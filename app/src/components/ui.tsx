import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, radius, space, type } from '../theme/tokens';
import { roleIcon } from '../types';

export function RoleIcon({ id, size = 20, muted }: { id: string; size?: number; muted?: boolean }) {
  return <MaterialCommunityIcons name={roleIcon(id) as never} size={size} color={muted ? colors.text3 : colors.text} />;
}

/** 唯一强调样式：仅「否决」「新上岗」使用 */
export function StrongPill({ text, testID }: { text: string; testID?: string }) {
  return <View style={g.strong} testID={testID}><Text style={g.strongText}>{text}</Text></View>;
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return <View style={[g.card, style]} testID={testID}>{children}</View>;
}

export function Group({ title, footer, children, testID }: { title?: string; footer?: string; children: React.ReactNode; testID?: string }) {
  return (
    <View style={{ gap: space.sm }} testID={testID}>
      {title ? <Text style={g.groupTitle}>{title}</Text> : null}
      <View style={g.card}>{children}</View>
      {footer ? <Text style={[type.caption, { marginHorizontal: 4 }]}>{footer}</Text> : null}
    </View>
  );
}

export function Row({ children, last, onPress, testID }: { children: React.ReactNode; last?: boolean; onPress?: () => void; testID?: string }) {
  const inner = <View style={[g.row, !last && g.sep]}>{children}</View>;
  if (!onPress) return inner;
  return <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { backgroundColor: colors.surface }}>{inner}</Pressable>;
}

export function TextBtn({ label, onPress, danger, muted, testID }: { label: string; onPress: () => void; danger?: boolean; muted?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.5 }}>
      <Text style={[type.subhead, { color: danger ? colors.danger : muted ? colors.text3 : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, loading, disabled, testID }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={loading || disabled} accessibilityRole="button"
      style={({ pressed }) => [g.primary, (pressed || loading || disabled) && { opacity: 0.6 }]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={g.primaryText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [g.secondary, pressed && { opacity: 0.6 }]}>
      <Text style={[type.body, { fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

/** 普通可选胶囊（选中浅灰底黑字+细黑描边；黑胶囊只留给否决/新上岗） */
export function Chip({ label, on, onPress, testID }: { label: string; on?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [g.chip, on && { backgroundColor: '#E5E5EA', borderWidth: 1, borderColor: '#000' }, pressed && { opacity: 0.6 }]}>
      <Text style={[type.subhead, on && { color: '#000', fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <View style={g.hstack}>
      {items.map((it) => <Chip key={it.key} label={it.label} on={it.key === value} onPress={() => onChange(it.key)} />)}
    </View>
  );
}

export function NavBar({ title, onBack, backLabel = '返回' }: { title: string; onBack: () => void; backLabel?: string }) {
  return (
    <View style={g.nav}>
      <Pressable onPress={onBack} hitSlop={10} style={[g.hstack, { gap: 2, width: 80 }]} testID="nav-back" accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={type.body}>{backLabel}</Text>
      </Pressable>
      <Text style={[type.body, { fontWeight: '600' }]}>{title}</Text>
      <View style={{ width: 80 }} />
    </View>
  );
}

export type TabKey = 'talk' | 'today' | 'team' | 'habits' | 'me';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'talk', label: '说话', icon: 'mic' },
  { key: 'today', label: '今日', icon: 'today' },
  { key: 'team', label: '跟进', icon: 'people' },
  { key: 'habits', label: '习惯', icon: 'bulb' },
  { key: 'me', label: '我的', icon: 'person' },
];

export function TabBar({ value, onChange, bottom }: { value: TabKey; onChange: (k: TabKey) => void; bottom: number }) {
  return (
    <View style={[g.tabbar, { paddingBottom: Math.max(bottom, 6) }]}>
      {TABS.map((t) => {
        const on = t.key === value;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={g.tab} testID={`tab-${t.key}`} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Ionicons name={(on ? t.icon : `${t.icon}-outline`) as never} size={23} color={on ? colors.text : colors.text3} />
            <Text style={[g.tabText, { color: on ? colors.text : colors.text3 }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const g = StyleSheet.create({
  card: { backgroundColor: colors.bg, borderRadius: radius.card, borderWidth: 0.5, borderColor: colors.hairline, overflow: 'hidden' },
  groupTitle: { ...type.subhead, color: colors.text2, marginHorizontal: 4 },
  row: { paddingHorizontal: space.lg, paddingVertical: 12, minHeight: 44, justifyContent: 'center', gap: 3 },
  sep: { borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  strong: { height: 22, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.accent, justifyContent: 'center', alignSelf: 'flex-start' },
  strongText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  primary: { height: 50, borderRadius: radius.ctl, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  secondary: { height: 50, borderRadius: radius.ctl, borderWidth: 0.5, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, height: 32, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: 'center' },
  hstack: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sub: { ...type.body, fontSize: 13, lineHeight: 18, color: colors.text2 },
  input: { ...type.body, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.ctl, backgroundColor: colors.surface },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, paddingHorizontal: 8 },
  tabbar: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: colors.hairline, backgroundColor: colors.bg, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabText: { fontSize: 10, fontWeight: '500' },
});
