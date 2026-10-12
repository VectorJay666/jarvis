/**
 * v0.2 layer: role registry (扩编) + habit rules (会进化, visible & revocable).
 * Arbitration safety stays deterministic in council.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { proposeLedger } from "../skills/rules/ledger.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROLES_PATH = path.join(DIR, "roles.json");

export const CORE_ROLES = [
  { id: "fitness", name: "健身教练", duty: "按疲劳与可用时间改训练", not_do: "不做伤病诊疗、不承诺练出效果", core: true, votes: true },
  { id: "diet", name: "饮食顾问", duty: "用冰箱现有食材安排下一餐", not_do: "不做营养处方、不承诺减重数字", core: true, votes: true },
  { id: "recovery", name: "作息/恢复管家", duty: "用睡眠与恢复窗口卡训练强度", not_do: "不开药方、不做睡眠障碍诊断", core: true, votes: true },
  { id: "schedule", name: "日程秘书", duty: "把建议塞进真实空档", not_do: "未接日历前不出建议", core: true, votes: false, status: "placeholder" },
  { id: "focus", name: "专注教练", duty: "短专注块与打断恢复", not_do: "二期再做", core: true, votes: false, status: "placeholder" },
];

// Templates the recruiter can map a one-line need to. Unknown needs → 400, no free-form role invention.
const TEMPLATES = [
  {
    match: /钱|预算|记账|花销|开销|省钱/,
    role: { id: "ledger", name: "记账秘书", duty: "盯本周剩余预算，给这一顿/这一周的花钱上限", not_do: "不做投资、理财、借贷建议" },
    state_fields: [{ key: "budget_left", label: "本周剩余预算（元）", type: "number" }],
  },
];

const FORBIDDEN_ROLE = /医生|诊断|药|减肥|减重|投资|炒股|理财|贷款/;

function loadRoles() {
  try { return JSON.parse(fs.readFileSync(ROLES_PATH, "utf8")); } catch { return { recruited: [] }; }
}
function saveRoles(r) { fs.writeFileSync(ROLES_PATH, JSON.stringify(r, null, 2)); }

export function listRoles() {
  const { recruited } = loadRoles();
  return [...CORE_ROLES, ...recruited];
}

export function recruit({ need, confirm }) {
  const text = String(need || "").trim();
  if (!text) return { code: 400, body: { error: "BAD_INPUT", message: "need required" } };
  if (FORBIDDEN_ROLE.test(text)) {
    return { code: 422, body: { error: "ROLE_OUT_OF_SCOPE", message: "医疗、减重、投资类秘书不招" } };
  }
  const tpl = TEMPLATES.find((t) => t.match.test(text));
  if (!tpl) return { code: 422, body: { error: "NO_TEMPLATE", message: "暂时招不到这类秘书" } };
  const preview = { ...tpl.role, core: false, votes: true, state_fields: tpl.state_fields, from_need: text };
  if (!confirm) return { code: 200, body: { preview, confirmed: false } };
  const roles = loadRoles();
  if (!roles.recruited.some((r) => r.id === preview.id)) {
    roles.recruited.push({ ...preview, hired_at: new Date().toISOString(), shown_on_card: false });
    saveRoles(roles);
  }
  return { code: 201, body: { role: roles.recruited.find((r) => r.id === preview.id), confirmed: true } };
}

export function fireRole(id) {
  const roles = loadRoles();
  const before = roles.recruited.length;
  roles.recruited = roles.recruited.filter((r) => r.id !== id);
  saveRoles(roles);
  return before !== roles.recruited.length;
}

/** Recruited-role proposals (rule-based; Skills may replace later). */
export function proposeRecruited(st) {
  const { recruited } = loadRoles();
  const out = [];
  for (const r of recruited) {
    if (r.id === "ledger") {
      const p = proposeLedger(st);
      if (p) out.push(p);
    }
  }
  return out;
}

/** Mark first appearance on card, then persist. */
export function consumeNewFlags(roleIds) {
  const roles = loadRoles();
  const fresh = new Set();
  for (const r of roles.recruited) {
    if (roleIds.includes(r.id) && !r.shown_on_card) { fresh.add(r.id); r.shown_on_card = true; }
  }
  if (fresh.size) saveRoles(roles);
  return fresh;
}

// ---------- habit rules ----------
const LEARNERS = [
  {
    match: /膝盖|膝|脚踝|关节|跳不了|不能跳/,
    rule: { role: "fitness", key: "avoid_jump", text: "避开跳跃类动作" },
  },
  {
    match: /太累|改轻|太难|练不动/,
    rule: { role: "fitness", key: "prefer_low_impact", text: "默认低冲击" },
  },
  {
    match: /不喜欢吃蛋|不吃蛋|蛋吃腻/,
    rule: { role: "diet", key: "avoid_egg", text: "少安排鸡蛋" },
  },
];

export function ensureRules(habit) {
  if (!Array.isArray(habit.rules)) habit.rules = [];
  // migrate v0.1 boolean
  if (habit.prefer_low_impact && !habit.rules.some((r) => r.key === "prefer_low_impact")) {
    habit.rules.push({ id: randomUUID(), role: "fitness", key: "prefer_low_impact", text: "默认低冲击", because: "（v0.1 迁移）", learned_at: new Date().toISOString() });
  }
  return habit;
}

export function learnFromFeedback(habit, { role, note, rating }) {
  ensureRules(habit);
  const text = String(note || "") + (rating === "too_hard" ? " 太累" : "");
  const learned = [];
  for (const l of LEARNERS) {
    if (!l.match.test(text)) continue;
    if (role && l.rule.role !== role && role !== "card") continue;
    if (habit.rules.some((r) => r.key === l.rule.key)) continue;
    const rule = { id: randomUUID(), ...l.rule, because: `因为你上次说「${String(note || "太累了").slice(0, 40)}」`, learned_at: new Date().toISOString() };
    habit.rules.push(rule);
    learned.push(rule);
  }
  habit.prefer_low_impact = habit.rules.some((r) => r.key === "prefer_low_impact");
  return learned;
}

export function revokeRule(habit, id) {
  ensureRules(habit);
  const before = habit.rules.length;
  habit.rules = habit.rules.filter((r) => r.id !== id);
  habit.prefer_low_impact = habit.rules.some((r) => r.key === "prefer_low_impact");
  return before !== habit.rules.length;
}

/** Apply learned rules to proposals; return list of rules that changed something. */
export function applyRules(proposals, habit) {
  ensureRules(habit);
  const applied = [];
  for (const p of proposals) {
    for (const r of habit.rules.filter((x) => x.role === p.role)) {
      if (r.key === "avoid_jump" && /跳/.test(p.action)) {
        p.action = p.action.replace(/开合跳放慢版/g, "原地踏步").replace(/[^，；：、+]*跳[^，；：、+]*/g, "靠墙静蹲");
        p.tags = Array.from(new Set([...(p.tags || []), "no_jump"]));
        applied.push(r);
      } else if (r.key === "avoid_jump") {
        p.tags = Array.from(new Set([...(p.tags || []), "no_jump"]));
      }
      if (r.key === "avoid_egg" && /蛋/.test(p.action)) {
        p.action = p.action.replace(/两个蛋 \+ /, "").replace(/蛋炒饭/, "米饭配冰箱里的菜");
        applied.push(r);
      }
    }
  }
  return applied;
}

export function rulesByRole(habit) {
  ensureRules(habit);
  const m = {};
  for (const r of habit.rules) m[r.role] = (m[r.role] || 0) + 1;
  return m;
}
