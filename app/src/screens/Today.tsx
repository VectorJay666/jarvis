import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Source, Sourced } from '../api/council';
import { Card, Chip, g, RoleIcon, Segmented, StrongPill, TextBtn } from '../components/ui';
import { colors, radius, space, type } from '../theme/tokens';
import { FRIDGE_LABELS, type CouncilStatus, type HandoffCardData } from '../types';

export function sourceText(endpoint: string, s: Source) {
  return s === 'api' ? `来源 ${endpoint}` : s === 'fallback' ? '来源 本地兜底（接口失败）' : '来源 本地 mock（未配置 EXPO_PUBLIC_API_BASE）';
}

function Stat({ label, value, unit, step, min, max, onChange, testID }: { label: string; value: number; unit: string; step: number; min: number; max: number; onChange: (n: number) => void; testID?: string }) {
  const set = (d: number) => onChange(Math.min(max, Math.max(min, Math.round((value + d) * 10) / 10)));
  return (
    <Card style={s.stat} testID={testID}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={type.number}>{Number.isInteger(value) ? value : value.toFixed(1)}<Text style={s.unit}> {unit}</Text></Text>
      <View style={[g.hstack, { justifyContent: 'space-between' }]}>
        <Pressable onPress={() => set(-step)} style={s.step} accessibilityLabel={`${label}减`}><Text style={s.stepT}>−</Text></Pressable>
        <Pressable onPress={() => set(step)} style={s.step} accessibilityLabel={`${label}加`}><Text style={s.stepT}>+</Text></Pressable>
      </View>
    </Card>
  );
}

const REASONS = ['膝盖不舒服', '太累了', '不吃蛋'];

