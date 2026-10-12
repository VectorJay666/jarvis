/**
 * Ensure LLM polish did not rewrite factual numbers from the rule draft.
 * Compares minutes / hours / money / clock times / plain integers.
 * Returns true only when every draft number still appears in polished.
 */
function nums(text = "") {
  const s = String(text);
  const out = new Set();
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(分钟|分|小时|h|元|块|%|％)?/gi)) {
    const n = m[1];
    const unit = (m[2] || "").toLowerCase();
    out.add(unit ? `${n}|${unit}` : n);
    out.add(n); // also allow bare number survival
  }
  for (const m of s.matchAll(/\b(\d{1,2}:\d{2})\b/g)) out.add(`t:${m[1]}`);
  return out;
}

export function assertFacts(draft, polished) {
  const d = String(draft ?? "");
  const p = String(polished ?? "");
  if (!d.trim()) return true;
  if (!p.trim()) return false;
  const need = nums(d);
  if (!need.size) return true;
  const have = nums(p);
  for (const token of need) {
    // token like "15|分钟" or "15" or "t:23:00"
    if (token.startsWith("t:")) {
      if (!have.has(token)) return false;
      continue;
    }
    const [n, unit] = token.split("|");
    const ok =
      have.has(token) ||
      have.has(n) ||
      (unit && [...have].some((h) => h.startsWith(n + "|")));
    if (!ok) return false;
  }
  return true;
}
