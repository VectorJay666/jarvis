/** 视觉规范 v0.2 黑白极简（06-Frontend-v0.2视觉规范-黑白.md） */
export const colors = {
  bg: '#FFFFFF',
  surface: '#F5F5F5',
  hairline: '#E6E6E6',
  text: '#000000',
  text2: '#5C5C5C',
  text3: '#8A8A8A',
  accent: '#000000',
  danger: '#D70015',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { card: 12, ctl: 8, pill: 999 } as const;

export const type = {
  largeTitle: { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.3, color: colors.text },
  headline: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26, color: colors.text },
  number: { fontSize: 32, fontWeight: '600' as const, fontVariant: ['tabular-nums' as const], color: colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21, color: colors.text },
  subhead: { fontSize: 13, fontWeight: '500' as const, color: colors.text },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, color: colors.text3 },
};
