import type { HealthSnapshot } from '../talk/healthSnapshot';
import { fmtHours, type Baseline, type Judgement } from './nudge.mjs';

export type ActionId = 'train' | 'dinner' | 'sleep' | 'walk' | 'budget' | 'short10' | 'tomorrow' | 'remind' | 'detail';
export const FOLLOW_LABEL: Record<string, string> = { short10: '改成 10 分钟', tomorrow: '明天再说', remind: '到点提醒我', detail: '看详情' };

/** 一张结论卡：头头署名，大数字 + 一句为什么 + 一个动作 + 1–2 个跟进 */
export type Answer = { id: ActionId; title: string; conclusion: string; big?: { value: string; unit: string; label: string }; why: string; action: string; followups: ActionId[] };
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function answerFor(id: ActionId, s: HealthSnapshot, b: Baseline, j: Judgement): Answer {
  const sleep = n(s.sleep_hours), steps = n(s.steps), hrv = n(s.hrv_ms);
  const sleepBig = sleep == null ? undefined : { value: String(sleep), unit: '小时', label: '昨晚睡眠' };
  switch (id) {
    case 'train': {
      const L = j.level;
      return { id, title: '今晚练什么', big: sleepBig,
        conclusion: L === 'recover' ? '今晚不上强度，当恢复日。' : L === 'adjust' ? '可以练，降一档。' : L === 'unknown' ? '数据不全，先按轻量来。' : '按原计划练。',
        why: sleep == null ? '还没读到睡眠，不做恢复判断。' : `比你平时 ${fmtHours(b.sleep_hours)} 少 ${Math.round((b.sleep_hours - sleep) * 10) / 10} 小时${hrv != null && hrv < b.hrv_ms * 0.85 ? `，HRV ${hrv} 也低于平时 ${b.hrv_ms}` : ''}。`,
        action: L === 'recover' ? '20 分钟拉伸 + 慢走，心率保持轻松。' : L === 'adjust' ? '时长减半，重量不加。' : '照常训练，注意热身。',
        followups: ['short10', 'tomorrow'] };
    }
    case 'short10':
      return { id, title: '改成 10 分钟', conclusion: '建议只做 10 分钟拉伸。', big: { value: '10', unit: '分钟', label: '今晚活动' }, why: '睡得少时，短时低强度比硬练更划算。', action: '这是建议，还没写进你的日程。', followups: ['remind'] };
    case 'tomorrow':
      return { id, title: '明天再说', conclusion: '好，今晚不练。', why: '明早读到新睡眠数据后再给你建议。', action: '今晚早点休息就是最好的安排。', followups: ['remind'] };
    case 'dinner': {
      const fr = (s.fridge ?? []).map((x) => ({ egg: '鸡蛋', rice: '米饭' } as Record<string, string>)[x] ?? x);
      return { id, title: '冰箱做晚饭', big: n(s.meals_today) == null ? undefined : { value: String(s.meals_today), unit: '餐', label: '今天已记' },
        conclusion: fr.length ? `用${fr.join('、')}就够。` : '还不知道冰箱里有什么。', why: fr.length ? '用现有食材，不额外花钱。' : '冰箱没记录，先不硬给菜单。',
        action: fr.length ? '番茄炒蛋盖饭 + 一份青菜。' : '告诉我有什么食材。', followups: ['detail'] };
    }
    case 'sleep':
      return { id, title: '看睡眠', big: sleepBig, conclusion: sleep == null ? '还没读到睡眠。' : sleep < b.sleep_hours - 1 ? '昨晚睡少了。' : '睡眠在平时范围。',
        why: sleep == null ? '同步健康数据后再看。' : `你平时大约 ${fmtHours(b.sleep_hours)}。`, action: j.level === 'ok' ? '今晚照常作息。' : '今晚提前 30–45 分钟上床。', followups: ['remind', 'detail'] };
    case 'walk':
      return { id, title: '出去走走', big: steps == null ? undefined : { value: String(steps), unit: '步', label: '今日步数' }, conclusion: steps != null && steps < b.steps * 0.6 ? '今天走得少，饭后走 10 分钟。' : '活动量还可以。',
        why: `你平时一天大约 ${b.steps} 步。`, action: '饭后 10 分钟慢走，约 1000 步。', followups: ['remind'] };
    case 'budget':
      return { id, title: '这周还能花多少', big: n(s.budget_left) == null ? undefined : { value: String(s.budget_left), unit: '元', label: '剩余预算' },
        conclusion: n(s.budget_left) == null ? '还没设预算。' : '够用，晚饭用冰箱食材。', why: '数字来自你填的预算。', action: '今天可以不再额外花钱。', followups: ['dinner' as ActionId].slice(0, 1) };
    default:
      return { id, title: '', conclusion: '', why: '', action: '', followups: [] };
  }
}

export function intentFromText(t: string): ActionId | null {
  const m: [RegExp, ActionId][] = [[/练|训练|运动/, 'train'], [/睡/, 'sleep'], [/吃|饭/, 'dinner'], [/走|步/, 'walk'], [/钱|预算|花/, 'budget']];
  for (const [re, id] of m) if (re.test(t)) return id;
  return null;
}
