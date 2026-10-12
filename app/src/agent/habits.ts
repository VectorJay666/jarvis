import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit } from './home.mjs';

/** 本地习惯：taps / hour_taps / dismissed_today（与 skills/rules/home.mjs 字段一致），存 AsyncStorage */
const KEY = 'agent_habit_v2';
export const SEED: Habit = { taps: { train: 4, dinner: 3, sleep: 2 }, hour_taps: { dinner: { '18': 2, '19': 2, '20': 2 }, train: { '7': 1, '8': 1 } }, dismissed_today: [] };
const today = () => new Date().toDateString();

export async function loadHabit(): Promise<Habit> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) { const h = JSON.parse(raw) as Habit & { day?: string }; if (h.day !== today()) h.dismissed_today = []; return h; }
  } catch { /* ignore */ }
  return { ...SEED };
}
async function save(h: Habit) { try { await AsyncStorage.setItem(KEY, JSON.stringify({ ...h, day: today() })); } catch { /* ignore */ } }

export async function recordTap(h: Habit, id: string, now = new Date()): Promise<Habit> {
  const hr = String(now.getHours());
  const ht = { ...(h.hour_taps ?? {}) }; ht[id] = { ...(ht[id] ?? {}), [hr]: (ht[id]?.[hr] ?? 0) + 1 };
  const next = { ...h, taps: { ...(h.taps ?? {}), [id]: (h.taps?.[id] ?? 0) + 1 }, hour_taps: ht };
  await save(next); return next;
}
export async function recordDismiss(h: Habit, id: string): Promise<Habit> {
  const next = { ...h, dismissed_today: [...new Set([...(h.dismissed_today ?? []), id])] };
  await save(next); return next;
}
