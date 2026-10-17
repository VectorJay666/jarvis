import { Ionicons } from '@expo/vector-icons';
import React, { memo, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { inkOnAccent, type HomeTheme } from '../theme/homeTheme';
import { radius } from '../theme/tokens';
import { Tap } from '../talk/press';
import { HomeComposer } from './HomeConversation';
import { FlowSurface, type GlassTarget } from '../recovery/ConversationMotion';
import { FloatingChoices } from '../recovery/FloatingChoices';

/** Both inputs share a draft without subscribing the screen or sheet to keystrokes. */
export function createHomeDraft() {
  let value = '';
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set: (next: string) => { if (next === value) return; value = next; listeners.forEach(listener => listener()); },
  };
}
export type HomeDraft = ReturnType<typeof createHomeDraft>;
type Props = { draft: HomeDraft; busy: boolean; onChange: (value: string) => void; onSend: () => void; choices: string[]; onChoose: (value: string) => void; blurTarget?: GlassTarget; theme: HomeTheme };

export const HomeInputBar = memo(function HomeInputBar({ draft, busy, onChange, onSend, onFocus, onBlur, choices, onChoose, blurTarget, theme }: Props & { onFocus: () => void; onBlur: () => void }) {
  const value = useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getSnapshot);
  const dark = theme.mode !== 'light';
  const tone = dark ? 'dark' : 'light';
  return <View style={s.dock} testID="home-input-dock"><FloatingChoices choices={busy ? [] : choices} disabled={busy} onChoose={onChoose} testIDPrefix="home-opening-choice" blurTarget={blurTarget} textColor={theme.text} iconColor={theme.muted} tone={tone} /><FlowSurface style={[s.bar, { backgroundColor: dark ? theme.surface : 'rgba(255,255,255,0.58)' }]} blurTarget={blurTarget} blurIntensity={14} animate={false} tone={tone}>
    <TextInput testID="agent-input" value={value} onChangeText={onChange} onFocus={onFocus} onBlur={onBlur} placeholder="也可以直接说说…" accessibilityLabel="和 Jarvis 说话" placeholderTextColor={theme.muted} style={[s.input, { color: theme.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as never)]} onSubmitEditing={onSend} returnKeyType="send" maxLength={2000} editable={!busy} />
    <Tap testID="agent-send" accessibilityRole="button" feedback="light" disabled={!value.trim() || busy} onPress={onSend} style={[s.send, { backgroundColor: theme.accent }, !value.trim() && { opacity: 0.25 }]} accessibilityLabel="发送"><Ionicons name="arrow-up" size={18} color={inkOnAccent(theme)} /></Tap>
  </FlowSurface></View>;
});

export const HomeDraftComposer = memo(function HomeDraftComposer({ draft, busy, onChange, onSend, onStop, choices, onChoose, blurTarget, theme }: Props & { onStop: () => void }) {
  const input = useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getSnapshot);
  return <HomeComposer input={input} busy={busy} onChange={onChange} onSend={onSend} onStop={onStop} choices={choices} onChoose={onChoose} blurTarget={blurTarget} theme={theme} />;
});
const s = StyleSheet.create({
  dock: { marginHorizontal: 24, marginBottom: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 4, minHeight: 52, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.58)' },
  input: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '400', paddingVertical: 8 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#39393F', alignItems: 'center', justifyContent: 'center' },
});
