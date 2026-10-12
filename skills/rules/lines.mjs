/** Short meeting-note lines (主张｜依据, ≤20 chars). Backend streams these as role.say. */

function minsOf(action) {
  const m = String(action || "").match(/(\d+)\s*分钟/);
  return m ? Number(m[1]) : NaN;
}

/** Original "want" before any veto — only fitness has a distinct want today. */
export function wantLine(role, st = {}) {
  if (role !== "fitness") return null;
  const mins = Math.min(40, Math.max(20, Number(st.free_minutes) || 40));
  return {
    short: `${mins}分钟训练｜你说想练`,
    full: `按你说的练一下：${mins} 分钟力量循环（俯卧撑、深蹲、平板支撑）`,
  };
}

/** Final / post-veto short line for the meeting notes. */
export function sayLine(role, action, st = {}) {
  const m = minsOf(action);
  const sleepy = Number(st.sleep_hours) < 6;
  if (role === "fitness") {
    const kind = /低冲击|拉伸|踏步/.test(action || "") ? "低冲击" : "训练";
    // keep ≤16 chars so left-aligned bubbles never clip mid-phrase
    const base = Number.isFinite(m)
      ? `${m}分${kind}｜${sleepy ? "睡" + st.sleep_hours + "小时" : "时间够"}`
      : `${kind}｜${sleepy ? "睡" + st.sleep_hours + "小时" : "时间够"}`;
    return base;
  }
  if (role === "recovery") {
    const t = (String(action || "").match(/(\d{1,2}:\d{2})\s*前/) || [])[1] || "早点";
    return `${t}前进房｜${sleepy ? "先还睡眠债" : "保住睡眠窗口"}`;
  }
  if (role === "diet") {
    return /蛋炒饭/.test(action || "") ? "一碗蛋炒饭｜冰箱只有蛋和米" : "用现有食材｜不额外买菜";
  }
  if (role === "ledger") {
    const left = Number(st.budget_left);
    return Number.isFinite(left) ? `这顿0元｜本周剩${left}元` : "先报预算｜才能算上限";
  }
  return String(action || "").slice(0, 20);
}

/** Revised line after a veto (fitness only). Prefix 「改成」 once. */
export function revisedLine(role, action, st = {}) {
  const s = sayLine(role, action, st);
  if (role !== "fitness") return s;
  return s.startsWith("改成") ? s : `改成${s}`;
}
