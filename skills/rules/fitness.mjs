import { sanitizeProposal } from "./forbidden.mjs";

/**
 * Fitness coach Skill — propose only. Arbitration stays on Backend.
 * Triggers: council needs a train slot; free_minutes + fatigue/sleep known.
 */
export function proposeFitness(st, habit = {}) {
  const sleepy =
    st.sleep_hours < 6 || st.fatigue === "high" || habit.prefer_low_impact;
  const budget = Math.max(0, (st.free_minutes ?? 40) - 10); // leave stretch room

  let raw;
  if (sleepy) {
    const mins = Math.min(20, budget || 20);
    raw = {
      role: "fitness",
      action: `做 ${mins} 分钟低冲击：徒手深蹲 ×3 组 + 靠墙静蹲 40 秒 ×2，动作慢，不喘粗气就停`,
      duration_min: mins,
      veto: [],
      confidence: 0.75,
      tags: ["low_impact", "bodyweight"],
    };
  } else {
    const mins = Math.min(30, budget || 30);
    raw = {
      role: "fitness",
      action: `做 ${mins} 分钟力量循环：俯卧撑、深蹲、平板支撑各 3 组`,
      duration_min: mins,
      veto: [],
      confidence: 0.7,
      tags: ["strength"],
    };
  }
  return sanitizeProposal(raw);
}

export const NEGATIVES = [
  { id: "F-N1", desc: "诊疗/药方话术", expect: "sanitize → null / drop" },
  { id: "F-N2", desc: "睡不够仍 HIIT/重训", expect: "sleepy 分支 low_impact" },
  { id: "F-N3", desc: "duration > free_minutes", expect: "裁到 budget" },
  { id: "F-N4", desc: "结果承诺", expect: "banned" },
];
