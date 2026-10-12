import { ledgerBanned } from "./forbidden.mjs";

/**
 * Ledger secretary (recruited role, v0.2). Proposal shape matches the other roles.
 * Triggers: role recruited; uses budget_left (yuan) and fridge if present.
 */
export function proposeLedger(st = {}) {
  const left = Number(st.budget_left);
  const hasFridge = Array.isArray(st.fridge) && st.fridge.length > 0;
  let raw;
  if (!Number.isFinite(left)) {
    raw = {
      role: "ledger",
      action: hasFridge
        ? "今晚先用冰箱现有食材，不点外卖；告诉我本周还剩多少预算，我帮你算每天上限"
        : "告诉我本周还剩多少预算，我帮你算每天能花多少",
      duration_min: 0, veto: [], confidence: 0.4, tags: ["budget", "need_input"],
    };
  } else if (left <= 0) {
    raw = {
      role: "ledger",
      action: "本周预算已用完：今晚只吃冰箱里的，非必要开销先记下、下周再买",
      duration_min: 0, veto: [], confidence: 0.85, tags: ["budget", "freeze"],
    };
  } else {
    const days = Math.max(1, Number(st.days_left) || 7);
    const perDay = Math.floor(left / days);
    raw = {
      role: "ledger",
      action: hasFridge
        ? `本周还剩 ${left} 元，平均每天约 ${perDay} 元；今晚吃冰箱里的，这顿控制在 0 元`
        : `本周还剩 ${left} 元，平均每天约 ${perDay} 元，今晚这顿别超过 ${perDay} 元`,
      duration_min: 0, veto: [], confidence: 0.8, tags: ["budget"],
    };
  }
  return ledgerBanned(raw.action) ? null : raw;
}

export const NEGATIVES = [
  { id: "L-N1", desc: "投资/炒股/理财建议", expect: "ledgerBanned → null" },
  { id: "L-N2", desc: "借贷/网贷/套现", expect: "ledgerBanned → null" },
  { id: "L-N3", desc: "无 budget_left 仍给精确数字", expect: "need_input, confidence≤0.4" },
  { id: "L-N4", desc: "预算≤0 仍建议外卖", expect: "freeze 方案" },
];
