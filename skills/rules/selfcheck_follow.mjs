import assert from "node:assert";
import { proposeFollow } from "./follow.mjs";
assert.equal(proposeFollow({ sleep_hours: 8, steps: 8000, meals_today: 2 }), null);
const a = proposeFollow({ sleep_hours: 5, steps: 1000, meals_today: 0 });
assert.equal(a.speaker, "boss");
assert.ok(a.updates.some((u) => u.id === "follow-sleep-downshift"));
assert.ok(a.updates.some((u) => u.id === "follow-no-meal"));
// sleep downshift wins over steps-low noise: steps-low suppressed when sleepy
assert.ok(!a.updates.some((u) => u.id === "follow-steps-low"));
const b = proposeFollow({ sleep_hours: 7, steps: 1200, meals_today: 2 });
assert.ok(b.updates.some((u) => u.id === "follow-steps-low"));
assert.ok(proposeFollow({ meals_today: 4 }).updates.some((u) => u.id === "follow-meals-heavy"));
console.log("follow selfcheck OK", a.updates.map((u) => u.id));
