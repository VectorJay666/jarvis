export type HomeAction = { id: 'train' | 'dinner' | 'sleep' | 'walk' | 'budget'; label: string; icon: string; score: number; why: string | null };
export type Habit = { taps?: Record<string, number>; hour_taps?: Record<string, Record<string, number>>; dismissed_today?: string[] };
export type GreetPeriod = 'morning' | 'afternoon' | 'evening' | 'late';
export type Greet = { primary: string; secondary: string | null; period: GreetPeriod };
export const ACTIONS: Record<string, Omit<HomeAction, 'score' | 'why'>>;
export function rankActions(habit?: Habit, snap?: Record<string, unknown>, now?: Date): HomeAction[];
export function nudgeLine(kind: string, facts?: Record<string, unknown>): string | null;
export function greet(now?: Date, snap?: Record<string, unknown>, hasNudge?: boolean): Greet;
export const NUDGE_ACTIONS: string[];
