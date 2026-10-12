import { AccessibilityInfo, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Frontend haptic table (Web / reduce-motion / haptics-off -> no-op):
 * send Light · skin entry/long-press Light · boss.ack Soft · role.join Selection
 * veto Medium · card.ready Success(>=400ms) · follow.start Light
 * cancelled/stop Warning · refuse/ask Soft · button press Selection
 * role.say / quote rotate: no haptic
 */
const native = Platform.OS === 'ios' || Platform.OS === 'android';

let reduceMotion = false;
let hapticsOff = false;
let lastSuccessAt = 0;

if (native) {
  AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduceMotion = !!v; }).catch(() => {});
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => { reduceMotion = !!v; });
}

export function setHapticsEnabled(on: boolean) {
  hapticsOff = !on;
}

function allowed() {
  return native && !reduceMotion && !hapticsOff;
}

async function run(fn: () => Promise<void>) {
  if (!allowed()) return;
  try { await fn(); } catch { /* ignore */ }
}

export const hap = {
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  soft: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** card.ready — Success, consecutive cards ≥400ms apart */
  success: () => {
    const now = Date.now();
    if (now - lastSuccessAt < 400) return Promise.resolve();
    lastSuccessAt = now;
    return run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  selection: () => run(() => Haptics.selectionAsync()),
};
