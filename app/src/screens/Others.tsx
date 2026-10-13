import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { ContentArrival } from '../components/ContentArrival';
import { g, Group, PrimaryButton, RoleIcon, Row, SecondaryButton, StrongPill, TextBtn } from '../components/ui';
import { colors, space, type } from '../theme/tokens';
import type { CompareResult, HabitRule, Role, RolePreview } from '../types';

export function fmtTime(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const isPlaceholder = (r: Role) => r.status === 'placeholder';

export function Team({ roles, newIds, onOpen, onHire }: { roles: Role[]; newIds: string[]; onOpen: (id: string) => void; onHire: () => void }) {
  const onDuty = roles.filter((r) => !isPlaceholder(r)).length;
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <ContentArrival delay={0}><Text style={type.largeTitle}>跟进</Text></ContentArrival>
        <ContentArrival delay={100}><Text style={g.sub}>{onDuty ? `${onDuty} 位秘书正在跟进你的节奏` : '你的秘书团正在准备中'}</Text></ContentArrival>
      </View>
      <Group testID="role-list">
        {roles.map((r, i) => {
          const ph = isPlaceholder(r);
          return (
            <ContentArrival key={r.id} delay={180 + i * 85}>
              <Row onPress={ph ? undefined : () => onOpen(r.id)} testID={`role-${r.id}`}>
              <View style={g.hstack}>
                <RoleIcon id={r.id} muted={ph} />
                <Text style={[type.body, { fontWeight: '500' }, ph && { color: colors.text3 }]}>{r.name}</Text>
                {newIds.includes(r.id) ? <StrongPill text="新上岗" /> : null}
                <View style={{ flex: 1 }} />
                <Text style={[type.caption, !ph && { color: colors.text2 }]}>{ph ? '二期' : `已学 ${r.learned_count} 条 ›`}</Text>
              </View>
              <Text style={[g.sub, { marginLeft: 28 }, ph && { color: colors.text3 }]} numberOfLines={1}>{r.duty}</Text>
              </Row>
            </ContentArrival>
          );
        })}
        <ContentArrival delay={180 + roles.length * 85}>
          <Row last onPress={onHire} testID="btn-hire">
            <Text style={[type.body, { fontWeight: '600' }]}>＋ 招一个新秘书</Text>
          </Row>
        </ContentArrival>
      </Group>
      <ContentArrival delay={260 + roles.length * 85}><Text style={[type.caption, { marginTop: -space.lg, marginHorizontal: 4 }]}>灰色角色暂未上岗。</Text></ContentArrival>
    </View>
  );
}

function Diff({ before, after }: { before: string; after: string }) {
  let p = 0; while (p < before.length && before[p] === after[p]) p++;
  let s = 0; while (s < before.length - p && s < after.length - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++;
  return <Text style={type.body}>{after.slice(0, p)}<Text style={{ fontWeight: '700' }}>{after.slice(p, after.length - s)}</Text>{after.slice(after.length - s)}</Text>;
}

export function RoleDetail({ role, rules, compare, onRevoke }: { role: Role | undefined; rules: HabitRule[]; compare: CompareResult | null; onRevoke: (id: string) => void }) {
  if (!role) return <Text style={g.sub}>角色不存在</Text>;
  const a = compare?.after.handoffs.find((x) => x.role === role.id);
  const b = compare?.before.handoffs.find((x) => x.role === role.id);
  return (
    <View style={{ gap: space.xl }} testID="role-detail">
      <ContentArrival style={{ gap: 6 }}>
        <View style={g.hstack}><RoleIcon id={role.id} size={28} /><Text style={type.largeTitle}>{role.name}</Text></View>
        <Text style={g.sub}>{role.duty}</Text>
        <Text style={type.caption}>不做：{role.not_do}</Text>
      </ContentArrival>
      <ContentArrival delay={140}><Group title="学到的习惯" footer="习惯在安全否决之后才生效；撤销后下一次会商回到旧建议。" testID="habit-rules">
        {rules.length === 0 ? <Row last><Text style={g.sub}>还没学到习惯。在今日卡上点开短签 →「不合适」告诉它原因。</Text></Row>
          : rules.map((r, i) => (
            <Row key={r.id} last={i === rules.length - 1}>
              <View style={[g.hstack, { justifyContent: 'space-between' }]}>
                <Text style={[type.body, { fontWeight: '600', flex: 1 }]}>{r.text}</Text>
                <TextBtn danger testID={`revoke-${r.key}`} label="撤销" onPress={() => onRevoke(r.id)} />
              </View>
              <Text style={g.sub}>{r.because.startsWith('因为') ? r.because : `因为你上次说「${r.because}」`}</Text>
              <Text style={type.caption}>{fmtTime(r.learned_at)}</Text>
            </Row>
          ))}
      </Group></ContentArrival>
      <ContentArrival delay={280}><Group title="上周 vs 这周" footer="同一状态输入：上周 = 未学习时；这周 = 应用已学习惯后。" testID="compare-view">
        {a && b && a.action !== b.action ? (
          <>
            <Row><Text style={type.caption}>上周</Text><Text style={[type.body, { color: colors.text3, textDecorationLine: 'line-through' }]}>{b.action}</Text></Row>
            <Row last><Text style={type.caption}>这周</Text><Diff before={b.action} after={a.action} /></Row>
          </>
        ) : <Row last><Text style={g.sub}>两周建议一致（暂无生效的习惯）。</Text></Row>}
      </Group></ContentArrival>
    </View>
  );
}

export function Habits({ rules, roles, onOpen }: { rules: HabitRule[]; roles: Role[]; onOpen: (id: string) => void }) {
  const name = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <ContentArrival delay={0}><Text style={type.largeTitle}>习惯</Text></ContentArrival>
        <ContentArrival delay={100}><Text style={g.sub}>{rules.length ? `已经记住 ${rules.length} 条你的偏好` : '还没有学到习惯，聊过之后会慢慢记住'}</Text></ContentArrival>
      </View>
      <Group>
        {rules.length === 0 ? <ContentArrival delay={180}><Row last><Text style={g.sub}>还没学到习惯。</Text></Row></ContentArrival>
          : rules.map((r, i) => (
            <ContentArrival key={r.id} delay={180 + i * 85}>
              <Row last={i === rules.length - 1} onPress={() => onOpen(r.role)}>
              <View style={g.hstack}><RoleIcon id={r.role} /><Text style={type.subhead}>{name(r.role)}</Text><View style={{ flex: 1 }} /><Text style={type.caption}>›</Text></View>
              <Text style={[type.body, { marginLeft: 28 }]}>{r.text}</Text>
              </Row>
            </ContentArrival>
          ))}
      </Group>
      {rules.length ? <ContentArrival delay={260 + rules.length * 85}><Text style={[type.caption, { marginTop: -space.lg, marginHorizontal: 4 }]}>点开一条，可以查看变化或撤销。</Text></ContentArrival> : null}
    </View>
  );
}

