import assert from "node:assert";
import { splitText } from "./split.mjs";
import { bossAsk, bossRefuse } from "./boss.mjs";

assert.deepEqual(splitText("今晚想练一下，顺便看看冰箱能做啥，这周钱紧").map((t) => t.intent), ["fitness", "diet", "ledger"]);
assert.equal(splitText("帮我炒股赚点钱")[0].intent, "refuse");
assert.equal(splitText("给我讲个笑话")[0].intent, "unknown");
assert.equal(splitText("给我讲个笑话")[0].title, "再说具体一点");
assert.equal(splitText("你办")[0].intent, "unknown");
assert.equal(splitText("你办")[0].title, "再说具体一点");
assert.ok(!JSON.stringify(splitText("你办")).includes("你办"));
assert.equal(splitText("拉产品和技术开会")[0].intent, "refuse");
assert.ok(splitText("拉产品和技术开会")[0].reason.includes("睡眠"));
assert.equal(bossAsk("clarify", { hint: "你办" }), "能再说具体一点吗？今晚是想睡觉、动一动，还是吃点啥？");
assert.ok(!bossAsk("clarify", { hint: "你办" }).includes("你办"));
assert.equal(bossRefuse("off_health"), "这期我先帮你盯睡眠、活动、训练、饮食。");
console.log("split+clarify selfcheck OK", splitText("你办"), splitText("拉产品和技术开会"));
