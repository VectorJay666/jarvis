/** Runtime API wiring — set EXPO_PUBLIC_API_BASE to hit Backend. */

export const API_BASE =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE
    ? String(process.env.EXPO_PUBLIC_API_BASE)
    : ''
  ).replace(/\/$/, '');

/** No base → local mock; do not call network. */
export const USE_MOCK = !API_BASE;
