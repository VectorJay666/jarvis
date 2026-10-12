import type { TalkEvent } from './types';

type Draft = Omit<TalkEvent, 'session_id' | 'seq' | 'ts'> & { wait: number };
type D = Record<string, unknown> & { event: string; wait: number };

/** 把一句话按字切成若干 delta，逐字流出 */
function say(task_id: string, role: string, line_id: string, text: string, full = '', phase?: 'want' | 'revised'): D[] {
  const out: D[] = [];
  const step = 2;
  for (let i = 0; i < text.length; i += step) {
    const delta = text.slice(i, i + step);
    out.push({ event: 'role.say', task_id, role, line_id, delta, done: i + step >= text.length, wait: 70 });
  }
  Object.assign(out[out.length - 1], { short: text, full: full || text.replace('｜', '，'), ...(phase ? { phase } : {}) });
  for (const o of out) if (phase) o.phase = phase;
  out[0].wait = 450;
  return out;
}

/** 用例：「今晚想练一下，顺便看看冰箱能做啥，这周钱紧」→ 3 件事、1 次否决、3 张卡 */
export function buildMockScript(text: string): Draft[] {
  const s: D[] = [
    { event: 'session.start', text, wait: 300 },
    { event: 'intent.split', wait: 700, tasks: [
      { task_id: 't1', intent: 'council.fitness', title: '今晚练一下' },
      { task_id: 't2', intent: 'council.diet', title: '冰箱能做啥' },
      { task_id: 't3', intent: 'council.ledger', title: '这周钱紧' },
    ] },
    { event: 'boss.ack', wait: 800, line: '这件事我拉健身、恢复、饮食、记账来开。', roles: ['fitness', 'recovery', 'diet', 'ledger'] },
    { event: 'role.join', task_id: 't1', role: 'fitness', name: '健身教练', icon: 'dumbbell', wait: 500 },
    { event: 'role.join', task_id: 't1', role: 'recovery', name: '恢复管家', icon: 'moon-waning-crescent', wait: 350 },
    { event: 'role.join', task_id: 't2', role: 'diet', name: '饮食顾问', icon: 'noodles', wait: 350 },
    { event: 'role.join', task_id: 't3', role: 'ledger', name: '记账秘书', icon: 'wallet-outline', wait: 350 },
    ...say('t1', 'fitness', 'L1', '40分钟训练｜你说想练', '按你说的练一下：40 分钟力量循环', 'want'),
    ...say('t1', 'recovery', 'L2', '23:00前进房｜先还睡眠债', '拉伸 20 分钟；今晚 23:00 前进房'),
    { event: 'veto', task_id: 't1', from: 'recovery', to: 'fitness', line_id: 'L1', reason: '恢复管家拦了健身教练：只睡了 5.2 小时', wait: 700 },
    ...say('t1', 'fitness', 'L1b', '改成15分钟低冲击｜只睡了5小时', '改成 15 分钟低冲击：开合跳放慢版 ×2 组 + 全身拉伸', 'revised'),
    { event: 'habit.learned', task_id: 't1', rule: { id: 'r1', text: '睡不够 6 小时不排力量训练', because: '这次只睡了 5.2 小时' }, wait: 600 },
    { event: 'card.ready', task_id: 't1', wait: 800, speaker: 'boss', card: { headline: '今晚只做15分钟低冲击', boss_line: '我帮你定了：今晚只做15分钟低冲击', facts: [{ label: '睡眠', value: 5, unit: '小时' }, { label: '训练', value: 15, unit: '分钟' }], items: [
      { role: 'fitness', text: '改成 15 分钟低冲击：开合跳放慢版 ×2 组 + 全身拉伸' },
      { role: 'recovery', text: '拉伸 20 分钟；今晚 23:00 前进房' },
    ] } },
    { event: 'task.done', task_id: 't1', status: 'ok', wait: 300 },
    ...say('t2', 'diet', 'L3', '鸡蛋炒饭｜冰箱有蛋和米饭', '2 个鸡蛋 + 1 碗米饭，15 分钟'),
    { event: 'ask', task_id: 't2', ask_id: 'a1', role: 'diet', question: '要不要加个青菜？没回我就按不加做', wait: 700 },
    { event: 'habit.learned', task_id: 't2', rule: { id: 'r2', text: '先用冰箱现有食材', because: '你问冰箱能做啥' }, wait: 600 },
    { event: 'card.ready', task_id: 't2', wait: 800, speaker: 'boss', card: { headline: '冰箱蛋米，一碗蛋炒饭', boss_line: '我帮你定了：冰箱蛋米，一碗蛋炒饭', items: [
      { role: 'diet', text: '2 个鸡蛋 + 1 碗米饭，15 分钟' },
    ] } },
    { event: 'task.done', task_id: 't2', status: 'ok', wait: 300 },
    ...say('t3', 'ledger', 'L4', '这顿0元｜本周还剩300', '今晚在家做，省下一顿外卖约 35 元'),
    { event: 'habit.learned', task_id: 't3', rule: { id: 'r3', text: '钱紧的周优先在家做饭', because: '你说这周钱紧' }, wait: 600 },
    { event: 'card.ready', task_id: 't3', wait: 800, speaker: 'boss', card: { headline: '这顿0元，本周还剩300', boss_line: '我帮你定了：这顿0元，本周还剩300', items: [
      { role: 'ledger', text: '今晚在家做，省下一顿外卖约 35 元' },
    ] } },
    { event: 'task.done', task_id: 't3', status: 'ok', wait: 300 },
    { event: 'follow.start', status: 'watching', hint: '跟进中', plan: '会后按睡眠/完成情况自动改下一版', wait: 500 },
    { event: 'follow.update', id: 'follow-sleep-downshift', because: '因你只睡了 5.2 小时', change: '今晚训练已下调', text: '因你只睡了 5.2 小时 → 今晚训练已下调', facts: { sleep_hours: 5.2 }, wait: 400 },
    { event: 'done', tasks_ok: 3, tasks_failed: 0, wait: 500 },
  ];
  return s as unknown as Draft[];
}

/** 本地假流：按间隔推事件，带全局递增 seq；cancel 后推一条 cancelled 并不再推任何事件 */
export function startMockStream(text: string, onEvent: (e: TalkEvent) => void) {
  const session_id = `mock-${Date.now().toString(36)}`;
  const script = buildMockScript(text);
  let seq = 0; let i = 0; let timer: ReturnType<typeof setTimeout> | null = null; let stopped = false;
  const emit = (d: Record<string, unknown>) => { seq += 1; onEvent({ ...d, session_id, seq, ts: Date.now() } as TalkEvent); };
  const next = () => {
    if (stopped || i >= script.length) return;
    const { wait, ...d } = script[i];
    timer = setTimeout(() => { if (stopped) return; i += 1; emit(d); next(); }, wait);
  };
  next();
  return {
    source: 'mock' as const,
    cancel: () => {
      if (stopped) return; stopped = true;
      if (timer) clearTimeout(timer);
      emit({ event: 'cancelled', reason: 'user_stop' });
    },
  };
}
