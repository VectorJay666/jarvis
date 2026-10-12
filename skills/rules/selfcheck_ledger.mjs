#!/usr/bin/env node
import { proposeLedger, ledgerBanned } from "./index.mjs";
let fail = 0;
const ok = (n, c) => { console.log(c ? "PASS" : "FAIL", n); if (!c) fail++; };
const a = proposeLedger({ budget_left: 140, fridge: ["egg", "rice"] });
ok("budget per-day", /140/.test(a.action) && /20/.test(a.action));
const b = proposeLedger({});
ok("missing budget asks", b.tags.includes("need_input") && b.confidence <= 0.4);
const c = proposeLedger({ budget_left: 0 });
ok("zero budget freeze", c.tags.includes("freeze"));
ok("L-N1 banned", ledgerBanned("这周钱紧，拿 100 元买基金"));
ok("L-N2 banned", ledgerBanned("先借个网贷周转"));
ok("shape", ["role","action","duration_min","veto","confidence","tags"].every((k) => k in a));
if (fail) { console.error(fail + " failed"); process.exit(1); }
console.log("all passed");
