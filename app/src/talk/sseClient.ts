import { API_BASE } from '../config';
import { startMockStream } from './mockStream';
import type { TalkEvent, TalkStream } from './types';

/**
 * 接 POST /v1/talk 的 SSE。有 EXPO_PUBLIC_API_BASE 且接口可用时走真流，否则回落 mock。
 * 事件按 seq 排序后再交给 onEvent（乱序先缓存，等前一个到了再放）。
 */
/** 演示状态：字段名以 server/council.mjs 为准（sleep_hours / free_minutes / fridge / budget_left） */
export const DEMO_STATE = { sleep_hours: 5, free_minutes: 40, fridge: ['egg', 'rice'], budget_left: 300 };
const PACE_MS = 900;

export function startTalk(text: string, onEvent: (e: TalkEvent) => void, state?: Record<string, unknown>): TalkStream {
  const payload = { ...(state ?? DEMO_STATE) };
  const ordered = orderBySeq(onEvent);
  if (!API_BASE) return startMockStream(text, ordered.push);

  let inner: TalkStream | null = null;
  let sessionId: string | null = null;
  let stopped = false;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const handle: TalkStream = {
    source: 'live',
    cancel: () => {
      if (stopped) return; stopped = true;
      if (inner) { inner.cancel(); return; }
      if (sessionId) fetch(`${API_BASE}/v1/talk/${sessionId}/cancel`, { method: 'POST' }).catch(() => {});
      ctrl?.abort();
      // 本地立即收住：不等后端回 cancelled
      ordered.force({ event: 'cancelled', reason: 'user_stop', session_id: sessionId ?? 'local', seq: ordered.last() + 1, ts: Date.now() } as TalkEvent);
    },
  };

  (async () => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/v1/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ text, state: payload, pace_ms: PACE_MS }),
        signal: ctrl?.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      if (stopped) return;
      inner = startMockStream(text, ordered.push); // 接口不可用 → mock
      handle.source = 'mock';
      return;
    }
    const onBlock = (block: string) => {
      let name = ''; const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (!data.length) return;
      try {
        const obj = JSON.parse(data.join('\n'));
        const ev = { ...obj, event: name || obj.event } as TalkEvent;
        if (ev.session_id) sessionId = ev.session_id;
        if (!stopped) ordered.push(ev);
      } catch { /* 坏帧丢弃 */ }
    };
    try {
      const reader = res.body?.getReader?.();
      if (reader) {
        const dec = new TextDecoder(); let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done || stopped) break;
          buf += dec.decode(value, { stream: true }).replace(/\r/g, '');
          let k: number;
          while ((k = buf.indexOf('\n\n')) >= 0) { onBlock(buf.slice(0, k)); buf = buf.slice(k + 2); }
        }
      } else {
        // RN fetch 无流式 body：整体读完再按序播放（降级）
        (await res.text()).replace(/\r/g, '').split('\n\n').forEach(onBlock);
      }
    } catch { /* abort / 断线 */ }
    if (!stopped && !ordered.ended()) handle.cancel(); // 断线视同收住
  })();
  return handle;
}

function orderBySeq(onEvent: (e: TalkEvent) => void) {
  let expect = 1; let lastSeq = 0; let closed = false;
  const pending = new Map<number, TalkEvent>();
  const deliver = (e: TalkEvent) => {
    lastSeq = e.seq; onEvent(e);
    if (e.event === 'cancelled' || e.event === 'done') { closed = true; pending.clear(); }
  };
  return {
    push: (e: TalkEvent) => {
      if (closed) return;
      if (expect === 1 && pending.size === 0 && e.seq !== 1 && lastSeq === 0) expect = e.seq; // 首条不是 1 时以首条为起点
      pending.set(e.seq, e);
      while (!closed && pending.has(expect)) { const x = pending.get(expect)!; pending.delete(expect); expect += 1; deliver(x); }
    },
    force: (e: TalkEvent) => { if (!closed) deliver(e); },
    last: () => lastSeq,
    ended: () => closed,
  };
}
