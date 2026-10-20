// cole/generators/jurisdiction-flag.ts — F149. ONE rule for the flag every product's surfaces fly.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// AN AUSTRALIAN PRODUCT WAS FLYING A UNION JACK, ON BOTH SURFACES
//
// There were two flag rules, each keyed on config.country, and country is the one field that does
// NOT say which jurisdiction a product is about:
//
//   generate-gate-page.ts  country === "au" ? 🇦🇺 : "us" ? 🇺🇸 : "nz" ? 🇳🇿 : "ca" ? 🇨🇦 : 🇬🇧
//                          — a ternary whose DEFAULT is a nation's flag, so every country outside
//                            that list renders as British.
//
//   generate-product-files.ts  { au, uk, us, nz, ca }[country] ?? 🏳️
//                          — a map that misses "can" and "global", so those render a WHITE flag
//                            in the paid deliverable.
//
// MEASURED 2026-10-20 across all 48 configs. country is: au(16), global(11), uk(6), us(5), nz(5),
// can(5) — so 16 products are outside both rules' coverage. What they render today:
//
//   au-expat-cgt             market Australia, authority ATO, country global
//                              gate page 🇬🇧   ·   delivered file pages 🇬🇧
//   australia-smsf-residency market Australia, authority ATO, country global
//                              gate page 🇬🇧   ·   delivered file pages 🏳️
//   can-01…can-05            market Canada, authority CRA, country "can" (not "ca")
//                              gate page 🇬🇧   ·   delivered file pages 🏳️
//
// So the Union Jack is not a stale artefact in those products — it is what the generators emit
// now, on a page the buyer paid for.
//
// ── WHY MARKET AND AUTHORITY, NOT COUNTRY ──
//
// `country` is a ROUTE SEGMENT (app/<country>/check/<slug>), which is why a cross-border product
// is filed under "global" and the Canadian ones under "can" — both correct as routes and useless
// as jurisdictions. `market` and `authority` are the fields that state whose law the product is
// about: "Australia" / "ATO". Market is consulted FIRST because it is the operator's own
// statement of jurisdiction, and because it keeps a multi-authority product honest — nomad-04
// declares market "Global (cross-border departure)" with authority "National tax authorities
// (CRA / ATO / HMRC / IRD NZ / IRS)", and reading the authority first would stamp a maple leaf on
// a product about five countries.
//
// A CROSS-BORDER PRODUCT GETS 🌐, NOT A NATION AND NOT 🏳️. A white flag reads as an error (and,
// in a document someone paid for, as surrender); any nation's flag would be a false claim. The
// globe says what is true: this one is not about a single country.
// ═════════════════════════════════════════════════════════════════════════════════════════════

export interface Jurisdiction {
  country?: string | null;
  market?: string | null;
  authority?: string | null;
}

/** Not a single jurisdiction. Honest, and visibly not a nation. */
export const MULTI_FLAG = "🌐";

const AU = "🇦🇺", UK = "🇬🇧", US = "🇺🇸", NZ = "🇳🇿", CA = "🇨🇦", ES = "🇪🇸";

/** Market → flag, matched as a PREFIX: "United States (IRS Substantial Presence Test)" is the US. */
const BY_MARKET: Array<[string, string]> = [
  ["australia", AU],
  ["united kingdom", UK],
  ["united states", US],
  ["new zealand", NZ],
  ["canada", CA],
  ["spain", ES],
];

/** Authority token → flag. Matched as a word so "IRD" does not fire inside another word. */
const BY_AUTHORITY: Array<[RegExp, string]> = [
  [/\bATO\b|australian taxation office/i, AU],
  [/\bHMRC\b|hm revenue/i, UK],
  [/\bIRS\b|internal revenue service/i, US],
  [/\bIRD\b|inland revenue/i, NZ],
  [/\bCRA\b|canada revenue/i, CA],
  [/\bAEAT\b|agencia estatal/i, ES],
];

/** Route segment → flag, for a config that declares neither market nor authority. */
const BY_COUNTRY: Record<string, string> = {
  au: AU, aus: AU,
  uk: UK, gb: UK,
  us: US, usa: US,
  nz: NZ,
  ca: CA, can: CA,
  es: ES,
};

/** True when the text says "not one country" — checked before any single-nation match. */
function isMulti(text: string): boolean {
  return /\bglobal\b|\bcross-border\b|\bworldwide\b|\bmulti\b|national tax authorities|oecd/i.test(text);
}

/**
 * The flag for a product's jurisdiction.
 *
 * market → authority → country → 🌐. Never defaults to a nation: a flag nobody can justify from
 * the config is worse than no flag, because it is a claim about whose law applies.
 */
export function jurisdictionFlag(j: Jurisdiction): string {
  const market = (j.market ?? "").trim();
  const authority = (j.authority ?? "").trim();
  const country = (j.country ?? "").trim().toLowerCase();

  // A market that names more than one jurisdiction settles it, before any nation can match.
  if (market && isMulti(market)) return MULTI_FLAG;

  const m = market.toLowerCase();
  for (const [prefix, flag] of BY_MARKET) if (m.startsWith(prefix)) return flag;

  if (authority) {
    if (isMulti(authority)) return MULTI_FLAG;
    for (const [re, flag] of BY_AUTHORITY) if (re.test(authority)) return flag;
  }

  if (country) {
    if (isMulti(country)) return MULTI_FLAG;
    const byCountry = BY_COUNTRY[country];
    if (byCountry) return byCountry;
  }

  return MULTI_FLAG;
}
