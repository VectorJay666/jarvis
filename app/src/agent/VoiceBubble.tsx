import React, { memo, useEffect, useId, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

type Props = { size: number; active: boolean; reduceMotion: boolean; pulse: SharedValue<number> };

/** Abstract light: one UI-thread clock moves static layers; no JS frame updates. */
export const VoiceBubble = memo(function VoiceBubble({ size, active, reduceMotion, pulse }: Props) {
  const id = useId().replace(/:/g, '');
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const phase = useSharedValue(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    cancelAnimation(phase);
    if (!active || !foreground || reduceMotion) { phase.set(0); return; }
    phase.set(0);
    phase.set(withRepeat(withTiming(Math.PI * 2, { duration: 6200, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(phase);
  }, [active, foreground, phase, reduceMotion]);
  const body = useAnimatedStyle(() => {
    const t = phase.get();
    const p = reduceMotion || !active || !foreground ? 0 : pulse.get();
    return { transform: [
      { translateY: Math.sin(t) * size * 0.025 - p * 2 },
      { rotate: `${Math.sin(t) * 1.6}deg` },
      { scaleX: 1 + Math.sin(t * 2) * 0.018 + p * 0.035 },
      { scaleY: 1 - Math.sin(t * 2) * 0.014 - p * 0.018 },
    ] };
  });
  const reflection = useAnimatedStyle(() => ({ transform: [
    { translateX: Math.sin(phase.get()) * size * 0.022 },
    { translateY: Math.sin(phase.get() * 2) * size * 0.018 },
    { rotate: `${Math.sin(phase.get()) * 4}deg` },
  ] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.2 + (reduceMotion || !active || !foreground ? 0 : pulse.get() * 0.35), transform: [{ scaleX: 1 + Math.sin(phase.get()) * 0.05 }] }));
  return <View style={{ width: size, height: size }} pointerEvents="none" accessible={false} testID="voice-bubble">
    <Animated.View style={[s.halo, { width: size * 1.25, height: size * 0.24, left: -size * 0.125, bottom: -size * 0.11 }, halo]} testID="agent-orb-halo">
      <Svg width="100%" height="100%" viewBox="0 0 150 28"><Defs><RadialGradient id={`${id}shadow`}><Stop offset="0" stopColor="#B0ADA0" stopOpacity="0.5"/><Stop offset="1" stopColor="#B9CDD2" stopOpacity="0"/></RadialGradient></Defs><Ellipse cx="75" cy="14" rx="75" ry="14" fill={`url(#${id}shadow)`}/></Svg>
    </Animated.View>
    <Animated.View style={[s.body, { width: size, height: size }, body]} testID="agent-orb-body">
      <Svg width="100%" height="100%" viewBox="0 0 160 160">
        <Defs>
          <RadialGradient id={`${id}base`} cx="32%" cy="28%" r="85%"><Stop offset="0" stopColor="#FFF9E5"/><Stop offset="0.42" stopColor="#E8DCD9"/><Stop offset="0.78" stopColor="#C4D6D2"/><Stop offset="1" stopColor="#B5C8DC" stopOpacity="0.7"/></RadialGradient>
          <RadialGradient id={`${id}pink`}><Stop offset="0" stopColor="#E8B8CD" stopOpacity="0.8"/><Stop offset="1" stopColor="#E8B8CD" stopOpacity="0"/></RadialGradient>
          <RadialGradient id={`${id}light`}><Stop offset="0" stopColor="#FFFDF1" stopOpacity="0.85"/><Stop offset="1" stopColor="#FFFDF1" stopOpacity="0"/></RadialGradient>
        </Defs>
        <Path d="M80 11 C119 6 147 42 146 79 C150 117 121 151 81 148 C39 153 11 127 13 85 C7 43 40 14 80 11Z" fill={`url(#${id}base)`}/>
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, reflection]}>
        <Svg width="100%" height="100%" viewBox="0 0 160 160">
          <Defs><RadialGradient id={`${id}warm`}><Stop offset="0" stopColor="#E9C2D1" stopOpacity="0.62"/><Stop offset="1" stopColor="#E9C2D1" stopOpacity="0"/></RadialGradient><RadialGradient id={`${id}soft`}><Stop offset="0" stopColor="#FFFCEE" stopOpacity="0.9"/><Stop offset="1" stopColor="#FFFCEE" stopOpacity="0"/></RadialGradient></Defs>
          <Ellipse cx="108" cy="100" rx="37" ry="43" fill={`url(#${id}warm)`}/>
          <Ellipse cx="55" cy="57" rx="32" ry="38" fill={`url(#${id}soft)`}/>
        </Svg>
      </Animated.View>
    </Animated.View>
  </View>;
});
const s = StyleSheet.create({body:{alignItems:'center',justifyContent:'center'},halo:{position:'absolute'}});
