/**
 * In-memory mock of the v0.2 stub — fallback when API fails / not configured.
 * Covers 3 acts: council veto, evolve (knee → avoid jump), hire (ledger).
 */
import type {
  CompareResult, CouncilStatus, HabitRule, HandoffCardData, HandoffLine, Role, RolePreview,
} from '../types';
import { DISCLAIMER, FRIDGE_LABELS } from '../types';

const BASE_ROLES: Role[] = [
  { id: 'fitness', name: '健身教练', duty: '按疲劳与可用时间改训练', not_do: '不做伤病诊疗、不承诺练出效果', core: true, votes: true, learned_count: 0 },
  { id: 'diet', name: '饮食顾问', duty: '用冰箱现有食材安排下一餐', not_do: '不做营养处方、不承诺减重数字', core: true, votes: true, learned_count: 0 },
  { id: 'recovery', name: '作息/恢复管家', duty: '用睡眠与恢复窗口卡训练强度', not_do: '不开药方、不做睡眠障碍诊断', core: true, votes: true, learned_count: 0 },
  { id: 'schedule', name: '日程秘书', duty: '把建议塞进真实空档', not_do: '未接日历前不出建议', core: true, votes: false, status: 'placeholder', learned_count: 0 },
  { id: 'focus', name: '专注教练', duty: '短专注块与打断恢复', not_do: '二期再做', core: true, votes: false, status: 'placeholder', learned_count: 0 },
];

const LEDGER: RolePreview = {
  id: 'ledger', name: '记账秘书', duty: '盯本周剩余预算，给这一顿/这一周的花钱上限',
  not_do: '不做投资、理财、借贷建议', core: false, votes: true,
  state_fields: [{ key: 'budget_left', label: '本周剩余预算（元）', type: 'number' }],
};

const state = {
  rules: [] as HabitRule[],
  hired: [] as Role[],
  seen: new Set<string>(),
};

export class MockHttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function mockRoles(): Role[] {
  return [...BASE_ROLES, ...state.hired].map((r) => ({
    ...r, learned_count: state.rules.filter((x) => x.role === r.id).length,
  }));
}

export function mockHire(need: string, confirm: boolean): { preview: RolePreview; confirmed: boolean } {
  if (/医|药|病|减重|减肥|瘦|投资|理财|股|基金|借贷|网贷/.test(need)) {
    throw new MockHttpError(422, 'ROLE_OUT_OF_SCOPE', '医疗、减重、投资类秘书不招');
  }
  if (!/钱|预算|记账|花销|开销|省/.test(need)) {
    throw new MockHttpError(422, 'NO_TEMPLATE', '暂时没有对应的秘书模板');
  }
  const preview = { ...LEDGER, from_need: need };
  if (confirm && !state.hired.some((r) => r.id === 'ledger')) {
    state.hired.push({ ...(LEDGER as Role), learned_count: 0 });
  }
  return { preview, confirmed: confirm };
}

export function mockFeedback(role: string, note: string): HabitRule[] {
  const learned: HabitRule[] = [];
  const add = (key: string, text: string, r = role) => {
    if (state.rules.some((x) => x.key === key)) return;
    const rule = { id: `mock-${Date.now()}-${key}`, role: r, key, text, because: `因为你上次说「${note.slice(0, 40)}」`, learned_at: new Date().toISOString() };
    state.rules.push(rule); learned.push(rule);
  };
  if (/膝|关节/.test(note)) add('avoid_jump', '避开跳跃类动作', 'fitness');
  if (/累/.test(note)) add('low_impact', '默认低冲击', 'fitness');
  if (/不吃蛋|鸡蛋/.test(note)) add('no_egg', '少安排鸡蛋', 'diet');
  return learned;
}

export function mockRules(): HabitRule[] { return [...state.rules]; }
export function mockDeleteRule(id: string) { state.rules = state.rules.filter((r) => r.id !== id); }

function build(status: CouncilStatus, rules: HabitRule[], markSeen: boolean): HandoffCardData {
  const lowSleep = status.sleep_hours < 6;
  const fridge = status.fridge.length ? status.fridge : ['egg', 'rice'];
  const avoidJump = rules.some((r) => r.key === 'avoid_jump');
  const noEgg = rules.some((r) => r.key === 'no_egg');
  let fitness = lowSleep
    ? '改成 15 分钟低冲击：开合跳放慢版 ×2 组 + 全身拉伸，心率不冲'
    : `按可用 ${status.free_minutes} 分钟安排一组力量循环 + 开合跳热身`;
  if (avoidJump) fitness = fitness.replace(/开合跳(放慢版)?/, '原地踏步');
  const fridgeZh = fridge.map((f) => FRIDGE_LABELS[f] ?? f).join('、');
  const diet = noEgg ? `米饭配青菜简餐（冰箱：${fridgeZh}），少安排鸡蛋` : `一碗蛋炒饭（冰箱：${fridgeZh}），少油快炒`;
  const handoffs: HandoffLine[] = [
    { role: 'fitness', label: '健身教练', action: fitness, is_new: false },
    { role: 'diet', label: '饮食顾问', action: diet, is_new: false },
    { role: 'recovery', label: '作息/恢复管家', action: '训练后拉伸 10 分钟；今晚 23:00 前进房，争取睡满 7 小时（窗口 23:00–06:30）', is_new: false },
  ];
  for (const r of state.hired) {
    const b = status.budget_left;
    const action = b == null ? '先告诉我本周还剩多少预算，我再给每天上限' : `本周剩 ${b} 元，每天上限约 ${Math.floor(b / 7)} 元；冰箱有菜这顿花 0 元`;
    handoffs.push({ role: r.id, label: r.name, action, is_new: !state.seen.has(r.id) });
    if (markSeen) state.seen.add(r.id);
  }
  return {
    card_id: `mock-${Date.now()}`,
    lead_role: lowSleep ? 'recovery' : 'fitness',
    headline: lowSleep ? '睡眠债优先：短训 + 简餐 + 钉死睡眠窗口' : '今晚：按状态给一条可执行安排',
    handoffs,
    sleep_window: '23:00-06:30',
    vetoes_applied: lowSleep ? [{ from: 'recovery', to: 'fitness', reason: `昨晚只睡 ${status.sleep_hours} 小时，今晚禁止加练，改为低冲击或拉伸` }] : [],
    disclaimer: DISCLAIMER,
    learned_applied: rules.map((r) => r.key),
  };
}

export function buildHandoffCard(status: CouncilStatus): HandoffCardData {
  return build(status, state.rules, true);
}

export function mockCompare(status: CouncilStatus): CompareResult {
  return { before: build(status, [], false), after: build(status, state.rules, false), rules: mockRules() };
}
