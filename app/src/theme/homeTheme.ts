import { themeForPeriod, type GreetPeriod, type HomeTheme, type HomeThemeMode } from '../agent/home.mjs';

export type { HomeTheme, HomeThemeMode };

/** Afternoon light preset. Used when `/v1/home` omits or sends an unusable `theme`. */
export const AFTERNOON_HOME_THEME: HomeTheme = themeForPeriod('afternoon');

const PERIODS = new Set<GreetPeriod>(['morning', 'afternoon', 'evening', 'late']);
const MODES = new Set<HomeThemeMode>(['light', 'dim', 'dark']);
const COLOR_KEYS = ['background', 'surface', 'text', 'muted', 'accent'] as const;

export function isHomeTheme(raw: unknown): raw is HomeTheme {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as Record<string, unknown>;
  if (!PERIODS.has(row.period as GreetPeriod) || !MODES.has(row.mode as HomeThemeMode)) return false;
  return COLOR_KEYS.every((key) => typeof row[key] === 'string' && (row[key] as string).length > 0);
}

/**
 * Keep a complete server theme. Anything empty, partial, or mistyped becomes
 * the afternoon light preset. Does not read the clock.
 */
export function coerceHomeTheme(raw: unknown): HomeTheme {
  if (!isHomeTheme(raw)) return { ...AFTERNOON_HOME_THEME };
  return {
    period: raw.period,
    mode: raw.mode,
    background: raw.background,
    surface: raw.surface,
    text: raw.text,
    muted: raw.muted,
    accent: raw.accent,
  };
}

/** Label/icon ink drawn on top of `theme.accent`. */
export function inkOnAccent(theme: HomeTheme): string {
  return theme.mode === 'light' ? '#FFFFFF' : '#000000';
}

export function themeHairline(theme: HomeTheme): string {
  return theme.mode === 'light' ? '#E6E6E6' : 'rgba(255,255,255,0.16)';
}

/**
 * Dim wash over seasonal artwork so bright photos don't fight dark chrome.
 * Driven by theme.mode. Light (morning/afternoon, and the missing-theme preset) has no scrim.
 * Dim is about rgba(0,0,0,0.45). Dark is about 0.7 toward #000.
 * Black, not the dim surface color: a 45% wash of #2C2C2E left light type under 3.5:1 on the bright photo.
 */
export function artworkScrim(theme: Pick<HomeTheme, 'mode'>): { color: string; opacity: number } {
  if (theme.mode === 'dim') return { color: '#000000', opacity: 0.45 };
  if (theme.mode === 'dark') return { color: '#000000', opacity: 0.7 };
  return { color: '#000000', opacity: 0 };
}
