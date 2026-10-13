import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Modal, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import {
  blocksFromSnapshot, healthKitAvailable, persistAndMaybePost, type HealthBlock, type HealthSnapshot,
} from './healthSnapshot';
import { hap } from './haptics';
import { Tap } from './press';

const LABEL = '#8E8E93';
const BG = '#F2F2F7';
const DAMP = 0.86;

type Follow = { hint: string; plan: string; updates: { id: string; because: string; change: string; text?: string; facts?: { sleep_hours?: number } }[] };

type Props = {
  visible: boolean;
  follow: Follow;
  snapshot: HealthSnapshot;
  reduceMotion?: boolean;
  onSnapshot: (s: HealthSnapshot) => void;
  onClose: () => void;
  onOpenRecovery?: () => void;
};

export function HealthFollowPanel({ visible, follow, snapshot, reduceMotion, onSnapshot, onClose, onOpenRecovery }: Props) {
  const { height } = useWindowDimensions();
  const sheetH = Math.min(height * 0.78, 640);
  const y = useRef(new Animated.Value(sheetH)).current;
  const blocks = useMemo(() => blocksFromSnapshot(snapshot), [snapshot]);
  const [detail, setDetail] = useState<HealthBlock | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const hk = healthKitAvailable();

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) { y.setValue(0); return; }
    y.setValue(sheetH);
    Animated.spring(y, { toValue: 0, damping: DAMP * 20, stiffness: 180, mass: 0.9, useNativeDriver: true }).start();
  }, [visible, sheetH, reduceMotion, y]);

  const close = () => {
    if (reduceMotion) { onClose(); return; }
    Animated.spring(y, { toValue: sheetH, damping: DAMP * 20, stiffness: 200, mass: 0.85, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const connectHealth = () => {
    hap.light();
    // No native HealthKit bridge exists yet. Never relabel demo samples as HealthKit.
    setManualOpen(true);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} testID="follow-panel">
      <View style={st.root}>
        <Tap feedback="selection" style={st.dim} onPress={close} pressOpacity={1} pressScale={1} />
        <Animated.View style={[st.sheet, { height: sheetH, transform: [{ translateY: y }] }]} testID="follow-health-sheet">
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <View style={st.inner}>
            <View style={st.grab} />
            <View style={st.topRow}>
              <Text style={st.title}>健康详情</Text>
              <Tap feedback="selection" onPress={close} hitSlop={12} pressOpacity={0.5} pressScale={1}><Text style={st.close}>收起</Text></Tap>
            </View>
            <Text style={st.plan}>{follow.plan || (snapshot.source === 'mock' ? '演示健康数据 · 尚未连接 Apple 健康' : '当前可用记录 · 根据你的反馈调整建议')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
              <View style={st.inset} testID="health-blocks">
                {blocks.map((b, i) => (
                  <Tap
                    key={b.id}
                    testID={`health-block-${b.id}`}
                    feedback="selection"
                    onPress={() => setDetail(b)}
                    style={[st.row, i < blocks.length - 1 && st.rowLine]}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={st.rowTitle}>{b.title}</Text>
                      <Text style={st.rowConcl} numberOfLines={2}>{b.conclusion}</Text>
                    </View>
                    <View style={st.numWrap}>
                      <Text style={st.num}>{b.value}</Text>
                      {b.unit ? <Text style={st.unit}>{b.unit}</Text> : null}
                    </View>
                  </Tap>
                ))}
              </View>

              {follow.updates.length ? (
                <View style={{ marginTop: 16 }}>
                  <Text style={st.section}>头头改版</Text>
                  {follow.updates.map((u) => {
                    const sh = u.facts?.sleep_hours;
                    const line = u.text || `${u.because} → ${u.change}`;
                    const shown = typeof sh === 'number' && /只睡了\s*\d+(\.\d+)?\s*小时/.test(line)
                      ? line.replace(/只睡了\s*\d+(\.\d+)?\s*小时/, `只睡了 ${sh} 小时`)
                      : line;
                    return <Text key={u.id} style={st.update}>{shown}</Text>;
                  })}
                </View>
              ) : (
                <Text style={[st.update, { marginTop: 14 }]}>在睡眠模式里，结合你的感受与日程一起调整。</Text>
              )}

              {onOpenRecovery ? <View style={{ marginTop: 22 }}>
                <Text style={st.section}>睡眠</Text>
                <Tap testID="health-sleep-skill" onPress={onOpenRecovery} style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 18, backgroundColor: '#FFFFFF', marginTop: 6, gap: 14 }}>
                  <View style={{ width: 44, height: 44, backgroundColor: '#F2F2F7', borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="moon-outline" size={23} color="#1D1D1F" /></View>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '600', color: '#1D1D1F' }}>睡眠与恢复</Text><Text style={{ fontSize: 12, color: '#8E8E93', lineHeight: 19, marginTop: 4 }}>陪我调整 · 从今天的感受，聊到今晚的安排</Text></View>
                  <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                </Tap>
              </View> : null}
              <Tap testID="btn-healthkit" feedback={false} onPress={connectHealth} style={st.hkBtn}>
                <Text style={st.hkTitle}>Apple 健康 · 尚未接入</Text>
                <Text style={st.hkSub}>当前可手动填写，不会模拟授权或同步</Text>
              </Tap>
              {!hk ? (
                <Tap testID="btn-manual-health" feedback="selection" onPress={() => setManualOpen(true)} style={st.manualLink}>
                  <Text style={st.manualText}>手动填写</Text>
                </Tap>
              ) : null}
            </ScrollView>
          </View>
        </Animated.View>
      </View>

      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <Tap feedback={false} style={st.dimCenter} onPress={() => { hap.selection(); setDetail(null); }} pressOpacity={1} pressScale={1}>
          <View style={st.card}>
            <Text style={st.cardTitle}>{detail?.title}</Text>
            <Text style={st.cardBody}>{detail?.detail}</Text>
            <Tap feedback="selection" onPress={() => setDetail(null)} style={st.cardBtn}><Text style={st.cardBtnText}>好</Text></Tap>
          </View>
        </Tap>
      </Modal>

      <ManualSheet
        visible={manualOpen}
        snapshot={snapshot}
        onClose={() => setManualOpen(false)}
        onSave={async (partial) => {
          const next = await persistAndMaybePost({
            ...(snapshot.source === 'mock' ? {} : snapshot),
            ...partial,
            source: 'manual',
          });
          onSnapshot(next);
          setManualOpen(false);
        }}
      />
    </Modal>
  );
}

