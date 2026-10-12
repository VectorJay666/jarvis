import { banned, ledgerBanned } from "./forbidden.mjs";

/** One sentence → tasks. intent ∈ fitness/diet/recovery/ledger/refuse/unknown. Never silent-drops. */
const SEP = /[，,。；;！!？?\n]|然后|顺便|还有|另外|再帮我|并且|而且/;
const RULES = [
  ["ledger", /钱|预算|花销|开销|省|记账|穷|元|块钱/, "看看预算怎么花"],
  ["diet", /吃|冰箱|做饭|做啥|晚饭|午饭|早饭|外卖|菜|饿/, "看看今晚吃什么"],
  ["recovery", /睡|熬夜|累|困|休息|恢复|酸痛/, "调一下作息恢复"],
  ["fitness", /练|跑步|健身|运动|锻炼|撸铁|拉伸|走路/, "安排今晚的运动"],
];
const REFUSE = /炒股|股票|基金|理财|投资|借钱|网贷|贷款|套现|诊断|吃药|药|减肥药|一周瘦|必瘦/;
/** Off health-vertical + meta narrative (never “拉产品/技术开会”). */
const OFF_HEALTH =
  /旅行|机票|酒店|租房|面试|代码|写作业|翻译|修电脑|法律|起诉|相亲|约会地点|产品|技术|研发|工程师|开会|拉产品|拉技术|产品和技术|元叙事/;
/** Short filler — never become a task title echoed back to the user. */
const JUNK = /^(你办|帮我|那个|这个|嗯+|啊+|哦+|好的|谢谢|一下|看看|再说|随便|都行|怎么样)$/;

const UNKNOWN_TITLE = "再说具体一点";

export function splitText(text = "") {
  const raw = String(text || "").trim();
  const segs = raw
    .split(SEP)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !JUNK.test(s) && (s.length > 2 || /睡|练|吃|跑|饿|困|钱|预算/.test(s)));

  const out = [];
  const seen = new Set();
  for (const s of segs) {
    if (REFUSE.test(s) || banned(s) || ledgerBanned?.(s)) {
      out.push({
        intent: "refuse",
        title: "超出范围",
        reason: "这类事秘书团不做：医疗、减重承诺、投资借贷",
      });
      continue;
    }
    if (OFF_HEALTH.test(s)) {
      out.push({
        intent: "refuse",
        title: "这期先盯健康",
        reason: "这期我先帮你盯睡眠、活动、训练、饮食",
      });
      continue;
    }
    const hit = RULES.find(([, re]) => re.test(s));
    if (!hit) {
      // never echo the fragment as title — Backend/UI must not quote it back
      out.push({ intent: "unknown", title: UNKNOWN_TITLE, reason: "clarify" });
      continue;
    }
    if (seen.has(hit[0])) continue;
    seen.add(hit[0]);
    out.push({ intent: hit[0], title: hit[2] });
  }
  if (!out.length) {
    return [{ intent: "unknown", title: UNKNOWN_TITLE, reason: "clarify" }];
  }
  // collapse duplicate unknowns into one
  const unknowns = out.filter((t) => t.intent === "unknown");
  const rest = out.filter((t) => t.intent !== "unknown");
  if (unknowns.length && !rest.length) return [unknowns[0]];
  if (unknowns.length) return [...rest, unknowns[0]];
  return rest;
}
