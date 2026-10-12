/** 事件格式以 07-后端-一句话多任务与思考流-草案.md 为准（含 boss / follow） */
export type TalkCard = {
  headline: string;
  defaulted?: boolean;
  disclaimer?: string;
  boss_line?: string;
  items?: { role: string; text: string }[];
  handoffs?: { role: string; text?: string; line?: string; action?: string }[];
  /** 卡内事实大数字（跟进/结论用，空闲首页不出现） */
  facts?: { label: string; value: string | number; unit?: string }[];
};

type Base = { session_id: string; seq: number; ts: number };
export type TalkEvent = Base & (
  | { event: 'session.start'; text: string }
  | { event: 'intent.split'; tasks: { task_id: string; intent: string; title: string }[] }
  | { event: 'boss.ack'; line: string; roles: string[] }
  | { event: 'role.join'; task_id: string; role: string; name: string; icon: string }
  | { event: 'role.say'; task_id: string; role: string; line_id: string; delta: string; done: boolean; short?: string; full?: string; phase?: 'want' | 'revised' }
  | { event: 'veto'; task_id: string; from: string; to: string; line_id: string; reason: string }
  | { event: 'refuse'; task_id: string; title: string; reason: string; speaker?: 'boss'; boss_line?: string }
  | { event: 'ask'; task_id: string; ask_id: string; role: string; question: string; speaker?: 'boss' }
  | { event: 'habit.learned'; task_id: string; rule: { id: string; text: string; because: string } }
  | { event: 'habit.applied'; task_id: string; rule_id: string; text: string }
  | { event: 'card.ready'; task_id: string; card: TalkCard; speaker?: 'boss' }
  | { event: 'task.done'; task_id: string; status: 'ok' | 'degraded' | 'failed' }
  | { event: 'follow.start'; status: string; hint: string; plan: string }
  | { event: 'follow.update'; id: string; because: string; change: string; sources?: string[] }
  | { event: 'cancelled'; reason: string }
  | { event: 'error'; task_id?: string; code: string; message: string }
  | { event: 'done'; tasks_ok: number; tasks_failed: number }
);
export type TalkStream = { cancel: () => void; source: 'mock' | 'live' };
