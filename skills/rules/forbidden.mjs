/** Shared negative-content gates for all role proposals. */
export const FORBIDDEN = [
  /诊断|处方|药方|用药|剂量|mg\b|伤病诊疗/i,
  /一周掉\s*\d+|减重\s*\d+\s*斤|保证瘦|必瘦/i,
  /清肠|只喝代餐|绝食|极端节食/i,
];

export function banned(text) {
  return FORBIDDEN.some((re) => re.test(text || ""));
}

/** Drop or refuse a proposal that violates hard negatives. */
export function sanitizeProposal(p) {
  if (!p || banned(p.action)) return null;
  if (p.confidence <= 0.4 && p.tags?.includes("strength")) {
    return {
      ...p,
      action: "证据不足：今晚改成 15 分钟散步或拉伸，不硬推力量",
      duration_min: Math.min(p.duration_min || 15, 15),
      confidence: Math.min(p.confidence, 0.4),
      tags: ["low_impact", "conservative"],
    };
  }
  return p;
}

/** Ledger-specific: no investing / lending / wealth advice. */
export const LEDGER_FORBIDDEN = [/炒股|股票|基金|理财|投资|借贷|贷款|信用卡套现|网贷|加杠杆/];
export function ledgerBanned(text) {
  return banned(text) || LEDGER_FORBIDDEN.some((re) => re.test(text || ""));
}
