import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '../talk/Drops';
import { hap } from '../talk/haptics';
import type { HomeTheme } from '../theme/homeTheme';

export type TabKey = 'talk' | 'today' | 'team' | 'habits' | 'me';
const TABS: { key: TabKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; outline: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'talk', label: '开始', icon: 'mic', outline: 'mic-outline' },
  { key: 'today', label: '今日', icon: 'today', outline: 'today-outline' },
  { key: 'team', label: '跟进', icon: 'people', outline: 'people-outline' },
  { key: 'habits', label: '习惯', icon: 'bulb', outline: 'bulb-outline' },
  { key: 'me', label: '我的', icon: 'person', outline: 'person-outline' },
];

const HEIGHT = 64;
const GAP = 12;
export const tabBarInset = (bottom: number) => HEIGHT + GAP + Math.max(bottom, GAP);

/** Keep this at the screen owner so both navigation surfaces share one position. */
export function useTabIndicator(value: TabKey): SharedValue<number> {
  const position = useSharedValue(TABS.findIndex((tab) => tab.key === value));
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    const next = TABS.findIndex((tab) => tab.key === value);
    position.set(reduceMotion ? next : withSpring(next, { damping: 24, stiffness: 280, mass: 0.8, overshootClamping: true }));
  }, [position, reduceMotion, value]);
  return position;
}

type Props = {
  value: TabKey;
  onChange: (tab: TabKey) => void;
  bottom: number;
  indicator: SharedValue<number>;
  blurTarget: React.RefObject<View | null>;
  glass?: boolean;
  active?: boolean;
  /** Home passes `/v1/home` theme. Other tabs keep the light capsule. */
  chrome?: HomeTheme;
};

export function TabBar({ value, onChange, bottom, indicator, blurTarget, glass = false, active = true, chrome }: Props) {
  const [width, setWidth] = useState(0);
  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicator.get() * width / TABS.length }],
  }), [width]);

  const dark = chrome != null && chrome.mode !== 'light';
  const selectedColor = chrome?.accent ?? '#252830';
  const idleColor = chrome?.muted ?? '#7C818B';
  return (
    <View pointerEvents="box-none" style={[st.dock, glass && st.sheetDock, { paddingBottom: Math.max(bottom, GAP) }]} testID="glass-tab-dock">
      <View style={[st.shadow, glass && st.sheetShadow]}>
        <View style={[st.capsule, dark && { backgroundColor: 'rgba(28,28,30,0.55)', borderColor: 'rgba(255,255,255,0.14)' }]} testID="glass-tabbar" accessibilityRole="tablist" accessibilityLabel="主导航">
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {active ? <BlurView blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus" intensity={60} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} testID="glass-tab-blur" /> : null}
            <LinearGradient colors={dark ? ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.28)'] : ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.04)', 'rgba(219,222,230,0.12)']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
          </View>
          <View style={st.track} onLayout={(event) => { if (event.nativeEvent.layout.width > 0) setWidth(event.nativeEvent.layout.width); }}>
            {width > 0 ? (
              <Animated.View pointerEvents="none" style={[st.highlight, { width: width / TABS.length - 4 }, dark && { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.2)' }, highlightStyle]} testID="glass-tab-highlight">
                <LinearGradient colors={dark ? ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.08)'] : ['rgba(255,255,255,0.96)', 'rgba(229,232,238,0.72)']} style={StyleSheet.absoluteFill} />
              </Animated.View>
            ) : null}
            {TABS.map((tab) => {
              const selected = tab.key === value;
              const color = selected ? selectedColor : idleColor;
              return (
                <Pressable key={tab.key} testID={`tab-${tab.key}`} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }} aria-selected={selected}
                  onPress={() => { if (!selected) { void hap.selection(); onChange(tab.key); } }}
                  style={({ pressed }) => [st.tab, pressed && st.pressed]}>
                  <Ionicons name={selected ? tab.icon : tab.outline} size={22} color={color} />
                  <Text numberOfLines={1} style={[st.label, { color }, selected && st.selectedLabel, selected && chrome ? { color: selectedColor } : null]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: GAP },
  sheetDock: { paddingHorizontal: 10 },
  shadow: { borderRadius: 34, boxShadow: '0 8px 28px rgba(27,35,53,0.10), 0 2px 6px rgba(27,35,53,0.05)' },
  sheetShadow: { boxShadow: '0 6px 22px rgba(27,35,53,0.08), 0 2px 5px rgba(27,35,53,0.04)' },
  capsule: { height: HEIGHT, borderRadius: 34, borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', padding: 5, overflow: 'hidden', backgroundColor: 'rgba(242,244,248,0.24)' },
  track: { flex: 1, flexDirection: 'row' },
  highlight: { position: 'absolute', top: 0, bottom: 0, left: 2, borderRadius: 27, borderWidth: 1, borderColor: 'rgba(255,255,255,0.94)', backgroundColor: 'rgba(223,227,235,0.52)', overflow: 'hidden', boxShadow: '0 2px 7px rgba(25,32,48,0.07)' },
  tab: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 27 },
  pressed: { opacity: 0.6, backgroundColor: 'rgba(255,255,255,0.26)' },
  label: { fontSize: 10, lineHeight: 14, fontWeight: '500', color: '#7C818B' },
  selectedLabel: { color: '#252830', fontWeight: '600' },
});
