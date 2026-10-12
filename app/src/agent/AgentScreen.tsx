import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BossSkinPicker } from '../talk/BossSkinPicker';
import { HealthFollowPanel } from '../talk/HealthFollow';
import { loadBossSkinId, poolSource, resolveSkinUri, type BossSkinId } from '../talk/bossSkin';
import { useReduceMotion } from '../talk/Drops';
import { hap } from '../talk/haptics';
import { loadHealthSnapshot, MOCK_SNAPSHOT, postHealthSnapshot, type HealthSnapshot } from '../talk/healthSnapshot';
import { Tap } from '../talk/press';
import { colors, radius, space } from '../theme/tokens';
import { answerFor, FOLLOW_LABEL, intentFromText, type ActionId, type Answer } from './answers';
import { GlassActionButton } from './GlassActionButton';
import { PeriodIcon, resolvePeriod } from './PeriodIcon';
import { loadHabit, recordTap, SEED } from './habits';
import { rankActions, greet as localGreet, type Habit, type Greet, type HomeAction } from './home.mjs';
import { DEFAULT_BASELINE, judge } from './nudge.mjs';
import { demoHour, dismissHome, getHome, NUDGE_TO_ACTION, tapHome, type Nudge } from './nudgeClient';
import { scheduleNudge } from './notify';

const ORB = 56;
const CARD_SPRING = { damping: 22, stiffness: 180, mass: 1 };
const DISCLAIMER = '非医疗建议，仅供参考';

function clipNudge(text: string, max = 18) {
  const t = (text || '').trim();
  if ([...t].length <= max) return t;
  return [...t].slice(0, max).join('');
}

