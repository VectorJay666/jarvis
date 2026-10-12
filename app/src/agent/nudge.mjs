// nudge.mjs — 单 agent 主动判断（确定性规则，非医疗建议）
// 入参: snapshot(HealthSnapshot), baseline({sleep_hours,hrv_ms,resting_hr,steps})
// 出参: {needsAdjust, level, headline, reasons[{metric,label,value,baseline,unit}], missing[], suggestion, actions[], disclaimer}
// 规范副本: app/src/agent/nudge.mjs 必须与本文件一致（selfcheck_nudge 校验）。

export const DEFAULT_BASELINE = { sleep_hours: 7.3, hrv_ms: 52, resting_hr: 56, steps: 6500 };
export const DISCLAIMER = '非医疗建议';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r1 = (v) => Math.round(v * 10) / 10;
export function fmtHours(h) {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)} 小时${m % 60 ? ` ${m % 60} 分` : ''}`;
}

export function judge(snapshot = {}, baseline = DEFAULT_BASELINE) {
  const b = { ...DEFAULT_BASELINE, ...(baseline || {}) };
  const s = snapshot || {};
  const reasons = [];
  const missing = [];
  const sleep = num(s.sleep_hours), hrv = num(s.hrv_ms), rhr = num(s.resting_hr), steps = num(s.steps);

  let lowSleep = false, lowHrv = false, highRhr = false, lowSteps = false;
  if (sleep == null) missing.push('睡眠');
  else if (sleep < b.sleep_hours - 1) { lowSleep = true; reasons.push({ metric: 'sleep_hours', label: '睡眠', value: sleep, baseline: b.sleep_hours, unit: 'h' }); }
  if (hrv == null) missing.push('HRV');
  else if (hrv < b.hrv_ms * 0.85) { lowHrv = true; reasons.push({ metric: 'hrv_ms', label: 'HRV', value: hrv, baseline: b.hrv_ms, unit: 'ms' }); }
  if (rhr == null) missing.push('静息心率');
  else if (rhr >= b.resting_hr + 5) { highRhr = true; reasons.push({ metric: 'resting_hr', label: '静息心率', value: rhr, baseline: b.resting_hr, unit: 'bpm' }); }
  if (steps != null && steps < b.steps * 0.4) { lowSteps = true; reasons.push({ metric: 'steps', label: '步数', value: steps, baseline: b.steps, unit: '步' }); }
  if (num(s.meals_today) == null) missing.push('饮食');

  const recovery = lowHrv || highRhr;
  const needsAdjust = lowSleep || recovery;
  let level = 'ok', headline, suggestion, actions;

  if (recovery && lowSleep) {
    level = 'recover';
    headline = `睡了 ${fmtHours(sleep)}，比你平时少 ${r1(b.sleep_hours - sleep)} 小时，恢复指标也偏低`;
    suggestion = '建议今天当恢复日：不上强度，只做 15 分钟散步或拉伸，今晚提前 45 分钟上床。';
    actions = ['plan_training', 'bedtime', 'why'];
  } else if (recovery) {
    level = 'recover';
    headline = 'HRV / 静息心率不在你平时的范围，身体可能还没恢复';
    suggestion = '建议今天当恢复日：低强度活动为主，晚上早点休息。';
    actions = ['plan_training', 'bedtime', 'why'];
  } else if (lowSleep) {
    level = 'adjust';
    headline = `睡了 ${fmtHours(sleep)}，比你平时少 ${r1(b.sleep_hours - sleep)} 小时`;
    suggestion = '建议训练降一档（时长减半、不冲重量），今晚提前 30 分钟上床。';
    actions = ['plan_training', 'bedtime', 'why'];
  } else if (sleep == null && hrv == null && rhr == null) {
    level = 'unknown';
    headline = '今天还没读到睡眠和恢复数据';
    suggestion = '先不给恢复判断。同步健康数据或手动填一下睡眠，我再帮你看。';
    actions = ['fill_data'];
  } else {
    headline = '今天的数据在你平时范围内';
    suggestion = lowSteps ? '照常安排即可；活动偏少，可以加 10 分钟散步。' : '照常安排即可。';
    actions = ['plan_training', 'dinner'];
  }
  if (missing.length && level !== 'unknown') headline += `（缺${missing.join('、')}，未纳入判断）`;
  return { needsAdjust, level, headline, reasons, missing, suggestion, actions, disclaimer: DISCLAIMER };
}

/** 是否值得发主动提醒（只在需要调整时） */
export function shouldNudge(result) { return !!result && result.needsAdjust === true; }
