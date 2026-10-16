import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarInset } from '../components/TabBar';
import { TabBar, type TabKey } from '../components/ui';
import { GlassSheet } from './GlassSheet';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import { HealthFollowPanel } from '../talk/HealthFollow';
import { useReduceMotion } from '../talk/Drops';
import { hap } from '../talk/haptics';
import { loadHealthSnapshot, MOCK_SNAPSHOT, postHealthSnapshot, type HealthSnapshot } from '../talk/healthSnapshot';
import { AFTERNOON_HOME_THEME, inkOnAccent, themeHairline, type HomeTheme } from '../theme/homeTheme';
import { Tap } from '../talk/press';
import { answerFor, FOLLOW_LABEL, type ActionId, type Answer } from './answers';
import { GlassActionButton } from './GlassActionButton';
import { loadHabit, recordTap, SEED } from './habits';
import { rankActions, type Greet, type Habit, type HomeAction } from './home.mjs';
import { DEFAULT_BASELINE, judge } from './nudge.mjs';
import { dismissHome, getHome, NUDGE_TO_ACTION, tapHome, type Home, type Nudge } from './nudgeClient';
import { HomeConversation } from './HomeConversation';
import { createHomeDraft, HomeDraftComposer, HomeInputBar } from './HomeDraft';
import { VoiceBubble } from './VoiceBubble';
import { VoiceRecorder } from './VoiceRecorder';
import { HomeArrival } from './HomeArrival';
import { SeasonIllustration } from './SeasonIllustration';
import { FloatingChoices } from '../recovery/FloatingChoices';
import { SeasonBackground, SeasonPicker, useSeasonScene } from './SeasonBackground';
import { useSettledHeight } from './useSettledHeight';
import { askAssistant, type AssistantReply } from '../recovery/client';
import type { Message } from '../recovery/types';
import { BlurTargetView } from 'expo-blur';
import { conversationOpening } from '../recovery/opening';
import { RecoveryScreen } from '../recovery/RecoveryScreen';

const ORB = 124;
const CARD_SPRING = { damping: 22, stiffness: 180, mass: 1 };
const DISCLAIMER = '非医疗建议，仅供参考';

function clipNudge(text: string, max = 18) {
  const t = (text || '').trim();
  if ([...t].length <= max) return t;
  return [...t].slice(0, max).join('');
}

