import { Ionicons } from '@expo/vector-icons';
import { BlurTargetView, BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ConversationGlassContext } from '../recovery/ConversationMotion';
import { hap } from '../talk/haptics';
import { AFTERNOON_HOME_THEME, type HomeTheme } from '../theme/homeTheme';
import { useSettledHeight } from './useSettledHeight';

const PEEK = 44;
const SPRING = { damping: 27, stiffness: 240, mass: 0.9 };

type Props = {
  reduceMotion: boolean;
  active?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  renderBackground: (reveal: ReturnType<typeof Gesture.Pan>, open: () => void) => React.ReactNode;
  children: React.ReactNode;
  footer: (close: () => void, blurTarget: React.RefObject<View | null>) => React.ReactNode;
  footerInset: number;
  scrollRef?: React.RefObject<ScrollView | null>;
  theme?: HomeTheme;
};

/** The shared progress is updated directly during a drag; only release uses a spring. */
export function GlassSheet({ reduceMotion, active = true, onExpandedChange, renderBackground, children, footer, footerInset, scrollRef, theme = AFTERNOON_HOME_THEME }: Props) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const peek = PEEK + insets.bottom;
  const [height, measureHeight] = useSettledHeight(window.height);
  const [expanded, setExpanded] = useState(false);
  const [footerHeight, setFooterHeight] = useState(footerInset);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [headerHeight, setHeaderHeight] = useState(peek + 80);
  const [gestureActive, setGestureActive] = useState(false);
  const backgroundRef = useRef<View>(null);
  const contentRef = useRef<View>(null);
  const blurTarget = useRef<View>(null);
  const footerBlurTarget = useRef<View>(null);
  const progress = useSharedValue(0);
  const origin = useSharedValue(0);
  const dragging = useSharedValue(false);
  const lastDragEnded = useSharedValue(0);
  const sheetHeight = Math.min(height - 54, Math.max(280, contentHeight === null ? height * 0.76 : headerHeight + contentHeight + 24 + footerHeight));
  const travel = Math.max(1, sheetHeight - peek);

  const markExpanded = useCallback((open: boolean) => {
    setExpanded(open);
    setGestureActive(false);
  }, []);
  const prepareDrag = useCallback(() => {
    Keyboard.dismiss();
    setExpanded(true);
    setGestureActive(true);
  }, []);
  const settle = useCallback((open: boolean, velocity = 0) => {
    'worklet';
    progress.set(reduceMotion ? (open ? 1 : 0) : withSpring(open ? 1 : 0, { ...SPRING, velocity: -velocity / travel }));
    dragging.set(false);
    runOnJS(markExpanded)(open);
  }, [dragging, markExpanded, progress, reduceMotion, travel]);
  const toggle = useCallback(() => {
    // A moving handle can remain under the pointer: suppress the following press.
    if (Date.now() - lastDragEnded.get() < 150) return;
    Keyboard.dismiss();
    hap.selection();
    settle(!expanded);
  }, [expanded, lastDragEnded, settle]);
  const open = useCallback(() => { Keyboard.dismiss(); settle(true); }, [settle]);
  const close = useCallback(() => { settle(false); }, [settle]);

  useEffect(() => {
    if (!expanded) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    if (Platform.OS !== 'web') return () => subscription.remove();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    globalThis.addEventListener('keydown', escape);
    return () => { subscription.remove(); globalThis.removeEventListener('keydown', escape); };
  }, [close, expanded]);

  // RN Web does not forward the HTML inert prop. Apply it to the host nodes.
  // Wait until the drag finishes so an active reveal gesture keeps its pointer.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const background = backgroundRef.current as unknown as HTMLElement | null;
    const content = contentRef.current as unknown as HTMLElement | null;
    if (background) background.inert = expanded && !gestureActive;
    if (content) content.inert = !expanded;
  }, [expanded, gestureActive]);

  useEffect(() => { onExpandedChange?.(expanded); }, [expanded, onExpandedChange]);
  useEffect(() => {
    if (!active) { cancelAnimation(progress); progress.set(0); cancelAnimation(origin); }
  }, [active, origin, progress]);

  const makePan = useCallback((revealOnly: boolean) => {
    const pan = Gesture.Pan().activeOffsetY(revealOnly ? -10 : [-8, 8]).failOffsetX([-28, 28]);
    if (revealOnly) pan.failOffsetY(14);
    return pan
      .onStart(() => {
        cancelAnimation(progress);
        origin.set(progress.get());
        dragging.set(true);
        runOnJS(prepareDrag)();
      })
      .onUpdate((event) => {
        const next = origin.get() - event.translationY / travel;
        // Gentle resistance at both limits, rather than a hard stop.
        progress.set(next < 0 ? Math.max(-0.08, next * 0.15) : next > 1 ? Math.min(1.08, 1 + (next - 1) * 0.15) : next);
      })
      .onEnd((event) => {
        lastDragEnded.set(Date.now());
        const projected = progress.get() - event.velocityY * 0.16 / travel;
        settle(projected > 0.42, event.velocityY);
      })
      .onFinalize((_, success) => {
        if (!success && dragging.get()) settle(progress.get() > 0.42);
      });
  }, [dragging, lastDragEnded, origin, prepareDrag, progress, settle, travel]);
  const reveal = useMemo(() => makePan(true), [makePan]);
  const pan = useMemo(() => makePan(false), [makePan]);
  const dark = theme.mode !== 'light';
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: travel * (1 - progress.get()) }] }));
  const shadeStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, progress.get())) * 0.12 }));
  const backgroundStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : 1 - Math.max(0, Math.min(1, progress.get())) * 0.025 }],
  }));

  return (
    <View style={st.root} onLayout={measureHeight}>
      <BlurTargetView ref={blurTarget} style={st.fill}>
        <Animated.View ref={backgroundRef} style={[st.fill, backgroundStyle]} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}>
          {renderBackground(reveal, open)}
        </Animated.View>
      </BlurTargetView>
      <Animated.View accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'} pointerEvents={expanded ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, st.shade, shadeStyle]}>
        <Pressable style={st.fill} onPress={close} accessibilityRole="button" accessibilityLabel="收起详情" testID="home-sheet-backdrop" tabIndex={expanded ? 0 : -1} />
      </Animated.View>
      <Animated.View style={[st.sheet, { height: sheetHeight, backgroundColor: expanded ? 'transparent' : theme.background }, sheetStyle]} testID="home-sheet">
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {expanded && active ? <BlurView blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus" intensity={70} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} testID="home-sheet-glass" /> : null}
          <View style={[StyleSheet.absoluteFill, st.tint, dark ? { backgroundColor: theme.mode === 'dim' ? 'rgba(44,44,46,0.78)' : 'rgba(0,0,0,0.78)', borderColor: 'rgba(255,255,255,0.12)' } : null]} />
        </View>
        <GestureDetector gesture={pan}>
          <Animated.View testID="home-sheet-drag" onLayout={(event) => { const next = Math.round(event.nativeEvent.layout.height); setHeaderHeight(previous => Math.abs(previous - next) > 1 ? next : previous); }} style={[st.dragArea, Platform.OS === 'web' && ({ touchAction: 'none' } as never)]}>
            <Pressable onPress={toggle} testID="home-sheet-toggle" accessibilityRole="button" accessibilityLabel={expanded ? '收起详情' : '展开详情，也可以向上滑动'} accessibilityState={{ expanded }} style={[st.handleHit, { height: peek, paddingBottom: insets.bottom }]}>
              <View style={[st.handle, { backgroundColor: theme.muted }]} />
            </Pressable>
            <View style={st.titleRow} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
              <View><Text style={[st.title, { color: theme.text }]}>为你准备</Text><Text style={[st.subtitle, { color: theme.muted }]}>把今天，过得轻一点。</Text></View>
              <Pressable onPress={close} testID="home-sheet-close" accessibilityLabel="收起详情" accessibilityRole="button" tabIndex={expanded ? 0 : -1} style={[st.close, dark && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <Ionicons name="chevron-down" size={20} color={theme.muted} />
              </Pressable>
            </View>
          </Animated.View>
        </GestureDetector>
        <View ref={contentRef} style={st.fill} pointerEvents={expanded ? 'auto' : 'none'} accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}>
          <BlurTargetView ref={footerBlurTarget} style={st.fill}>
            <ScrollView ref={scrollRef} style={st.fill} contentContainerStyle={[st.content, { paddingBottom: 24 + footerHeight }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" testID="home-sheet-content">
              <View onLayout={(event) => { const next = Math.round(event.nativeEvent.layout.height); setContentHeight(previous => previous === null || Math.abs(previous - next) > 1 ? next : previous); }}>
                <ConversationGlassContext.Provider value={blurTarget}>{children}</ConversationGlassContext.Provider>
              </View>
            </ScrollView>
          </BlurTargetView>
          {expanded ? (
            <View style={[st.footer, { paddingBottom: footerInset }]} onLayout={(event) => { const next = Math.round(event.nativeEvent.layout.height); setFooterHeight(previous => Math.abs(previous - next) > 1 ? next : previous); }} pointerEvents="box-none">
              {footer(close, footerBlurTarget)}
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1 },
  shade: { backgroundColor: '#24242A' },
  sheet: { position: 'absolute', left: 8, right: 8, bottom: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', backgroundColor: '#FAFAFC' },
  tint: { backgroundColor: 'rgba(255,255,255,0.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.82)', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  dragArea: { paddingHorizontal: 22 },
  handleHit: { height: PEEK, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: '#C5C5CA' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 22 },
  title: { fontSize: 25, letterSpacing: -0.6, fontWeight: '600', color: '#202024' },
  subtitle: { fontSize: 13, color: '#85858A', marginTop: 6 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(235,235,240,0.65)' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
});
