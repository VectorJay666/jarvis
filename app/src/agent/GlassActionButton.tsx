/**
 * Soft-square action button — Frontend empty-Jarvis hard lines:
 * radius 16, white + hairline, press fill #F5F5F5 + scale 0.97
 * glass follow on press (BlurView + drag ×0.35 + withSpring); no why / no chevron
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { hap } from '../talk/haptics';
import type { HomeAction } from './home.mjs';

/** damping 22 @ stiffness 180 ≈ dampingRatio 0.82–0.88 */
const SPRING = { damping: 22, stiffness: 180, mass: 1 };
const FOLLOW = 0.35;
const MAX = 28;

function rubber(v: number) {
  'worklet';
  const a = Math.abs(v);
  if (a <= MAX) return v;
  const extra = a - MAX;
  const decayed = MAX + extra * 0.25;
  return v < 0 ? -decayed : decayed;
}

type Props = {
  action: HomeAction;
  reduceMotion: boolean;
  onPress: () => void;
  testID?: string;
};

export function GlassActionButton({ action, reduceMotion, onPress, testID }: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  const w = useSharedValue(200);
  const h = useSharedValue(54);
  const didTap = useSharedValue(false);

  const doTap = useMemo(() => () => { onPress(); }, [onPress]);
  const doLight = useMemo(() => () => { hap.light(); }, []);

  const gesture = useMemo(() => {
    if (reduceMotion) {
      return Gesture.Tap()
        .onBegin(() => { pressed.value = withTiming(1, { duration: 80 }); })
        .onFinalize((_, ok) => {
          pressed.value = withTiming(0, { duration: 120 });
          if (ok) {
            runOnJS(doLight)();
            runOnJS(doTap)();
          }
        });
    }
    return Gesture.Pan()
      .minDistance(0)
      .onBegin(() => {
        didTap.value = false;
        pressed.value = 1;
        scale.value = withTiming(0.97, { duration: 100 });
      })
      .onUpdate((e) => {
        tx.value = rubber(e.translationX * FOLLOW);
        ty.value = rubber(e.translationY * FOLLOW);
      })
      .onEnd((e) => {
        const hw = w.value / 2;
        const hh = h.value / 2;
        didTap.value = Math.abs(e.translationX) <= hw && Math.abs(e.translationY) <= hh;
      })
      .onFinalize(() => {
        pressed.value = 0;
        scale.value = withSpring(1, SPRING);
        tx.value = withSpring(0, SPRING);
        ty.value = withSpring(0, SPRING);
        runOnJS(doLight)();
        if (didTap.value) runOnJS(doTap)();
      });
  }, [reduceMotion, doTap, doLight, pressed, scale, tx, ty, w, h, didTap]);

  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: reduceMotion ? 0 : tx.value },
      { translateY: reduceMotion ? 0 : ty.value },
      { scale: reduceMotion ? 1 : scale.value },
    ],
    backgroundColor: pressed.value ? '#F5F5F5' : '#FFFFFF',
    zIndex: pressed.value ? 4 : 0,
    ...(Platform.OS === 'web' ? ({ touchAction: 'none' } as object) : null),
  }));

  const glassOp = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : pressed.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID={testID}
        onLayout={(e) => { w.value = e.nativeEvent.layout.width; h.value = e.nativeEvent.layout.height; }}
        style={[st.row, anim]}
      >
        {!reduceMotion ? (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.glassClip, glassOp]}>
            <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
            <View style={st.glassTint} />
          </Animated.View>
        ) : null}
        <Ionicons name={`${action.icon}-outline` as never} size={20} color="#000000" />
        <Text style={st.label} numberOfLines={1}>{action.label}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
    overflow: 'hidden',
  },
  glassClip: { borderRadius: 16, overflow: 'hidden' },
  glassTint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.28)' },
  label: { flex: 1, fontSize: 17, fontWeight: '600', color: '#000000', letterSpacing: -0.2 },
});