export function AgentScreen({ onOpenDetail: _onOpenDetail }: { onOpenDetail?: () => void }) {
  const rm = useReduceMotion();
  const [snap, setSnap] = useState<HealthSnapshot>(MOCK_SNAPSHOT);
  const [habit, setHabit] = useState<Habit>(SEED);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [skinOpen, setSkinOpen] = useState(false);
  const [skinId, setSkinId] = useState<BossSkinId>('default');
  const [uploadUri, setUploadUri] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [greet, setGreet] = useState<Greet>(() => localGreet(new Date(), MOCK_SNAPSHOT as Record<string, unknown>, false));
  const scroll = useRef<ScrollView>(null);
  const baseline = DEFAULT_BASELINE;
  const j = useMemo(() => judge(snap as Record<string, unknown>, baseline), [snap, baseline]);
  const [ranked, setRanked] = useState<HomeAction[]>(() => rankActions(SEED, MOCK_SNAPSHOT as Record<string, unknown>, new Date()));

  const breathe = useSharedValue(1);
  const orbY = useSharedValue(rm ? 0 : 6);
  const greetOp = useSharedValue(rm ? 1 : 0);

  useEffect(() => {
    if (rm) { breathe.value = 1; orbY.value = 0; greetOp.value = 1; return; }
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.045, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    orbY.value = withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) });
    greetOp.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
  }, [rm, breathe, orbY, greetOp, greet.primary]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: orbY.value }, { scale: breathe.value }],
  }));
  const greetStyle = useAnimatedStyle(() => ({ opacity: greetOp.value }));

  useEffect(() => {
    (async () => {
      const [s, h, id] = await Promise.all([loadHealthSnapshot(), loadHabit(), loadBossSkinId()]);
      setSnap(s); setHabit(h); setSkinId(id);
      if (id === 'upload') setUploadUri(await resolveSkinUri('upload'));
      await postHealthSnapshot(s);
      const home = await getHome(s, h, []);
      const nu = home.nudge;
      setNudge(nu); setRanked(home.actions); setGreet(home.greet);
      if (nu) { hap.light(); void scheduleNudge('头头提醒', nu.text, 3); }
    })();
  }, []);

  const skinSrc = skinId === 'default' ? null : skinId === 'upload' ? (uploadUri ? { uri: uploadUri } : null) : poolSource(skinId);
  const top3 = ranked.slice(0, 3);

  const show = (a: Answer) => {
    hap.success();
    setAnswer(a);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: !rm }), 60);
  };
  const tap = async (id: ActionId) => {
    if (id === 'detail') { setDetailOpen(true); return; }
    if (['train', 'dinner', 'sleep', 'walk', 'budget'].includes(id)) {
      const h2 = await recordTap(habit, id); setHabit(h2);
      void tapHome(id, snap, h2, dismissed).then((hm) => { setRanked(hm.actions); if (hm.greet) setGreet(hm.greet); });
    }
    if (id === 'remind') {
      const ok = await scheduleNudge('该准备休息了', '按今天的建议，早点上床。', 5);
      show(ok
        ? { id, title: '到点提醒我', conclusion: '已设好提醒。', why: '系统通知已排上（测试为 5 秒后）。', action: '到点会在通知里提醒你。', followups: [] }
        : { id, title: '到点提醒我', conclusion: '还没设上提醒。', why: '当前环境不支持系统通知（网页预览或未授权）。', action: '在手机上授权通知后再点一次。', followups: [] });
      return;
    }
    show(answerFor(id, snap, baseline, j));
  };
  const onLook = () => { const a = nudge?.actions.find((x) => x.id !== 'dismiss'); const id = (a && NUDGE_TO_ACTION[a.id]) || 'train'; setNudge(null); void tap(id); };
  const onDismiss = async () => {
    if (!nudge) return;
    const d = [...dismissed, nudge.id]; setDismissed(d);
    const hm = await dismissHome(nudge.id, snap, habit, dismissed);
    setNudge(hm.nudge); setRanked(hm.actions); if (hm.greet) setGreet(hm.greet);
  };

  const submit = () => {
    const t = text.trim(); if (!t) return;
    setText('');
    const id = intentFromText(t);
    if (id) void tap(id);
    else show({ id: 'train', title: t, conclusion: '这个我还不会。', why: '能帮你的都在上面的按钮里。', action: '', followups: [] });
  };

  const bigFact = nudge?.facts ? Object.entries(nudge.facts).find(([, v]) => typeof v === 'number') : undefined;

  return (
    <View style={{ flex: 1 }} testID="agent-screen">
      <ScrollView ref={scroll} contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* 1. Orb + greet */}
        <View style={st.head}>
          <Tap testID="agent-orb" feedback="light" onPress={() => setSkinOpen(true)} accessibilityLabel="换形象" style={st.orbHit}>
            <Animated.View style={[st.orb, orbStyle]}>
              {skinSrc ? <Image source={skinSrc} style={st.orbImg} /> : <View style={st.orbDot} />}
            </Animated.View>
          </Tap>
        </View>

        <Animated.View style={[st.greetWrap, greetStyle]} testID="agent-greet">
          <View style={st.greetRow}>
            <Text style={st.greetPrimary} testID="greet-primary">{greet.primary}</Text>
            <PeriodIcon period={resolvePeriod(greet, demoHour())} />
          </View>
        </Animated.View>

        {/* 2. Nudge ≤1 — 0 height when none */}
        {nudge ? (
          <View style={st.banner} testID="nudge-row">
            <View style={st.nudgeMain}>
              {bigFact ? (
                <Text style={st.nudgeNum} testID="nudge-num">
                  {String(bigFact[1])}
                  <Text style={st.nudgeUnit}> {UNIT[bigFact[0]] ?? ''}</Text>
                </Text>
              ) : null}
              <Text style={[st.nudgeText, bigFact ? { flex: 1 } : null]} numberOfLines={1} testID="nudge-text">
                {clipNudge(nudge.text)}
              </Text>
            </View>
            <View style={st.nudgeBtns}>
              <Tap testID="nudge-look" feedback="light" onPress={onLook} style={st.nbtnDark}>
                <Text style={st.nbtnDarkTxt}>看看</Text>
              </Tap>
              <Tap testID="nudge-dismiss" feedback={false} onPress={onDismiss} style={st.nbtn}>
                <Text style={st.nbtnTxt}>不用</Text>
              </Tap>
            </View>
          </View>
        ) : null}

        {/* 3. ≤3 soft-square action buttons — no why */}
        <View style={st.list} testID="action-list">
          {top3.map((a) => (
            <GlassActionButton
              key={a.id}
              action={a}
              reduceMotion={rm}
              testID={`act-${a.id}`}
              onPress={() => { void tap(a.id); }}
            />
          ))}
        </View>

        {answer ? (
          <AnswerCard
            key={`${answer.id}-${answer.title}`}
            a={answer}
            rm={rm}
            disclaimer={j.disclaimer || DISCLAIMER}
            onFollow={tap}
          />
        ) : null}
      </ScrollView>

      <View style={st.bar}>
        <TextInput
          testID="agent-input"
          value={text}
          onChangeText={setText}
          placeholder="问我…"
          placeholderTextColor="#C7C7CC"
          style={[st.input, { outlineStyle: 'none' } as never]}
          onSubmitEditing={submit}
          returnKeyType="send"
          maxLength={200}
        />
        <Tap
          testID="agent-send"
          feedback="light"
          disabled={!text.trim()}
          onPress={submit}
          hitSlop={8}
          style={[st.send, !text.trim() && { opacity: 0.2 }]}
          accessibilityLabel="发送"
        >
          <Ionicons name="arrow-up" size={13} color="#fff" />
        </Tap>
      </View>

      <HealthFollowPanel
        visible={detailOpen}
        follow={{ hint: '', plan: '', updates: [] }}
        snapshot={snap}
        reduceMotion={rm}
        onSnapshot={setSnap}
        onClose={() => setDetailOpen(false)}
      />
      <BossSkinPicker
        visible={skinOpen}
        current={skinId}
        uploadPreview={uploadUri}
        reduceMotion={rm}
        onClose={() => setSkinOpen(false)}
        onSelect={(id, uri) => { setSkinId(id); setUploadUri(id === 'upload' ? uri ?? null : null); }}
      />
    </View>
  );
}

