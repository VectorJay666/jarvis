import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { cancelAnimation, Easing, FadeInDown, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../talk/Drops';

export type GlassTarget = React.RefObject<View | null>;
export const ConversationGlassContext = createContext<GlassTarget | undefined>(undefined);

/** One glass treatment for bubbles, cards and controls; motion only runs on changes. */
export function FlowSurface({ children, style, delay = 0, testID, blurTarget, animate = true, blurIntensity = 42, tone = 'light' }: { children: React.ReactNode; style?: React.ComponentProps<typeof View>['style']; delay?: number; testID?: string; blurTarget?: GlassTarget; animate?: boolean; blurIntensity?: number; tone?: 'light' | 'dark' }) {
  const reduced = useReduceMotion();
  const inheritedTarget = useContext(ConversationGlassContext);
  const target = blurTarget || inheritedTarget;
  const dark = tone === 'dark';
  return <Animated.View testID={testID} style={[s.surface, dark && s.darkSurface, style]} entering={reduced || !animate ? undefined : FadeInDown.duration(300).springify().damping(24).stiffness(220).mass(0.8).delay(delay)} layout={reduced ? undefined : LinearTransition.springify().damping(28).stiffness(260)}>
    <BlurView pointerEvents="none" blurTarget={target} blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'} intensity={blurIntensity} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={dark ? ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.48)'] : ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.08)', 'rgba(231,239,232,0.16)']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
    {children}
  </Animated.View>;
}

/** Smooth actual arriving chunks; never fabricate text while waiting for the model. */
export function FlowText({ text, streaming, style }: { text: string; streaming?: boolean; style?: React.ComponentProps<typeof Text>['style'] }) {
  const reduced = useReduceMotion();
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (!streaming || reduced) return;
    const timer = setInterval(() => setShown(previous => {
      if (!text.startsWith(previous)) return text;
      const old = Array.from(previous), goal = Array.from(text);
      return goal.slice(0, old.length + Math.max(2, Math.ceil((goal.length - old.length) / 4))).join('');
    }), 32);
    return () => clearInterval(timer);
  }, [text, streaming, reduced]);
  return <Text style={style}>{streaming && !reduced ? shown : text}</Text>;
}

export function ConversationOrb({ active, input = '' }: { active: boolean; input?: string }) {
  const reduced = useReduceMotion();
  const breath = useSharedValue(1), turn = useSharedValue(0), pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced || !active) { cancelAnimation(breath); cancelAnimation(turn); breath.set(1); turn.set(0); return; }
    breath.set(withRepeat(withSequence(withTiming(1.09, { duration: 1000, easing: Easing.inOut(Easing.sin) }), withTiming(0.98, { duration: 1000, easing: Easing.inOut(Easing.sin) })), -1));
    turn.set(withRepeat(withTiming(360, { duration: 6500, easing: Easing.linear }), -1));
    return () => { cancelAnimation(breath); cancelAnimation(turn); };
  }, [active, reduced, breath, turn]);
  useEffect(() => {
    if (reduced || !input) return;
    pulse.set(withSequence(withTiming(1, { duration: 100 }), withTiming(0, { duration: 380 })));
  }, [input, reduced, pulse]);
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: breath.get() + pulse.get() * 0.09 }, { rotate: `${turn.get()}deg` }] }));
  const halo = useAnimatedStyle(() => ({ opacity: active ? 0.12 + (breath.get() - 1) * 0.8 : pulse.get() * 0.2, transform: [{ scale: 1 + pulse.get() * 0.2 }] }));
  return <View style={s.orbSpace} testID={active ? 'conversation-orb-active' : 'conversation-orb'} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Animated.View style={[s.halo, halo]} /><Animated.View style={[s.orb, orb]}><LinearGradient colors={['#C3C6E5', '#667092', '#222735']} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} /><View style={s.glint} /></Animated.View></View>;
}
const s = StyleSheet.create({ surface: { borderRadius: 24, overflow: 'hidden', backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.24)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)' }, darkSurface: { backgroundColor: 'rgba(28,28,30,0.72)', borderColor: 'rgba(255,255,255,0.16)' }, orbSpace: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, orb: { width: 27, height: 27, borderRadius: 20, overflow: 'hidden', borderWidth: 0.5, borderColor: '#FFF8' }, halo: { position: 'absolute', width: 39, height: 39, borderRadius: 24, backgroundColor: '#858BBF' }, glint: { position: 'absolute', top: 4, left: 5, width: 11, height: 7, borderRadius: 8, backgroundColor: '#FFFFFF44', transform: [{ rotate: '-28deg' }] } });
