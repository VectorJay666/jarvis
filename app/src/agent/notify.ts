import { Platform } from 'react-native';

/**
 * 主动提醒：原生上用 expo-notifications 排一条本地通知；Web 上为 no-op（只显示 App 内横幅）。
 * 返回 true 表示真的排上了，界面据此决定能否说「已设提醒」。
 */
export async function scheduleNudge(title: string, body: string, secondsFromNow = 5): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const N = await import('expo-notifications');
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    const perm = await N.getPermissionsAsync();
    const ok = perm.granted || (await N.requestPermissionsAsync()).granted;
    if (!ok) return false;
    await N.scheduleNotificationAsync({
      content: { title, body },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, secondsFromNow) },
    });
    return true;
  } catch {
    return false;
  }
}
/** A real receipt is an Expo notification identifier; no identifier means nothing was scheduled. */
export async function scheduleRecoveryReminder(body: string, date: Date): Promise<string | null> {
  if (Platform.OS === 'web' || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return null;
  try {
    const N = await import('expo-notifications');
    N.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
    const permission = await N.getPermissionsAsync();
    if (!permission.granted && !(await N.requestPermissionsAsync()).granted) return null;
    return await N.scheduleNotificationAsync({
      content: { title: '睡眠与恢复', body, data: { skill: 'sleep-recovery' } },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000)) },
    });
  } catch { return null; }
}
export async function cancelRecoveryReminder(id: string): Promise<boolean> {
  if (Platform.OS === 'web' || !id) return false;
  try { const N = await import('expo-notifications'); await N.cancelScheduledNotificationAsync(id); return true; }
  catch { return false; }
}