const UNIT: Record<string, string> = { sleep_hours: '小时', steps: '步', meals_today: '餐', budget_left: '元' };

function AnswerCard({
  a, rm, disclaimer, onFollow,
}: {
  a: Answer;
  rm: boolean;
  disclaimer: string;
  onFollow: (id: ActionId) => void;
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
    <Animated.View testID="answer-card" style={[st.card, style]}>
      <Text style={st.cardEyebrow}>{a.title}</Text>
      {a.big ? (
        <Text style={st.big}>
          {a.big.value}
          <Text style={st.bigUnit}> {a.big.unit}</Text>
        </Text>
      ) : null}
      <Text style={st.concl}>{a.conclusion}</Text>
      {a.why ? <Text style={st.cardWhy}>{a.why}</Text> : null}
      {a.action ? <Text style={st.cardAction}>{a.action}</Text> : null}
      {a.followups.length ? (
        <View style={st.chips}>
          {a.followups.slice(0, 2).map((id) => (
            <Tap key={id} testID={`follow-${id}`} feedback="selection" onPress={() => onFollow(id)} style={st.chip}>
              <Text style={st.chipTxt}>{FOLLOW_LABEL[id] ?? ({ dinner: '冰箱做晚饭' } as Record<string, string>)[id] ?? id}</Text>
            </Tap>
          ))}
        </View>
      ) : null}
      <Text style={st.cardFoot} testID="card-disclaimer">{disclaimer}</Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: space.lg, paddingBottom: 40 },
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
  head: { alignItems: 'center', marginTop: 8, marginBottom: 4 },
  orbHit: { width: ORB + 8, height: ORB + 8, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbImg: { width: ORB, height: ORB },
  orbDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', opacity: 0.92 },
  greetWrap: { alignItems: 'center', marginBottom: 28, paddingHorizontal: space.md },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greetPrimary: { fontSize: 28, fontWeight: '700', color: '#000000', letterSpacing: -0.3, lineHeight: 34 },
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 42,
    borderRadius: radius.pill,
    backgroundColor: '#F2F2F7',
  },
  input: { flex: 1, fontSize: 15, fontWeight: '400', color: colors.text, paddingVertical: 8 },
  send: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#C7C7CC', alignItems: 'center', justifyContent: 'center' },
});
