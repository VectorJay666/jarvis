import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { HomeThemeMode } from '../theme/homeTheme';
import type { GreetPeriod } from './home.mjs';
import { demoHour } from './nudgeClient';

const FADE_MS = 400;
/** Evening and late plates. Artwork by Crea&Cons. */
const DUSK = require('../../assets/bg/jarvis-bg-dusk.png');
const LATE = require('../../assets/bg/jarvis-bg-late.png');

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
type DayScene = 'morning' | 'afternoon' | 'evening';
export type SeasonPreset = Season | DayScene | 'auto' | 'time';
const KEY = 'home_season_background';
export const SEASONS: Record<Season, { label: string; note: string }> = {
  spring: { label: '春', note: '花开有时' },
  summer: { label: '夏', note: '风过青绿' },
  autumn: { label: '秋', note: '风把日子吹慢' },
  winter: { label: '冬', note: '静候一场雪' },
};
const PERIOD_LABELS: Record<GreetPeriod, string> = { morning: '晨光', afternoon: '午后', evening: '暮色', late: '夜静' };
const SCENES: Record<Season | DayScene, { label: string; source: ImageSourcePropType; dark: boolean }> = {
  spring: { label: '春日', source: require('../../assets/backgrounds/spring.jpg'), dark: false },
  summer: { label: '夏日', source: require('../../assets/backgrounds/summer.jpg'), dark: false },
  autumn: { label: '秋日', source: require('../../assets/backgrounds/autumn.jpg'), dark: false },
  winter: { label: '冬日', source: require('../../assets/backgrounds/winter.jpg'), dark: false },
  morning: { label: '晨光', source: require('../../assets/backgrounds/morning.jpg'), dark: false },
  afternoon: { label: '午后', source: require('../../assets/backgrounds/afternoon.jpg'), dark: false },
  evening: { label: '暮色', source: require('../../assets/backgrounds/evening.jpg'), dark: true },
};
function validPreset(value: string | null): value is SeasonPreset {
  return value === 'auto' || value === 'time' || value !== null && Object.hasOwn(SCENES, value);
}
export function seasonForMonth(month: number): Season {
  return month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'autumn' : 'winter';
}
function clockScene() {
  const date = new Date();
  const hour = demoHour() ?? date.getHours();
  const period: GreetPeriod = hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'late';
  return { season: seasonForMonth(date.getMonth()), period };
}
export function useSeasonScene() {
  const [preset, setPreset] = useState<SeasonPreset>('auto');
  const [clock, setClock] = useState(clockScene);
  const selected = useRef(false);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(KEY).then(value => {
      if (mounted && !selected.current && validPreset(value)) setPreset(value);
    }).catch(() => {});
    const refresh = () => {
      const next = clockScene();
      setClock(previous => previous.season === next.season && previous.period === next.period ? previous : next);
    };
    const timer = setInterval(refresh, 60000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { mounted = false; clearInterval(timer); sub.remove(); };
  }, []);
  const select = useCallback((next: SeasonPreset) => {
    selected.current = true;
    setPreset(next);
    // Preserve the last selection even if the user taps several presets quickly.
    writeQueue.current = writeQueue.current.then(() => AsyncStorage.setItem(KEY, next)).catch(() => {});
  }, []);
  const scene = preset === 'auto' ? clock.season : preset === 'time' ? clock.period === 'late' ? 'evening' : clock.period : preset;
  const palette = SCENES[scene];
  return {
    preset, scene, period: clock.period, select,
    label: preset === 'auto' ? `${SEASONS[clock.season].label} · ${PERIOD_LABELS[clock.period]}` : preset === 'time' ? PERIOD_LABELS[clock.period] : palette.label,
    foreground: palette.dark ? '#FAF8F4' : '#3E403E',
    secondary: palette.dark ? '#E6EBF1' : '#676860',
  };
}

function fadePlate(value: SharedValue<number>, to: number, reduceMotion: boolean) {
  cancelAnimation(value);
  value.set(reduceMotion ? to : withTiming(to, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }));
}

/**
 * Light keeps the seasonal photo. Dim crossfades to the dusk plate, dark to the late plate.
 * Missing theme is the afternoon light preset, so it stays on the seasonal photo.
 */
