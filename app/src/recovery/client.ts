import { fetch as streamingFetch } from 'expo/fetch';
import { API_BASE } from '../config';
import type { Evidence, Message, Reply } from './types';
import type { HealthSnapshot } from '../talk/healthSnapshot';
import { createEventDecoder } from './stream';
export type StreamOptions = { onReply?: (text: string) => void; signal?: AbortSignal };
export type AssistantReply = Reply & { topic: 'sleep' | 'fitness' | 'diet' | 'budget' | 'general'; confidence: number };
export async function getRecoveryStatus(): Promise<{ configured: boolean; model?: string; evidence?: Evidence[] }> {
  if (!API_BASE) return { configured: false };
  const response = await fetch(`${API_BASE}/v1/recovery/status`, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error('暂时无法连接对话服务。');
  return response.json();
}
async function conversation<T extends Reply>(endpoint: string, messages: Message[], health: HealthSnapshot, options: StreamOptions = {}): Promise<T> {
  if (!API_BASE) throw new Error('对话暂时未连接，请稍后再试。');
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 35000);
  try {
    const response = await streamingFetch(`${API_BASE}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })), health, calendar: { status: 'unavailable' }, local_time: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    if (!response.ok) { const body = await response.json(); throw new Error(body.message || '对话服务暂时没有回应，请重试。'); }
    if (!response.body) throw new Error('连接没有返回内容，请重试。');
    const reader = response.body.getReader();
    const utf8 = new TextDecoder();
    let result: T | undefined;
    const events = createEventDecoder(event => {
      if (event.type === 'reply') options.onReply?.(event.text);
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'complete') result = event.result as T;
    });
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break; events.push(utf8.decode(value, { stream: true })); }
      events.push(utf8.decode()); events.finish();
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (!result) throw new Error('回复暂时中断，你的消息已保留。请重试。');
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(options.signal?.aborted ? '已停止回复，你的消息已保留。' : '回复等得有点久，你的消息已保留。请重试。');
    throw error;
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
export const askRecovery = (messages: Message[], health: HealthSnapshot, options?: StreamOptions) => conversation<Reply>('/v1/recovery/stream', messages, health, options);
export const askAssistant = (messages: Message[], health: HealthSnapshot, options?: StreamOptions) => conversation<AssistantReply>('/v1/assistant/stream', messages, health, options);
