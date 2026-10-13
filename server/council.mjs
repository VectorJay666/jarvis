#!/usr/bin/env node
/**
 * Jarvis council stub — POST /v1/council, /v1/feedback, GET /v1/habit, /health
 * Port 9301. Rule-based proposals + deterministic arbitration (skeleton §4).
 */
import http from "node:http";
import { recoveryStatus, runRecovery } from "./recovery.mjs";
import { runAssistant } from "./assistant.mjs";
import { streamResponse } from "./recoveryTransport.mjs";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proposeFitness, proposeDiet, proposeRecovery, banned } from "../skills/rules/index.mjs";
import { runTalk, getSession, cancelSession, replySession } from "./talk.mjs";
import { loadEnv, llmStatus } from "./llm.mjs";
import { loadSnapshot, saveSnapshot, clearSnapshot, mergeState } from "./health.mjs";
import { pickNudge, NUDGE_ACTION } from "./nudge.mjs";
import { rankActions, greet } from "../skills/rules/home.mjs";
const HOME_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "home_habit.json");
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
function loadHome() {
  let h; try { h = JSON.parse(fs.readFileSync(HOME_PATH, "utf8")); } catch { h = {}; }
  h.taps ||= {}; h.hour_taps ||= {};
  if (h.day !== today()) { h.day = today(); h.dismissed_today = []; h.dismissed_nudges = []; }
  h.dismissed_today ||= []; h.dismissed_nudges ||= [];
  return h;
}
function saveHome(h) { fs.writeFileSync(HOME_PATH, JSON.stringify(h, null, 2)); }
function homePayload(now = new Date()) {
  const h = loadHome(); const snap = loadSnapshot();
  const nudge = pickNudge(snap, new Set(h.dismissed_nudges));
  let actions = rankActions(h, snap || {}, now);
  if (nudge?.action_id) actions = actions.map((a) => (a.id === nudge.action_id ? { ...a, why: null } : a));
  const greeting = greet(now, snap || {}, Boolean(nudge));
  return { greet: greeting, nudge, actions, habit_day: h.day };
}
loadEnv();
import { proposeLedger as proposeRecruitedLedger } from "../skills/rules/ledger.mjs";
const proposeRecruitedForce = (st) => [proposeRecruitedLedger(st)].filter(Boolean);
import { listRoles, recruit, fireRole, proposeRecruited, consumeNewFlags, ensureRules, learnFromFeedback, revokeRule, applyRules, rulesByRole } from "./v02.mjs";

const PORT = Number(process.env.PORT || 9301);
const HOST = process.env.HOST || "0.0.0.0";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HABIT_PATH = path.join(__dirname, "habit.json");

function loadHabit() {
  try {
    return JSON.parse(fs.readFileSync(HABIT_PATH, "utf8"));
  } catch {
    return {
      prefer_low_impact: false,
      meal_likes: [],
      meal_dislikes: [],
      usual_sleep_target: null,
      last_card_id: null,
      last_feedback: null,
    };
  }
}

