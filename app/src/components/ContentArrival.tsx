import React, { createContext, useContext, useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

export const ArrivalContext = createContext({ active: true, reduceMotion: false });

/** Keep the final layout in place while its content gently floats into view. */
export function ContentArrival({ children, active, reduceMotion, delay = 0, style, testID }: {
  children: React.ReactNode;
  active?: boolean;
  reduceMotion?: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const screen = useContext(ArrivalContext);
  const visible = active ?? screen.active;
  const reduced = reduceMotion ?? screen.reduceMotion;
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    cancelAnimation(progress);
    progress.set(reduced ? 1 : 0);
    if (visible && !reduced) progress.set(withDelay(Math.min(delay, 640), withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) })));
    return () => cancelAnimation(progress);
  }, [visible, reduced, delay, progress]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: reduced ? 0 : (1 - progress.get()) * 12 }, { scale: reduced ? 1 : 0.97 + progress.get() * 0.03 }] }));
  return <Animated.View testID={testID} style={[style, motion]}>{children}</Animated.View>;
}
