import { Ionicons } from '@expo/vector-icons';
import React, { memo, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius } from '../theme/tokens';
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
type Props = { draft: HomeDraft; busy: boolean; onChange: (value: string) => void; onSend: () => void; choices: string[]; onChoose: (value: string) => void; blurTarget?: GlassTarget };

export const HomeInputBar = memo(function HomeInputBar({ draft, busy, onChange, onSend, onFocus, onBlur, choices, onChoose, blurTarget }: Props & { onFocus: () => void; onBlur: () => void }) {
  const value = useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getSnapshot);
  return <View style={s.dock} testID="home-input-dock"><FloatingChoices choices={busy ? [] : choices} disabled={busy} onChoose={onChoose} testIDPrefix="home-opening-choice" blurTarget={blurTarget} /><FlowSurface style={s.bar} blurTarget={blurTarget} blurIntensity={14} animate={false}>
    <TextInput testID="agent-input" value={value} onChangeText={onChange} onFocus={onFocus} onBlur={onBlur} placeholder="也可以直接说说…" accessibilityLabel="和 Jarvis 说话" placeholderTextColor="#A5A5AC" style={[s.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as never)]} onSubmitEditing={onSend} returnKeyType="send" maxLength={2000} editable={!busy} />
    <Tap testID="agent-send" accessibilityRole="button" feedback="light" disabled={!value.trim() || busy} onPress={onSend} style={[s.send, !value.trim() && { opacity: 0.25 }]} accessibilityLabel="发送"><Ionicons name="arrow-up" size={18} color="#fff" /></Tap>
  </FlowSurface></View>;
});

export const HomeDraftComposer = memo(function HomeDraftComposer({ draft, busy, onChange, onSend, onStop, choices, onChoose, blurTarget }: Props & { onStop: () => void }) {
  const input = useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getSnapshot);
  return <HomeComposer input={input} busy={busy} onChange={onChange} onSend={onSend} onStop={onStop} choices={choices} onChoose={onChoose} blurTarget={blurTarget} />;
});
const s = StyleSheet.create({
  dock: { marginHorizontal: 24, marginBottom: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 4, minHeight: 52, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.58)' },
  input: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '400', color: colors.text, paddingVertical: 8 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#39393F', alignItems: 'center', justifyContent: 'center' },
});
