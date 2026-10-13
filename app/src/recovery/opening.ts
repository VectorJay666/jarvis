import type { HealthSnapshot } from '../talk/healthSnapshot';
export type ConversationOpening = { label: string; observation: string; question: string; choices: string[] };
const validHours = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 24;

/** Opening copy uses recorded facts, never the demo baseline or assumed calendar access. */
export function conversationOpening(snapshot: HealthSnapshot, scope: 'home' | 'recovery' = 'home', now = Date.now()): ConversationOpening {
  const sleep = snapshot.sleep_hours;
  const choices = scope === 'recovery' ? ['先安排今天的任务', '根据感受调整运动', '聊聊今晚怎么休息'] : ['先安排今天', '看看运动怎么安排', '聊聊今晚的休息'];
  const question = '你想先从哪件事开始？';
  if (snapshot.source === 'mock') return { label: '演示 · 今天的节奏', observation: validHours(sleep) ? `演示记录里的睡眠是 ${sleep} 小时。我们先看看今天要做的事，再留出休息的空间。` : '这里使用演示记录，可以先体验怎样根据反馈调整一天。', question, choices };
  const stamp = snapshot.updated_at ? new Date(snapshot.updated_at).getTime() : NaN;
  if (!Number.isFinite(stamp) || now - stamp > 36 * 60 * 60 * 1000 || stamp > now + 5 * 60 * 1000) return { label: '先从现在开始', observation: '还没有可确认是近期的健康记录。先听听你现在的感受，再一起安排。', question: '现在更接近哪种状态？', choices: ['精神还可以，先安排任务', '有点累，想留点休息时间', '先聊聊今晚的安排'] };
  if (validHours(sleep)) {
    const raw = snapshot.personal_baseline?.sleep_hours;
    const mean = typeof raw === 'number' ? raw : raw && typeof raw === 'object' && 'mean' in raw ? raw.mean : undefined;
    let observation = `这次记录的睡眠是 ${sleep} 小时。`;
    if (validHours(mean)) {
      const diff = Math.round((sleep - mean) * 10) / 10;
      observation += Math.abs(diff) >= 0.3 ? `比你的个人基线${diff < 0 ? '少' : '多'} ${Math.abs(diff)} 小时。` : '和你的个人基线接近。';
      observation += '安排之前，也想听听你现在的感受。';
    } else observation += '个人历史还不够，先结合你的感受安排。';
    return { label: '睡眠与今天的节奏', observation, question, choices };
  }
  return { label: '一起理一理今天', observation: '近期记录里还没有睡眠数据。可以先从任务和感受开始，慢慢补充。', question: '接下来最想处理哪一件？', choices };
}
