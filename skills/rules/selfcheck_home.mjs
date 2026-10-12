import assert from "node:assert";
import { rankActions, nudgeLine } from "./home.mjs";
import { banned } from "./forbidden.mjs";
import { assertFacts } from "./assert_facts.mjs";

const eve = new Date("2026-10-11T19:00:00");
const morning = new Date("2026-10-11T08:00:00");
const r1 = rankActions({}, { sleep_hours: 5.2, meals_today: 0 }, morning);
const r1e = rankActions({}, { sleep_hours: 5.2, meals_today: 0 }, eve);
assert.equal(r1e[0].id, "dinner");              // evening: dinner first (demo beat 2)
assert.ok(r1.length >= 3 && r1.length <= 5);
assert.equal(r1[0].id, "sleep");               // morning: sleep debt first
assert.ok(r1[0].why.includes("5.2"));
assert.ok(r1.findIndex((a) => a.id === "dinner") < r1.findIndex((a) => a.id === "train"));

const r2 = rankActions({ taps: { train: 8 }, hour_taps: { train: { 19: 4 } } }, { sleep_hours: 8, training_done: false }, eve);
assert.equal(r2[0].id, "train");
assert.ok(r2[0].why);                           // signal-first why; habit only when no signal

const r3 = rankActions({ dismissed_today: ["sleep"] }, { sleep_hours: 5 }, eve);
assert.notEqual(r3[0].id, "sleep");

for (const [k, f] of [["sleep_low",{sleep_hours:5.2}],["no_meal",{}],["steps_low",{steps:1200}],["budget_out",{}]]) {
  const s = nudgeLine(k, f);
  assert.ok(s && !banned(s));
}
assert.equal(nudgeLine("sleep_low", { sleep_hours: 5.2 }), "今晚训练已调轻");
assert.equal(nudgeLine("steps_low", { steps: 1200 }), "饭后走 10 分钟");
assert.equal(nudgeLine("unknown"), null);
console.log("home selfcheck OK", r1.map((a) => `${a.label}(${a.why})`).join(" > "));

import { greet } from "./home.mjs";
const g1 = greet(new Date("2026-10-11T07:30:00"), { sleep_hours: 5.2 }, true);
assert.equal(g1.primary, "早上好");
assert.equal(g1.secondary, null); // has nudge → no half-line
const g2 = greet(new Date("2026-10-11T07:30:00"), { sleep_hours: 5.2 }, false);
assert.equal(g2.primary, "早上好");
assert.ok(g2.secondary.includes("5.2"));
assert.ok(assertFacts("5.2", g2.secondary));
const g3 = greet(new Date("2026-10-11T23:10:00"), {}, false);
assert.equal(g3.primary, "夜深了");
assert.equal(g3.secondary, null);
const g4 = greet(new Date("2026-10-11T19:00:00"), {}, false);
assert.equal(g4.primary, "晚上好");
assert.equal(g4.secondary, null);
const g5 = greet(new Date("2026-10-11T14:00:00"), {}, false);
assert.equal(g5.primary, "下午好");
console.log("greet selfcheck OK", g1, g2, g3);
