import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE } from '../config';

/** Backend-aligned health vertical snapshot (v0.2.2) */
export type HealthSnapshot = {
  sleep_hours?: number;
  steps?: number;
  active_kcal?: number;
  training_done?: boolean;
  meals_today?: number;
  fridge?: string[];
  budget_left?: number;
  free_minutes?: number;
  hrv_ms?: number;
  resting_hr?: number;
  source?: 'mock' | 'manual' | 'healthkit' | 'cache' | string;
  updated_at?: number | string;
};

const KEY = 'health_snapshot_v1';

/** Local demo seed when nothing cached / API empty */
export const MOCK_SNAPSHOT: HealthSnapshot = {
  sleep_hours: 5.2,
  hrv_ms: 41,
  resting_hr: 61,
  steps: 1840,
  active_kcal: 96,
  training_done: false,
  meals_today: 1,
  fridge: ['egg', 'rice'],
  budget_left: 300,
  free_minutes: 40,
  source: 'mock',
  updated_at: Date.now(),
};

function mergeSnap(base: HealthSnapshot, extra?: Partial<HealthSnapshot> | null): HealthSnapshot {
  if (!extra) return { ...base };
  return { ...base, ...extra };
}

export async function loadHealthSnapshot(): Promise<HealthSnapshot> {
  let local: HealthSnapshot | null = null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) local = JSON.parse(raw) as HealthSnapshot;
  } catch { /* ignore */ }

  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/v1/health/snapshot`);
      if (res.ok) {
        const body = await res.json() as { snapshot?: HealthSnapshot; ok?: boolean };
        if (body?.snapshot) {
          const merged = mergeSnap(MOCK_SNAPSHOT, { ...local, ...body.snapshot, source: body.snapshot.source ?? 'cache' });
          try { await AsyncStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* ignore */ }
          return merged;
        }
      }
    } catch { /* silent */ }
  }

  if (local) return mergeSnap(MOCK_SNAPSHOT, { ...local, source: local.source ?? 'cache' });
  return { ...MOCK_SNAPSHOT };
}

export async function saveHealthSnapshot(snap: HealthSnapshot): Promise<HealthSnapshot> {
  const next: HealthSnapshot = { ...snap, updated_at: new Date().toISOString() };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

/** POST /v1/health/snapshot when API_BASE set; failures silent */
export async function postHealthSnapshot(snap: HealthSnapshot): Promise<boolean> {
  if (!API_BASE) return false;
  try {
    const res = await fetch(`${API_BASE}/v1/health/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snap),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function persistAndMaybePost(snap: HealthSnapshot): Promise<HealthSnapshot> {
  const saved = await saveHealthSnapshot(snap);
  void postHealthSnapshot(saved);
  return saved;
}

export type HealthBlockId = 'sleep' | 'activity' | 'training' | 'meals';

export type HealthBlock = {
  id: HealthBlockId;
  title: string;
  conclusion: string;
  value: string;
  unit: string;
  detail: string;
};

export function blocksFromSnapshot(st: HealthSnapshot): HealthBlock[] {
  const sleep = Number(st.sleep_hours);
  const steps = Number(st.steps);
  const kcal = Number(st.active_kcal);
  const meals = Number(st.meals_today);
  const done = st.training_done === true;

  const sleepConcl = !Number.isFinite(sleep)
    ? '还没读到睡眠，回头再问你'
    : sleep < 6 ? '睡不够，今晚别硬扛' : sleep >= 7 ? '睡眠够用' : '睡眠一般，留意恢复';

  const useSteps = Number.isFinite(steps);
  const actVal = useSteps ? String(Math.floor(steps)) : (Number.isFinite(kcal) ? String(Math.floor(kcal)) : '—');
  const actUnit = useSteps ? '步' : (Number.isFinite(kcal) ? 'kcal' : '');
  const actConcl = useSteps
    ? (steps < 3000 ? '活动偏少，可加散步' : '活动量还可以')
    : Number.isFinite(kcal)
      ? (kcal < 150 ? '活动热量偏低' : '活动热量够用')
      : '还没读到活动';

  return [
    {
      id: 'sleep',
      title: '今日睡眠',
      conclusion: sleepConcl,
      value: Number.isFinite(sleep) ? (Math.round(sleep * 10) / 10).toString() : '—',
      unit: '小时',
      detail: Number.isFinite(sleep)
        ? `昨晚约 ${sleep} 小时。低于 6 小时会触发训练下调；有 sleep_hours 时 talk 不再追问睡眠。`
        : '连接 Apple 健康或手动填写后，这里会显示睡眠结论。',
    },
    {
      id: 'activity',
      title: '活动',
      conclusion: actConcl,
      value: actVal,
      unit: actUnit,
      detail: useSteps
        ? `今日步数 ${Math.floor(steps)}。低于 3000 时建议加 10 分钟散步，不加压力量。`
        : Number.isFinite(kcal)
          ? `今日活动约 ${Math.floor(kcal)} kcal。`
          : '可同步步数或活动热量。',
    },
    {
      id: 'training',
      title: '训练',
      conclusion: done ? '今日训练已完成' : '今天还没练',
      value: done ? '1' : '0',
      unit: '次',
      detail: done ? '今天的训练已勾选完成。睡够时可回到常规力量。' : '还没完成今日训练。头头会按睡眠决定强度。',
    },
    {
      id: 'meals',
      title: '饮食',
      conclusion: !Number.isFinite(meals) ? '还没记饮食' : meals === 0 ? '今天还没吃饭记录' : meals >= 4 ? '餐次已经偏多' : `已记 ${meals} 餐`,
      value: Number.isFinite(meals) ? String(meals) : '—',
      unit: '餐',
      detail: Number.isFinite(meals)
        ? `今天已记 ${meals} 餐。0 餐会提醒用冰箱；≥4 餐晚间不加餐。`
        : '记下餐次后，饮食秘书会按预算与冰箱调整。',
    },
  ];
}

/** Merge snapshot into talk state — having sleep_hours lets backend skip ask */
export function talkStateFromSnapshot(snap: HealthSnapshot): Record<string, unknown> {
  return {
    sleep_hours: snap.sleep_hours,
    steps: snap.steps,
    active_kcal: snap.active_kcal,
    training_done: snap.training_done,
    meals_today: snap.meals_today,
    fridge: snap.fridge ?? ['egg', 'rice'],
    budget_left: snap.budget_left ?? 300,
    free_minutes: snap.free_minutes ?? 40,
  };
}

export function healthKitAvailable(): boolean {
  return Platform.OS === 'ios';
}
