/** Aligns with Backend 05-后端契约-v0.2 */

export type RoleId = string;
export type DeepRole = 'fitness' | 'diet' | 'recovery';

export type StateField = { key: string; label: string; type: string };

/** GET /v1/roles item */
export type Role = {
  id: RoleId;
  name: string;
  duty: string;
  not_do: string;
  core: boolean;
  votes: boolean;
  status?: string;
  learned_count: number;
  state_fields?: StateField[];
};

/** POST /v1/roles {need} → preview */
export type RolePreview = {
  id: string;
  name: string;
  duty: string;
  not_do: string;
  core?: boolean;
  votes?: boolean;
  state_fields?: StateField[];
  from_need?: string;
};

export type CouncilStatus = {
  sleep_hours: number;
  free_minutes: number;
  fridge: string[];
  active_role: RoleId | null;
  budget_left?: number;
};

export type HandoffLine = {
  role: RoleId;
  label: string;
  action: string;
  is_new: boolean;
};

export type VetoApplied = { from: RoleId; to: RoleId; reason: string };

export type HabitRule = {
  id: string;
  role: RoleId;
  key: string;
  text: string;
  because: string;
  learned_at: string;
};

export type HandoffCardData = {
  card_id: string;
  lead_role: RoleId;
  headline: string;
  handoffs: HandoffLine[];
  sleep_window: string | null;
  vetoes_applied: VetoApplied[];
  disclaimer: string;
  learned_applied: unknown[];
};

export type CompareResult = {
  before: HandoffCardData;
  after: HandoffCardData;
  rules: HabitRule[];
};

export const DISCLAIMER = '非医疗建议；不承诺减重效果';

export const DEMO_DEFAULTS: CouncilStatus = {
  sleep_hours: 5,
  free_minutes: 40,
  fridge: ['egg', 'rice'],
  active_role: null,
};

export const FRIDGE_LABELS: Record<string, string> = { egg: '鸡蛋', rice: '米饭' };

/** 单色线性图标（MaterialCommunityIcons），黑白规范：去掉角色色 */
export const ROLE_ICON: Record<string, string> = {
  fitness: 'dumbbell',
  diet: 'noodles',
  recovery: 'moon-waning-crescent',
  schedule: 'calendar-blank-outline',
  focus: 'target',
  ledger: 'wallet-outline',
};
export const roleIcon = (id: string) => ROLE_ICON[id] ?? 'account-outline';
