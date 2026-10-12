import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, AppState, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Tap } from './press';
import { roleIcon } from '../types';
import { colors, radius, space, type } from '../theme/tokens';
import { DropStage, layoutDrops, useReduceMotion } from './Drops';
import { BossSkinPicker } from './BossSkinPicker';
import { HealthFollowPanel } from './HealthFollow';
import { loadHealthSnapshot, MOCK_SNAPSHOT, talkStateFromSnapshot, type HealthSnapshot } from './healthSnapshot';
import { loadBossSkinId, poolSource, resolveSkinUri, type BossSkinId } from './bossSkin';
import { hap } from './haptics';
import { MEETING_LINE, pickQuote } from './quotes';
import { startTalk } from './sseClient';
import type { TalkEvent } from './types';
import {
  SUGGEST_CHIPS,
  beginTalkSend,
  cancelTalkStream,
  clearTalkDraftBackup,
  clearTalkSendTimer,
  dispatchTalk,
  getTalkSession,
  getTalkStream,
  restoreTalkDraftOnFail,
  setTalkDraft,
  setTalkMinutesOpen,
  setTalkSrc,
  subscribeTalk,
  type Card,
  type Line,
} from './talkStore';

/** 仍导出，供测试/演示引用；UI 默认不再预填 */
export const DEMO_UTTERANCE = '今晚想练一下，顺便看看冰箱能做啥，这周钱紧';

function useTalkSession() {
  return useSyncExternalStore(subscribeTalk, getTalkSession, getTalkSession);
}

/** 纪要逐字：上一行流完再开始；积压超 3 行整行直出 */
function useTypewriter(lines: Line[], frozen: boolean) {
  const [cur, setCur] = useState(0);
  const [chars, setChars] = useState(0);
  useEffect(() => {
    if (lines.length === 0) {
      setCur(0);
      setChars(0);
    }
  }, [lines.length === 0]);
  useEffect(() => {
    if (frozen) {
      setCur(lines.length);
      return;
    }
    if (cur >= lines.length) return;
    const l = lines[cur];
    if (lines.length - cur > 3) {
      setCur((c) => c + 1);
      setChars(0);
      return;
    }
    if (l.kind !== 'say') {
      if (chars === 0) {
        setChars(l.text.length);
        return;
      }
      const t = setTimeout(() => {
        setCur((c) => c + 1);
        setChars(0);
      }, l.kind === 'reason' ? 900 : l.kind === 'boss' ? 700 : 280);
      return () => clearTimeout(t);
    }
    if (chars < l.text.length) {
      const t = setTimeout(() => setChars((c) => c + 2), 30);
      return () => clearTimeout(t);
    }
    if (l.done) {
      setCur((c) => c + 1);
      setChars(0);
    }
  }, [lines, cur, chars, frozen]);
  const f = (i: number) => (i < cur ? -1 : i === cur ? chars : 0);
  return Object.assign(f, { cur });
}