export const AgentScreen = memo(function AgentScreen({ onNavigate, activeTab, tabIndicator, visible = true }: { onNavigate?: (tab: TabKey) => void; activeTab: TabKey; tabIndicator: SharedValue<number>; visible?: boolean }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [homeHeight, measureHome] = useSettledHeight(window.height);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const homeBackdrop = useRef<View>(null);
  const [focused, setFocused] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const rm = useReduceMotion();
  const [snap, setSnap] = useState<HealthSnapshot>(MOCK_SNAPSHOT);
  const [habit, setHabit] = useState<Habit>(SEED);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryInitial, setRecoveryInitial] = useState('');
  const [recoveryFromNotification, setRecoveryFromNotification] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const scene = useSeasonScene();
  const [fontLoaded] = useFonts({ JarvisGreeting: require('../../assets/fonts/JarvisGreeting-Regular.ttf') });
  const [draft] = useState(createHomeDraft);
  const [homeMessages, setHomeMessages] = useState<Message[]>([]);
  const [homeResult, setHomeResult] = useState<AssistantReply | null>(null);
  const [homePending, setHomePending] = useState('');
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeError, setHomeError] = useState('');
  const [recoverySeed, setRecoverySeed] = useState<Message[] | undefined>();
  const homeRequest = useRef<AbortController | null>(null);
  const homeSequence = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const baseline = DEFAULT_BASELINE;
  const j = useMemo(() => judge(snap as Record<string, unknown>, baseline), [snap, baseline]);
  const [ranked, setRanked] = useState<HomeAction[]>(() => rankActions(SEED, MOCK_SNAPSHOT as Record<string, unknown>, new Date()));
  const [greet, setGreet] = useState<Greet>({ primary: '下午好', secondary: null, period: 'afternoon' });
  const [theme, setTheme] = useState<HomeTheme>(AFTERNOON_HOME_THEME);
  const [homeSource, setHomeSource] = useState<'pending' | Home['source']>('pending');

  const typingPulse = useSharedValue(0);
  const changeText = useCallback((next: string) => {
    draft.set(next);
    if (rm || !visible) return;
    cancelAnimation(typingPulse);
    typingPulse.set(withSequence(
      withTiming(1, { duration: 85, easing: Easing.out(Easing.cubic) }),
      withSpring(0, { damping: 14, stiffness: 170, mass: 0.6 }),
    ));
  }, [draft, rm, typingPulse, visible]);
  const focusInput = useCallback(() => setFocused(true), []);
  const blurInput = useCallback(() => setFocused(false), []);

  useEffect(() => {
    (async () => {
      const [s, h] = await Promise.all([loadHealthSnapshot(), loadHabit()]);
      setSnap(s); setHabit(h);
      await postHealthSnapshot(s);
      const home = await getHome(s, h, []);
      const nu = home.nudge;
      setNudge(nu); setRanked(home.actions); setGreet(home.greet); setTheme(home.theme); setHomeSource(home.source);
      // Suggestions stay inside the app; notifications require an explicit user request.
    })();
  }, []);

  const top3 = ranked.slice(0, 3);
  const opening = useMemo(() => conversationOpening(snap), [snap]);
  const homeChoices = homeMessages.length ? homeResult?.quick_replies || [] : opening.choices;

  const show = (a: Answer) => {
    hap.success();
    setAnswer(a);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: !rm }), 60);
  };
  const tap = async (id: ActionId) => {
    if (id === 'detail' || id === 'sleep') { setDetailOpen(true); return; }
    if (['train', 'dinner', 'sleep', 'walk', 'budget'].includes(id)) {
      const h2 = await recordTap(habit, id); setHabit(h2);
      void tapHome(id, snap, h2, dismissed).then((hm) => { setRanked(hm.actions); setGreet(hm.greet); setTheme(hm.theme); setHomeSource(hm.source); });
    }
    if (id === 'remind') { openRecovery('我想设置睡前提醒'); return; }
    show(answerFor(id, snap, baseline, j));
  };
  const onLook = () => { const a = nudge?.actions.find((x) => x.id !== 'dismiss'); const id = (a && NUDGE_TO_ACTION[a.id]) || 'train'; setNudge(null); void tap(id); };
  const onDismiss = async () => {
    if (!nudge) return;
    const d = [...dismissed, nudge.id]; setDismissed(d);
    const hm = await dismissHome(nudge.id, snap, habit, dismissed);
    setNudge(hm.nudge); setRanked(hm.actions); setGreet(hm.greet); setTheme(hm.theme); setHomeSource(hm.source);
  };

  const openRecovery = (initial = '') => { setRecoverySeed(undefined); setRecoveryFromNotification(Boolean(initial)); setRecoveryInitial(initial); setDetailOpen(false); setRecoveryOpen(true); };
  const submit = async (openSheet?: () => void, retry = false, choice?: string) => {
    const value = (choice ?? draft.getSnapshot()).trim(); if ((!value && !retry) || homeRequest.current) return;
    const controller = new AbortController(); homeRequest.current = controller;
    const turn = ++homeSequence.current;
    const messages: Message[] = retry ? homeMessages : [...homeMessages, { id: 'home-u-' + turn, role: 'user', content: value }];
    setHomeMessages(messages); setHomeResult(null); draft.set(''); setHomeError(''); setHomePending(''); setHomeBusy(true); openSheet?.();
    try {
      const result = await askAssistant(messages, snap, { signal: controller.signal, onReply: setHomePending });
      if (controller.signal.aborted) return;
      const completed: Message[] = [...messages, { id: 'home-a-' + turn, role: 'assistant', content: result.reply, result }];
      setHomeMessages(completed); setHomeResult(result);
      if (result.topic === 'sleep' && result.confidence >= 0.85) {
        setRecoverySeed(completed); setRecoveryInitial(''); setRecoveryFromNotification(true); setRecoveryOpen(true);
      }
    } catch (error) { setHomeError(error instanceof Error ? error.message : '暂时没有连接上，请重试。'); }
    finally { homeRequest.current = null; setHomePending(''); setHomeBusy(false); }
  };
  useEffect(() => () => { homeRequest.current?.abort(); }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    let subscription: { remove: () => void } | undefined;
    void import('expo-notifications').then(async N => {
      const open = (response: { notification: { request: { content: { data?: Record<string, unknown> } } } }) => {
        if (active && response.notification.request.content.data?.skill === 'sleep-recovery') {
          setRecoverySeed(undefined); setRecoveryFromNotification(true); setRecoveryInitial(''); setDetailOpen(false); setRecoveryOpen(true);
        }
      };
      if (!active) return;
      subscription = N.addNotificationResponseReceivedListener(open);
      const last = await N.getLastNotificationResponseAsync();
      if (last) { open(last); await N.clearLastNotificationResponseAsync(); }
    }).catch(() => { /* native notifications unavailable */ });
    return () => { active = false; subscription?.remove(); };
  }, []);

  const bigFact = nudge?.facts ? Object.entries(nudge.facts).find(([, v]) => typeof v === 'number') : undefined;

  const compact = homeHeight < 720;
  const typingOnShortScreen = focused && homeHeight < 600;
  const orbSize = compact ? 64 : ORB;
  const greetingSize = typingOnShortScreen ? 28 : compact ? 42 : 54;
  const illustrationSeason = scene.scene === 'spring' || scene.scene === 'summer' || scene.scene === 'autumn' || scene.scene === 'winter' ? scene.scene : 'autumn';
  const orbActive = visible && !sheetExpanded && !backgroundOpen && !detailOpen && !recoveryOpen && !voiceOpen;

  const hairline = themeHairline(theme);
  const onAccent = inkOnAccent(theme);
  return (
    <KeyboardAvoidingView style={[st.screen, { backgroundColor: theme.background }]} enabled={visible} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top} testID="agent-screen" accessibilityLabel={`home-${homeSource}-${greet.period}-${theme.mode}-${theme.background}`}>
      {visible ? <StatusBar style={theme.mode === 'light' ? 'dark' : 'light'} /> : null}
      <GlassSheet
        theme={theme}
        reduceMotion={rm}
        active={visible}
        onExpandedChange={setSheetExpanded}
        scrollRef={scroll}
        footerInset={tabBarInset(insets.bottom)}
        footer={(closeSheet, blurTarget) => (
          <>
            {homeMessages.length ? <HomeDraftComposer theme={theme} draft={draft} busy={homeBusy} onChange={changeText} onSend={() => { void submit(); }} onStop={() => homeRequest.current?.abort()} choices={homeChoices} onChoose={(value) => { void submit(undefined, false, value); }} blurTarget={blurTarget} /> : null}
            <TabBar chrome={theme} indicator={tabIndicator} blurTarget={blurTarget} value={activeTab} onChange={(tab) => { closeSheet(); setVoiceOpen(false); homeRequest.current?.abort(); onNavigate?.(tab); }} bottom={insets.bottom} glass />
          </>
        )}
        renderBackground={(reveal, openSheet) => (
        <View style={st.screen} onLayout={measureHome}>
          <BlurTargetView ref={homeBackdrop} style={StyleSheet.absoluteFill}><SeasonBackground scene={scene.scene} /></BlurTargetView>
          <View style={st.header}>
            <Text style={[st.brand, { color: theme.muted }]}>JARVIS</Text>
            <View style={st.headerActions}>
            <Tap testID="background-preset" accessibilityRole="button" accessibilityLabel="选择季节或时光背景" onPress={() => setBackgroundOpen(true)} style={st.backgroundHit}><Text style={[st.backgroundLabel, { color: theme.muted }]}>{scene.label}</Text><Ionicons name="chevron-down" size={12} color={theme.muted} /></Tap>
            <Tap onPress={() => setDetailOpen(true)} testID="agent-health" accessibilityRole="button" accessibilityLabel="查看健康详情" style={st.healthHit}><Ionicons name="heart-outline" size={20} color={theme.muted} /></Tap>
            </View>
          </View>
          <GestureDetector gesture={reveal}>
            <Animated.View style={[st.hero, Platform.OS === 'web' && ({ touchAction: 'pan-x' } as never)]} testID="home-hero">
              <View style={[st.greetWrap, { paddingTop: typingOnShortScreen ? 0 : compact ? 12 : 30 }]} testID="agent-greet">
                <HomeArrival active={visible} reduceMotion={rm} style={st.greetingRow}>
                  <Text style={[st.greetPrimary, { color: theme.text, fontFamily: fontLoaded ? 'JarvisGreeting' : undefined, fontSize: greetingSize, lineHeight: greetingSize * 1.2 }]} numberOfLines={1} adjustsFontSizeToFit testID="greet-primary">{greet.primary}</Text>
                  {!typingOnShortScreen ? <SeasonIllustration season={illustrationSeason} size={compact ? 76 : 90} /> : null}
                </HomeArrival>
                <HomeArrival active={visible} reduceMotion={rm} delay={160}><Text style={[st.openingLabel, { color: theme.muted }]} testID="home-opening-topic">{homeMessages.length ? '接着聊聊' : opening.label}</Text></HomeArrival>
                <HomeArrival active={visible} reduceMotion={rm} delay={320}><Text style={[st.quote, { color: theme.text }, typingOnShortScreen && { fontSize: 12, lineHeight: 18, paddingTop: 6 }]} numberOfLines={typingOnShortScreen ? 2 : 3} testID="home-opening-observation">{homeMessages.length ? homeMessages.at(-1)?.content : opening.observation}</Text></HomeArrival>
                {!typingOnShortScreen ? <HomeArrival active={visible} reduceMotion={rm} delay={480}><Text style={[st.openingQuestion, { color: theme.muted }]}>{opening.question}</Text></HomeArrival> : null}
              </View>
              <HomeArrival active={visible} reduceMotion={rm} delay={640} style={st.openingChoices}><FloatingChoices choices={homeBusy ? [] : homeChoices} disabled={homeBusy} onChoose={(value) => { void submit(openSheet, false, value); }} testIDPrefix="home-opening-choice" blurTarget={homeBackdrop} textColor={theme.text} iconColor={theme.muted} tone={theme.mode === 'light' ? 'light' : 'dark'} /></HomeArrival>
              <View style={[st.orbStage, { minHeight: typingOnShortScreen ? 0 : orbSize + 34, flex: typingOnShortScreen ? 0 : 1 }]}>
                {!typingOnShortScreen ? <Tap testID="agent-orb" accessibilityRole="button" accessibilityLabel="点击水球，开始语音录音" disabled={homeBusy} onPress={() => { Keyboard.dismiss(); setVoiceOpen(true); }} style={{ alignItems: 'center', padding: 8 }}><VoiceBubble size={orbSize} active={orbActive} reduceMotion={rm} pulse={typingPulse} /><Text style={[st.orbLabel, { color: theme.muted }]}>点我，说说今天</Text></Tap> : null}
              </View>

            </Animated.View>
          </GestureDetector>
          <HomeInputBar theme={theme} draft={draft} busy={homeBusy} onChange={changeText} onFocus={focusInput} onBlur={blurInput} onSend={() => { void submit(openSheet); }} choices={[]} onChoose={(value) => { void submit(openSheet, false, value); }} blurTarget={homeBackdrop} />
          {typingOnShortScreen ? <View style={{ height: Math.max(insets.bottom, 8) + 44 }} /> : <Text pointerEvents="none" style={[st.swipeHint, { color: theme.muted, paddingBottom: Math.max(insets.bottom, 8) + 44 }]} testID="home-swipe-hint">上滑，看看今天的安排</Text>}
        </View>
      )}>
        {homeMessages.length ? <HomeConversation theme={theme} messages={homeMessages} result={homeResult} busy={homeBusy} pending={homePending} error={homeError} onRetry={() => { void submit(undefined, true); }} onReset={() => { setHomeMessages([]); setHomeResult(null); setHomeError(''); }} /> : null}
        {/* 2. Nudge ≤1 — 0 height when none */}
        {!homeMessages.length && nudge ? (
          <View style={[st.banner, { backgroundColor: theme.surface, borderColor: hairline }]} testID="nudge-row">
            <View style={st.nudgeMain}>
              {bigFact ? (
                <Text style={[st.nudgeNum, { color: theme.text }]} testID="nudge-num">
                  {String(bigFact[1])}
                  <Text style={[st.nudgeUnit, { color: theme.muted }]}> {UNIT[bigFact[0]] ?? ''}</Text>
                </Text>
              ) : null}
              <Text style={[st.nudgeText, { color: theme.text }, bigFact ? { flex: 1 } : null]} numberOfLines={1} testID="nudge-text">
                {clipNudge(nudge.text)}
              </Text>
            </View>
            <View style={st.nudgeBtns}>
              <Tap testID="nudge-look" feedback="light" onPress={onLook} style={[st.nbtnDark, { backgroundColor: theme.accent }]}>
                <Text style={[st.nbtnDarkTxt, { color: onAccent }]}>看看</Text>
              </Tap>
              <Tap testID="nudge-dismiss" feedback={false} onPress={onDismiss} style={[st.nbtn, { backgroundColor: theme.background }]}>
                <Text style={[st.nbtnTxt, { color: theme.text }]}>不用</Text>
              </Tap>
            </View>
          </View>
        ) : null}

        {/* 3. ≤3 soft-square action buttons — no why */}
        {!homeMessages.length ? <View style={st.list} testID="action-list">
          {top3.map((a) => (
            <GlassActionButton
              key={a.id}
              action={a}
              theme={theme}
              reduceMotion={rm}
              testID={`act-${a.id}`}
              onPress={() => { void tap(a.id); }}
            />
          ))}
        </View> : null}

        {!homeMessages.length && answer ? (
          <AnswerCard
            key={`${answer.id}-${answer.title}`}
            a={answer}
            rm={rm}
            disclaimer={j.disclaimer || DISCLAIMER}
            theme={theme}
            onFollow={tap}
            onRecovery={() => openRecovery()}
          />
        ) : null}
      </GlassSheet>
      <VoiceRecorder visible={voiceOpen && visible} onClose={() => setVoiceOpen(false)} />

      <HealthFollowPanel
        visible={detailOpen}
        onOpenRecovery={() => openRecovery()}
        follow={{ hint: '', plan: '', updates: [] }}
        snapshot={snap}
        reduceMotion={rm}
        onSnapshot={setSnap}
        onClose={() => setDetailOpen(false)}
      />
      <RecoveryScreen initialConversation={recoverySeed} visible={recoveryOpen} snapshot={snap} initialText={recoveryInitial} openRealConversation={recoveryFromNotification} onClose={() => setRecoveryOpen(false)} />
      <SeasonPicker visible={backgroundOpen} current={scene.preset} reduceMotion={rm} onClose={() => setBackgroundOpen(false)} onSelect={scene.select} />
    </KeyboardAvoidingView>
  );
});

