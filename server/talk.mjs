/**
 * v0.3-draft: POST /v1/talk (SSE) — one sentence → tasks → per-task council stream.
 * Splitter: uses ../skills/rules/split.mjs if present (export splitText), else fallback below.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wantLine, sayLine, revisedLine } from "../skills/rules/lines.mjs";
import { proposeFollow } from "../skills/rules/follow.mjs";
import { bossAck, bossAsk, bossLine, bossRefuse } from "../skills/rules/boss.mjs";
import { polishSay, polishBoss, llmStatus } from "./llm.mjs";
import { loadSnapshot, mergeState } from "./health.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SPLIT_PATH = path.join(DIR, "../skills/rules/split.mjs");

const ICON = { fitness: "dumbbell", diet: "bowl", recovery: "moon", ledger: "wallet" };
const NAME = { fitness: "健身教练", diet: "饮食顾问", recovery: "作息/恢复管家", ledger: "记账秘书" };
const KW = [
  ["fitness", /练|跑|健身|运动|累|锻炼/],
  ["diet", /吃|冰箱|饭|做啥|晚餐|午餐/],
  ["recovery", /睡|熬夜|作息|休息/],
  ["ledger", /钱|预算|花|记账|省/],
];
const FORBID = /诊断|药|减重|减肥\d|炒股|理财|投资|贷款/;
const META_ACK = /产品|技术|研发|工程师|开会/;
const CLARIFY_Q = "能再说具体一点吗？今晚是想睡觉、动一动，还是吃点啥？";
function sanitizeBossLine(line, fallback) {
  const s = String(line || "").trim();
  if (!s || META_ACK.test(s)) return fallback;
  return s;
}


function fallbackSplit(text) {
  const segs = text.split(/然后|顺便|还有|另外|，|,|。|；|;/).map((s) => s.trim()).filter(Boolean);
  const tasks = [];
  for (const s of segs) {
    if (s.length <= 2 && !/睡|练|吃|跑/.test(s)) continue; // drop tiny junk like「你办」
    if (FORBID.test(s) || /产品|技术|研发/.test(s)) {
      const kind = FORBID.test(s) ? "forbidden" : "off_health";
      tasks.push({ intent: "refuse", title: s, reason: bossRefuse(kind), kind });
      continue;
    }
    const hit = KW.find(([, re]) => re.test(s));
    tasks.push(hit ? { intent: hit[0], title: s } : { intent: "unknown", title: s });
  }
  return tasks.length ? tasks : [{ intent: "unknown", title: String(text).trim() || "（空）" }];
}

async function getSplitter() {
  if (fs.existsSync(SPLIT_PATH)) {
    try {
      const m = await import(SPLIT_PATH + "?t=" + fs.statSync(SPLIT_PATH).mtimeMs);
      if (typeof m.splitText === "function") return m.splitText;
    } catch (e) { console.error("split.mjs load failed, fallback:", e.message); }
  }
  return fallbackSplit;
}


function taskHeadline(intent, card, st) {
  const h = (r) => card?.handoffs.find((x) => x.role === r)?.action || "";
  if (intent === "fitness") {
    const a = h("fitness");
    const m = Number((a.match(/(\d+)\s*分钟/) || [])[1]);
    return `今晚只做${Number.isFinite(m) ? m : ""}分钟${/低冲击|拉伸|踏步/.test(a) ? "低冲击" : "训练"}`;
  }
  if (intent === "diet") return /蛋炒饭/.test(h("diet")) ? "冰箱蛋米，一碗蛋炒饭" : "用冰箱现有食材吃一顿";
  if (intent === "ledger") { const left = Number(st.budget_left); return Number.isFinite(left) ? `这顿0元，本周还剩${left}` : "先报本周剩余预算"; }
  if (intent === "recovery") return "今晚早点进房";
  return card?.headline || "";
}

const sessions = new Map(); // id -> {events:[], cancelled, pendingAsk:{ask_id, resolve}}

export function getSession(id) { return sessions.get(id); }

export function cancelSession(id) {
  const s = sessions.get(id);
  if (!s) return false;
  s.cancelled = true;
  s.pendingAsk?.resolve(null);
  return true;
}

export function replySession(id, ask_id, text) {
  const s = sessions.get(id);
  if (!s?.pendingAsk || s.pendingAsk.ask_id !== ask_id) return false;
  s.pendingAsk.resolve(String(text || ""));
  return true;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param res  http response (SSE)
 * @param body {text, state?, session_id?}
 * @param deps {council}  council(body,{dryRun}) → card
 */
