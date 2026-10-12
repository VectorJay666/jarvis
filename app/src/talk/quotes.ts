/** Boss idle lines under the orb — synced with skills/rules/idle_quotes.mjs (Crea 12). */
export const BOSS_QUOTES: readonly string[] = [
  '先听完，再动手。',
  '少做一点，做对一点。',
  '睡不够，别硬扛。',
  '今天只解眼前这件。',
  '慢，是为了走得更稳。',
  '留一点余地给明天。',
  '说清楚，比说得多重要。',
  '累了就停，不算输。',
  '把难事拆小再走。',
  '空着，也是一种准备。',
  '先问需不需要，再问能不能。',
  '我会记得你刚才说的。',
];

/** Meeting-state replacement (or hide entirely). */
export const MEETING_LINE = '我去开会';

export function pickQuote(exclude?: string): string {
  const pool = exclude ? BOSS_QUOTES.filter((q) => q !== exclude) : BOSS_QUOTES;
  const list = pool.length ? pool : BOSS_QUOTES;
  return list[Math.floor(Math.random() * list.length)]!;
}
