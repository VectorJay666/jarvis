/**
 * Monochrome period line icons beside greeting primary.
 * Frontend: 22×22, stroke 1.5, #3A3A3C — morning sun / afternoon half-sun / evening moon / late star
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import type { GreetPeriod } from './home.mjs';

const SIZE = 22;
const STROKE = 1.5;
const COLOR = '#3A3A3C';

function Sun() {
  // 8 rays around a circle — classic sun line icon
  const cx = 11, cy = 11, r = 3.5;
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const x1 = cx + Math.cos(rad) * 6.2;
    const y1 = cy + Math.sin(rad) * 6.2;
    const x2 = cx + Math.cos(rad) * 9.2;
    const y2 = cy + Math.sin(rad) * 9.2;
    return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLOR} strokeWidth={STROKE} strokeLinecap="round" />;
  });
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 22 22">
      <Circle cx={cx} cy={cy} r={r} stroke={COLOR} strokeWidth={STROKE} fill="none" />
      {rays}
    </Svg>
  );
}

function HalfSun() {
  // Partial day: semicircle + horizon + a few rays upward
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 22 22">
      <Path
        d="M4.5 13.5 A6.5 6.5 0 0 1 17.5 13.5"
        stroke={COLOR}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
      />
      <Line x1={3} y1={13.5} x2={19} y2={13.5} stroke={COLOR} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={11} y1={3.5} x2={11} y2={6} stroke={COLOR} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={5.5} y1={5.8} x2={7} y2={7.5} stroke={COLOR} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1={16.5} y1={5.8} x2={15} y2={7.5} stroke={COLOR} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

function Moon() {
  // Crescent via two overlapping circles (path)
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 22 22">
      <Path
        d="M13.2 3.8 A7.2 7.2 0 1 0 18.2 14.5 A5.8 5.8 0 1 1 13.2 3.8 Z"
        stroke={COLOR}
        strokeWidth={STROKE}
        fill="none"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Star() {
  // 4-point star (diamond cross) — clean late-night mark
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 22 22">
      <Path
        d="M11 2.5 L12.4 9.2 L19 11 L12.4 12.8 L11 19.5 L9.6 12.8 L3 11 L9.6 9.2 Z"
        stroke={COLOR}
        strokeWidth={STROKE}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const MAP: Record<GreetPeriod, () => React.ReactElement> = {
  morning: Sun,
  afternoon: HalfSun,
  evening: Moon,
  late: Star,
};

export function PeriodIcon({
  period,
  testID,
}: {
  period: GreetPeriod;
  testID?: string;
}) {
  const Icon = MAP[period];
  return (
    <View
      testID={testID ?? `period-icon-${period}`}
      accessibilityLabel={period}
      style={{ width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center' }}
    >
      <Icon />
    </View>
  );
}

/** Prefer greet.period; fall back to primary text or hour. */
export function resolvePeriod(
  greet: { period?: GreetPeriod | null; primary?: string },
  hour?: number | null,
): GreetPeriod {
  if (greet.period === 'morning' || greet.period === 'afternoon' || greet.period === 'evening' || greet.period === 'late') {
    return greet.period;
  }
  const p = greet.primary ?? '';
  if (p.includes('早上')) return 'morning';
  if (p.includes('下午')) return 'afternoon';
  if (p.includes('晚上')) return 'evening';
  if (p.includes('夜深')) return 'late';
  const h = hour ?? new Date().getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'late';
}