const UNIT: Record<string, string> = { sleep_hours: '小时', steps: '步', meals_today: '餐', budget_left: '元' };

function AnswerCard({
  a, rm, disclaimer, theme, onFollow, onRecovery,
}: {
  a: Answer;
  rm: boolean;
  disclaimer: string;
  theme: HomeTheme;
  onFollow: (id: ActionId) => void;
  onRecovery: () => void;
}) {
  const y = useSharedValue(rm ? 0 : 36);
  const op = useSharedValue(rm ? 1 : 0);
  useEffect(() => {
    if (rm) { y.value = 0; op.value = 1; return; }
    y.value = withSpring(0, CARD_SPRING);
    op.value = withTiming(1, { duration: 220 });
  }, [rm, y, op]);
  const style = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: y.value }] }));
  return (
    <Animated.View testID="answer-card" style={[st.card, { backgroundColor: theme.surface, borderColor: themeHairline(theme) }, style]}>
      <Text style={[st.cardEyebrow, { color: theme.muted }]}>{a.title}</Text>
      {a.id === 'sleep' ? <Tap onPress={onRecovery} testID="answer-open-recovery" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="chatbubble-outline" size={15} color={theme.muted} /><Text style={{ fontSize: 13, color: theme.muted }}>进入睡眠模式，聊聊安排</Text></Tap> : null}
      {a.big ? (
        <Text style={[st.big, { color: theme.text }]}>
          {a.big.value}
          <Text style={[st.bigUnit, { color: theme.muted }]}> {a.big.unit}</Text>
        </Text>
      ) : null}
      <Text style={[st.concl, { color: theme.text }]}>{a.conclusion}</Text>
      {a.why ? <Text style={[st.cardWhy, { color: theme.muted }]}>{a.why}</Text> : null}
      {a.action ? <Text style={[st.cardAction, { color: theme.text }]}>{a.action}</Text> : null}
      {a.followups.length ? (
        <View style={st.chips}>
          {a.followups.slice(0, 2).map((id) => (
            <Tap key={id} testID={`follow-${id}`} feedback="selection" onPress={() => onFollow(id)} style={[st.chip, { backgroundColor: theme.background }]}>
              <Text style={[st.chipTxt, { color: theme.text }]}>{FOLLOW_LABEL[id] ?? ({ dinner: '冰箱做晚饭' } as Record<string, string>)[id] ?? id}</Text>
            </Tap>
          ))}
        </View>
      ) : null}
      <Text style={[st.cardFoot, { color: theme.muted }]} testID="card-disclaimer">{disclaimer}</Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFC' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backgroundHit: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 8 },
  backgroundLabel: { fontSize: 12, letterSpacing: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26, height: 48 },
  brand: { fontSize: 10, fontWeight: '500', color: '#99999F', letterSpacing: 3 },
  healthHit: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  period: { marginBottom: 18, opacity: 0.7 },
  orbStage: { flex: 1, minHeight: ORB + 12, width: '100%', alignItems: 'center', justifyContent: 'center' },
  openingLabel: { fontSize: 10, letterSpacing: 1, paddingTop: 14 },
  openingQuestion: { fontSize: 13, lineHeight: 21, paddingTop: 10 },
  quote: { fontSize: 17, fontWeight: '400', textAlign: 'left', lineHeight: 28, paddingTop: 9 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 },
  openingChoices: { width: '100%', marginTop: 18, flexShrink: 1 },
  orbLabel: { fontSize: 11, letterSpacing: 1, paddingTop: 14 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: 16 },
  dotHit: { minWidth: 76, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 10 },
  shortcutDot: { width: 13, height: 13, borderRadius: 7 },
  dotLabel: { fontSize: 10, color: '#9B9BA2' },
  swipeHint: { fontSize: 10, color: '#B0B0B7', textAlign: 'center', paddingTop: 8 },
  banner: {
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
    marginBottom: 20,
  },
  nudgeMain: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  nudgeText: { fontSize: 15, fontWeight: '400', lineHeight: 21, color: '#3A3A3A', flexShrink: 1, minWidth: 0 },
  nudgeNum: {
    fontSize: 34,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    flexShrink: 0,
  },
  nudgeUnit: { fontSize: 13, fontWeight: '400', color: '#8A8A8A' },
  nudgeBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  nbtn: {
    minHeight: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F2F2F2',
  },
  nbtnTxt: { fontSize: 15, fontWeight: '500', color: '#000000' },
  nbtnDark: {
    minHeight: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#000000',
  },
  nbtnDarkTxt: { fontSize: 15, fontWeight: '500', color: '#FFFFFF' },
  big: {
    fontSize: 34,
    fontWeight: '600',
    color: '#000000',
    marginTop: 6,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
  },
  bigUnit: { fontSize: 15, fontWeight: '400', color: '#8A8A8A' },
  orbHit: { width: ORB + 8, height: ORB + 8, alignItems: 'center', justifyContent: 'center' },
  greetWrap: { alignItems: 'flex-start', width: '100%' },
  greetPrimary: { fontWeight: '400', letterSpacing: 0, flexShrink: 1 },
  list: { gap: 12, overflow: 'visible' },
  card: {
    marginTop: 24,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
  },
  cardEyebrow: { fontSize: 12, fontWeight: '400', color: '#8A8A8A', letterSpacing: 0.2 },
  concl: { fontSize: 17, fontWeight: '600', color: '#000000', marginTop: 6, marginBottom: 6, letterSpacing: -0.2 },
  cardWhy: { fontSize: 13, fontWeight: '400', color: '#8A8A8A', lineHeight: 18 },
  cardAction: { fontSize: 14, fontWeight: '400', color: '#3A3A3A', marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F2F2F2',
  },
  chipTxt: { fontSize: 15, fontWeight: '500', color: '#000000' },
  cardFoot: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '400',
    color: '#8A8A8A',
    lineHeight: 16,
  },
});
