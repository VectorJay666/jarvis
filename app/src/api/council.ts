/**
 * v0.2 client. Every call returns { data, source }; network/HTTP failure → local mock.
 * Business rejections (422 on hire) are surfaced, not masked by mock.
 */
import { API_BASE, USE_MOCK } from '../config';
import {
  buildHandoffCard, MockHttpError, mockCompare, mockDeleteRule, mockFeedback, mockHire, mockRoles, mockRules,
} from '../mock/buildHandoffCard';
import type {
  CompareResult, CouncilStatus, HabitRule, HandoffCardData, Role, RolePreview,
} from '../types';
import { DISCLAIMER } from '../types';

export type Source = 'api' | 'mock' | 'fallback';
export type Sourced<T> = { data: T; source: Source; endpoint: string; error?: string };

export class RejectError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const REJECT_TEXT: Record<string, string> = {
  ROLE_OUT_OF_SCOPE: '这类需求不招：医疗、减重、投资类秘书不在服务范围内。',
  NO_TEMPLATE: '暂时没有对应的秘书模板，换个说法试试，比如「这周钱紧」。',
};

async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (/:(9101|9102)\b/.test(API_BASE)) throw new Error('API 基址不可使用 ICT 端口 9101/9102');
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`请求失败：${e instanceof Error ? e.message : '网络错误'}`);
  }
  if (res.status === 422) {
    let code = 'UNPROCESSABLE'; let message = '';
    try { const j = await res.json(); code = j.error ?? code; message = j.message ?? ''; } catch { /* ignore */ }
    throw new RejectError(422, code, REJECT_TEXT[code] ?? (message || '需求被拒绝'));
  }
  if (!res.ok) throw new Error(`接口 ${res.status}`);
  if (res.status === 204) return undefined as T;
  try { return (await res.json()) as T; } catch { throw new Error('响应不是合法 JSON'); }
}

async function withFallback<T>(endpoint: string, live: () => Promise<T>, mock: () => T): Promise<Sourced<T>> {
  if (USE_MOCK) return { data: mock(), source: 'mock', endpoint };
  try {
    return { data: await live(), source: 'api', endpoint };
  } catch (e) {
    if (e instanceof RejectError) throw e;
    return { data: mock(), source: 'fallback', endpoint, error: e instanceof Error ? e.message : String(e) };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeCard(w: any): HandoffCardData {
  if (!w || !Array.isArray(w.handoffs) || w.handoffs.length === 0) throw new Error('会商响应缺少 handoffs');
  return {
    card_id: String(w.card_id ?? `council-${Date.now()}`),
    lead_role: String(w.lead_role ?? w.handoffs[0].role),
    headline: String(w.headline ?? '秘书团会商结果'),
    handoffs: w.handoffs.filter((h: any) => h && h.role && typeof h.action === 'string').map((h: any) => ({
      role: String(h.role), label: String(h.label ?? ''), action: String(h.action), is_new: h.is_new === true,
    })),
    sleep_window: w.sleep_window ? String(w.sleep_window) : null,
    vetoes_applied: (w.vetoes_applied ?? []).map((v: any) => ({ from: String(v.from), to: String(v.to), reason: String(v.reason ?? '') })),
    disclaimer: String(w.disclaimer || DISCLAIMER),
    learned_applied: Array.isArray(w.learned_applied) ? w.learned_applied : [],
  };
}

function body(s: CouncilStatus) {
  const b: Record<string, unknown> = { sleep_hours: s.sleep_hours, free_minutes: s.free_minutes, fridge: s.fridge, active_role: s.active_role };
  if (s.budget_left != null) b.budget_left = s.budget_left;
  return b;
}

export const fetchCouncil = (s: CouncilStatus) =>
  withFallback('/v1/council', async () => normalizeCard(await http('POST', '/v1/council', body(s))), () => buildHandoffCard(s));

export const fetchCompare = (s: CouncilStatus) =>
  withFallback<CompareResult>('/v1/council/compare', async () => {
    const w = await http<any>('POST', '/v1/council/compare', body(s));
    return { before: normalizeCard(w.before), after: normalizeCard(w.after), rules: w.rules ?? [] };
  }, () => mockCompare(s));

export const fetchRoles = () =>
  withFallback<Role[]>('/v1/roles', async () => (await http<{ roles: Role[] }>('GET', '/v1/roles')).roles ?? [], mockRoles);

export const fetchRules = () =>
  withFallback<HabitRule[]>('/v1/habit/rules', async () => (await http<{ rules: HabitRule[] }>('GET', '/v1/habit/rules')).rules ?? [], mockRules);

export const postFeedback = (card_id: string, role: string, note: string) =>
  withFallback<HabitRule[]>('/v1/feedback', async () => {
    const r = await http<{ learned?: HabitRule[] } | undefined>('POST', '/v1/feedback', { card_id, role, rating: 'not_fit', note });
    return r?.learned ?? [];
  }, () => mockFeedback(role, note));

export const deleteRule = (id: string) =>
  withFallback<null>(`/v1/habit/rules/${id}`, async () => { await http('DELETE', `/v1/habit/rules/${encodeURIComponent(id)}`); return null; }, () => { mockDeleteRule(id); return null; });

function wrapMockReject<T>(fn: () => T): () => T {
  return () => {
    try { return fn(); } catch (e) {
      if (e instanceof MockHttpError) throw new RejectError(e.status, e.code, REJECT_TEXT[e.code] ?? e.message);
      throw e;
    }
  };
}

export const previewRole = (need: string) =>
  withFallback<RolePreview>('/v1/roles', async () => (await http<{ preview: RolePreview }>('POST', '/v1/roles', { need })).preview,
    wrapMockReject(() => mockHire(need, false).preview));

export const confirmRole = (need: string) =>
  withFallback<RolePreview>('/v1/roles', async () => {
    const r = await http<any>('POST', '/v1/roles', { need, confirm: true });
    return (r.role ?? r.preview ?? r) as RolePreview;
  }, wrapMockReject(() => mockHire(need, true).preview));
