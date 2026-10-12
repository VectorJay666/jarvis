import assert from "node:assert";
import { assertFacts } from "./assert_facts.mjs";
assert.equal(assertFacts("改成15分低冲击｜睡5小时", "改成15分低冲击｜睡5小时"), true);
assert.equal(assertFacts("改成15分低冲击｜睡5小时", "今晚轻松练一会，早点休息"), false);
assert.equal(assertFacts("这顿0元｜本周剩120元", "这顿0元，本周还剩120元"), true);
assert.equal(assertFacts("这顿0元｜本周剩120元", "这顿少花点，本周还剩80元"), false);
assert.equal(assertFacts("23:00前进房｜先还睡眠债", "23:00 前进房，先还睡眠债"), true);
assert.equal(assertFacts("23:00前进房", "早点睡吧"), false);
assert.equal(assertFacts("轻松一点", "放轻松就好"), true); // no numbers
console.log("assertFacts selfcheck OK");