function FeedbackInline({ busy, onSubmit, onCancel }: { busy: boolean; onSubmit: (n: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState('');
  return (
    <View style={{ gap: space.sm, marginTop: space.sm }} testID="feedback-form">
      <View style={[g.hstack, { flexWrap: 'wrap' }]}>
        {REASONS.map((r) => <Chip key={r} label={r} on={note === r} onPress={() => setNote(r)} />)}
      </View>
      <TextInput testID="feedback-input" value={note} onChangeText={setNote} placeholder="或写一句原因" placeholderTextColor={colors.text3} style={g.input} />
      <View style={[g.hstack, { justifyContent: 'flex-end', gap: space.lg }]}>
        <TextBtn label="取消" muted onPress={onCancel} />
        <TextBtn testID="btn-feedback-submit" label={busy ? '提交中…' : '提交反馈'} onPress={() => note.trim() && !busy && onSubmit(note.trim())} />
      </View>
    </View>
  );
}

type Props = {
  status: CouncilStatus;
  onChange: (s: CouncilStatus) => void;
  hasBudget: boolean;
  card: Sourced<HandoffCardData> | null;
  labels: Record<string, string>;
  learned: { role: string; text: string } | null;
  onOpenRole: (id: string) => void;
  feedbackRole: string | null;
  setFeedbackRole: (r: string | null) => void;
  onFeedback: (note: string) => void;
  busy: boolean;
  fallbackErr: string | null;
};

export function Today(p: Props) {
  const [seg, setSeg] = useState<'day' | 'week'>('day');
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [vetoOpen, setVetoOpen] = useState(true);
  const { status, onChange, card } = p;
  const toggleFridge = (item: string) => onChange({ ...status, fridge: status.fridge.includes(item) ? status.fridge.filter((f) => f !== item) : [...status.fridge, item] });
  const c = card?.data;

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.md }}>
        <Text style={type.largeTitle}>今日</Text>
        <Segmented items={[{ key: 'day', label: '今日' }, { key: 'week', label: '本周' }]} value={seg} onChange={setSeg} />
      </View>

      {seg === 'week' ? (
        <Card style={{ padding: space.lg }}><Text style={g.sub}>本周视图二期再做；演示请看「今日」。</Text></Card>
      ) : (
        <>
          <View style={{ gap: space.md }} testID="status-panel">
            <View style={[g.hstack, { gap: space.md }]}>
              <Stat label="昨晚睡眠" value={status.sleep_hours} unit="小时" step={0.5} min={0} max={24} onChange={(n) => onChange({ ...status, sleep_hours: n })} />
              <Stat label="今晚可用" value={status.free_minutes} unit="分钟" step={5} min={0} max={240} onChange={(n) => onChange({ ...status, free_minutes: n })} />
            </View>
            {p.hasBudget ? (
              <View style={g.hstack} testID="budget-row">
                <Stat label="本周剩余预算" value={status.budget_left ?? 300} unit="元" step={50} min={0} max={5000} onChange={(n) => onChange({ ...status, budget_left: n })} />
              </View>
            ) : null}
            <View style={[g.hstack, { flexWrap: 'wrap' }]}>
              <Text style={[s.statLabel, { marginRight: 4 }]}>冰箱里有</Text>
              {(['egg', 'rice'] as const).map((it) => <Chip key={it} label={FRIDGE_LABELS[it] ?? it} on={status.fridge.includes(it)} onPress={() => toggleFridge(it)} />)}
            </View>
          </View>

          {p.fallbackErr ? (
            <View style={s.banner}><Text style={[type.subhead]}>已用本地兜底</Text><Text style={type.caption} numberOfLines={2}>{p.fallbackErr}</Text></View>
          ) : null}

          {c ? (
            <View style={{ gap: space.sm }} testID="phase-handoff">
              <Text style={s.statLabel}>交接班 · 秘书团会商</Text>
              <Card testID="handoff-card">
                {p.learned ? (
                  <Pressable onPress={() => p.onOpenRole(p.learned!.role)} style={[s.pad, s.sep, g.hstack]} testID="learned-tip">
                    <Text style={[g.sub, { flex: 1 }]} numberOfLines={1}>学到：{p.learned.text}</Text>
                    <Text style={[type.subhead]}>查看 ›</Text>
                  </Pressable>
                ) : null}
                <View style={[s.pad, s.sep]}><Text style={type.headline}>{c.headline}</Text></View>
                {c.handoffs.map((h) => {
                  const open = openRole === h.role;
                  return (
                    <Pressable key={h.role} onPress={() => { setOpenRole(open ? null : h.role); if (open) p.setFeedbackRole(null); }} style={[s.pad, s.sep]} testID={`line-${h.role}`}>
                      <View style={[g.hstack, { marginBottom: 4 }]}>
                        <RoleIcon id={h.role} />
                        <Text style={type.subhead}>{h.label || p.labels[h.role] || h.role}</Text>
                        {h.is_new ? <StrongPill text="新上岗" testID={`new-${h.role}`} /> : null}
                        <View style={{ flex: 1 }} />
                        {open && p.feedbackRole !== h.role ? <TextBtn muted testID={`notfit-${h.role}`} label="不合适" onPress={() => p.setFeedbackRole(h.role)} /> : null}
                      </View>
                      <Text style={type.body}>{h.action}</Text>
                      {p.feedbackRole === h.role ? <FeedbackInline busy={p.busy} onSubmit={p.onFeedback} onCancel={() => p.setFeedbackRole(null)} /> : null}
                    </Pressable>
                  );
                })}
                {c.sleep_window ? (
                  <View style={[s.pad, c.vetoes_applied.length ? s.sep : null, g.hstack, { justifyContent: 'space-between' }]}>
                    <Text style={type.body}>睡眠窗口</Text>
                    <Text style={[type.body, { fontWeight: '600', fontVariant: ['tabular-nums'] }]}>{c.sleep_window.replace('-', '–')}</Text>
                  </View>
                ) : null}
                {c.vetoes_applied.length ? (
                  <View style={[s.pad, { gap: space.sm }]} testID="vetoes-block">
                    {c.vetoes_applied.map((v, i) => (
                      <Pressable key={i} onPress={() => setVetoOpen((o) => !o)} style={{ gap: 6 }}>
                        <View style={g.hstack}>
                          <StrongPill text="否决" testID="veto-pill" />
                          <Text style={[type.subhead, { flex: 1 }]}>{p.labels[v.from] ?? v.from} → {p.labels[v.to] ?? v.to}</Text>
                          <Text style={type.caption}>{vetoOpen ? '收起' : '展开'}</Text>
                        </View>
                        {vetoOpen ? <Text style={g.sub}>{v.reason}</Text> : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Card>
              <Text style={[type.caption, { marginHorizontal: 4 }]} testID="card-source">{c.disclaimer} · {sourceText(card!.endpoint, card!.source)}</Text>
            </View>
          ) : (
            <View style={s.placeholder}><Text style={[g.sub, { textAlign: 'center' }]}>会商后，在岗秘书会在一张卡片上交接班</Text></View>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  stat: { flex: 1, padding: space.lg, gap: space.sm },
  statLabel: { ...type.subhead, color: colors.text2 },
  unit: { fontSize: 15, fontWeight: '400', color: colors.text2 },
  step: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepT: { fontSize: 18, fontWeight: '500', color: colors.text, lineHeight: 20 },
  pad: { paddingHorizontal: space.lg, paddingVertical: 14 },
  sep: { borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  banner: { backgroundColor: colors.surface, borderRadius: radius.ctl, padding: space.md, gap: 2 },
  placeholder: { borderRadius: radius.card, borderWidth: 0.5, borderColor: colors.hairline, borderStyle: 'dashed', padding: space.xl },
});
