/**
 * Single-agent home (v0.3): habit-ranked action buttons + nudge copy.
 * Deterministic. Every rank carries a human-readable `why` so Frontend can explain ordering.
 */

export const ACTIONS = {
  train:  { id: "train",  label: "今晚练什么",   icon: "barbell" },
  dinner: { id: "dinner", label: "冰箱做晚饭",   icon: "restaurant" },
  sleep:  { id: "sleep",  label: "看睡眠",       icon: "moon" },
  walk:   { id: "walk",   label: "出去走走",     icon: "walk" },
  budget: { id: "budget", label: "这周还能花多少", icon: "wallet" },
};

/**
 * habit: { taps: {actionId: count}, hour_taps: {actionId: {hour: count}}, dismissed_today: [actionId] }
 * snap:  health snapshot (sleep_hours, steps, meals_today, training_done, budget_left)
 * now:   Date (local)
 * returns [{...action, score, why}] length 3..5
 */
export function rankActions(habit = {}, snap = {}, now = new Date()) {
  const h = now.getHours();
  const taps = habit.taps || {};
  const hourTaps = habit.hour_taps || {};
  const dismissed = new Set(habit.dismissed_today || []);
  const sleep = Number(snap.sleep_hours);
  const steps = Number(snap.steps);
  const meals = Number(snap.meals_today);

  const rows = Object.values(ACTIONS).map((a) => {
    let score = 0;
    const why = [];
    const n = Number(taps[a.id]) || 0;
    const habitWhy = [];
    if (n) { score += Math.min(n, 10) * 2; habitWhy.push(`你常点（${n} 次）`); }
    const nh = Number(hourTaps[a.id]?.[h]) || 0;
    if (nh) { score += Math.min(nh, 5) * 3; habitWhy.unshift(`这个时段常用`); }

    if (a.id === "sleep" && Number.isFinite(sleep) && sleep < 6) { score += h >= 16 ? 6 : 16; why.push(`昨晚只睡 ${sleep} 小时`); }
    if (a.id === "train" && snap.training_done !== true && h >= 17) { score += 6; why.push("今天还没练"); }
    if (a.id === "train" && Number.isFinite(sleep) && sleep < 6) { score -= 4; }
    if (a.id === "dinner" && h >= 16 && h <= 21) { score += 8; why.push("快到饭点"); }
    if (a.id === "dinner" && Number.isFinite(meals) && meals === 0) { score += 6; why.push("今天还没记饮食"); }
    if (a.id === "walk" && Number.isFinite(steps) && steps < 3000) { score += 7; why.push(`今天才 ${Math.floor(steps)} 步`); }
    if (a.id === "budget" && !Number.isFinite(Number(snap.budget_left)) && !n) { score -= 6; }
    if (dismissed.has(a.id)) { score -= 20; why.push("今天点过不用"); }

    return { ...a, score, why: why[0] || habitWhy[0] || null };
  });

  rows.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
  const top = rows.filter((r) => r.score > -10).slice(0, 5);
  return top.length >= 3 ? top : rows.slice(0, 3);
}

/** Home nudge — ≤18 Chinese chars; number lives in facts / left big digit — don't repeat. */
export function nudgeLine(kind, facts = {}) {
  switch (kind) {
    case "sleep_low":
      return "今晚训练已调轻";
    case "no_meal":
      return "今天还没记饮食，先看冰箱";
    case "steps_low":
      return "饭后走 10 分钟";
    case "budget_out":
      return "预算用完了，先吃冰箱里的";
    default:
      return null;
  }
}

export const NUDGE_ACTIONS = ["看看", "不用"];

/**
 * Time-of-day greeting for the open page.
 * greet(now, snap, hasNudge) → { primary, secondary|null, period: morning|afternoon|evening|late }
 * - primary: 早上好 / 下午好 / 晚上好 / 夜深了 (local clock only)
 * - secondary: optional half-line with snapshot facts; null when hasNudge or no signal
 * - period: for Mobile icon mapping (sun / half-day / moon / star)
 * Never invents numbers; never medical/preachy.
 */
export function greet(now = new Date(), snap = {}, hasNudge = false) {
  const h = now instanceof Date ? now.getHours() : new Date(now).getHours();
  let primary, period;
  if (h >= 5 && h < 11) { primary = "早上好"; period = "morning"; }
  else if (h >= 11 && h < 17) { primary = "下午好"; period = "afternoon"; }
  else if (h >= 17 && h < 22) { primary = "晚上好"; period = "evening"; }
  else { primary = "夜深了"; period = "late"; }

  if (hasNudge) return { primary, secondary: null, period };

  const sleep = Number(snap.sleep_hours);
  const steps = Number(snap.steps);
  const meals = Number(snap.meals_today);

  let secondary = null;
  if (Number.isFinite(sleep) && sleep < 6) {
    secondary = `昨晚 ${sleep} 小时，今天轻一点。`;
  } else if (Number.isFinite(sleep) && sleep >= 7 && h < 11) {
    secondary = `昨晚睡了 ${sleep} 小时，状态不错。`;
  } else if (Number.isFinite(meals) && meals === 0 && h >= 16 && h <= 21) {
    secondary = "晚饭还没着落的话，我帮你看冰箱。";
  } else if (Number.isFinite(steps) && steps < 3000 && h >= 14 && h < 22) {
    secondary = `今天 ${Math.floor(steps)} 步，饭后走走也好。`;
  }

  return { primary, secondary, period };
}