function ManualSheet({ visible, snapshot, onClose, onSave }: {
  visible: boolean;
  snapshot: HealthSnapshot;
  onClose: () => void;
  onSave: (p: Partial<HealthSnapshot>) => void;
}) {
  const [sleep, setSleep] = useState(String(snapshot.sleep_hours ?? ''));
  const [steps, setSteps] = useState(String(snapshot.steps ?? ''));
  const [meals, setMeals] = useState(String(snapshot.meals_today ?? ''));
  const [done, setDone] = useState<boolean | undefined>(snapshot.source === 'mock' ? undefined : snapshot.training_done);

  useEffect(() => {
    if (!visible) return;
    setSleep(snapshot.source === 'mock' ? '' : String(snapshot.sleep_hours ?? ''));
    setSteps(snapshot.source === 'mock' ? '' : String(snapshot.steps ?? ''));
    setMeals(snapshot.source === 'mock' ? '' : String(snapshot.meals_today ?? ''));
    setDone(snapshot.source === 'mock' ? undefined : snapshot.training_done);
  }, [visible, snapshot]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Tap feedback={false} style={st.dimCenter} onPress={onClose} pressOpacity={1} pressScale={1}>
        <Tap feedback={false} style={st.card} onPress={(e) => e.stopPropagation?.()} pressOpacity={1} pressScale={1}>
          <Text style={st.cardTitle}>手动填写</Text>
          <Field label="睡眠（小时）" value={sleep} onChange={setSleep} />
          <Field label="步数" value={steps} onChange={setSteps} />
          <Field label="今日餐次" value={meals} onChange={setMeals} />
          <Tap feedback="selection" onPress={() => setDone((d) => !d)} style={st.toggle}>
            <Text style={st.rowConcl}>训练已完成</Text>
            <Text style={st.cardBtnText}>{done === undefined ? '未填写' : done ? '是' : '否'}</Text>
          </Tap>
          <Tap
            testID="btn-save-manual"
            feedback="success"
            style={st.cardBtn}
            onPress={() => onSave({
              sleep_hours: manualNumber(sleep),
              steps: manualNumber(steps),
              meals_today: manualNumber(meals),
              training_done: done,
            })}
          >
            <Text style={st.cardBtnText}>保存</Text>
          </Tap>
        </Tap>
      </Tap>
    </Modal>
  );
}

function manualNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : undefined;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={st.unit}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType="decimal-pad" style={st.input} placeholderTextColor={LABEL} />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.18)' },
  dimCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', padding: 24 },
  sheet: {
    borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden',
    backgroundColor: 'rgba(242,242,247,0.86)',
  },
  inner: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(60,60,67,0.18)', marginBottom: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { flex: 1, fontSize: 20, fontWeight: '600', color: '#000' },
  close: { fontSize: 15, color: LABEL },
  plan: { fontSize: 13, color: LABEL, marginBottom: 14, lineHeight: 18 },
  inset: { backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA' },
  rowTitle: { fontSize: 13, fontWeight: '400', color: LABEL, marginBottom: 4 },
  rowConcl: { fontSize: 15, fontWeight: '400', color: '#000', lineHeight: 20 },
  numWrap: { alignItems: 'flex-end', minWidth: 72 },
  num: { fontSize: 34, fontWeight: '700', color: '#000', fontVariant: ['tabular-nums'], lineHeight: 38 },
  unit: { fontSize: 15, fontWeight: '400', color: LABEL, marginTop: 2 },
  section: { fontSize: 13, color: LABEL, marginBottom: 6 },
  update: { fontSize: 15, color: '#000', lineHeight: 21, marginTop: 4 },
  hkBtn: { marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  hkTitle: { fontSize: 17, fontWeight: '400', color: '#000' },
  hkSub: { fontSize: 13, color: LABEL, marginTop: 4 },
  manualLink: { alignSelf: 'center', paddingVertical: 12 },
  manualText: { fontSize: 15, color: LABEL },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 20 },
  cardTitle: { fontSize: 20, fontWeight: '600', color: '#000', marginBottom: 10 },
  cardBody: { fontSize: 15, color: '#000', lineHeight: 22, marginBottom: 16 },
  cardBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 },
  cardBtnText: { fontSize: 17, fontWeight: '600', color: '#000' },
  input: {
    marginTop: 4, backgroundColor: BG, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 17, color: '#000',
  },
  toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingVertical: 8 },
});
