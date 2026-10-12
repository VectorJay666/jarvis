export type Reason = { metric: string; label: string; value: number; baseline: number; unit: string };
export type Judgement = {
  needsAdjust: boolean; level: 'ok' | 'adjust' | 'recover' | 'unknown'; headline: string;
  reasons: Reason[]; missing: string[]; suggestion: string; actions: string[]; disclaimer: string;
};
export type Baseline = { sleep_hours: number; hrv_ms: number; resting_hr: number; steps: number };
export const DEFAULT_BASELINE: Baseline;
export const DISCLAIMER: string;
export function fmtHours(h: number): string;
export function judge(snapshot?: Record<string, unknown>, baseline?: Partial<Baseline>): Judgement;
export function shouldNudge(r: Judgement | null | undefined): boolean;
