import { Ionicons } from '@expo/vector-icons';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tap } from '../talk/press';
import { VoiceBubble } from './VoiceBubble';
import { useReduceMotion } from '../talk/Drops';
import { useSharedValue } from 'react-native-reanimated';

const LIMIT_MS = 60_000;

export function VoiceRecorder({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null);
  const pulse = useSharedValue(0);
  const reduced = useReduceMotion();
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const starting = useRef(false);
  const recording = useRef(false);
  const stopping = useRef(false);
  const mounted = useRef(true);
  const allowed = useRef(false);

  const stop = useCallback(async () => {
    if (!recording.current) return;
    recording.current = false;
    stopping.current = true;
    if (mounted.current) setBusy(true);
    try {
      await recorder.stop();
      if (mounted.current) setUri(recorder.uri);
    } catch {
      if (mounted.current) setError('录音未能保存，请重新试一次。');
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      stopping.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [recorder]);

  const start = useCallback(async () => {
    if (starting.current || stopping.current || recording.current || !visible) return;
    if (AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    allowed.current = true;
    starting.current = true;
    setBusy(true); setError(''); setUri(null);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!mounted.current || !allowed.current) return;
      if (!permission.granted) throw new Error('麦克风权限未开启，请在系统设置中允许访问。');
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      if (!mounted.current || !allowed.current) { await setAudioModeAsync({ allowsRecording: false }); return; }
      await recorder.prepareToRecordAsync();
      if (!mounted.current || !allowed.current) {
        await recorder.stop().catch(() => {});
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      player.pause();
      recorder.record();
      recording.current = true;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '无法开始录音，请重试。');
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    } finally { starting.current = false; if (mounted.current) setBusy(false); }
  }, [recorder, player, visible]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; allowed.current = false; if (recording.current) void stop(); };
  }, [stop]);
  useEffect(() => {
    allowed.current = visible;
    // The recorder stays mounted while closed, so closing during permission or
    // preparation cannot release the native object under an in-flight request.
    const timer = setTimeout(() => { if (visible) void start(); else void stop(); }, 0);
    return () => { clearTimeout(timer); allowed.current = false; };
  }, [visible, start, stop]);
  useEffect(() => {
    if (!visible || !status.isRecording) return;
    const timer = setTimeout(() => { void stop(); }, Math.max(0, LIMIT_MS - status.durationMillis));
    return () => clearTimeout(timer);
  }, [visible, status.isRecording, status.durationMillis, stop]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') { allowed.current = false; void stop(); } });
    return () => sub.remove();
  }, [stop]);

  const close = () => { allowed.current = false; void stop(); player.pause(); onClose(); };
  const replay = () => { if (!uri) return; player.replace(uri); player.play(); };
  const recordingLabel = '正在录音 · ' + Math.floor(status.durationMillis / 1000) + ' 秒 / 60 秒';
  return <Modal visible={visible} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={close} testID="voice-recorder-modal">
    <View style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="关闭录音" />
      <View style={s.panel}>
        <Tap style={s.close} onPress={close} accessibilityLabel="关闭录音"><Ionicons name="close" size={22} color="#515B59" /></Tap>
        <Text style={s.title}>和 Jarvis 说说</Text>
        <View style={s.orb}><VoiceBubble size={128} active={visible && status.isRecording} reduceMotion={reduced} pulse={pulse} /></View>
        <Text style={s.state} testID="voice-recording-state">{error || (busy ? '正在准备麦克风…' : status.isRecording ? recordingLabel : uri ? '录好了，可以试听' : '点击下方开始录音')}</Text>
        <Text style={s.note}>当前仅支持录音与试听，语音转文字尚未接通。</Text>
        <View style={s.actions}>
          {uri ? <Tap style={s.secondary} onPress={replay} accessibilityLabel="试听录音" testID="voice-play"><Ionicons name="play" size={17} color="#374E4B"/><Text style={s.secondaryText}>试听</Text></Tap> : null}
          <Tap style={s.primary} disabled={busy} onPress={() => { if (recording.current) void stop(); else void start(); }} accessibilityLabel={status.isRecording ? '结束录音' : '开始录音'} testID="voice-record-toggle"><Ionicons name={status.isRecording ? 'stop' : 'mic'} size={18} color="#fff" /><Text style={s.primaryText}>{status.isRecording ? '结束录音' : uri ? '重新录制' : '开始录音'}</Text></Tap>
        </View>
      </View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(25,34,34,0.32)' },
  panel: { backgroundColor: '#F6F9F7', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 52, alignItems: 'center' },
  close: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '600', color: '#243936' },
  orb: { height: 180, alignItems: 'center', justifyContent: 'center' },
  state: { fontSize: 16, color: '#2D4440', minHeight: 25, textAlign: 'center' },
  note: { fontSize: 12, lineHeight: 18, color: '#687671', textAlign: 'center', marginTop: 9 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 26 },
  primary: { minHeight: 48, minWidth: 154, paddingHorizontal: 18, borderRadius: 24, backgroundColor: '#30564E', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondary: { minHeight: 48, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1, borderColor: '#9EACA7', flexDirection: 'row', gap: 7, alignItems: 'center' },
  secondaryText: { color: '#374E4B', fontSize: 15 },
});
