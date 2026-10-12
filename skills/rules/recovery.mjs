import { sanitizeProposal } from "./forbidden.mjs";

/** Recovery steward — owns sleep-debt veto on fitness. */
export function proposeRecovery(st) {
  const sleepy = st.sleep_hours < 6 || st.fatigue === "high";
  const stretch = 10;
  const trainBudget = Math.max(0, (st.free_minutes ?? 40) - stretch);
  const veto = sleepy
    ? [
        {
          role: "fitness",
          reason: `昨晚只睡 ${st.sleep_hours} 小时，今晚禁止加练，改为低冲击或拉伸`,
        },
      ]
    : [];

  const raw = {
    role: "recovery",
    action: `训练后拉伸 ${stretch} 分钟；今晚 23:00 前进房，争取睡满 7 小时（窗口 23:00–06:30）`,
    duration_min: stretch,
    veto,
    confidence: 0.9,
    tags: ["sleep_window", "stretch"],
    _train_budget: trainBudget,
    _sleep_window: "23:00-06:30",
  };
  return sanitizeProposal(raw);
}

export const NEGATIVES = [
  { id: "R-N1", desc: "药方/剂量", expect: "banned" },
  { id: "R-N2", desc: "睡眠债不否决 fitness", expect: "veto 必含 fitness" },
  { id: "R-N3", desc: "挤掉入睡窗口", expect: "保 stretch + sleep_window" },
];
