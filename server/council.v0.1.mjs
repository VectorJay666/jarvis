#!/usr/bin/env node
/**
 * Jarvis council stub — POST /v1/council, /v1/feedback, GET /v1/habit, /health
 * Port 9301. Rule-based proposals + deterministic arbitration (skeleton §4).
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { proposeFitness, proposeDiet, proposeRecovery, banned } from "../skills/rules/index.mjs";

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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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
  const handoffs = order
    .filter((r) => by[r])
    .map((r) => ({ role: r, action: by[r].action }));

  const headlines = {
    fitness: "今晚练轻一点，吃顺口的，早点睡",
    diet: "先把这一顿吃对，训练配合恢复",
    recovery: "睡眠债优先：短训 + 简餐 + 钉死入睡窗口",
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

function council(body) {
  const st = normalize(body);
  const habit = loadHabit();
  const proposals = [
    proposeFitness(st, habit),
    proposeDiet(st),
    proposeRecovery(st),
  ].filter((p) => p && !banned(p.action));
  return arbitrate(proposals, st, habit);
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, service: "jarvis-council", version: "0.1.0" });
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
      if (rating === "too_hard" || /太累|改轻|太难/.test(note)) {
        habit.prefer_low_impact = true;
      }
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
      cors(res);
      res.writeHead(204);
      return res.end();
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
