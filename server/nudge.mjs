/**
 * v0.3 single-agent nudge: health snapshot -> at most ONE proactive reminder.
 * Deterministic; numbers come only from the snapshot. Model polish is optional and off by default.
 */
import { proposeFollow } from "../skills/rules/follow.mjs";
import { nudgeLine } from "../skills/rules/home.mjs";
const KIND = { "follow-sleep-downshift": "sleep_low", "follow-no-meal": "no_meal", "follow-steps-low": "steps_low", "follow-budget-freeze": "budget_out" };
export const NUDGE_ACTION = { "follow-sleep-downshift": "sleep", "follow-no-meal": "dinner", "follow-steps-low": "walk", "follow-kcal-low": "walk", "follow-budget-freeze": "budget", "follow-meals-heavy": "dinner", "follow-recovered": "train" };

// priority: sleep > meals > activity > budget
const ORDER = ["follow-sleep-downshift", "follow-no-meal", "follow-meals-heavy", "follow-steps-low", "follow-kcal-low", "follow-budget-freeze", "follow-recovered"];
const ACTIONS = {
  "follow-sleep-downshift": [{ id: "plan_light", label: "看看" }, { id: "dismiss", label: "不用" }],
  "follow-recovered": [{ id: "plan_normal", label: "看看" }, { id: "dismiss", label: "不用" }],
  "follow-steps-low": [{ id: "walk_10", label: "看看" }, { id: "dismiss", label: "不用" }],
  "follow-kcal-low": [{ id: "walk_10", label: "看看" }, { id: "dismiss", label: "不用" }],
  "follow-no-meal": [{ id: "fridge_dinner", label: "看看" }, { id: "dismiss", label: "不用" }],
  "follow-meals-heavy": [{ id: "no_snack", label: "看看" }, { id: "dismiss", label: "不用" }],
  "follow-budget-freeze": [{ id: "fridge_dinner", label: "看看" }, { id: "dismiss", label: "不用" }],
};

export function pickNudge(snapshot, dismissed = new Set()) {
  if (!snapshot) return null;
  const f = proposeFollow(snapshot, {});
  if (!f?.updates?.length) return null;
  const cands = f.updates
    .filter((u) => !dismissed.has(u.id))
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const u = cands[0];
  if (!u) return null;
  const [because, change] = String(u.text).split("→").map((s) => s.trim());
  return {
    id: u.id,
    speaker: "boss",
    kind: KIND[u.id] || null,
    action_id: NUDGE_ACTION[u.id] || null,
    text: (KIND[u.id] && nudgeLine(KIND[u.id], u.facts || {})) || (change ? `${because}，${change}` : u.text),
    because,
    facts: u.facts || null,
    patch: u.patch || null,
    actions: ACTIONS[u.id] || [{ id: "dismiss", label: "不用" }],
    snapshot_at: snapshot.updated_at || null,
    source: "rule",
  };
}
