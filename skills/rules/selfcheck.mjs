#!/usr/bin/env node
import { proposeAll, banned } from "./index.mjs";

const demo = {
  sleep_hours: 5,
  free_minutes: 40,
  fridge: ["egg", "rice"],
  fatigue: "high",
};

let fail = 0;
function ok(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    fail++;
  } else console.log("PASS", name);
}

const props = proposeAll(demo, {});
ok("three roles", props.length === 3);
const by = Object.fromEntries(props.map((p) => [p.role, p]));
ok("fitness low_impact", by.fitness.tags.includes("low_impact"));
ok("diet egg+rice", /蛋炒饭|蛋/.test(by.diet.action));
ok("recovery veto fitness", by.recovery.veto.some((v) => v.role === "fitness"));
ok("no banned demo text", !props.some((p) => banned(p.action)));

ok(
  "F-N4 banned",
  banned("保证一周掉 5 斤")
);
ok("D-N2 banned", banned("本周只喝代餐清肠"));

if (fail) {
  console.error(`\n${fail} failed`);
  process.exit(1);
}
console.log("\nall passed");
