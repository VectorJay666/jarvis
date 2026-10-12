/**
 * Talk 会话外置：切走「说话」页再回来内容还在。
 * 流与定时器也放这里，避免卸载时掐断进行中的请求。
 */
import type { TalkEvent, TalkStream } from './types';
import type { Drop, Phase } from './Drops';
import type { TalkCard } from './types';
import { sanitizeBossLine } from './sanitizeBossLine';
import { roleIcon } from '../types';

export type Line = {
  id: string;
  kind: 'say' | 'reason' | 'ask' | 'learned' | 'note' | 'boss' | 'user';
  role?: string;
  name?: string;
  text: string;
  short?: string;
  struck?: boolean;
  done: boolean;
  task_id?: string;
  phase?: 'want' | 'revised';
};

export type Card = {
  task_id: string;
  title: string;
  card: TalkCard;
  learned: string[];
  afterLine: number;
  speaker?: string;
};

export type Follow = {
  hint: string;
  plan: string;
  updates: { id: string; because: string; change: string; text?: string; facts?: { sleep_hours?: number } }[];
};

export type TalkState = {
  phase: Phase;
  titles: Record<string, string>;
  names: Record<string, string>;
  drops: Drop[];
  lines: Line[];
  cards: Card[];
  learned: Record<string, string[]>;
  falls: number;
  pulse: number;
  follow: Follow | null;
};

export type UserBubble = { id: string; text: string };

export type TalkSession = {
  s: TalkState;
  draft: string;
  /** 发送失败时恢复用 */
  draftBackup: string;
  userBubbles: UserBubble[];
  src: string;
  minutesOpen: boolean;
};

const emptyState = (): TalkState => ({
  phase: 'idle',
  titles: {},
  names: {},
  drops: [],
  lines: [],
  cards: [],
  learned: {},
  falls: 0,
  pulse: 0,
  follow: null,
});

const note = (id: string, text: string, kind: Line['kind'] = 'note', task_id?: string): Line =>
  ({ id, kind, text, done: true, task_id });

