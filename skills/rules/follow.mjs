/**
 * Follow-up after council — boss translates health snapshot into next plan.
 * Snapshot fields: sleep_hours, steps|active_kcal, training_done, meals_today, fridge, budget_left.
 * Returns null when nothing should change (0 silent invent).
 */
export function proposeFollow(st = {}, lastCard = {}) {
  const sleep = Number(st.sleep_hours);
  const steps = Number(st.steps);
  const kcal = Number(st.active_kcal);
  const meals = Number(st.meals_today);
  const done = st.training_done === true;
  const updates = [];

  if (Number.isFinite(sleep) && sleep < 6) {
    updates.push({
      id: "follow-sleep-downshift",
      text: `因你只睡了 ${sleep} 小时 → 今晚训练已下调`,
      because: "sleep_hours<6",
      patch: { fitness: "prefer_low_impact" },
      facts: { sleep_hours: sleep },
    });
  } else if (Number.isFinite(sleep) && sleep >= 7 && done) {
    updates.push({
      id: "follow-recovered",
      text: "昨晚睡够且训练已完成 → 明天可回到常规力量",
      because: "training_done && sleep_hours>=7",
      patch: { fitness: "clear_low_impact" },
      facts: { sleep_hours: sleep, training_done: true },
    });
  }

  if (Number.isFinite(steps) && steps < 3000 && !(Number.isFinite(sleep) && sleep < 6)) {
    updates.push({
      id: "follow-steps-low",
      text: `今日步数 ${Math.floor(steps)} → 加 10 分钟散步，不加压力量`,
      because: "steps<3000",
      patch: { fitness: "add_walk_10" },
      facts: { steps },
    });
  } else if (Number.isFinite(kcal) && kcal < 150 && !(Number.isFinite(sleep) && sleep < 6)) {
    updates.push({
      id: "follow-kcal-low",
      text: `今日活动约 ${Math.floor(kcal)} kcal → 加 10 分钟散步`,
      because: "active_kcal<150",
      patch: { fitness: "add_walk_10" },
      facts: { active_kcal: kcal },
    });
  }

  if (Number.isFinite(meals) && meals === 0) {
    updates.push({
      id: "follow-no-meal",
      text: "今天还没记饮食 → 下一餐先用冰箱现有食材",
      because: "meals_today===0",
      patch: { diet: "fridge_first" },
      facts: { meals_today: 0 },
    });
  } else if (Number.isFinite(meals) && meals >= 4) {
    updates.push({
      id: "follow-meals-heavy",
      text: `今天已 ${meals} 餐 → 晚间不加餐，喝水即可`,
      because: "meals_today>=4",
      patch: { diet: "no_late_snack" },
      facts: { meals_today: meals },
    });
  }

  if (Number.isFinite(st.budget_left) && st.budget_left <= 0) {
    updates.push({
      id: "follow-budget-freeze",
      text: "本周预算已用完 → 后续餐次优先冰箱，不点外卖",
      because: "budget_left<=0",
      patch: { diet: "fridge_only" },
      facts: { budget_left: st.budget_left },
    });
  }

  return updates.length ? { speaker: "boss", updates } : null;
}