export const ThemeBackdrop = memo(function ThemeBackdrop({ scene, mode, reduceMotion }: { scene: Season | DayScene; mode: HomeThemeMode; reduceMotion: boolean }) {
  const seasonOpacity = useSharedValue(mode === 'light' ? 1 : 0);
  const duskOpacity = useSharedValue(mode === 'dim' ? 1 : 0);
  const lateOpacity = useSharedValue(mode === 'dark' ? 1 : 0);
  useEffect(() => {
    fadePlate(seasonOpacity, mode === 'light' ? 1 : 0, reduceMotion);
    fadePlate(duskOpacity, mode === 'dim' ? 1 : 0, reduceMotion);
    fadePlate(lateOpacity, mode === 'dark' ? 1 : 0, reduceMotion);
  }, [duskOpacity, lateOpacity, mode, reduceMotion, seasonOpacity]);
  const seasonStyle = useAnimatedStyle(() => ({ opacity: seasonOpacity.get() }));
  const duskStyle = useAnimatedStyle(() => ({ opacity: duskOpacity.get() }));
  const lateStyle = useAnimatedStyle(() => ({ opacity: lateOpacity.get() }));
  return <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} testID="home-backdrop" accessibilityLabel={`home-backdrop-${mode}`}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, seasonStyle]} testID={`season-background-${scene}`}>
      <Image source={SCENES[scene].source} resizeMode="cover" fadeDuration={0} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} />
    </Animated.View>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, duskStyle]} testID="theme-bg-dusk">
      <Image source={DUSK} resizeMode="cover" fadeDuration={0} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} accessibilityLabel="暮色背景，Crea&Cons" />
    </Animated.View>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, lateStyle]} testID="theme-bg-late">
      <Image source={LATE} resizeMode="cover" fadeDuration={0} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} accessibilityLabel="夜深背景，Crea&Cons" />
    </Animated.View>
  </View>;
});

export function SeasonPicker({ visible, current, reduceMotion, onClose, onSelect }: { visible: boolean; current: SeasonPreset; reduceMotion: boolean; onClose: () => void; onSelect: (preset: SeasonPreset) => void }) {
  return <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onClose}>
    <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="关闭背景选择" testID="season-picker-backdrop">
      <Pressable style={s.panel} onPress={event => event.stopPropagation()} testID="season-picker">
        <View style={s.heading}><View><Text style={s.title}>四季与时光</Text><Text style={s.subtitle}>给日子，留一点风景</Text></View><Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="完成背景选择"><Ionicons name="close" size={21} color="#666B72"/></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.modes}>{(['auto', 'time'] as const).map(preset => <Pressable key={preset} testID={`season-preset-${preset}`} accessibilityRole="radio" accessibilityState={{checked:current === preset}} style={[s.mode,current === preset && s.selected]} onPress={() => { onSelect(preset); onClose(); }}>
            <Ionicons name={preset === 'auto' ? 'leaf-outline' : 'sunny-outline'} size={18} color="#676A65"/><Text style={s.modeTitle}>{preset === 'auto' ? '跟随季节' : '跟随早中晚'}</Text>
          </Pressable>)}</View>
          <Text style={s.section}>四季</Text>
          <View style={s.grid}>{(['spring','summer','autumn','winter'] as const).map(preset => <SceneChoice key={preset} preset={preset} current={current} onSelect={value => { onSelect(value); onClose(); }}/>)}</View>
          <Text style={s.section}>早 · 中 · 晚</Text>
          <View style={s.grid}>{(['morning','afternoon','evening'] as const).map(preset => <SceneChoice key={preset} preset={preset} current={current} onSelect={value => { onSelect(value); onClose(); }}/>)}</View>
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>;
}
function SceneChoice({preset,current,onSelect}:{preset:Season | DayScene;current:SeasonPreset;onSelect:(preset:SeasonPreset)=>void}) {
  const scene = SCENES[preset];
  return <Pressable accessibilityRole="radio" accessibilityLabel={`${scene.label}背景`} accessibilityState={{checked:current === preset}} testID={`season-preset-${preset}`} style={s.choice} onPress={() => onSelect(preset)}>
    <Image source={scene.source} style={[s.preview,current === preset && s.previewSelected]} resizeMode="cover"/>
    <View style={s.caption}><Text style={s.choiceTitle}>{scene.label}</Text>{current === preset ? <Ionicons name="checkmark" size={14} color="#515C50"/> : null}</View>
  </Pressable>;
}
const s = StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'#20253044',justifyContent:'flex-end',padding:16,paddingBottom:32},
  panel:{backgroundColor:'#FCFCF9',borderRadius:28,padding:20,maxWidth:430,width:'100%',maxHeight:'85%',alignSelf:'center'},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:18},title:{fontSize:22,fontWeight:'600',color:'#262B33'},subtitle:{fontSize:12,color:'#90948C',marginTop:5},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  modes:{flexDirection:'row',gap:10},mode:{flex:1,minHeight:54,borderRadius:14,borderWidth:1,borderColor:'#E5E7E0',alignItems:'center',justifyContent:'center',gap:7,flexDirection:'row'},selected:{backgroundColor:'#E8EDE5',borderColor:'#A7B09F'},modeTitle:{fontSize:13,color:'#51574D'},
  section:{fontSize:12,color:'#8C9087',marginTop:18,marginBottom:10,letterSpacing:2},grid:{flexDirection:'row',gap:10},choice:{flex:1},preview:{width:'100%',height:92,borderRadius:13,borderWidth:2,borderColor:'transparent'},previewSelected:{borderColor:'#8A9B80'},caption:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingTop:7,paddingBottom:4},choiceTitle:{fontSize:12,color:'#62685E'},
});
