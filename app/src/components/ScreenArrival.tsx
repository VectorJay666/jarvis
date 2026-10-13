import React, { useEffect } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../talk/Drops';
import { ArrivalContext } from './ContentArrival';

/** A short liquid settling motion, while preserving hidden screen state. */
export function ScreenArrival({ active, children }: { active: boolean; children: React.ReactNode }) {
  const reduced = useReduceMotion();
  const settle = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(settle); cancelAnimation(opacity);
    if (!active || reduced) { settle.set(1); opacity.set(1); return; }
    settle.set(0); opacity.set(0);
    settle.set(withSpring(1, { damping: 19, stiffness: 125, mass: 0.7 }));
    opacity.set(withTiming(1, { duration: 280 }));
    return () => { cancelAnimation(settle); cancelAnimation(opacity); };
  }, [active, reduced, settle, opacity]);
  const motion = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: (1 - settle.get()) * 14 }, { scaleX: 0.974 + settle.get() * 0.026 }, { scaleY: 1.018 - settle.get() * 0.018 }] }));
  return <ArrivalContext.Provider value={{ active, reduceMotion: reduced }}><Animated.View style={[{ flex: 1, display: active ? 'flex' : 'none' }, motion]} pointerEvents={active ? 'auto' : 'none'} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>{children}</Animated.View></ArrivalContext.Provider>;
}
