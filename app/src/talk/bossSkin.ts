import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageSourcePropType, Platform } from 'react-native';

export type BossSkinId =
  | 'default'
  | 'upload'
  | 'pool_dot'
  | 'pool_orb'
  | 'pool_moon'
  | 'pool_spark'
  | 'pool_wave'
  | 'pool_face';

export type PoolSkinId = Exclude<BossSkinId, 'default' | 'upload'>;

export const SKIN_KEY = 'boss_skin';
const UPLOAD_WEB_KEY = 'boss_avatar_dataurl';
const UPLOAD_FILE = 'boss_avatar.png';

export const POOL_ITEMS: ReadonlyArray<{ id: PoolSkinId; label: string; source: ImageSourcePropType }> = [
  { id: 'pool_dot', label: '点', source: require('../../assets/boss-pool/pool_dot.png') },
  { id: 'pool_orb', label: '球', source: require('../../assets/boss-pool/pool_orb.png') },
  { id: 'pool_moon', label: '月', source: require('../../assets/boss-pool/pool_moon.png') },
  { id: 'pool_spark', label: '芒', source: require('../../assets/boss-pool/pool_spark.png') },
  { id: 'pool_wave', label: '波', source: require('../../assets/boss-pool/pool_wave.png') },
  { id: 'pool_face', label: '脸', source: require('../../assets/boss-pool/pool_face.png') },
];

const VALID = new Set<string>(['default', 'upload', ...POOL_ITEMS.map((p) => p.id)]);

export function uploadUri(): string {
  if (Platform.OS === 'web') return '';
  return `${FileSystem.documentDirectory ?? ''}${UPLOAD_FILE}`;
}

export async function loadBossSkinId(): Promise<BossSkinId> {
  try {
    const v = await AsyncStorage.getItem(SKIN_KEY);
    if (v && VALID.has(v)) return v as BossSkinId;
  } catch { /* ignore */ }
  return 'default';
}

export async function saveBossSkinId(id: BossSkinId): Promise<void> {
  await AsyncStorage.setItem(SKIN_KEY, id);
}

/** Native: copy into documentDirectory; Web: keep data URL in localStorage. Returns display URI. */
export async function persistUpload(localUri: string): Promise<string> {
  if (Platform.OS === 'web') {
    let dataUrl = localUri;
    if (!localUri.startsWith('data:')) {
      const res = await fetch(localUri);
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    }
    try { localStorage.setItem(UPLOAD_WEB_KEY, dataUrl); } catch { /* ignore */ }
    await saveBossSkinId('upload');
    return dataUrl;
  }
  const dest = uploadUri();
  await FileSystem.copyAsync({ from: localUri, to: dest });
  await saveBossSkinId('upload');
  return dest;
}

export async function resolveSkinUri(id: BossSkinId): Promise<string | null> {
  if (id === 'default') return null;
  if (id === 'upload') {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(UPLOAD_WEB_KEY); } catch { return null; }
    }
    const dest = uploadUri();
    const info = await FileSystem.getInfoAsync(dest);
    return info.exists ? dest : null;
  }
  return null; // pool resolved via require source
}

export function poolSource(id: BossSkinId): ImageSourcePropType | null {
  const hit = POOL_ITEMS.find((p) => p.id === id);
  return hit ? hit.source : null;
}
