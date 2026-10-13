import type { Reply } from './types';
export type StreamEvent = { type: 'start' } | { type: 'reply'; text: string } | { type: 'complete'; result: Reply } | { type: 'error'; message: string };
/** A transport chunk may split a line, an escape or a Chinese character. */
export function createEventDecoder(onEvent: (event: StreamEvent) => void) {
  let pending = '';
  const dispatch = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (!event || !['start', 'reply', 'complete', 'error'].includes(event.type)) throw new Error('回复格式暂时无法读取，请重试。');
    if ((event.type === 'reply' && typeof event.text !== 'string') || (event.type === 'error' && typeof event.message !== 'string') || (event.type === 'complete' && (!event.result || typeof event.result.reply !== 'string' || !Array.isArray(event.result.cards) || !Array.isArray(event.result.quick_replies)))) throw new Error('回复格式暂时无法读取，请重试。');
    onEvent(event);
  };
  return { push(chunk: string) { pending += chunk; if (pending.length > 100000) throw new Error('回复过长，请重试。'); let end: number; while ((end = pending.indexOf('\n')) >= 0) { dispatch(pending.slice(0, end)); pending = pending.slice(end + 1); } }, finish() { dispatch(pending); pending = ''; } };
}