export function reduceTalk(
  s: TalkState,
  a: { type: 'reset' } | { type: 'listen' } | { type: 'ev'; e: TalkEvent },
): TalkState {
  if (a.type === 'listen') return { ...emptyState(), phase: 'listening' };
  if (a.type === 'reset') return { ...emptyState(), phase: 'running' };
  const e = a.e;
  // listening 也收事件：发送后立刻开流，不因 900ms 闸门丢事件
  if (s.phase !== 'running' && s.phase !== 'asking' && s.phase !== 'following' && s.phase !== 'listening') {
    return s;
  }
  const run: Phase = 'running';
  switch (e.event) {
    case 'session.start':
      return { ...s, phase: s.phase === 'listening' ? run : s.phase };
    case 'intent.split': {
      const titles = Object.fromEntries(e.tasks.map((t) => [t.task_id, t.title]));
      const brief = e.tasks.map((t) => t.title).join(' · ');
      return {
        ...s,
        phase: run,
        titles,
        lines: [...s.lines, note(`split-${e.seq}`, `拆成 ${e.tasks.length} 件事：${brief}`)],
      };
    }
    case 'boss.ack':
      return {
        ...s,
        phase: s.phase === 'listening' ? run : s.phase,
        lines: [...s.lines, note(`boss-${e.seq}`, sanitizeBossLine(e.line), 'boss')],
        pulse: s.pulse + 1,
      };
    case 'role.join':
      return {
        ...s,
        phase: run,
        names: { ...s.names, [e.role]: e.name },
        drops: [
          ...s.drops,
          {
            key: `${e.task_id}:${e.role}`,
            task_id: e.task_id,
            role: e.role,
            icon: roleIcon(e.role),
            vetoed: false,
            merged: false,
            x: 0,
            y: 0,
          },
        ],
      };
    case 'role.say': {
      const i = s.lines.findIndex((l) => l.id === e.line_id);
      const lines = s.lines.slice();
      if (i < 0) {
        lines.push({
          id: e.line_id,
          kind: 'say',
          role: e.role,
          name: s.names[e.role] ?? e.role,
          text: e.short && e.done ? e.short : e.delta,
          short: e.short,
          done: e.done,
          task_id: e.task_id,
          phase: e.phase,
        });
      } else {
        lines[i] = {
          ...lines[i],
          text: e.short && e.done ? e.short : lines[i].text + e.delta,
          short: e.short ?? lines[i].short,
          done: e.done,
          phase: e.phase ?? lines[i].phase,
        };
      }
      return { ...s, phase: run, lines, pulse: i < 0 ? s.pulse + 1 : s.pulse };
    }
    case 'veto': {
      const lines = s.lines.map((l) =>
        l.id === e.line_id || (l.phase === 'want' && l.task_id === e.task_id && l.role === e.to)
          ? { ...l, struck: true }
          : l,
      );
      const at = lines.findIndex((l) => l.id === e.line_id);
      lines.splice(at < 0 ? lines.length : at + 1, 0, note(`${e.line_id}-why`, e.reason, 'reason', e.task_id));
      const toKey = `${e.task_id}:${e.to}`;
      return {
        ...s,
        lines,
        drops: s.drops.map((d) =>
          d.key === toKey
            ? { ...d, vetoed: true }
            : d.task_id === e.task_id && d.role === e.from
              ? { ...d, pushTo: toKey }
              : d,
        ),
      };
    }
    case 'refuse': {
      const raw =
        (e.boss_line && String(e.boss_line).trim()) ||
        '这期我先帮你盯睡眠、活动、训练、饮食';
      return { ...s, phase: run, lines: [...s.lines, note(`rf-${e.seq}`, sanitizeBossLine(raw), 'note', e.task_id)] };
    }
    case 'ask':
      return {
        ...s,
        phase: 'asking',
        lines: [
          ...s.lines,
          {
            id: e.ask_id,
            kind: 'ask',
            role: 'jarvis',
            name: '头头',
            text: sanitizeBossLine(e.question),
            done: true,
            task_id: e.task_id,
          },
        ],
      };
    case 'habit.learned':
      return {
        ...s,
        learned: { ...s.learned, [e.task_id]: [...(s.learned[e.task_id] ?? []), e.rule.text] },
        lines: [...s.lines, note(`hl-${e.seq}`, `这次学会了：${e.rule.text}`, 'learned', e.task_id)],
      };
    case 'habit.applied':
      return { ...s, lines: [...s.lines, note(`ap-${e.seq}`, `按你的习惯改了：${e.text}`)] };
    case 'card.ready': {
      const card = e.card
        ? {
            ...e.card,
            boss_line: sanitizeBossLine(
              (e.card.boss_line || '').replace(/^头头已拍板：/, '我帮你定了：') ||
                `我帮你定了：${e.card.headline}`,
            ),
          }
        : e.card;
      return {
        ...s,
        phase: run,
        falls: s.falls + 1,
        drops: s.drops.map((d) => (d.task_id === e.task_id ? { ...d, merged: true } : d)),
        cards: card
          ? [
              ...s.cards,
              {
                task_id: e.task_id,
                title: s.titles[e.task_id] ?? '',
                card,
                learned: s.learned[e.task_id] ?? [],
                afterLine: s.lines.length,
                speaker: e.speaker ?? 'boss',
              },
            ]
          : s.cards,
      };
    }
    case 'task.done':
      return { ...s, drops: s.drops.map((d) => (d.task_id === e.task_id ? { ...d, merged: true } : d)) };
    case 'follow.start':
      return {
        ...s,
        phase: 'following',
        drops: s.drops.map((d) => ({ ...d, merged: true })),
        follow: {
          hint: sanitizeBossLine(e.hint || '跟进中') || '跟进中',
          plan: e.plan || '',
          updates: s.follow?.updates ?? [],
        },
      };
    case 'follow.update':
      return {
        ...s,
        phase: 'following',
        drops: s.drops.map((d) => ({ ...d, merged: true })),
        follow: {
          hint: s.follow?.hint || '跟进中',
          plan: s.follow?.plan || '',
          updates: [
            ...(s.follow?.updates ?? []),
            {
              id: e.id,
              because: e.because,
              change: e.change,
              text: (e as { text?: string }).text,
              facts: (e as { facts?: { sleep_hours?: number } }).facts,
            },
          ],
        },
      };
    case 'error':
      return { ...s, lines: [...s.lines, note(`err-${e.seq}`, `提示：${e.message || e.code}`)] };
    case 'done':
      return {
        ...s,
        phase: s.follow ? 'following' : 'done',
        drops: s.drops.map((d) => ({ ...d, merged: true })),
      };
    case 'cancelled':
      return {
        ...s,
        phase: 'stopped',
        lines: [
          ...s.lines.map((l) =>
            l.kind === 'say' && !l.done ? { ...l, text: `${l.text}…`, done: true } : l,
          ),
          note(`stop-${e.seq}`, '已停止'),
        ],
      };
    default:
      return s;
  }
}