export function Me() {
  return (
    <View style={{ gap: space.xl }}>
      <ContentArrival delay={0}><Text style={type.largeTitle}>我的</Text></ContentArrival>
      <Group>
        <ContentArrival delay={120}><Row><Text style={type.body}>账户与同步</Text><Text style={type.caption}>二期</Text></Row></ContentArrival>
        <ContentArrival delay={220}><Row last><Text style={type.body}>关于随身助手</Text><Text style={type.caption}>会扩编、会进化的秘书团</Text></Row></ContentArrival>
      </Group>
      <ContentArrival delay={320}><Text style={[type.caption, { marginHorizontal: 4 }]}>非医疗建议；不承诺减重效果</Text></ContentArrival>
    </View>
  );
}

type HireProps = {
  step: 1 | 2 | 3; setStep: (s: 1 | 2 | 3) => void; need: string; setNeed: (n: string) => void;
  preview: RolePreview | null; error: string | null; busy: boolean; onPreview: () => void; onConfirm: () => void;
};

export function HireFooter({ step, setStep, need, preview, error, busy, onPreview, onConfirm }: HireProps) {
  if (step === 1) return <PrimaryButton testID="btn-hire-preview" label="预览角色" loading={busy} disabled={!need.trim()} onPress={onPreview} />;
  if (step === 2) return preview && !error ? <PrimaryButton testID="btn-hire-next" label="下一步" onPress={() => setStep(3)} /> : <SecondaryButton label="换个需求" onPress={() => setStep(1)} />;
  return <PrimaryButton testID="btn-hire-confirm" label="确认上岗" loading={busy} onPress={onConfirm} />;
}

/** 招新秘书：Checkout 式分步 1 说需求 → 2 预览 → 3 确认 */
export function HireFlow({ step, need, setNeed, preview, error }: HireProps) {
  const steps = ['说需求', '预览角色', '确认上岗'];
  return (
      <View style={{ gap: space.xl }} testID="hire-panel">
      <ContentArrival><Text style={type.largeTitle}>招一个新秘书</Text></ContentArrival>
      <ContentArrival delay={100} style={[g.hstack, { gap: 6 }]} testID="hire-steps">
        {steps.map((t, i) => {
        const n = i + 1; const on = n <= step;
        return (
          <React.Fragment key={t}>
            <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.text : colors.surface }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: on ? '#fff' : colors.text3 }}>{n}</Text>
            </View>
            <Text style={[type.subhead, !on && { color: colors.text3 }]}>{t}</Text>
            {n < 3 ? <View style={{ flex: 1, height: 0.5, backgroundColor: colors.hairline }} /> : null}
          </React.Fragment>
        );
        })}
      </ContentArrival>
      {step === 1 ? (
        <ContentArrival delay={200}><Group title="一句话说你缺什么" footer="只按模板招；医疗、减重、投资类不招。">
        <Row last><TextInput testID="hire-input" value={need} onChangeText={setNeed} placeholder="比如：这周钱紧" placeholderTextColor={colors.text3} style={g.input} /></Row>
        </Group></ContentArrival>
      ) : null}
      {step >= 2 ? (
        <ContentArrival delay={120}><Group title={`需求：${need}`} testID="hire-preview">
        {error ? <Row last><Text style={g.sub} testID="hire-error">{error}</Text></Row> : preview ? (
          <>
            <Row><View style={g.hstack}><RoleIcon id={preview.id} /><Text style={[type.body, { fontWeight: '600' }]}>{preview.name}</Text></View></Row>
            <Row><Text style={type.caption}>职责</Text><Text style={type.body}>{preview.duty}</Text></Row>
            <Row last={!preview.state_fields?.length}><Text style={type.caption}>不做</Text><Text style={[type.body, { fontWeight: '600' }]}>{preview.not_do}</Text></Row>
            {preview.state_fields?.length ? <Row last><Text style={type.caption}>新增状态</Text><Text style={type.body}>{preview.state_fields.map((f) => f.label).join('、')}</Text></Row> : null}
          </>
        ) : null}
        </Group></ContentArrival>
      ) : null}
      {step === 3 ? <ContentArrival delay={200}><Text style={g.sub}>确认后它会出现在秘书团和今日交接班卡上；只出短签，没有否决权。</Text></ContentArrival> : null}
    </View>
  );
}