export function TalkScreen({ onOpenClassic }: { onOpenClassic?: () => void } = {}) {
  const session = useTalkSession();
  const s = session.s;
  const text = session.draft;
  const [level, setLevel] = useState(0);
  const [width, setWidth] = useState(390);
  const [srcLocal, setSrcLocal] = useState(session.src);
  const rm = useReduceMotion();
  const scroll = useRef<ScrollView>(null);
  const shown = useTypewriter(s.lines, s.phase === 'stopped');
  const drops = useMemo(() => layoutDrops(s.drops, width), [s.drops, width]);
  const open = session.minutesOpen;
  const scrollToVeto = useCallback(() => {
    const go = () => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const el = document.querySelector('[data-testid="veto-want"]') as HTMLElement | null;
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      scroll.current?.scrollTo({ y: 140, animated: true });
    };
    setTimeout(go, 60);
    setTimeout(go, 220);
  }, []);
  const [info, setInfo] = useState('');
  const curLine = s.lines[shown.cur];
  const speaking =
    s.phase === 'running' && curLine?.kind === 'say' && curLine.role !== 'jarvis'
      ? `${curLine.task_id}:${curLine.role}`
      : null;
  const [followOpen, setFollowOpen] = useState(false);
  const [skinOpen, setSkinOpen] = useState(false);
  const [skinId, setSkinId] = useState<BossSkinId>('default');
  const [uploadUri, setUploadUri] = useState<string | null>(null);
  const [healthSnap, setHealthSnap] = useState<HealthSnapshot>(MOCK_SNAPSHOT);
  useEffect(() => {
    (async () => {
      const id = await loadBossSkinId();
      setSkinId(id);
      if (id === 'upload') setUploadUri(await resolveSkinUri('upload'));
      setHealthSnap(await loadHealthSnapshot());
    })();
  }, []);
  const bossSkinSource = useMemo(() => {
    if (skinId === 'default') return null;
    if (skinId === 'upload') return uploadUri ? { uri: uploadUri } : null;
    return poolSource(skinId);
  }, [skinId, uploadUri]);
  const [quote, setQuote] = useState(() => pickQuote());
  const quoteOpacity = useRef(new Animated.Value(1)).current;
  const quotePhase = useRef(s.phase);
  const quoteBusy = useRef(false);
  const swapQuote = useCallback(() => {
    if (quoteBusy.current) return;
    quoteBusy.current = true;
    Animated.timing(quoteOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) {
        quoteBusy.current = false;
        return;
      }
      setQuote((q) => pickQuote(q));
      Animated.timing(quoteOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        quoteBusy.current = false;
      });
    });
  }, [quoteOpacity]);
  useEffect(() => {
    quotePhase.current = s.phase;
    if (s.phase !== 'idle' && s.phase !== 'done') return;
    const id = setInterval(() => {
      const ph = quotePhase.current;
      if (ph === 'idle' || ph === 'done') swapQuote();
    }, 12000);
    return () => clearInterval(id);
  }, [s.phase, swapQuote]);
  const prevPhase = useRef(s.phase);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = s.phase;
    quotePhase.current = s.phase;
    if (s.phase === 'idle' && prev !== 'idle') swapQuote();
    if (s.phase === 'done' && (prev === 'running' || prev === 'asking' || prev === 'listening' || prev === 'following')) {
      swapQuote();
    }
  }, [s.phase, swapQuote]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const ph = quotePhase.current;
      if (ph === 'idle' || ph === 'done') swapQuote();
    });
    return () => sub.remove();
  }, [swapQuote]);
  const visibleCards = s.cards.filter((c) => c.afterLine <= shown.cur);
  const landed = new Set(visibleCards.map((c) => c.task_id));
  const folded = s.lines.filter(
    (l) =>
      (s.phase === 'done' || s.phase === 'stopped' ? true : l.task_id ? landed.has(l.task_id) : true) &&
      visibleCards.length > 0,
  );
  const foldedIds = new Set(folded.map((l) => l.id));
  const nSay = folded.filter((l) => l.kind === 'say').length;
  const nVeto = folded.filter((l) => l.kind === 'reason').length;

  // 切页不掐流：只清未触发的定时器；不在卸载时 cancelTalkStream
  useEffect(() => () => {
    clearTalkSendTimer();
  }, []);

  useEffect(() => {
    setSrcLocal(session.src);
  }, [session.src]);

  useEffect(() => {
    if (s.phase === 'done' || s.phase === 'stopped') {
      const t = setTimeout(() => scroll.current?.scrollTo({ y: 0, animated: true }), 400);
      return () => clearTimeout(t);
    }
  }, [s.phase]);

  const onTalkEvent = useCallback((e: TalkEvent) => {
    if (e.event === 'boss.ack') hap.soft();
    else if (e.event === 'role.join') hap.selection();
    else if (e.event === 'veto') hap.medium();
    else if (e.event === 'card.ready') hap.success();
    else if (e.event === 'follow.start') hap.light();
    else if (e.event === 'cancelled') hap.warning();
    else if (e.event === 'refuse' || e.event === 'ask') hap.soft();

    if (e.event === 'error') {
      restoreTalkDraftOnFail();
    } else if (e.event === 'cancelled') {
      clearTalkDraftBackup();
    } else if (
      e.event === 'session.start' ||
      e.event === 'intent.split' ||
      e.event === 'boss.ack' ||
      e.event === 'done'
    ) {
      clearTalkDraftBackup();
    }

    dispatchTalk({ type: 'ev', e });
    const st = getTalkStream();
    if (st?.source) setTalkSrc(st.source);
  }, []);

  const send = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    hap.light();
    const state = healthSnap ? talkStateFromSnapshot(healthSnap) : undefined;
    beginTalkSend({
      text: t,
      startStream: (utterance, onEvent) => startTalk(utterance, onEvent, state),
      onEvent: onTalkEvent,
    });
  }, [text, healthSnap, onTalkEvent]);

  const applyChip = useCallback((chip: string) => {
    hap.selection();
    setTalkDraft(chip);
    setLevel((x) => x + 1);
  }, []);

  const running = s.phase === 'running' || s.phase === 'asking' || s.phase === 'listening';
  const showEmptyHints =
    (s.phase === 'idle' || s.phase === 'done') &&
    !text.trim() &&
    session.userBubbles.length === 0 &&
    s.lines.length === 0 &&
    s.cards.length === 0;

  return (
    <View style={{ flex: 1 }} testID="talk-screen">
      <View onLayout={(ev) => setWidth(ev.nativeEvent.layout.width)}>
        <DropStage
          width={width}
          phase={s.phase}
          level={level}
          pulse={s.pulse}
          drops={drops}
          speaking={speaking}
          falls={s.falls}
          reduce={rm}
          followHint={s.follow?.hint}
          bossSkin={bossSkinSource}
          onPressBoss={() => {
            if (s.phase === 'following' && s.follow) {
              hap.light();
              setFollowOpen(true);
            }
          }}
          onLongPressBoss={() => {
            hap.light();
            if (s.phase === 'idle' || s.phase === 'done' || s.phase === 'listening' || s.phase === 'following') {
              setSkinOpen(true);
            }
          }}
          onInfo={setInfo}
        />
        {s.phase === 'following' && s.follow ? (
          <Tap
            testID="follow-chip"
            feedback="light"
            onPress={() => setFollowOpen(true)}
            style={{ alignSelf: 'center', marginTop: 8, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text style={[type.caption, { color: colors.text2 }]}>● {s.follow.hint}</Text>
          </Tap>
        ) : s.phase === 'idle' || s.phase === 'done' || s.phase === 'listening' ? (
          <Animated.Text
            testID="boss-quote"
            numberOfLines={1}
            style={{
              alignSelf: 'center',
              marginTop: 16,
              maxWidth: width * 0.7,
              fontSize: 15,
              fontWeight: '400',
              lineHeight: 20,
              color: '#8E8E93',
              textAlign: 'center',
              opacity: quoteOpacity,
            }}
          >
            {quote}
          </Animated.Text>
        ) : s.phase === 'running' || s.phase === 'asking' ? (
          <Text
            testID="boss-meeting-line"
            style={{
              alignSelf: 'center',
              marginTop: 16,
              fontSize: 15,
              fontWeight: '400',
              lineHeight: 20,
              color: '#8E8E93',
              textAlign: 'center',
            }}
          >
            {MEETING_LINE}
          </Text>
        ) : null}
        {s.phase === 'idle' || s.phase === 'done' || s.phase === 'listening' || s.phase === 'following' ? (
          <Tap
            testID="btn-skin"
            feedback="light"
            onPress={() => setSkinOpen(true)}
            style={{
              alignSelf: 'center',
              marginTop: 10,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 14,
              backgroundColor: colors.surface,
            }}
            accessibilityLabel="换形象"
          >
            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.text2 }}>换形象</Text>
          </Tap>
        ) : null}
        <Text testID="talk-debug" style={{ position: 'absolute', opacity: 0, fontSize: 1 }}>
          {info}
        </Text>
      </View>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={st.scroll}
        onContentSizeChange={() => {
          if (running) scroll.current?.scrollToEnd({ animated: true });
        }}
        showsVerticalScrollIndicator={false}
      >
        {showEmptyHints ? (
          <View style={st.chips} testID="suggest-chips">
            {SUGGEST_CHIPS.map((c) => (
              <Tap
                key={c}
                testID={`chip-${c}`}
                feedback="selection"
                onPress={() => applyChip(c)}
                style={st.chip}
              >
                <Text style={st.chipText}>{c}</Text>
              </Tap>
            ))}
          </View>
        ) : null}

        {session.userBubbles.map((b) => (
          <View key={b.id} style={st.userRow} testID="user-bubble">
            <View style={st.userBubble}>
              <Text style={st.userText}>{b.text}</Text>
            </View>
          </View>
        ))}

        {folded.length ? (
          <Tap
            testID="minutes-toggle"
            feedback="selection"
            onPress={() => {
              const next = !open;
              setTalkMinutesOpen(next);
              if (next) scrollToVeto();
            }}
            style={st.fold}
          >
            <Text style={type.subhead}>
              会议纪要 · {nSay} 句 · {nVeto} 次否决
            </Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text3} />
          </Tap>
        ) : null}
        {open
          ? folded.map((l) => {
              const tid =
                l.struck ? 'veto-want' : l.kind === 'reason' ? 'veto-reason' : l.phase === 'revised' ? 'veto-revised' : undefined;
              return (
                <View key={l.id} testID={tid} nativeID={tid}>
                  <MinuteLine l={l} />
                </View>
              );
            })
          : null}
        {s.lines.length > folded.length ? (
          <Text style={[st.section, folded.length ? { marginTop: space.md } : null]}>头头 · 主持</Text>
        ) : null}
        {s.lines.map((l, i) => {
          if (foldedIds.has(l.id)) return null;
          const n = shown(i);
          return n === 0 ? null : <MinuteLine key={l.id} l={n < 0 ? l : { ...l, text: l.text.slice(0, n) }} />;
        })}
        {visibleCards.length ? <Text style={[st.section, { marginTop: space.lg }]}>头头结论</Text> : null}
        {visibleCards.map((c) => (
          <ResultCard key={c.task_id} c={c} />
        ))}
        {s.follow && healthSnap ? (
          <HealthFollowPanel
            visible={followOpen}
            follow={s.follow}
            snapshot={healthSnap}
            reduceMotion={rm}
            onSnapshot={setHealthSnap}
            onClose={() => setFollowOpen(false)}
          />
        ) : null}
        {s.phase === 'done' ? (
          <Text style={[type.caption, { marginTop: space.md }]}>
            非医疗建议 · 来源 {srcLocal === 'live' || session.src === 'live' ? '/v1/talk' : '本地演示序列'}
          </Text>
        ) : null}
      </ScrollView>
      <View
        style={[
          st.bar,
          (s.phase === 'idle' || s.phase === 'listening' || s.phase === 'done') && { marginTop: 48 },
          s.phase === 'asking' && st.barLit,
        ]}
      >
        {/* P0：麦克风未实现，图标直接隐藏 */}
        <TextInput
          testID="talk-input"
          value={text}
          onChangeText={(v) => {
            setTalkDraft(v);
            setLevel((x) => x + 1);
          }}
          placeholder={s.phase === 'asking' ? '回我一句…' : '跟我说…'}
          placeholderTextColor={colors.text3}
          style={[st.input, { outlineStyle: 'none' } as never]}
          editable={!running || s.phase === 'asking'}
          onSubmitEditing={running ? undefined : send}
          returnKeyType="send"
          multiline
          maxLength={500}
          blurOnSubmit={false}
        />
        {running ? (
          <Tap
            testID="btn-stop"
            feedback="warning"
            pressOpacity={0.7}
            onPress={() => {
              cancelTalkStream();
            }}
            style={st.send}
            accessibilityLabel="停止"
          >
            <View style={st.stopSq} />
          </Tap>
        ) : (
          <Tap
            testID="btn-send"
            feedback={false}
            pressOpacity={0.7}
            disabled={!text.trim()}
            onPress={send}
            style={[st.send, !text.trim() && { opacity: 0.28 }]}
            accessibilityLabel="发送"
          >
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </Tap>
        )}
      </View>
      {onOpenClassic ? (
        <Tap
          testID="open-classic"
          feedback="selection"
          onPress={onOpenClassic}
          style={{ alignSelf: 'center', paddingVertical: 6, paddingBottom: 10 }}
        >
          <Text style={[type.caption, { color: colors.text3 }]}>旧版今日 ›</Text>
        </Tap>
      ) : null}
      <BossSkinPicker
        visible={skinOpen}
        current={skinId}
        uploadPreview={uploadUri}
        reduceMotion={rm}
        onClose={() => setSkinOpen(false)}
        onSelect={(id, uri) => {
          setSkinId(id);
          if (id === 'upload') setUploadUri(uri ?? null);
          if (id === 'default') setUploadUri(null);
        }}
      />
    </View>
  );
}