export async function runTalk(res, body, deps) {
  const session_id = body.session_id || randomUUID();
  const s = { events: [], cancelled: false, seq: 0 };
  sessions.set(session_id, s);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  let closed = false;
  res.on("close", () => { closed = true; s.cancelled = true; s.pendingAsk?.resolve(null); });

  const pace = Number(body.pace_ms ?? 120);
  const emit = (event, data) => {
    if (closed) return;
    const ev = { session_id, seq: ++s.seq, ts: new Date().toISOString(), ...data };
    s.events.push({ event, data: ev });
    res.write(`event: ${event}\ndata: ${JSON.stringify(ev)}\n\n`);
  };
  const stop = () => {
    if (s.cancelled && !s.sentCancel) { s.sentCancel = true; emit("cancelled", { reason: "user" }); res.end(); }
    return s.cancelled;
  };

  const text = String(body.text || "").trim();
  emit("session.start", { text });
  if (!text) { emit("error", { code: "BAD_INPUT", message: "text required" }); emit("done", { tasks_ok: 0, tasks_failed: 0 }); return res.end(); }

  const split = await getSplitter();
  const raw = split(text).map((t) => ({ task_id: randomUUID().slice(0, 8), ...t }));
  emit("intent.split", { tasks: raw.map(({ task_id, intent, title }) => ({ task_id, intent, title })) });
  const liveForAck = raw.filter((t) => ["fitness", "diet", "recovery", "ledger"].includes(t.intent));
  const ackRoles = [...new Set(liveForAck.flatMap((t) => (t.intent === "fitness" ? ["fitness", "recovery"] : [t.intent])))];
  {
    const draftAck = bossAck(ackRoles);
    let line = draftAck;
    let source = "rule";
    // Only polish when real specialists are joining — empty ack must not invent「产品/技术」.
    if (ackRoles.length) {
      const polished = await polishBoss({ kind: "ack", draft: draftAck, context: { roles: ackRoles } });
      line = sanitizeBossLine(polished.line, draftAck);
      source = line === draftAck ? "rule" : polished.source;
    }
    emit("boss.ack", { line, roles: ackRoles, speaker: "boss", source });
  }
  await sleep(pace);

  // state: client body.state > health snapshot > ask once (demo default on timeout/no answer)
  let state = mergeState(body.state, loadSnapshot());
  const needsCouncil = raw.some((t) => ["fitness", "diet", "recovery", "ledger"].includes(t.intent));
  if (needsCouncil && !(state && Number.isFinite(Number(state.sleep_hours)))) {
    const ask_id = randomUUID().slice(0, 8);
    emit("ask", { task_id: raw[0].task_id, ask_id, role: "recovery", speaker: "boss", question: bossAsk("sleep") });
    const answer = await new Promise((resolve) => {
      s.pendingAsk = { ask_id, resolve };
      setTimeout(() => resolve(null), Number(body.ask_timeout_ms ?? 8000));
    });
    s.pendingAsk = null;
    if (stop()) return;
    const sleepH = Number((answer || "").match(/(\d+(?:\.\d+)?)\s*(小时|h|个钟)/)?.[1]);
    const mins = Number((answer || "").match(/(\d+)\s*(分钟|min)/)?.[1]);
    state = {
      sleep_hours: Number.isFinite(sleepH) ? sleepH : 5,
      free_minutes: Number.isFinite(mins) ? mins : 40,
      fridge: ["egg", "rice"],
      _defaulted: !answer,
    };
  }

  if (needsCouncil && state) {
    if (!Array.isArray(state.fridge) || !state.fridge.length) state.fridge = ["egg", "rice"];
    if (!Number.isFinite(Number(state.free_minutes))) state.free_minutes = 40;
  }

  let card = null;
  if (needsCouncil) {
    const b = { ...state };
    if (raw.some((t) => t.intent === "ledger") && b.budget_left === undefined) b.budget_left = state.budget_left;
    try {
      card = deps.council(b, { dryRun: true, forceRoles: raw.map((t) => t.intent) });
    } catch (e) {
      emit("error", { code: "BAD_STATE", message: `状态字段不全或写错（${e.message}），按保守默认值继续` });
      state = { sleep_hours: 5, free_minutes: 40, fridge: ["egg", "rice"], budget_left: b.budget_left, _defaulted: true };
      try { card = deps.council({ ...state }, { dryRun: true, forceRoles: raw.map((t) => t.intent) }); }
      catch (e2) { emit("error", { code: "INTERNAL", message: String(e2.message || e2) }); emit("done", { tasks_ok: 0, tasks_failed: raw.length }); return res.end(); }
    }
  }

  let ok = 0, failed = 0;
  const rolesOf = (t) => (t.intent === "fitness" ? ["fitness", "recovery"] : [t.intent]);
  const live = raw.filter((t) => ["fitness", "diet", "recovery", "ledger"].includes(t.intent));
  // phase 1: every role.join first, so the split shows all droplets at once
  for (const t of live) for (const r of rolesOf(t)) emit("role.join", { task_id: t.task_id, role: r, name: NAME[r], icon: ICON[r] });
  await sleep(pace);
  for (const t of raw) {
    if (stop()) return;
    if (t.intent === "refuse") {
      const kind = t.kind === "forbidden" || /医疗|减重|投资|诊断|药|理财|贷款/.test(t.reason || t.title || "")
        ? "forbidden"
        : "off_health";
      const line = bossRefuse(kind);
      emit("refuse", {
        task_id: t.task_id,
        title: t.title,
        reason: t.reason || line,
        speaker: "boss",
        boss_line: line,
      });
      emit("task.done", { task_id: t.task_id, status: "failed" }); failed++; continue;
    }
    if (t.intent === "unknown") {
      emit("ask", {
        task_id: t.task_id,
        ask_id: randomUUID().slice(0, 8),
        role: "system",
        speaker: "boss",
        question: CLARIFY_Q,
      });
      emit("task.done", { task_id: t.task_id, status: "degraded" }); failed++; continue;
    }
    const roles = rolesOf(t);
    const lines = {};
    const taskVetoes = (card?.vetoes_applied || []).filter((v) => roles.includes(v.to) && roles.includes(v.from));
    const vetoTargets = new Set(taskVetoes.map((v) => v.to));
    const say = async (role, short, full, marked, source) => {
      const line_id = randomUUID().slice(0, 8);
      lines[role] = line_id;
      const chunks = short.match(/.{1,6}/gu) || [short];
      for (let i = 0; i < chunks.length; i++) {
        if (stop()) return null;
        const payload = { task_id: t.task_id, role, line_id, delta: chunks[i], done: i === chunks.length - 1, short };
        if (i === chunks.length - 1 && full) payload.full = full;
        if (marked) payload.phase = marked; // "want" | "revised"
        if (i === chunks.length - 1 && source) payload.source = source;
        emit("role.say", payload);
        await sleep(pace / 3);
      }
      return line_id;
    };
    // 1) 原主张（会被否决的角色先说「想要」版，避免划掉的就是结论）
    for (const r of roles) {
      if (!vetoTargets.has(r)) continue;
      const want = wantLine(r, state);
      if (!want) continue;
      const p = await polishSay({ role: r, phase: "want", draftShort: want.short, draftFull: want.full, state });
      await say(r, p.short, p.full || want.full, "want", p.source);
    }
    // 2) 其他角色正常说（含 recovery）
    for (const r of roles) {
      if (vetoTargets.has(r)) continue;
      const h = card?.handoffs.find((x) => x.role === r);
      if (!h) continue;
      const draft = sayLine(r, h.action, state);
      const p = await polishSay({ role: r, phase: "say", draftShort: draft, draftFull: h.action, state });
      await say(r, p.short, p.full || h.action, null, p.source);
    }
    // 3) 否决：划掉「想要」那一行
    for (const v of taskVetoes) {
      emit("veto", { task_id: t.task_id, from: v.from, to: v.to, line_id: lines[v.to] || null, reason: `${NAME[v.from]}拦了${NAME[v.to]}：${v.reason}` });
      await sleep(pace);
    }
    // 4) 被否决的角色再冒改过的一句（对齐卡片标题）
    for (const v of taskVetoes) {
      const h = card?.handoffs.find((x) => x.role === v.to);
      if (!h) continue;
      const draft = revisedLine(v.to, h.action, state);
      const p = await polishSay({ role: v.to, phase: "revised", draftShort: draft, draftFull: h.action, state });
      await say(v.to, p.short, p.full || h.action, "revised", p.source);
    }
    for (const a of card?.learned_applied || []) {
      if (roles.includes(a.role)) emit("habit.applied", { task_id: t.task_id, rule_id: a.id, text: `按你的习惯改了：${a.text}` });
    }
    const sub = card ? { ...card, headline: taskHeadline(t.intent, card, state), handoffs: card.handoffs.filter((h) => roles.includes(h.role)), vetoes_applied: card.vetoes_applied.filter((v) => roles.includes(v.to)) } : null;
    if (state?._defaulted && sub) { sub.defaulted = true; sub.disclaimer += "；用了默认值"; }
    if (sub) {
      sub.speaker = "boss";
      const draftLine = bossLine(sub.headline);
      const polished = await polishBoss({ kind: "line", draft: draftLine, context: { headline: sub.headline, intent: t.intent } });
      sub.boss_line = polished.line;
      sub.boss_line_source = polished.source;
    }
    emit("card.ready", { task_id: t.task_id, card: sub, speaker: "boss" });
    emit("task.done", { task_id: t.task_id, status: state?._defaulted ? "degraded" : "ok" });
    ok++;
    await sleep(pace);
  }
  if (stop()) return;
  if (ok > 0) {
    emit("follow.start", { status: "watching", hint: "跟进中", plan: "会后按睡眠/完成情况自动改下一版", speaker: "boss" });
    const follow = proposeFollow(state || {}, card || {});
    if (follow?.updates?.length) {
      for (const u of follow.updates) {
        const parts = String(u.text || "").split("→").map((s) => s.trim());
        emit("follow.update", {
          id: u.id || randomUUID().slice(0, 8),
          speaker: "boss",
          because: parts[0] || u.because,
          change: parts[1] || u.text,
          text: u.text,
          facts: u.facts || null,
          patch: u.patch || null,
          sources: ["council", "follow.mjs"],
        });
      }
    }
  }
  emit("done", { tasks_ok: ok, tasks_failed: failed });
  res.end();
  setTimeout(() => sessions.delete(session_id), 10 * 60 * 1000);
}
