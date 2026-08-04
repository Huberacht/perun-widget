// Smoke test: bramka zakładów + fallback leksykalny + kontrakt /api/match na fixtures.
import assert from 'node:assert/strict';

delete process.env.PERUN_ACCESS_KEY; // test nigdy nie dotyka prawdziwego feedu
const { allowBet, lexicalMatch, getSnapshot, handleMatch } = await import('./server.js');

const items = await getSnapshot();
assert.ok(items.length >= 10, 'fixtures loaded');

// bramka: resolved i block_bet odpadają
const bettable = items.filter(allowBet);
assert.ok(!bettable.some((m) => m.block_bet || m.is_resolved), 'gate filters blocked/resolved');
assert.ok(bettable.length < items.length, 'gate actually removed something');

// fallback leksykalny trafia w rynek BTC-200k dla artykułu o BTC
const article =
  'Bitcoin przebija 130 000 dolarów. Analitycy mówią, że cena może osiągnąć 200 000 USD przed końcem 2026 roku.';
const hit = lexicalMatch(article, bettable);
assert.equal(hit?.market_id, 'fx-btc-200k-2026', `lexical match, got ${hit?.market_id}`);

// i nie trafia w nic dla tekstu bez związku
assert.equal(lexicalMatch('Przepis na sernik babci Krysi z rodzynkami i lukrem.', bettable), null);

// fold ł: "złoty"/"opłaty" tokenizują się w całości, nie jako fragmenty
const fee = lexicalMatch(
  'Oplaty sieciowe Bitcoina rosną. Czy opłaty sieciowe Bitcoina przekroczą 100 USD w 2026 roku?',
  items.filter((m) => m.market_id === 'fx-btc-halving-fee'),
);
assert.equal(fee?.market_id, 'fx-btc-halving-fee', 'ł-folding in lexical matcher');

// kontrakt endpointu: za krótki artykuł / zły URL => match null, bez wołania AI
assert.deepEqual(await handleMatch({ url: 'https://x.pl/a', title: 'krótko', text: '' }), { match: null });
assert.deepEqual(await handleMatch({ url: 'nie-url', title: article, text: article }), { match: null });

// cache nie skleja artykułów różniących się tylko query stringiem (?p=ID)
const cake =
  'Przepis na sernik babci Krysi z rodzynkami i lukrem, pieczony powoli w domowym piekarniku przez godzinę.';
const a = await handleMatch({ url: 'https://x.pl/?p=1', title: article, text: article });
assert.equal(a.match?.market_id, 'fx-btc-200k-2026', 'query-string article matches BTC');
const b = await handleMatch({ url: 'https://x.pl/?p=2', title: cake, text: cake });
assert.equal(b.match, null, 'different ?p= article is not served the cached BTC match');

console.log('ok');
process.exit(0);
