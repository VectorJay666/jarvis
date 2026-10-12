/**
 * 头头对用户可见文案的展示兜底：拦「产品/技术/开会」元叙事，
 * 以及引号回显短碎片（如 「你办」）。不改布局，只换固定澄清句。
 */
export const BOSS_CLARIFY =
  '能再说具体一点吗？今晚是想睡觉、动一动，还是吃点啥？';

/** 产品 / 技术 / 开会 元叙事（台上只有健康秘书团） */
const META_NARRATIVE = /产品|技术|开会/;

/** 引号里短碎片回显，如 「你办」『那个』"帮我" */
const QUOTED_FRAGMENT = /[「『"'][^」』"']{1,6}[」』"']/;

/**
 * 脏则换成固定澄清句，干净原样返回。
 * 空串原样返回，避免把缺省文案冲掉。
 */
export function sanitizeBossLine(text: string | null | undefined): string {
  const t = (text ?? '').trim();
  if (!t) return t;
  if (META_NARRATIVE.test(t) || QUOTED_FRAGMENT.test(t)) return BOSS_CLARIFY;
  return t;
}

/** 是否脏文案（自检 / 单测用） */
export function isDirtyBossLine(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return META_NARRATIVE.test(t) || QUOTED_FRAGMENT.test(t);
}
