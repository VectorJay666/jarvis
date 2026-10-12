/**
 * Empty-state tap suggestions under the boss orb (P0 input).
 * Health-vertical only; click writes into the input, user can edit before send.
 */
export const TAP_SUGGESTIONS = [
  "今晚想轻练一下",
  "冰箱能做什么晚饭",
  "睡得不多，帮我看着点",
];

/** Optional longer demo line — not prefilled; only if user taps nothing. */
export function pickSuggestion(prev = "") {
  const pool = TAP_SUGGESTIONS.filter((s) => s !== prev);
  const list = pool.length ? pool : TAP_SUGGESTIONS;
  return list[Math.floor(Math.random() * list.length)];
}
