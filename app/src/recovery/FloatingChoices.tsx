import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Tap } from '../talk/press';
import { FlowSurface, type GlassTarget } from './ConversationMotion';

type Props = { choices: string[]; disabled?: boolean; onChoose: (value: string) => void; testIDPrefix: string; blurTarget?: GlassTarget; textColor?: string; iconColor?: string; tone?: 'light' | 'dark' };

/** The composer owns this stack, so choices follow the same keyboard and sheet movement. */
export function FloatingChoices({ choices, disabled, onChoose, testIDPrefix, blurTarget, textColor, iconColor, tone = 'light' }: Props) {
  const { height } = useWindowDimensions();
  if (!choices.length) return null;
  return <ScrollView style={[s.scroll, { maxHeight: Math.min(188, Math.max(100, height * 0.28)) }]} contentContainerStyle={s.stack} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} testID={`${testIDPrefix}-stack`}>
    {choices.slice(0, 3).map((choice, index) => <FlowSurface key={choice} delay={index * 45} blurTarget={blurTarget} style={s.surface} tone={tone}>
      <Tap testID={`${testIDPrefix}-${index}`} accessibilityRole="button" accessibilityLabel={choice} disabled={disabled} onPress={() => onChoose(choice)} pressOpacity={0.88} style={[s.choice, disabled && s.disabled]}>
        <View style={s.dot} /><Text style={[s.text, textColor ? { color: textColor } : null]}>{choice}</Text><Ionicons name="arrow-up-outline" size={15} color={iconColor ?? '#68716D'} />
      </Tap>
    </FlowSurface>)}
  </ScrollView>;
}
const s = StyleSheet.create({ scroll: { flexGrow: 0, flexShrink: 1 }, stack: { gap: 7, paddingBottom: 10 }, surface: { borderRadius: 18 }, choice: { minHeight: 46, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#99AAA0' }, text: { flex: 1, minWidth: 0, color: '#36433D', fontSize: 13, lineHeight: 20 }, disabled: { opacity: 0.4 } });
