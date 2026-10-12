/** Boss (头头) lines — only voice that talks to the user. */

const ROLE_CN = {
  fitness: "健身",
  diet: "饮食",
  recovery: "恢复",
  ledger: "记账",
};

/** After split:「这件事我拉A、B来开。」 */
export function bossAck(intents = []) {
  const names = [...new Set(intents)]
    .filter((i) => ROLE_CN[i])
    .map((i) => ROLE_CN[i]);
  if (!names.length) return "这句话我先听懂了，还差点信息。";
  if (names.length === 1) return `这件事我拉${names[0]}来开。`;
  if (names.length === 2) return `这件事我拉${names[0]}、${names[1]}来开。`;
  return `这件事我拉${names.slice(0, -1).join("、")}、${names.at(-1)}来开。`;
}

/**
 * Specialist needs info → boss asks the user one short question.
 * kind: sleep | free | fridge | budget | clarify
 */
export function bossAsk(kind, detail = {}) {
  switch (kind) {
    case "sleep":
      return "昨晚大概睡了几小时？回我一句就行。";
    case "free":
      return "今晚能抽出多少分钟？回我一个数字就行。";
    case "fridge":
      return "冰箱里现在有什么？随便说几样。";
    case "budget":
      return "这周还剩多少预算？回我一个数字。";
    case "clarify":
      // Never echo split fragments back to the user.
      return "能再说具体一点吗？今晚是想睡觉、动一动，还是吃点啥？";
    default:
      return "还差点信息，回我一句就能继续。";
  }
}

/** Closing line on the card spoken as boss. */
export function bossLine(headline = "") {
  const h = String(headline || "").trim();
  return h ? `我帮你定了：${h}` : "会开完了，结论在下面。";
}

/** Health-vertical refuse, spoken as boss (not a system error). */
export function bossRefuse(kind = "off_health") {
  if (kind === "forbidden") return "这类事我帮不了：医疗、减重承诺、投资借贷，我都不碰。";
  return "这期我先帮你盯睡眠、活动、训练、饮食。";
}