function RoleGlyph({ role, size, color }: { role?: string; size: number; color: string }) {
  if (role === 'jarvis') return <Ionicons name="diamond" size={size} color={color} />;
  if (role === 'fitness') return <Ionicons name="barbell" size={size} color={color} />;
  return <MaterialCommunityIcons name={roleIcon(role ?? '') as never} size={size} color={color} />;
}

function MinuteLine({ l }: { l: Line }) {
  if (l.kind === 'boss') {
    return (
      <View style={st.bossRow} testID="boss-ack">
        <Text style={st.bossText}>{l.text}</Text>
      </View>
    );
  }
  if (l.kind === 'reason' || l.kind === 'note') {
    return (
      <View style={st.sysRow}>
        <Text style={st.sysText}>{l.text}</Text>
      </View>
    );
  }
  if (l.kind === 'learned') {
    return (
      <View style={st.sysRow}>
        <Text style={[st.sysText, { color: colors.text2, fontWeight: '500' }]}>{l.text}</Text>
      </View>
    );
  }
  const name = (l.name ?? '').replace(/^.*\//, '');
  const [claim, basis] = l.text.split('｜');
  const ink = l.struck ? colors.text3 : colors.text;
  const reserve = l.short && l.short.length > 0 ? l.short : l.text;
  const minW = Math.min(300, Math.max(13 * 15, reserve.length * 15));
  return (
    <View style={st.chatRow}>
      <View style={[st.avatar, l.struck && { backgroundColor: '#EDEDED' }]}>
        <RoleGlyph role={l.role} size={16} color={ink} />
      </View>
      <View style={{ flexShrink: 1, maxWidth: '100%' }}>
        <Text style={[type.caption, { color: l.struck ? colors.text3 : colors.text2, marginBottom: 3 }]}>{name}</Text>
        <View style={[st.bubble, l.struck && st.bubbleStruck, { minWidth: minW }]}>
          <Text style={[{ fontSize: 17, fontWeight: '400', lineHeight: 22, color: ink }, l.struck && st.struck]}>
            {l.kind === 'ask' ? <Text style={{ fontWeight: '600' }}>问你：</Text> : null}
            {claim}
            {basis !== undefined ? <Text style={{ color: l.struck ? colors.text3 : colors.text2 }}>｜{basis}</Text> : null}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ResultCard({ c }: { c: Card }) {
  const raw = c.card;
  const items = raw.items ?? (raw.handoffs ?? []).map((h) => ({ role: h.role, text: h.action ?? h.text ?? h.line ?? '' }));
  const learned = c.learned;
  const bossLine = raw.boss_line || `我帮你定了：${raw.headline}`;
  const facts = raw.facts ?? [];
  return (
    <View style={st.card} testID={`card-${c.task_id}`}>
      <Text style={[type.subhead, { color: colors.text2 }]}>头头</Text>
      <Text style={{ fontSize: 20, fontWeight: '600', lineHeight: 26, color: colors.text, marginTop: 4 }}>{bossLine}</Text>
      {c.title ? <Text style={[type.caption, { marginTop: 6 }]}>{c.title}</Text> : null}
      {facts.length ? (
        <View style={st.factsRow} testID={`card-facts-${c.task_id}`}>
          {facts.map((f, i) => (
            <View key={i} style={st.fact}>
              <Text style={st.factLabel}>{f.label}</Text>
              <Text style={st.factNum}>{f.value}</Text>
              {f.unit ? <Text style={st.factUnit}>{f.unit}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
      {items.map((it, i) => (
        <View key={i} style={st.cardRow}>
          <RoleGlyph role={it.role} size={16} color={colors.text} />
          <Text style={[type.body, { flex: 1 }]}>{it.text}</Text>
        </View>
      ))}
      {learned.length ? <Text style={st.learned}>这次学会了：{learned.join('；')}</Text> : null}
      {raw.defaulted ? <Text style={[type.caption, { marginTop: space.sm }]}>没收到你的状态，用了默认值</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: space.xl, flexGrow: 1 },
  section: { ...type.subhead, color: colors.text3, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  chipText: { fontSize: 15, color: colors.text, fontWeight: '400' },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 8 },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: colors.accent,
    borderRadius: 16,
    borderTopRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  userText: { fontSize: 17, fontWeight: '400', lineHeight: 22, color: '#fff' },
  chatRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleStruck: { backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  struck: { textDecorationLine: 'line-through', color: colors.text3 },
  sysRow: { paddingLeft: 42, paddingVertical: 4 },
  sysText: { ...type.caption, color: colors.text3, lineHeight: 17 },
  bossRow: { paddingVertical: 8, paddingHorizontal: 4 },
  bossText: { ...type.subhead, color: colors.text2, lineHeight: 20 },
  fold: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.hairline,
  },
  card: {
    borderWidth: 0.5,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
    backgroundColor: colors.bg,
  },
  factsRow: { flexDirection: 'row', gap: 16, marginTop: 14, marginBottom: 6 },
  fact: { minWidth: 72 },
  factLabel: { fontSize: 13, color: '#8E8E93', marginBottom: 2 },
  factNum: { fontSize: 28, fontWeight: '600', color: '#000', fontVariant: ['tabular-nums'], lineHeight: 32 },
  factUnit: { fontSize: 15, color: '#8E8E93', marginTop: 2 },
  cardRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.hairline,
  },
  learned: { ...type.subhead, marginTop: space.md },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: space.lg,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  barLit: { backgroundColor: colors.bg, borderColor: colors.text },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 6,
    paddingHorizontal: 6,
    lineHeight: 20,
    maxHeight: 96,
  },
  send: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    marginBottom: 1,
  },
  stopSq: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#fff' },
});
