import assert from "node:assert";
import { bossAck, bossAsk, bossLine } from "./boss.mjs";
assert.equal(bossAck(["fitness"]), "这件事我拉健身来开。");
assert.equal(bossAck(["fitness", "diet", "ledger"]), "这件事我拉健身、饮食、记账来开。");
assert.ok(bossAsk("sleep").includes("睡了几小时"));
assert.ok(bossAsk("clarify", { hint: "讲个笑话" }).includes("讲个笑话"));
assert.equal(bossLine("今晚只做15分钟低冲击"), "我帮你定了：今晚只做15分钟低冲击");
console.log("boss selfcheck OK");
