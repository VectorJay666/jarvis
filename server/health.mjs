/**
 * Health snapshot store — client (HealthKit) POSTs facts; talk/council prefer these.
 * Fields: sleep_hours, steps | active_kcal, training_done, meals_today, fridge, free_minutes, budget_left
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PATH = path.join(DIR, "health.json");

function num(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Normalize a partial snapshot; drops empty junk. */
export function normalizeSnapshot(body = {}) {
  const out = {};
  const sleep = num(body.sleep_hours);
  if (sleep !== undefined) out.sleep_hours = sleep;
  const steps = num(body.steps);
  if (steps !== undefined) out.steps = steps;
  const kcal = num(body.active_kcal);
  if (kcal !== undefined) out.active_kcal = kcal;
  if (body.training_done === true || body.training_done === false) out.training_done = body.training_done;
  const meals = num(body.meals_today);
  if (meals !== undefined) out.meals_today = meals;
  const free = num(body.free_minutes);
  if (free !== undefined) out.free_minutes = free;
  const budget = num(body.budget_left);
  if (budget !== undefined) out.budget_left = budget;
  if (Array.isArray(body.fridge) && body.fridge.length) {
    out.fridge = body.fridge.map((x) => String(x).toLowerCase());
  }
  for (const key of ['hrv_ms', 'resting_hr', 'awake_count', 'respiratory_rate', 'spo2_percent', 'wrist_temperature_c']) {
    const value = num(body[key]); if (value !== undefined) out[key] = value;
  }
  for (const key of ['sleep_start', 'sleep_end', 'hrv_method']) {
    if (typeof body[key] === 'string') out[key] = body[key].slice(0, 80);
  }
  for (const key of ['sleep_stages', 'recent_workouts']) {
    if (Array.isArray(body[key])) out[key] = body[key].slice(0, 200);
  }
  for (const key of ['metric_quality', 'personal_baseline']) {
    if (body[key] && typeof body[key] === 'object' && !Array.isArray(body[key])) out[key] = body[key];
  }
  if (body.source) out.source = String(body.source).slice(0, 32);
  out.updated_at = new Date().toISOString();
  return out;
}

export function loadSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(PATH, "utf8"));
  } catch {
    return null;
  }
}

export function mergeSnapshots(prev, body) {
  // Source changes and full client snapshots must not carry old demo values forward.
  const sameSource = body.source && body.source === prev.source && body.replace !== true;
  return { ...(sameSource ? prev : {}), ...normalizeSnapshot(body) };
}
export function saveSnapshot(body) {
  const next = mergeSnapshots(loadSnapshot() || {}, body);
  fs.writeFileSync(PATH, JSON.stringify(next, null, 2));
  return next;
}

export function clearSnapshot() {
  try {
    fs.unlinkSync(PATH);
  } catch {}
}

/** Merge client state over snapshot; snapshot fills missing keys. */
export function mergeState(clientState, snap) {
  const base = snap && typeof snap === "object" ? { ...snap } : {};
  delete base.updated_at;
  delete base.source;
  if (!clientState || typeof clientState !== "object") return Object.keys(base).length ? base : null;
  return { ...base, ...clientState };
}
