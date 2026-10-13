export type Period = 'morning' | 'evening' | 'night';
export type Mode = 'demo' | 'agent';
export type Evidence = { id: string; title: string; year: number; type: string; url: string; scope: string; review: string };
export type Card = { title: string; rows: { label: string; value: string }[]; basis: string; evidence_ids: string[] };
export type Reply = { reply: string; cards: Card[]; quick_replies: string[]; reminder_request: { title: string; question: string; time?: string } | null };
export type Message = { id: string; role: 'user' | 'assistant'; content: string; result?: Reply };
export type Conversation = { messages: Message[]; current?: Reply; period: Period; step: number };
