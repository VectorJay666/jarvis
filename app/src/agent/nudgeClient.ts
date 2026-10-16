import { Platform } from 'react-native';
import { API_BASE } from '../config';
import type { HealthSnapshot } from '../talk/healthSnapshot';
import { coerceHomeTheme, isHomeTheme, type HomeTheme } from '../theme/homeTheme';
import { greet as localGreet, nudgeLine, rankActions, themeForPeriod, type Greet, type GreetPeriod, type Habit, type HomeAction } from './home.mjs';
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
export type { HomeTheme };
export type Home = { nudge: Nudge | null; actions: HomeAction[]; greet: Greet; theme: HomeTheme; source: 'server' | 'local' };

const GREET_PRIMARY: Record<GreetPeriod, string> = { morning: '早上好', afternoon: '下午好', evening: '晚上好', late: '夜深了' };

/** 演示用时间覆盖：Web `?hour=19` 转发给 /v1/home，时段与主题以服务端为准。离线才用本地 home.mjs。 */
export function demoHour(): number | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('hour');
  const n = v == null ? NaN : Number(v);
  return Number.isInteger(n) && n >= 0 && n < 24 ? n : null;
}
const nowFor = () => { const h = demoHour(); const d = new Date(); if (h != null) d.setHours(h, 0, 0, 0); return d; };
const withHour = (path: string) => {
  const h = demoHour();
  if (h == null) return path;
  return `${path}${path.includes('?') ? '&' : '?'}hour=${h}`;
};
const cleanWhy = (a: HomeAction): HomeAction => ({ ...a, why: a.why && a.why !== '默认顺序' ? a.why : (null as unknown as string) });

function asPeriod(value: unknown): GreetPeriod | null {
  return value === 'morning' || value === 'afternoon' || value === 'evening' || value === 'late' ? value : null;
}

/**
 * Prefer server greet.period, then a valid theme.period, then the greeting words.
 * Missing all three → afternoon. Does not read the client clock.
 */
function ensurePeriod(g: Partial<Greet> | null | undefined, themePeriod?: GreetPeriod | null): Greet {
  const fromField = asPeriod(g?.period);
  const primary = g?.primary || '';
  const secondary = g?.secondary ?? null;
  if (fromField) return { primary: primary || GREET_PRIMARY[fromField], secondary, period: fromField };
  if (themePeriod) return { primary: primary || GREET_PRIMARY[themePeriod], secondary, period: themePeriod };
  if (primary.includes('早上')) return { primary, secondary, period: 'morning' };
  if (primary.includes('下午')) return { primary, secondary, period: 'afternoon' };
  if (primary.includes('晚上')) return { primary, secondary, period: 'evening' };
  if (primary.includes('夜深')) return { primary, secondary, period: 'late' };
  return { primary: primary || GREET_PRIMARY.afternoon, secondary, period: 'afternoon' };
}
function localHome(s: HealthSnapshot, habit: Habit, dismissed: string[]): Home {
  const nudge = localNudge(s, dismissed);
  const match = nudge ? NUDGE_TO_ACTION[nudge.actions[0]?.id] : undefined;
  const actions = rankActions(habit, s as Record<string, unknown>, nowFor()).map(cleanWhy).map((a) => (a.id === match ? { ...a, why: null as unknown as string } : a));
  // Offline only. A live /v1/home theme/greet.period replaces this.
  const greet = localGreet(nowFor(), s as Record<string, unknown>, !!nudge);
  return { nudge, actions, greet, theme: themeForPeriod(greet.period), source: 'local' };
}
async function call(path: string, body?: unknown): Promise<Home | null> {
  if (!API_BASE) return null;
  try {
    const r = await fetch(`${API_BASE}${withHour(path)}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    if (!r.ok) return null;
    const b = await r.json();
    const nudge = b.nudge ?? null;
    const theme = coerceHomeTheme(b.theme);
    const greet = ensurePeriod(b.greet, isHomeTheme(b.theme) ? theme.period : null);
    return { nudge, actions: (b.actions ?? []).map(cleanWhy), greet, theme, source: 'server' };
  } catch { return null; }
}
export async function getHome(s: HealthSnapshot, h: Habit, d: string[]) { return (await call('/v1/home')) ?? localHome(s, h, d); }
export async function tapHome(id: string, s: HealthSnapshot, h: Habit, d: string[]) { return (await call('/v1/home/tap', { action_id: id })) ?? localHome(s, h, d); }
export async function dismissHome(id: string, s: HealthSnapshot, h: Habit, d: string[]) { return (await call('/v1/nudge/dismiss', { id })) ?? localHome(s, h, [...d, id]); }
