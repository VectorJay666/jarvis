import { BlurTargetView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  confirmRole, deleteRule, fetchCompare, fetchCouncil, fetchRoles, fetchRules, postFeedback, previewRole,
  RejectError, type Sourced,
} from './src/api/council';
import { tabBarInset, useTabIndicator } from './src/components/TabBar';
import { NavBar, PrimaryButton, TabBar, type TabKey } from './src/components/ui';
import { Habits, HireFlow, HireFooter, Me, RoleDetail, Team } from './src/screens/Others';
import { Today } from './src/screens/Today';
import { AgentScreen } from './src/agent/AgentScreen';
import { ScreenArrival } from './src/components/ScreenArrival';
import { colors, space } from './src/theme/tokens';
import {
  DEMO_DEFAULTS, type CompareResult, type CouncilStatus, type HabitRule, type HandoffCardData, type Role, type RolePreview,
} from './src/types';

type Route = { name: 'detail'; roleId: string; from: TabKey } | { name: 'hire'; from: TabKey } | null;

function DemoScene() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('talk');
  const indicator = useTabIndicator(tab);
  const blurTarget = useRef<View>(null);
  const navigationInset = tabBarInset(insets.bottom);
  const [route, setRoute] = useState<Route>(null);
  const [status, setStatus] = useState<CouncilStatus>({ ...DEMO_DEFAULTS });
  const [roles, setRoles] = useState<Role[]>([]);
  const [rules, setRules] = useState<HabitRule[]>([]);
  const [card, setCard] = useState<Sourced<HandoffCardData> | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fallbackErr, setFallbackErr] = useState<string | null>(null);
  const [feedbackRole, setFeedbackRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hireStep, setHireStep] = useState<1 | 2 | 3>(1);
  const [need, setNeed] = useState('');
  const [preview, setPreview] = useState<RolePreview | null>(null);
  const [hireErr, setHireErr] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);

  const labels = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r.name])), [roles]);
  const hasBudget = roles.some((r) => r.id === 'ledger' || r.state_fields?.some((f) => f.key === 'budget_left'));
  const note = (r: Sourced<unknown>) => { if (r.source === 'fallback') setFallbackErr(r.error ?? '接口失败'); };

  const refreshMeta = useCallback(async () => {
    const [ro, ru] = await Promise.all([fetchRoles(), fetchRules()]);
    setRoles(ro.data); setRules(ru.data); note(ro); note(ru);
    return ru.data;
  }, []);
  useEffect(() => { refreshMeta(); }, [refreshMeta]);

  const runCouncil = useCallback(async (s: CouncilStatus, withCompare: boolean) => {
    setLoading(true);
    try {
      const r = await fetchCouncil(s); setCard(r); note(r);
      if (withCompare) { const c = await fetchCompare(s); setCompare(c.data); note(c); } else setCompare(null);
    } finally { setLoading(false); }
  }, []);

  const onCouncil = () => { setFallbackErr(null); runCouncil(status, rules.length > 0); };
  const onStatusChange = (next: CouncilStatus) => { setStatus(next); setCard(null); setCompare(null); };

  const onFeedback = async (text: string) => {
    if (!card || !feedbackRole) return;
    setBusy(true);
    try {
      const r = await postFeedback(card.data.card_id, feedbackRole, text); note(r);
      setFeedbackRole(null);
      await refreshMeta();
      await runCouncil(status, true);
    } finally { setBusy(false); }
  };

  const onRevoke = async (id: string) => {
    const r = await deleteRule(id); note(r);
    const left = await refreshMeta();
    void left; await runCouncil(status, true);
  };

  const onOpenRole = async (roleId: string) => {
    setRoute({ name: 'detail', roleId, from: tab });
    if (!compare && rules.length) { const c = await fetchCompare(status); setCompare(c.data); note(c); }
  };

  const openHire = () => { setHireStep(1); setNeed(''); setPreview(null); setHireErr(null); setRoute({ name: 'hire', from: tab }); };

  const onPreview = async () => {
    setBusy(true); setHireErr(null); setPreview(null);
    try { const r = await previewRole(need.trim()); setPreview(r.data); note(r); }
    catch (e) { setHireErr(e instanceof RejectError ? e.message : `预览失败：${e instanceof Error ? e.message : e}`); }
    finally { setBusy(false); setHireStep(2); }
  };

  const onConfirm = async () => {
    setBusy(true); setHireErr(null);
    try {
      const r = await confirmRole(need.trim()); note(r);
      setNewIds((ids) => [...ids, r.data.id]);
      await refreshMeta();
      const next = { ...status, budget_left: status.budget_left ?? 300 };
      setStatus(next);
      setRoute(null); setTab('today');
      await runCouncil(next, false);
    } catch (e) { setHireErr(e instanceof RejectError ? e.message : `上岗失败：${e instanceof Error ? e.message : e}`); setHireStep(2); }
    finally { setBusy(false); }
  };

  const learned = useMemo(() => {
    if (!card) return null;
    const r = rules.find((x) => card.data.handoffs.some((h) => h.role === x.role));
    return r ? { role: r.role, text: r.text } : null;
  }, [card, rules]);

  const navigate = useCallback((next: TabKey) => { Keyboard.dismiss(); setTab(next); setFeedbackRole(null); }, []);
  const talkVisible = !route && tab === 'talk';
  const todayVisible = !route && tab === 'today';

  const hireProps = { step: hireStep, setStep: setHireStep, need, setNeed, preview, error: hireErr, busy, onPreview, onConfirm };

  let body: React.ReactNode; let footer: React.ReactNode = null;
  if (route?.name === 'detail') {
    body = <RoleDetail role={roles.find((r) => r.id === route.roleId)} rules={rules.filter((r) => r.role === route.roleId)} compare={compare} onRevoke={onRevoke} />;
  } else if (route?.name === 'hire') {
    body = <HireFlow {...hireProps} />; footer = <HireFooter {...hireProps} />;
  } else if (tab === 'today') {
    body = null;
    footer = <PrimaryButton testID="btn-council" label="让秘书团会商" loading={loading} onPress={onCouncil} />;
  } else if (tab === 'team') body = <Team roles={roles} newIds={newIds} onOpen={onOpenRole} onHire={openHire} />;
  else if (tab === 'habits') body = <Habits rules={rules} roles={roles} onOpen={onOpenRole} />;
  else body = <Me />;

  const backLabel = route ? ({ talk: '开始', today: '今日', team: '跟进', habits: '习惯', me: '我的' } as const)[route.from] : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="demo-scene">
      <StatusBar style="dark" />
      <View style={styles.col}>
        {route ? <NavBar title={route.name === 'hire' ? '' : '秘书详情'} backLabel={backLabel} onBack={() => setRoute(null)} /> : null}
        <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
          {/* Preserve both screens and their scroll state; hiding Talk also pauses its motion. */}
          <ScreenArrival active={talkVisible}>
            <AgentScreen visible={talkVisible} activeTab="talk" tabIndicator={indicator} onNavigate={navigate} />
          </ScreenArrival>
          <ScreenArrival active={todayVisible}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scroll, { paddingBottom: navigationInset + 90 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} testID="today-scroll">
              <Today status={status} onChange={onStatusChange} hasBudget={hasBudget} card={card} labels={labels} learned={learned} onOpenRole={onOpenRole}
                feedbackRole={feedbackRole} setFeedbackRole={setFeedbackRole} onFeedback={onFeedback} busy={busy} fallbackErr={fallbackErr} />
            </ScrollView>
          </ScreenArrival>
          {!talkVisible && !todayVisible ? (
            <ScreenArrival key={route ? `${route.name}-${route.name === 'detail' ? route.roleId : ''}` : tab} active>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scroll, { paddingBottom: (route ? insets.bottom : navigationInset) + (footer ? 90 : space.xl) }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {body}
            </ScrollView>
            </ScreenArrival>
          ) : null}
        </BlurTargetView>
        {footer ? <View style={[styles.cta, { bottom: route ? 0 : navigationInset, paddingBottom: route ? Math.max(insets.bottom, space.sm) : space.sm }]}>{footer}</View> : null}
        <View style={[StyleSheet.absoluteFill, { display: !route && tab !== 'talk' ? 'flex' : 'none' }]} pointerEvents="box-none"><TabBar active={!route && tab !== 'talk'} indicator={indicator} blurTarget={blurTarget} value={tab} onChange={navigate} bottom={insets.bottom} /></View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider><DemoScene /></SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  col: { flex: 1, maxWidth: 430, width: '100%', alignSelf: 'center' },
  scroll: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl },
  cta: { position: 'absolute', left: 0, right: 0, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, backgroundColor: colors.bg },
});
