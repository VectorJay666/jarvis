import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FloatingChoices } from './FloatingChoices';
import { conversationOpening } from './opening';
import { ConversationGlassContext, ConversationOrb, FlowSurface, FlowText } from './ConversationMotion';
import { useReduceMotion } from '../talk/Drops';
import { KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import evidenceData from './evidence.json';
import { Tap } from '../talk/press';
import type { HealthSnapshot } from '../talk/healthSnapshot';
import { cancelRecoveryReminder, scheduleRecoveryReminder } from '../agent/notify';
import { askRecovery, getRecoveryStatus } from './client';
import { advanceDemo, seedConversation } from './demo';
import type { Conversation, Evidence, Message, Mode, Period } from './types';

const evidence: Evidence[] = evidenceData;
const STORE = 'jarvis-recovery-conversations-v1';
const PERIODS: { id: Period; name: string }[] = [{ id: 'morning', name: '早晨规划' }, { id: 'evening', name: '傍晚调整' }, { id: 'night', name: '今晚准备' }];
const blank = (): Conversation => ({ period: 'morning', step: 0, messages: [], current: undefined });
type Props = { visible: boolean; snapshot: HealthSnapshot; initialText?: string; openRealConversation?: boolean; initialConversation?: Message[]; onClose: () => void };

export function RecoveryScreen({ visible, snapshot, initialText, openRealConversation, initialConversation, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('agent');
  const [demo, setDemo] = useState<Conversation>(() => seedConversation('morning'));
  const [agent, setAgent] = useState<Conversation>(blank);
  const [configured, setConfigured] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [pendingId, setPendingId] = useState('');
  const reduced = useReduceMotion();
  const request = useRef<AbortController | null>(null);
  const followBottom = useRef(true);
  const seeded = useRef<string | null>(null);
  const blurTarget = useRef<View>(null);
  const backdropTarget = useRef<View>(null);
  const [dockHeight, setDockHeight] = useState(230);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showData, setShowData] = useState(false);
  const [reminderTime, setReminderTime] = useState('');
  const [reminder, setReminder] = useState<{ id: string; at: string; title: string } | null>(null);
  const [notice, setNotice] = useState('');
  const scroll = useRef<ScrollView>(null);
  const lock = useRef(false);
  const forwarded = useRef<string | null>(null);
  const state = mode === 'demo' ? demo : agent;
  const current = state.current;
  const opening = conversationOpening(snapshot, 'recovery');
  const choices = busy ? [] : current?.quick_replies || (mode === 'agent' ? opening.choices : []);

  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(STORE).then(raw => {
      if (!raw || !live) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.demo?.messages) setDemo(saved.demo);
        if (saved.agent?.messages) setAgent(saved.agent);
        if (saved.mode === 'agent' || saved.mode === 'demo') setMode(saved.mode);
        if (saved.reminder?.id) setReminder(saved.reminder);
      } catch { /* invalid local cache */ }
    }).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (ready) void AsyncStorage.setItem(STORE, JSON.stringify({ demo, agent, reminder, mode })).catch(() => setNotice('这次会话暂时无法保存到本机。'));
  }, [demo, agent, reminder, ready, mode]);
  useEffect(() => {
    if (!visible) return;
    let live = true;
    void getRecoveryStatus().then(status => { if (live) setConfigured(status.configured); }).catch(() => { if (live) setConfigured(false); });
    return () => { live = false; };
  }, [visible, initialText]);

  useEffect(() => {
    if (visible && ready && openRealConversation) requestAnimationFrame(() => setMode('agent'));
  }, [visible, ready, openRealConversation]);

  useEffect(() => {
    if (!visible) request.current?.abort();
    return () => { request.current?.abort(); };
  }, [visible]);
  useEffect(() => {
    const id = initialConversation?.at(-1)?.id;
    if (!visible || !ready || !id || seeded.current === id) return;
    seeded.current = id;
    const frame = requestAnimationFrame(() => {
      setMode('agent'); setAgent({ period: 'morning', step: 1, messages: initialConversation || [], current: initialConversation?.at(-1)?.result });
      setError(''); followBottom.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, ready, initialConversation]);

  const send = async (text: string, retry = false, targetMode = mode) => {
    const value = text.trim();
    if ((!value && !retry) || lock.current || !ready) return;
    lock.current = true;
    followBottom.current = true;
    setError(''); setExpanded(false); setInput(''); setBusy(true); setPendingText('');
    try {
      if (targetMode === 'demo') { setDemo(previous => advanceDemo(previous, value)); return; }
      const user: Message = { id: `${Date.now()}-u`, role: 'user', content: value };
      const messages = retry ? agent.messages : [...agent.messages, user];
      if (!retry) setAgent(previous => ({ ...previous, messages }));
      const controller = new AbortController(); request.current = controller;
      const assistantId = String(Date.now()) + '-a';
      setPendingId(assistantId);
      const response = await askRecovery(messages, snapshot, { signal: controller.signal, onReply: setPendingText });
      if (controller.signal.aborted) return;
      setAgent(previous => ({ ...previous, messages: [...messages, { id: assistantId, role: 'assistant', content: response.reply, result: response }], current: response, step: previous.step + 1 }));
    } catch (e) { setError(e instanceof Error ? e.message : '连接暂时中断，请重试。'); }
    finally { request.current = null; lock.current = false; setBusy(false); setPendingText(''); setPendingId(''); }
  };
  useEffect(() => {
    if (!visible) { forwarded.current = null; return; }
    if (initialText && ready && forwarded.current !== initialText) {
      forwarded.current = initialText;
      void send(initialText, false, 'agent');
    }
    // Only an explicit message forwarded from the homepage is sent on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialText, ready]);
  useEffect(() => {
    if (state.step > 0 && visible && followBottom.current) requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: !reduced }));
  }, [state.step, visible, reduced]);
  const switchMode = (next: Mode) => {
    if (busy) return;
    setMode(next); setError(''); setExpanded(false); setShowData(false); setNotice('');
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
  };
  const setPeriod = (period: Period) => { if (busy) return; setDemo(seedConversation(period)); setExpanded(false); setShowData(false); setError(''); setNotice(''); requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false })); };
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReminderTime(current?.reminder_request?.time || ''));
    return () => cancelAnimationFrame(frame);
  }, [current?.reminder_request]);
  const setRealReminder = async () => {
    if (lock.current || !current?.reminder_request) return;
    const match = reminderTime.trim().match(/^([01]?\d|2[0-3])[:：]([0-5]\d)$/);
    if (!match) { setNotice('请输入明确时间，例如 17:00。'); return; }
    const date = new Date(); date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    if (date.getTime() <= Date.now()) { setNotice('今天这个时间已经过去了，请选一个未来时间。'); return; }
    lock.current = true; setBusy(true);
    try {
      const request = current.reminder_request;
      // Cancel the existing reminder before replacement so there is never a hidden duplicate.
      if (reminder && !(await cancelRecoveryReminder(reminder.id))) { setNotice('原提醒暂时无法取消，保留原提醒，请重试。'); return; }
      if (reminder) setReminder(null);
      const id = await scheduleRecoveryReminder(request.title, date);
      if (!id) { setNotice('没有设置成功。网页预览不支持系统通知，手机上需要通知授权。'); return; }
      setReminder({ id, at: date.toISOString(), title: request.title });
      setNotice(`已设置 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 的系统提醒。`);
    } finally { lock.current = false; setBusy(false); }
  };
  const cancelReminder = async () => {
    if (!reminder || lock.current) return;
    lock.current = true; setBusy(true);
    try {
      if (await cancelRecoveryReminder(reminder.id)) { setReminder(null); setNotice('系统提醒已取消。'); }
      else setNotice('暂时无法取消提醒，请重试。');
    } finally { lock.current = false; setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose} testID="recovery-modal">
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <BlurTargetView ref={backdropTarget} style={StyleSheet.absoluteFill} pointerEvents="none"><LinearGradient colors={['#E5EDE5', '#ECEBF1', '#F1EEE5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /><View style={s.ambientSage} /><View style={s.ambientLilac} /></BlurTargetView>
        <ConversationGlassContext.Provider value={backdropTarget}>
        <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
          <View style={s.nav}>
            <Tap onPress={onClose} style={s.navButton} accessibilityLabel="返回睡眠模块" testID="recovery-back"><Ionicons name="chevron-back" size={21} color="#1D1D1F" /><Text style={s.navText}>健康</Text></Tap>
            <Text style={s.navTitle}>睡眠与恢复</Text>
            <Tap onPress={() => { if (!busy) { if (mode === 'demo') setDemo(seedConversation(demo.period)); else setAgent(blank()); setError(''); setExpanded(false); setShowData(false); requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false })); } }} disabled={busy} style={s.navButton} accessibilityLabel="开始新对话" testID="recovery-reset"><Ionicons name="create-outline" size={21} color="#1D1D1F" /></Tap>
          </View>
          <View style={s.modeRow}>
            <View style={s.modeSwitch}>{(['demo', 'agent'] as Mode[]).map(item => <Tap key={item} disabled={busy} onPress={() => switchMode(item)} style={[s.modeButton, mode === item && s.modeSelected]} testID={`recovery-mode-${item}`}><Text style={[s.modeText, mode === item && s.modeTextSelected]}>{item === 'demo' ? '体验示例' : '陪我调整'}</Text></Tap>)}</View>
            <Text style={s.meta}>{mode === 'demo' ? '示例数据' : configured ? '根据你的状态' : '暂未连接'}</Text>
          </View>
          {mode === 'demo' ? <View style={s.periods}>{PERIODS.map(period => <Tap key={period.id} disabled={busy} style={[s.period, demo.period === period.id && s.periodSelected]} onPress={() => setPeriod(period.id)} testID={`recovery-${period.id}`}><Text style={[s.periodText, demo.period === period.id && s.periodTextSelected]}>{period.name}</Text></Tap>)}</View> : null}
          <BlurTargetView ref={blurTarget} style={s.scroll}><ScrollView ref={scroll} style={s.scroll} contentContainerStyle={[s.content, { paddingBottom: dockHeight + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} testID="recovery-scroll" scrollEventThrottle={32} onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent; followBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 96; }} onContentSizeChange={() => { if (followBottom.current) scroll.current?.scrollToEnd({ animated: false }); }}>
            <View style={s.intro}>
              <View style={s.moon}><Ionicons name="moon-outline" size={25} color="#1D1D1F" /></View>
              <Text style={s.eyebrow}>SLEEP & RECOVERY</Text>
              <Text style={s.title}>{state.period === 'night' && mode === 'demo' ? '今晚，慢慢收尾。' : state.period === 'evening' && mode === 'demo' ? '计划，跟着状态走。' : '让今天，从容一点。'}</Text>
              <Text style={s.subtitle}>{mode === 'demo' ? '模拟健康与日历 · 不发送真实通知' : '结合你提供的数据、感受与安排，逐步调整。'}</Text>
            </View>
            <Tap onPress={() => setShowData(!showData)} style={s.dataLink} testID="recovery-data" accessibilityLabel="查看本次使用的数据"><Ionicons name="heart-outline" size={15} color="#6E6E73" /><Text style={s.dataText}>查看本次使用的数据</Text><Ionicons name={showData ? 'chevron-up' : 'chevron-down'} size={13} color="#86868B" /></Tap>
            {showData ? <View style={s.dataBox}>
              <Text style={s.cardTitle}>{mode === 'demo' ? '模拟数据' : snapshot.source === 'mock' ? '当前为演示健康记录' : '当前可用记录'}</Text>
              <Text style={s.basis}>{mode === 'demo' ? '睡眠 5.2 小时；日历为示例事件；无真实个人历史。' : `来源：${snapshot.source || '未知'}；记录时间：${snapshot.updated_at ? new Date(snapshot.updated_at).toLocaleString() : '未知'}。`}</Text>
              {mode === 'agent' ? <Text style={s.basis}>{Object.entries(snapshot).filter(([key]) => !['source', 'updated_at'].includes(key)).map(([key, value]) => `${HEALTH_LABELS[key] || key}：${Array.isArray(value) ? value.join('、') : String(value)}`).join('\n') || '没有可用指标。'}</Text> : null}
              <Text style={s.basis}>个人基线不足。Apple Calendar 尚未接入，可以直接描述日程。</Text>
            </View> : null}
            {mode === 'agent' && !agent.messages.length ? <FlowSurface style={s.empty} testID="recovery-opening"><Text style={s.speaker}>{opening.label}</Text><Text style={s.assistant}>{opening.observation}</Text><Text style={s.assistant}>{opening.question}</Text><Text style={s.basis}>{configured ? '点选下方，也可以直接告诉我。' : '对话暂未连接，可以先体验示例。'}</Text></FlowSurface> : null}
            <View style={s.messages}>
              {[...state.messages, ...(pendingId ? [{ id: pendingId, role: 'assistant' as const, content: pendingText }] : [])].map((message, index) => <FlowSurface key={message.id} style={message.role === 'user' ? s.userWrap : s.assistantWrap} testID={`recovery-message-${index}`}>
                {message.role === 'assistant' ? <Text style={s.speaker}>{mode === 'demo' ? 'Jarvis · 演示回复' : 'Jarvis'}</Text> : null}
                {message.id === pendingId && !pendingText ? <View style={s.loading} testID="recovery-waiting"><ConversationOrb active /><Text style={s.meta}>在听，也在想…</Text></View> : <FlowText text={message.content} streaming={message.id === pendingId} style={message.role === 'user' ? s.userText : s.assistant} />}
                {message.id === pendingId && pendingText ? <View style={s.streamStatus} testID="recovery-streaming"><ConversationOrb active /><Text style={s.meta}>正在回复</Text></View> : null}
              </FlowSurface>)}
            </View>
            {!pendingId && current?.cards.map((card, index) => <FlowSurface delay={index * 70} key={`${state.step}-${index}`} style={s.card} testID={`recovery-card-${index}`}>
              <View style={s.cardHeader}><Text style={s.cardTitle}>{card.title}</Text><View style={s.draft}><Text style={s.draftText}>可调整</Text></View></View>
              {card.rows.map((row, i) => <View key={i} style={[s.planRow, i > 0 && s.rowBorder]}><Text style={s.planLabel}>{row.label}</Text><Text style={s.planValue}>{row.value}</Text></View>)}
              <Tap style={s.why} onPress={() => setExpanded(!expanded)} testID={`recovery-why-${index}`}><Ionicons name="information-circle-outline" size={16} color="#6E6E73" /><Text style={s.whyText}>为什么这样建议</Text><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color="#86868B" /></Tap>
              {expanded ? <View style={s.reason}><Text style={s.basis}>{card.basis}</Text><Text style={s.sourceLabel}>数据、约束与研究依据</Text>
                {card.evidence_ids.length ? evidence.filter(e => card.evidence_ids.includes(e.id)).map(e => <Tap key={e.id} onPress={() => { void Linking.openURL(e.url).catch(() => setNotice('暂时无法打开文献链接。')); }} style={s.evidence} accessibilityLabel={`打开文献 ${e.title}`}><Text style={s.evidenceTitle}>{e.title} ↗</Text><Text style={s.meta}>{e.year} · {e.type}</Text><Text style={s.basis}>{e.scope}</Text><Text style={s.meta}>{e.review}</Text></Tap>) : <Text style={s.basis}>本卡片为对话与规划推断，没有对应的直接研究验证。</Text>}
                <Text style={s.footnote}>首批证据目录，非穷尽检索。非医疗建议。</Text>
              </View> : null}
            </FlowSurface>)}
            {mode === 'agent' && !pendingId && current?.reminder_request ? <View style={s.dataBox}><Text style={s.cardTitle}>提醒 · 等你确认</Text><Text style={s.basis}>{current.reminder_request.question}</Text><View style={s.timeRow}><TextInput value={reminderTime} onChangeText={setReminderTime} placeholder="今天 17:00" style={s.timeInput} testID="recovery-reminder-time" accessibilityLabel="今天的提醒时间" /><Tap disabled={busy} style={s.darkButton} onPress={() => { void setRealReminder(); }} testID="recovery-reminder-confirm"><Text style={s.darkText}>确认提醒</Text></Tap></View></View> : null}
            {mode === 'agent' && reminder ? <View style={s.dataBox}><Text style={s.cardTitle}>系统提醒</Text><Text style={s.basis}>{new Date(reminder.at).toLocaleString()} · {reminder.title}</Text><Tap disabled={busy} onPress={() => { void cancelReminder(); }} style={s.why}><Text style={s.whyText}>取消提醒</Text></Tap></View> : null}
            {error ? <View style={s.error} testID="recovery-error"><Text style={s.basis}>{error}</Text><Tap disabled={busy} onPress={() => { void send('', true); }} style={s.why} testID="recovery-retry"><Text style={s.whyText}>重试这条消息</Text></Tap></View> : null}
            {notice ? <Text style={s.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
            <Text style={s.footerNote}>{mode === 'demo' ? '预设演示 · 切换时段可体验不同场景' : '对话保存在本机 · 日程可以直接告诉我'}</Text>
          </ScrollView></BlurTargetView>
          <View style={s.bottom} testID="recovery-floating-dock" onLayout={event => { const height = Math.round(event.nativeEvent.layout.height); setDockHeight(previous => Math.abs(previous - height) > 1 ? height : previous); }}>
            <FloatingChoices choices={choices} disabled={busy || !ready} onChoose={reply => { void send(reply); }} testIDPrefix="recovery-quick" blurTarget={blurTarget} />
            <FlowSurface style={s.composer} blurTarget={blurTarget} animate={false} testID="recovery-composer-glass"><ConversationOrb active={Boolean(pendingId)} input={input} /><TextInput value={input} onChangeText={setInput} placeholder="也可以说说感受或安排…" placeholderTextColor="#86868B" style={s.input} onSubmitEditing={() => { void send(input); }} returnKeyType="send" editable={!busy && ready} maxLength={2000} testID="recovery-input" accessibilityLabel="聊聊睡眠与恢复" /><Tap disabled={!pendingId && (!input.trim() || busy || !ready)} onPress={() => { if (pendingId) request.current?.abort(); else void send(input); }} style={[s.send, !pendingId && (!input.trim() || busy) && s.disabled]} testID="recovery-send" accessibilityLabel={pendingId ? '停止回复' : '发送'}><Ionicons name={pendingId ? 'stop' : 'arrow-up'} size={pendingId ? 14 : 19} color="#FFF" /></Tap></FlowSurface>
          </View>
        </KeyboardAvoidingView>
        </ConversationGlassContext.Provider>
      </SafeAreaView>
    </Modal>
  );
}
const HEALTH_LABELS: Record<string, string> = { sleep_hours: '睡眠时长（小时）', hrv_ms: 'HRV（ms，方法未知）', resting_hr: '静息心率（次/分）', steps: '步数', active_kcal: '活动热量（kcal）', training_done: '训练完成（用户记录）', meals_today: '餐次（用户记录）', free_minutes: '空闲分钟（用户填写）', budget_left: '预算（用户填写）', fridge: '食材（用户填写）' };
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ECEFE9' }, ambientSage: { position: 'absolute', top: '18%', right: -100, width: 290, height: 330, borderRadius: 165, backgroundColor: 'rgba(170,193,174,0.20)' }, ambientLilac: { position: 'absolute', bottom: '12%', left: -110, width: 330, height: 350, borderRadius: 175, backgroundColor: 'rgba(195,186,220,0.16)' }, container: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  nav: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: 'transparent' }, navButton: { minWidth: 64, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 }, navText: { fontSize: 16, color: '#1D1D1F' }, navTitle: { fontSize: 17, fontWeight: '600', color: '#1D1D1F' },
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginBottom: 12 }, modeSwitch: { flexDirection: 'row', padding: 3, backgroundColor: '#EEEEF0', borderRadius: 12 }, modeButton: { paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: 9 }, modeSelected: { backgroundColor: '#FFF' }, modeText: { fontSize: 12, color: '#86868B' }, modeTextSelected: { color: '#1D1D1F', fontWeight: '600' }, meta: { fontSize: 11, color: '#86868B', lineHeight: 17 },
  periods: { flexDirection: 'row', paddingHorizontal: 22, gap: 8, marginBottom: 4 }, period: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, periodSelected: { borderBottomColor: '#1D1D1F' }, periodText: { fontSize: 13, color: '#86868B' }, periodTextSelected: { fontWeight: '600', color: '#1D1D1F' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 22, paddingBottom: 24 }, intro: { alignItems: 'center', paddingTop: 26, paddingBottom: 23 }, moon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#EEEEF0', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }, eyebrow: { fontSize: 9, fontWeight: '600', letterSpacing: 2, color: '#86868B', marginBottom: 10 }, title: { fontSize: 27, fontWeight: '600', color: '#1D1D1F', letterSpacing: -0.8 }, subtitle: { fontSize: 11, color: '#86868B', marginTop: 10, textAlign: 'center', lineHeight: 18 },
  dataLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, minHeight: 44, marginBottom: 14 }, dataText: { fontSize: 12, color: '#6E6E73' }, dataBox: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, gap: 8, marginBottom: 16 }, messages: { gap: 20, marginBottom: 20 }, assistantWrap: { padding: 17, borderBottomLeftRadius: 7 }, speaker: { fontSize: 10, color: '#86868B', marginBottom: 7, letterSpacing: 0.3 }, assistant: { fontSize: 15, color: '#1D1D1F', lineHeight: 25 }, userWrap: { alignSelf: 'flex-end', maxWidth: '90%', paddingVertical: 11, paddingHorizontal: 15, backgroundColor: 'rgba(216,230,219,0.40)', borderRadius: 22, borderBottomRightRadius: 7 }, userText: { fontSize: 14, color: '#1D1D1F', lineHeight: 22 }, empty: { gap: 10, padding: 18, marginBottom: 24 }, streamStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, loading: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 20 },
  card: { borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.78)', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 20, overflow: 'hidden', marginBottom: 16 }, cardHeader: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1D1D1F', lineHeight: 22 }, draft: { backgroundColor: '#F5F5F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }, draftText: { fontSize: 10, color: '#86868B' }, planRow: { marginHorizontal: 18, paddingVertical: 13, flexDirection: 'row', gap: 14 }, rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEEEF0' }, planLabel: { width: 78, fontSize: 12, color: '#86868B', lineHeight: 21 }, planValue: { flex: 1, fontSize: 13, color: '#1D1D1F', lineHeight: 21 }, why: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 44, paddingHorizontal: 18 }, whyText: { flex: 1, fontSize: 12, color: '#6E6E73' }, reason: { marginHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEEEF0', paddingVertical: 16, gap: 12 }, basis: { fontSize: 12, color: '#6E6E73', lineHeight: 21 }, sourceLabel: { fontSize: 11, fontWeight: '600', color: '#1D1D1F', marginTop: 6 }, evidence: { gap: 5, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEEEF0' }, evidenceTitle: { fontSize: 12, color: '#1D1D1F', lineHeight: 19, fontWeight: '500' }, footnote: { fontSize: 10, color: '#86868B', lineHeight: 18 },
  footerNote: { textAlign: 'center', fontSize: 10, lineHeight: 18, color: '#86868B', marginTop: 8 }, bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12 }, quickReplies: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingBottom: 10 }, quick: { paddingHorizontal: 13, paddingVertical: 10, minHeight: 44, justifyContent: 'center', borderRadius: 16, backgroundColor: '#EEEEF0', maxWidth: '100%' }, quickText: { fontSize: 12, color: '#424245', lineHeight: 18 }, composer: { flexDirection: 'row', alignItems: 'center', borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.36)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.82)', paddingLeft: 4, paddingRight: 5, minHeight: 54 }, input: { flex: 1, minWidth: 0, fontSize: 14, minHeight: 48, color: '#1D1D1F', ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {}) }, send: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1D1D1F', justifyContent: 'center', alignItems: 'center' }, disabled: { opacity: 0.2 },
  error: { padding: 16, borderRadius: 16, backgroundColor: '#EEEEF0', marginBottom: 16 }, notice: { fontSize: 12, color: '#6E6E73', lineHeight: 21, marginVertical: 10 }, timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, timeInput: { flex: 1, minWidth: 0, backgroundColor: '#F5F5F7', borderRadius: 10, padding: 12, fontSize: 15 }, darkButton: { padding: 12, borderRadius: 12, backgroundColor: '#1D1D1F' }, darkText: { color: '#FFF', fontSize: 12 },
});
