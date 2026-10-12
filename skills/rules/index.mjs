export { proposeFitness } from "./fitness.mjs";
export { proposeDiet } from "./diet.mjs";
export { proposeRecovery } from "./recovery.mjs";
export { banned, sanitizeProposal, FORBIDDEN } from "./forbidden.mjs";
export { NEGATIVES as FITNESS_NEGATIVES } from "./fitness.mjs";
export { NEGATIVES as DIET_NEGATIVES } from "./diet.mjs";
export { NEGATIVES as RECOVERY_NEGATIVES } from "./recovery.mjs";

import { proposeFitness } from "./fitness.mjs";
import { proposeDiet } from "./diet.mjs";
import { proposeRecovery } from "./recovery.mjs";

/** Parallel proposals for council — Skills layer only. */
export function proposeAll(st, habit = {}) {
  return [
    proposeFitness(st, habit),
    proposeDiet(st),
    proposeRecovery(st),
  ].filter(Boolean);
}
export { proposeLedger, NEGATIVES as LEDGER_NEGATIVES } from "./ledger.mjs";
export { ledgerBanned } from "./forbidden.mjs";
export { wantLine, sayLine, revisedLine } from "./lines.mjs";
export { proposeFollow } from "./follow.mjs";
export { bossAck, bossAsk, bossLine, bossRefuse } from "./boss.mjs";
export { IDLE_QUOTES, pickIdleQuote, MEETING_LINE } from "./idle_quotes.mjs";
export { AVATAR_IP_FORBIDDEN, avatarBanned, buildAvatarPrompt } from "./avatar_guard.mjs";
export { assertFacts } from "./assert_facts.mjs";
export { TAP_SUGGESTIONS, pickSuggestion } from "./suggestions.mjs";
export { ACTIONS, rankActions, nudgeLine, NUDGE_ACTIONS, greet } from "./home.mjs";
