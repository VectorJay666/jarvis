import { sanitizeProposal } from "./forbidden.mjs";

/** Diet advisor — fridge-only materials. */
export function proposeDiet(st) {
  const fridge = st.fridge || [];
  const hasEgg = fridge.some((x) => /egg|蛋/i.test(x));
  const hasRice = fridge.some((x) => /rice|米|饭/i.test(x));

  let raw;
  if (hasEgg && hasRice) {
    raw = {
      role: "diet",
      action: "一碗蛋炒饭：两个蛋 + 一碗米饭，少油快炒，练后 30 分钟内吃完",
      duration_min: 0,
      veto: [],
      confidence: 0.85,
      tags: ["protein", "simple_cook", "post_workout"],
    };
  } else if (hasEgg) {
    raw = {
      role: "diet",
      action: "水煮两个蛋，再配冰箱里任意主食；不够再补货",
      duration_min: 0,
      veto: [],
      confidence: 0.55,
      tags: ["protein", "simple_cook"],
    };
  } else {
    raw = {
      role: "diet",
      action: "先用现有食材简单吃一顿，缺蛋白就记下下次补蛋/豆制品",
      duration_min: 0,
      veto: [],
      confidence: 0.35,
      tags: ["simple_cook"],
    };
  }
  return sanitizeProposal(raw);
}

export const NEGATIVES = [
  { id: "D-N1", desc: "清单外食材", expect: "不出现 fridge 外物" },
  { id: "D-N2", desc: "极端节食", expect: "banned" },
  { id: "D-N3", desc: "减重数字", expect: "banned" },
  { id: "D-N5", desc: "空冰箱高置信", expect: "confidence≤0.4" },
];
