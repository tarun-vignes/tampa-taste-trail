import { readSettings } from '../lib/server/config';
import { TasteAgent } from '../lib/server/agent';
import { ruleProfile } from '../lib/server/ai';
const settings = readSettings();
if (!settings.qlooKey)
  throw new Error(
    'Add QLOO_API_KEY and verify QLOO_BASE_URL against your key-issuer instructions before running the real Qloo check.',
  );
const profile = ruleProfile(
  'Jazz and coffee. A relaxed evening in Tampa for two, under $100.',
);
const agent = new TasteAgent(settings);
const resolved = await agent.resolve({ profile, mode: 'live' });
const selected = resolved.items
  .filter((item) => item.exactId)
  .map((item) => ({ interestIndex: item.interestIndex, id: item.exactId! }));
if (!selected.length)
  throw new Error(
    'No exact lookup match. Use the UI to inspect and explicitly confirm candidates rather than guessing their meaning.',
  );
const plan = await agent.plan({ profile, mode: 'live', selected });
console.log(
  JSON.stringify(
    {
      mode: plan.mode,
      lookupMatches: resolved.items.map((item) => ({
        term: item.interest.term,
        candidates: item.candidates.length,
        exact: !!item.exactId,
      })),
      validatedPlaces: plan.stops.length + plan.alternatives.length,
      stopIds: plan.stops.map((stop) => stop.entity.id),
      discarded: plan.discardedCount,
      budgetStatus: plan.budgetStatus,
      warnings: plan.warnings,
    },
    null,
    2,
  ),
);
if (!plan.stops.length) process.exitCode = 1;
