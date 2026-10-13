import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { Season } from './SeasonBackground';

const INK: Record<Season, string> = { spring: '#718E73', summer: '#688678', autumn: '#A18C69', winter: '#7E93A0' };

/** A quiet line drawing that changes with the selected season. */
export function SeasonIllustration({ season, size = 88 }: { season: Season; size?: number }) {
  const ink = INK[season];
  return <Svg width={size} height={size * 0.72} viewBox="0 0 112 80" accessible={false} testID="home-season-illustration">
    <Circle cx="85" cy="18" r="10" fill={ink} opacity={0.12} />
    <Path d="M9 58 Q18 43 28 49 L47 24 Q52 17 59 27 L72 40 Q78 32 84 40 L103 60 M40 33 L48 38 L53 31 L59 36 M10 66 Q48 72 101 65" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    <Path d="M27 68 V45 M20 55 L27 44 L34 55 M18 61 L27 50 L36 61 M48 70 V50 M42 60 L48 49 L54 60 M40 66 L48 55 L56 66 M77 69 V48 M71 58 L77 47 L83 58 M69 64 L77 53 L85 64" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {season === 'winter' ? <Path d="M17 25 H23 M20 22 V28 M65 12 H71 M68 9 V15" stroke={ink} strokeWidth="1.2" strokeLinecap="round" /> : <Path d="M15 24 Q19 19 23 24 Q27 19 31 24" fill="none" stroke={ink} strokeWidth="1.2" strokeLinecap="round" />}
  </Svg>;
}
