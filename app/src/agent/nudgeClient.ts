import { API_BASE } from '../config';
import type { HealthSnapshot } from '../talk/healthSnapshot';
import { nudgeLine } from './home.mjs';
import { judge } from './nudge.mjs';

export type Nudge = { id: string; text: string; facts: Record<string, number | boolean> | null; actions: { id: string; label: string }[]; source: string };

/** 本地兜底：与服务端优先级一致 sleep > diet > activity > budget，数字只来自快照 */
function localNudge(s: HealthSnapshot, dismissed: string[]): Nudge | null {
  const j = judge(s as Record<string, unknown>);
  const c: Nudge[] = [];
  const A = (id: string) => [{ id, label: '看看' }, { id: 'dismiss', label: '不用' }];
  if (j.reasons.some((r) => r.metric === 'sleep_hours')) c.push({ id: 'follow-sleep-downshift', text: nudgeLine('sleep_low', s)!, facts: { sleep_hours: s.sleep_hours! }, actions: A('plan_light'), source: 'local' });
  if (s.meals_today === 0) c.push({ id: 'follow-no-meal', text: nudgeLine('no_meal')!, facts: { meals_today: 0 }, actions: A('fridge_dinner'), source: 'local' });
  if (typeof s.steps === 'number' && s.steps < 3000) c.push({ id: 'follow-steps-low', text: nudgeLine('steps_low', s)!, facts: { steps: s.steps }, actions: A('walk_10'), source: 'local' });
  if (s.budget_left === 0) c.push({ id: 'follow-budget-freeze', text: nudgeLine('budget_out')!, facts: { budget_left: 0 }, actions: A('fridge_dinner'), source: 'local' });
  return c.find((x) => !dismissed.includes(x.id)) ?? null;
}

export async function fetchNudge(s: HealthSnapshot, dismissed: string[]): Promise<Nudge | null> {
  if (API_BASE) {
    try {
      const r = await fetch(`${API_BASE}/v1/nudge`); if (r.ok) { const b = await r.json(); return (b.nudge as Nudge) ?? null; }
    } catch { /* fall through */ }
  }
  return localNudge(s, dismissed);
}

export async function dismissNudge(id: string, s: HealthSnapshot, dismissed: string[]): Promise<Nudge | null> {
  if (API_BASE) {
    try {
      const r = await fetch(`${API_BASE}/v1/nudge/dismiss`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (r.ok) { const b = await r.json(); return (b.nudge as Nudge) ?? null; }
    } catch { /* fall through */ }
  }
  return localNudge(s, [...dismissed, id]);
}

/** 看看 → 对应首页按钮 */
export const NUDGE_TO_ACTION: Record<string, 'train' | 'dinner' | 'walk' | 'sleep'> = {
  plan_light: 'train', plan_normal: 'train', walk_10: 'walk', fridge_dinner: 'dinner', no_snack: 'dinner',
};

// ---- v0.3 /v1/home 单接口 ----
import type { HomeAction, Habit, Greet } from './home.mjs';
import { rankActions, greet as localGreet, type GreetPeriod } from './home.mjs';
import { Platform } from 'react-native';

export type Home = { nudge: Nudge | null; actions: HomeAction[]; greet: Greet; source: 'server' | 'local' };

/** 演示用时间覆盖：Web 地址加 ?hour=19 即按晚上 7 点排序（走本地规则，与服务端同一份 home.mjs） */
export function demoHour(): number | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('hour');
  const n = v == null ? NaN : Number(v);
  return Number.isInteger(n) && n >= 0 && n < 24 ? n : null;
}
const nowFor = () => { const h = demoHour(); const d = new Date(); if (h != null) d.setHours(h, 0, 0, 0); return d; };
const cleanWhy = (a: HomeAction): HomeAction => ({ ...a, why: a.why && a.why !== '默认顺序' ? a.why : (null as unknown as string) });


function ensurePeriod(g: Greet): Greet {
  if (g.period === 'morning' || g.period === 'afternoon' || g.period === 'evening' || g.period === 'late') return g;
  const h = nowFor().getHours();
  let period: GreetPeriod;
  if (h >= 5 && h < 11) period = 'morning';
  else if (h >= 11 && h < 17) period = 'afternoon';
  else if (h >= 17 && h < 22) period = 'evening';
  else period = 'late';
  // Also map from primary text when hour demo mismatch
  const p = g.primary || '';
  if (p.includes('早上')) period = 'morning';
  else if (p.includes('下午')) period = 'afternoon';
  else if (p.includes('晚上')) period = 'evening';
  else if (p.includes('夜深')) period = 'late';
  return { ...g, period };
}
function localHome(s: HealthSnapshot, habit: Habit, dismissed: string[]): Home {
  const nudge = localNudge(s, dismissed);
  const match = nudge ? NUDGE_TO_ACTION[nudge.actions[0]?.id] : undefined;
  const actions = rankActions(habit, s as Record<string, unknown>, nowFor()).map(cleanWhy).map((a) => (a.id === match ? { ...a, why: null as unknown as string } : a));
  // Offline fallback only — prefer server `greet` when /v1/home returns it.
  const greet = localGreet(nowFor(), s as Record<string, unknown>, !!nudge);
  return { nudge, actions, greet, source: 'local' };
}
async function call(path: string, body?: unknown): Promise<Home | null> {
  // ?hour=N forces local greet/rank so demo frames match Skills clock buckets
  if (!API_BASE || demoHour() != null) return null;
  try {
    const r = await fetch(`${API_BASE}${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    if (!r.ok) return null;
    const b = await r.json();
    const nudge = b.nudge ?? null;
    // Prefer Backend greet; TODO: remove local fallback once all environments ship greet
    const greet: Greet = ensurePeriod(b.greet ?? localGreet(nowFor(), {} as Record<string, unknown>, !!nudge));
    return { nudge, actions: (b.actions ?? []).map(cleanWhy), greet, source: 'server' };
  } catch { return null; }
}
export async function getHome(s: HealthSnapshot, h: Habit, d: string[]) { return (await call('/v1/home')) ?? localHome(s, h, d); }
export async function tapHome(id: string, s: HealthSnapshot, h: Habit, d: string[]) { return (await call('/v1/home/tap', { action_id: id })) ?? localHome(s, h, d); }
export async function dismissHome(id: string, s: HealthSnapshot, h: Habit, d: string[]) { return (await call('/v1/nudge/dismiss', { id })) ?? localHome(s, h, [...d, id]); }
