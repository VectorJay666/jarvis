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
