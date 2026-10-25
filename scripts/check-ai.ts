import assert from 'node:assert/strict';
import { readSettings } from '../lib/server/config';
import { parseTaste } from '../lib/server/ai';
const settings = readSettings();
if (!settings.geminiKey || settings.aiProvider !== 'gemini')
  throw new Error(
    'Configure GEMINI_API_KEY and AI_PROVIDER=gemini for this opt-in real-provider check.',
  );
const result = await parseTaste(
  {
    prompt:
      'I like Afrobeats, sci-fi movies, and spicy food. Plan a relaxed Saturday evening in Tampa for two people, under $100.',
  },
  settings,
);
assert.equal(result.parser, 'gemini');
assert.equal(result.profile.budgetCents, 10000);
assert.equal(result.profile.partySize, 2);
assert.equal(
  result.profile.priceLevel,
  null,
  'A budget must not become a restaurant tier.',
);
console.log(
  JSON.stringify(
    { parser: result.parser, model: result.model, profile: result.profile },
    null,
    2,
  ),
);