function saveHabit(h) {
  fs.writeFileSync(HABIT_PATH, JSON.stringify(h, null, 2));
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, code, body) {
  cors(res);
  const s = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(s);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function normalize(body) {
  const sleep = Number(body.sleep_hours);
  const free = Number(body.free_minutes);
  const fridge = Array.isArray(body.fridge)
    ? body.fridge.map((x) => String(x).toLowerCase())
    : [];
  if (!Number.isFinite(sleep) || !Number.isFinite(free) || fridge.length === 0) {
    const err = new Error("sleep_hours, free_minutes, fridge required");
    err.code = "BAD_INPUT";
    throw err;
  }
  let fatigue = body.fatigue;
  if (!fatigue) fatigue = sleep < 6 ? "high" : sleep < 7 ? "mid" : "low";
  const active =
    ["fitness", "diet", "recovery", "schedule", "focus"].includes(body.active_role)
      ? body.active_role
      : null;
  return { sleep_hours: sleep, free_minutes: free, fridge, fatigue, active_role: active };
}

function arbitrate(proposals, st, habit) {
  const by = Object.fromEntries(proposals.map((p) => [p.role, { ...p }]));
  const vetoes_applied = [];

  // drop banned
  for (const role of Object.keys(by)) {
    if (banned(by[role].action)) {
      delete by[role];
    }
  }

  const recovery = by.recovery;
  const fitness = by.fitness;

  // 1) recovery veto on fitness
  if (recovery?.veto?.length && fitness) {
    for (const v of recovery.veto) {
      if (v.role === "fitness") {
        vetoes_applied.push({ from: "recovery", to: "fitness", reason: v.reason });
        by.fitness = {
          ...fitness,
          action:
            "改成 15 分钟低冲击：开合跳放慢版 ×2 组 + 全身拉伸，心率不冲",
          duration_min: 15,
          tags: ["low_impact", "stretch"],
          confidence: Math.min(fitness.confidence, 0.7),
        };
      }
    }
  }

  // 2) time trim: fitness + recovery stretch ≤ free
  const fit = by.fitness;
  const rec = by.recovery;
  if (fit && rec) {
    const total = (fit.duration_min || 0) + (rec.duration_min || 0);
    if (total > st.free_minutes) {
      const budget = Math.max(5, st.free_minutes - (rec.duration_min || 0));
      by.fitness = {
        ...fit,
        duration_min: budget,
        action: `压缩到 ${budget} 分钟低冲击徒手：深蹲+靠墙静蹲，留时间给拉伸与入睡`,
        tags: Array.from(new Set([...(fit.tags || []), "low_impact", "time_trimmed"])),
      };
      vetoes_applied.push({
        from: "recovery",
        to: "fitness",
        reason: `总时长超 ${st.free_minutes} 分钟，优先保留恢复窗口`,
      });
    }
  }

  // 3) fridge check already in diet propose; double-check action ingredients
  if (by.diet) {
    const a = by.diet.action;
    if (/三文鱼|外卖|鸡胸|牛排/.test(a) && !st.fridge.some((x) => /salmon|chicken|beef|三文鱼|鸡|牛/.test(x))) {
      by.diet = proposeDiet(st); // re-fallback
      vetoes_applied.push({
        from: "diet",
        to: "diet",
        reason: "食材不在冰箱，已降级为现有食材方案",
      });
    }
  }

  // 4) confidence degrade
  let disclaimer = "非医疗建议；不承诺减重效果";
  const low = Object.values(by).some((p) => p.confidence <= 0.4);
  if (low) {
    disclaimer += "；证据不足，已改为保守方案";
  }

  const lead =
    st.active_role && by[st.active_role]
      ? st.active_role
      : by.recovery && (st.sleep_hours < 6 || st.fatigue === "high")
        ? "recovery"
        : by.fitness
          ? "fitness"
          : Object.keys(by)[0] || "recovery";

  const order = ["fitness", "diet", "recovery"];
  const extra = Object.keys(by).filter((r) => !order.includes(r));
  const handoffs = [...order, ...extra]
    .filter((r) => by[r])
    .map((r) => ({ role: r, action: by[r].action }));

  const headlines = {
    fitness: "今晚练轻一点，吃顺口的，早点睡",
    diet: "先把这一顿吃对，训练配合恢复",
    recovery: "睡眠债优先：短训 + 简餐 + 钉死睡眠窗口",
  };

  return {
    card_id: randomUUID(),
    lead_role: lead,
    headline: headlines[lead] || "三角色已交接班",
    handoffs,
    sleep_window: by.recovery?._sleep_window || "23:00-06:30",
    vetoes_applied,
    disclaimer,
    placeholders: [
      { role: "schedule", status: "placeholder", reason: "需真实日历" },
      { role: "focus", status: "placeholder", reason: "与三角色耦合弱" },
    ],
  };
}

function council(body, opts = {}) {
  const st = normalize(body);
  if (body.budget_left !== undefined) st.budget_left = Number(body.budget_left);
  const habit = ensureRules(opts.habit || loadHabit());
  const proposals = [
    proposeFitness(st, habit),
    proposeDiet(st),
    proposeRecovery(st),
    ...proposeRecruited(st),
    ...((opts.forceRoles || []).includes("ledger") && !proposeRecruited(st).length ? proposeRecruitedForce(st) : []),
  ].filter((p) => p && !banned(p.action));
  const card = arbitrate(proposals, st, habit);
  // 会进化: apply learned rules on the final handoffs (after safety arbitration)
  const applied = applyRules(card.handoffs, habit);
  card.handoffs = card.handoffs.filter((h) => !banned(h.action));
  card.learned_applied = applied.map((r) => ({ id: r.id, role: r.role, text: r.text, because: r.because }));
  if (!opts.dryRun) {
    const fresh = consumeNewFlags(card.handoffs.map((h) => h.role));
    card.handoffs = card.handoffs.map((h) => ({ ...h, is_new: fresh.has(h.role) }));
  } else {
    card.handoffs = card.handoffs.map((h) => ({ ...h, is_new: false }));
  }
  card.contract_version = "0.2";
  return card;
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "POST" && ['/v1/recovery/stream', '/v1/assistant/stream'].includes(url.pathname)) {
      const body = await readBody(req);
      const runner = url.pathname === '/v1/assistant/stream' ? runAssistant : runRecovery;
      return streamResponse(req, res, options => runner(body, undefined, undefined, options));
    }
    if (req.method === "GET" && url.pathname === "/v1/recovery/status") {
      return json(res, 200, recoveryStatus());
    }
    if (req.method === "POST" && url.pathname === "/v1/recovery/talk") {
      try { return json(res, 200, await runRecovery(await readBody(req))); }
      catch (e) { return json(res, e.status || 400, { error: "RECOVERY_ERROR", message: e.message }); }
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "jarvis-council", version: "0.3.0", llm: llmStatus() });
    }
    if (req.method === "GET" && url.pathname === "/v1/habit") {
      return json(res, 200, loadHabit());
    }
    if (req.method === "POST" && url.pathname === "/v1/council") {
      const body = await readBody(req);
      const card = council(body);
      const habit = loadHabit();
      habit.last_card_id = card.card_id;
      saveHabit(habit);
      return json(res, 200, card);
    }
    if (req.method === "POST" && url.pathname === "/v1/talk") {
      return runTalk(res, await readBody(req), { council }).catch((e) => {
        try { res.write(`event: error\ndata: ${JSON.stringify({ code: "INTERNAL", message: String(e.message || e) })}\n\n`); res.end(); } catch {}
      });
    }
    let m;
    if (req.method === "POST" && (m = url.pathname.match(/^\/v1\/talk\/([^/]+)\/cancel$/))) {
      return cancelSession(m[1]) ? json(res, 200, { ok: true }) : json(res, 404, { error: "NOT_FOUND" });
    }
    if (req.method === "POST" && (m = url.pathname.match(/^\/v1\/talk\/([^/]+)\/reply$/))) {
      const b = await readBody(req);
      return replySession(m[1], b.ask_id, b.text) ? json(res, 200, { ok: true }) : json(res, 409, { error: "NO_PENDING_ASK" });
    }
    if (req.method === "GET" && (m = url.pathname.match(/^\/v1\/talk\/([^/]+)\/events$/))) {
      const s = getSession(m[1]);
      if (!s) return json(res, 404, { error: "NOT_FOUND" });
      const after = Number(url.searchParams.get("after_seq") || 0);
      return json(res, 200, { events: s.events.filter((e) => e.data.seq > after) });
    }
    if (req.method === "GET" && url.pathname === "/v1/nudge") {
      return json(res, 200, { nudge: homePayload().nudge });
    }
    if (req.method === "POST" && url.pathname === "/v1/nudge/dismiss") {
      const b = await readBody(req);
      const h = loadHome();
      if (b.id) {
        h.dismissed_nudges = [...new Set([...h.dismissed_nudges, String(b.id)])];
        const a = NUDGE_ACTION[b.id];
        if (a) h.dismissed_today = [...new Set([...h.dismissed_today, a])];
        saveHome(h);
      }
      return json(res, 200, { ok: true, ...homePayload() });
    }
    if (req.method === "GET" && url.pathname === "/v1/home") {
      return json(res, 200, homePayload());
    }
    if (req.method === "POST" && url.pathname === "/v1/home/tap") {
      const b = await readBody(req);
      if (!b.action_id) return json(res, 400, { error: "BAD_INPUT", message: "action_id required" });
      const h = loadHome(); const id = String(b.action_id);
      const hr = String(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai", hour: "numeric", hour12: false }) % 24);
      h.taps[id] = (h.taps[id] || 0) + 1;
      h.hour_taps[id] ||= {}; h.hour_taps[id][hr] = (h.hour_taps[id][hr] || 0) + 1;
      saveHome(h);
      return json(res, 200, { ok: true, ...homePayload() });
    }
    if (req.method === "GET" && url.pathname === "/v1/health/snapshot") {
      const snap = loadSnapshot();
      return json(res, 200, { snapshot: snap, ok: true });
    }
    if (req.method === "POST" && url.pathname === "/v1/health/snapshot") {
      const body = await readBody(req);
      const snap = saveSnapshot(body);
      return json(res, 200, { ok: true, snapshot: snap });
    }
    if (req.method === "POST" && url.pathname === "/v1/demo/reset") {
      for (const f of ["habit.json", "roles.json", "health.json"]) { try { fs.unlinkSync(path.join(__dirname, f)); } catch {} }
      clearSnapshot();
      try { fs.unlinkSync(HOME_PATH); } catch {}
      return json(res, 200, { ok: true, roles: listRoles().map((r) => r.id), rules: 0, health: null });
    }
    if (req.method === "GET" && url.pathname === "/v1/roles") {
      const counts = rulesByRole(loadHabit());
      return json(res, 200, { roles: listRoles().map((r) => ({ ...r, learned_count: counts[r.id] || 0 })) });
    }
    if (req.method === "POST" && url.pathname === "/v1/roles") {
      const out = recruit(await readBody(req));
      return json(res, out.code, out.body);
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/v1/roles/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      return fireRole(id) ? (cors(res), res.writeHead(204), res.end()) : json(res, 404, { error: "NOT_FOUND" });
    }
    if (req.method === "GET" && url.pathname === "/v1/habit/rules") {
      return json(res, 200, { rules: ensureRules(loadHabit()).rules });
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/v1/habit/rules/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const habit = loadHabit();
      if (!revokeRule(habit, id)) return json(res, 404, { error: "NOT_FOUND" });
      saveHabit(habit);
      cors(res); res.writeHead(204); return res.end();
    }
    if (req.method === "POST" && url.pathname === "/v1/council/compare") {
      const body = await readBody(req);
      const habit = ensureRules(loadHabit());
      const before = council(body, { habit: { ...habit, rules: [], prefer_low_impact: false }, dryRun: true });
      const after = council(body, { habit: JSON.parse(JSON.stringify(habit)), dryRun: true });
      return json(res, 200, { before, after, rules: habit.rules });
    }
    if (req.method === "POST" && url.pathname === "/v1/feedback") {
      const body = await readBody(req);
      if (!body.card_id) {
        return json(res, 400, { error: "BAD_INPUT", message: "card_id required" });
      }
      const habit = loadHabit();
      habit.last_card_id = body.card_id;
      habit.last_feedback = {
        rating: body.rating ?? null,
        note: body.note ?? null,
        at: new Date().toISOString(),
      };
      const note = String(body.note || "");
      const rating = body.rating;
      const learned = learnFromFeedback(habit, { role: body.role, note, rating });
      if (/好吃|喜欢/.test(note)) {
        habit.meal_likes = Array.from(new Set([...(habit.meal_likes || []), note]));
      }
      if (/不好吃|不喜欢|难吃/.test(note)) {
        habit.meal_dislikes = Array.from(new Set([...(habit.meal_dislikes || []), note]));
      }
      if (/入睡|睡觉|23:/.test(note)) {
        habit.usual_sleep_target = habit.usual_sleep_target || "23:00-06:30";
      }
      saveHabit(habit);
      return json(res, 200, { learned });
    }
    json(res, 404, { error: "NOT_FOUND" });
  } catch (e) {
    if (e.code === "BAD_INPUT") {
      return json(res, 400, { error: "BAD_INPUT", message: e.message });
    }
    json(res, 500, { error: "INTERNAL", message: String(e.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`jarvis-council listening on http://${HOST}:${PORT}`);
});

process.on("uncaughtException", (e) => console.error("uncaught:", e));
process.on("unhandledRejection", (e) => console.error("unhandled:", e));
