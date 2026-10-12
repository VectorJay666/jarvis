/** Boss idle lines under the orb — ≤14 chars, no brand / no promises. */
export const IDLE_QUOTES = [
  "先听完，再动手。",
  "少做一点，做对一点。",
  "睡不够，别硬扛。",
  "今天只解眼前这件。",
  "慢，是为了走得更稳。",
  "留一点余地给明天。",
  "说清楚，比说得多重要。",
  "累了就停，不算输。",
  "把难事拆小再走。",
  "空着，也是一种准备。",
  "先问需不需要，再问能不能。",
  "我会记得你刚才说的。",
];

/** Pick one; avoid repeating previous if provided. */
export function pickIdleQuote(prev = "") {
  const pool = IDLE_QUOTES.filter((q) => q !== prev);
  const list = pool.length ? pool : IDLE_QUOTES;
  return list[Math.floor(Math.random() * list.length)];
}

/** Meeting-state replacement (or hide entirely on client). */
export const MEETING_LINE = "我去开会";