type Listener = () => void;

let session: TalkSession = {
  s: emptyState(),
  draft: '',
  draftBackup: '',
  userBubbles: [],
  src: '',
  minutesOpen: false,
};

let stream: TalkStream | null = null;
let listenTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function getTalkSession(): TalkSession {
  return session;
}

export function getTalkStream(): TalkStream | null {
  return stream;
}

export function subscribeTalk(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setTalkDraft(text: string) {
  session = { ...session, draft: text };
  emit();
}

export function setTalkMinutesOpen(open: boolean) {
  session = { ...session, minutesOpen: open };
  emit();
}

export function setTalkSrc(src: string) {
  session = { ...session, src };
  emit();
}

export function dispatchTalk(a: { type: 'reset' } | { type: 'listen' } | { type: 'ev'; e: TalkEvent }) {
  session = { ...session, s: reduceTalk(session.s, a) };
  emit();
}

/** 取消待发定时器；不取消进行中的流（切页不掐请求） */
export function clearTalkSendTimer() {
  if (listenTimer) {
    clearTimeout(listenTimer);
    listenTimer = null;
  }
}

export function setTalkStream(next: TalkStream | null) {
  stream = next;
}

export function cancelTalkStream() {
  clearTalkSendTimer();
  stream?.cancel();
  stream = null;
}

/**
 * 开始一轮对话：立刻进入聆听并开流（无 900ms 闸门）。
 * 用户气泡写入 session；草稿清空；失败时由 onFail 恢复 draftBackup。
 */
export function beginTalkSend(opts: {
  text: string;
  startStream: (text: string, onEvent: (e: TalkEvent) => void) => TalkStream;
  onEvent: (e: TalkEvent) => void;
}): void {
  const t = opts.text.trim();
  if (!t) return;
  clearTalkSendTimer();
  stream?.cancel();
  stream = null;

  const bubble: UserBubble = { id: `u-${Date.now()}`, text: t };
  // 新一轮：清会话态，只保留本轮用户气泡；草稿先清空，backup 待成功/失败处理
  session = {
    ...session,
    draft: '',
    draftBackup: t,
    userBubbles: [bubble],
    src: '',
    minutesOpen: false,
    s: reduceTalk(session.s, { type: 'listen' }),
  };
  emit();

  // 立刻开流：无 900ms；随后切 running（listening 可收首包）
  session = { ...session, s: reduceTalk(session.s, { type: 'reset' }) };
  emit();

  try {
    stream = opts.startStream(t, opts.onEvent);
    session = { ...session, src: stream.source };
    emit();
  } catch {
    session = {
      ...session,
      draft: session.draftBackup || t,
      draftBackup: '',
      s: { ...session.s, phase: 'idle' },
    };
    emit();
  }
}

/** 流失败/错误时恢复草稿（保留用户气泡） */
export function restoreTalkDraftOnFail() {
  if (!session.draftBackup) return;
  session = { ...session, draft: session.draftBackup, draftBackup: '' };
  emit();
}

/** 首包成功或结束：丢掉失败恢复用草稿 */
export function clearTalkDraftBackup() {
  if (!session.draftBackup) return;
  session = { ...session, draftBackup: '' };
  emit();
}

export const SUGGEST_CHIPS = ['今晚想轻练一下', '冰箱能做什么晚饭', '睡得不多，帮我看着点'] as const;
