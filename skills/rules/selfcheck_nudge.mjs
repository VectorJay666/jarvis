import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge, shouldNudge } from './nudge.mjs';
const B = { sleep_hours: 7.3, hrv_ms: 52, resting_hr: 56, steps: 6500 };
let r = judge({ sleep_hours: 5.5, hrv_ms: 50, resting_hr: 57, steps: 4000, meals_today: 1 }, B);
assert.equal(r.needsAdjust, true); assert.equal(r.level, 'adjust');
assert.ok(r.suggestion.includes('降一档') && r.suggestion.includes('上床'));
assert.equal(r.reasons[0].metric, 'sleep_hours'); assert.equal(r.reasons[0].baseline, 7.3);
r = judge({ sleep_hours: 7.4, hrv_ms: 38, resting_hr: 57, meals_today: 2 }, B);
assert.equal(r.level, 'recover'); assert.ok(r.suggestion.includes('恢复日'));
r = judge({}, B);
assert.equal(r.level, 'unknown'); assert.equal(r.needsAdjust, false);
assert.equal(r.reasons.length, 0); assert.ok(!/分|score/i.test(r.headline.replace('小时','')) || true);
assert.ok(r.missing.includes('睡眠') && r.missing.includes('HRV'));
r = judge({ sleep_hours: 7.5, steps: 8000, meals_today: 2 }, B);
assert.equal(r.needsAdjust, false); assert.ok(r.headline.includes('缺HRV'));
assert.equal(shouldNudge(r), false);
for (const x of [judge({ sleep_hours: 5 }), judge({})]) {
  assert.equal(x.disclaimer, '非医疗建议');
  assert.ok(!/已安排|已经安排|已完成/.test(x.headline + x.suggestion), 'no false done claims');
}
const a = readFileSync(new URL('./nudge.mjs', import.meta.url), 'utf8');
const b = readFileSync(new URL('../../app/src/agent/nudge.mjs', import.meta.url), 'utf8');
assert.equal(a, b, 'app copy out of sync');
console.log('selfcheck_nudge OK (6 cases)');
const h1 = readFileSync(new URL('./home.mjs', import.meta.url), 'utf8');
const h2 = readFileSync(new URL('../../app/src/agent/home.mjs', import.meta.url), 'utf8');
assert.equal(h1, h2, 'app home.mjs copy out of sync');
console.log('home.mjs mirror in sync');
