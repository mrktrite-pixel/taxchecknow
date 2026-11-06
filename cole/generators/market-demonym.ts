// cole/generators/market-demonym.ts — one demonym, for every line that names the buyer's country.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// MEASURED 2026-11-06, on nomad-07-au-expat-cgt's delivered files:
//
//     "Always consult a qualified Australia tax adviser for your personal situation."
//
// And in BOTH of its success pages:
//
//     "Always consult a qualified Australia tax adviser before making financial decisions."
//
// "a qualified Australia tax adviser" is not English. Two different helpers produced it, and they
// fail for two different reasons:
//
//   generate-product-files.ts  adviserJurisdiction() — a correct demonym map keyed on
//     config.country. au-expat-cgt's country is "global", which is not in the map, so it falls
//     through to `config.market ?? "qualified"` and emits the raw market name.
//
//   generate-success-pages.ts  marketProse() — returns config.market with any trailing
//     parenthetical stripped. It was never a demonym function; it is a display-name function
//     being used where a demonym belongs, so it emits the raw market for EVERY product, not only
//     the global ones.
//
// CENSUS, all 49 configs, applying both helpers as they stand:
//     44 render a non-demonym in at least one delivered line
//     product-files line: correct wherever country is a known code (au/uk/us/nz/can) — wrong only
//                         for the 10 country:"global" products
//     success-pages line: wrong for ~44, because the raw market is always used
// So the success-page line is the larger defect and it was invisible because nobody regenerated
// those files.
//
// ── WHY MARKET FIRST, THEN COUNTRY ──
//
// The adviser a buyer needs is the one for the LAW the product is about, which is `market`.
// `country` is a routing field — "global" for every nomad product, including ones whose market is
// a single named jurisdiction. Keying on market gets au-expat-cgt right; keying on country is what
// got it wrong. Country stays as a fallback for a config with no market.
//
// ── A MARKET WITH NO DEMONYM GETS NO ADJECTIVE ──
//
// Four configs carry markets like "Global (cross-border)" and "United States (IRS Substantial
// Presence Test)". There is no adjective for those, and "a qualified Global (cross-border) tax
// adviser" is worse than the sentence without one. For these the demonym is EMPTY and the caller
// collapses its own whitespace, so the line reads "Always consult a qualified tax adviser…" —
// true, plain, and not a sentence a human would have to re-read.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Market name -> the adjective a person would write. */
const BY_MARKET: Readonly<Record<string, string>> = {
  "australia": "Australian",
  "united kingdom": "UK",
  "great britain": "UK",
  "united states": "US",
  "new zealand": "New Zealand",
  "canada": "Canadian",
  "spain": "Spanish",
  "ireland": "Irish",
  "germany": "German",
  "france": "French",
  "netherlands": "Dutch",
  "portugal": "Portuguese",
};

/** The pre-existing country-code map, kept as the fallback it always was. */
const BY_COUNTRY: Readonly<Record<string, string>> = {
  au: "Australian",
  uk: "UK",
  gb: "UK",
  us: "US",
  nz: "New Zealand",
  can: "Canadian",
  ca: "Canadian",
};

/**
 * The demonym for a product's market, or "" when the market has no adjective.
 *
 * Never returns the raw market name: that is the bug this exists to end. A market this table does
 * not know returns EMPTY rather than itself, so a new market reads as "a qualified tax adviser"
 * until someone adds its adjective — a plain sentence, never a broken one.
 */
export function marketDemonym(config: { country?: string; market?: string }): string {
  const market = (config.market ?? "").trim();
  // An exact match first, then the name with a trailing parenthetical stripped, so
  // "United States (IRS Substantial Presence Test)" can still resolve to "US".
  const keys = [market, market.replace(/\s*\([^)]*\)\s*$/, "").trim()];
  for (const k of keys) {
    const hit = BY_MARKET[k.toLowerCase()];
    if (hit) return hit;
  }
  // No market, or a market nobody has an adjective for: try the routing country, which is right
  // for the single-jurisdiction products and absent ("global") for the rest.
  return BY_COUNTRY[(config.country ?? "").toLowerCase()] ?? "";
}

/**
 * "a qualified Australian tax adviser" / "a qualified tax adviser".
 *
 * The caller passes the surrounding words so the whitespace collapses in one place rather than at
 * every call site — the empty-demonym case is the whole reason this helper exists.
 */
export function adviserPhrase(config: { country?: string; market?: string }): string {
  const d = marketDemonym(config);
  return d ? `a qualified ${d} tax adviser` : "a qualified tax adviser";
}
