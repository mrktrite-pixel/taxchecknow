// cole/generators/jurisdiction-flag.ts — one flag rule, for every surface that shows one.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// MEASURED ON THE LIVE ESTATE, 2026-09-28
//
// The gate page chose its flag with an inline ternary that FELL BACK TO THE UNION JACK:
//
//   config.country === "au" ? "🇦🇺" : "us" ? "🇺🇸" : "nz" ? "🇳🇿" : "ca" ? "🇨🇦" : "🇬🇧"
//
// Census of `country` across the 47 configs: au 16 · can 5 · global 10 · nz 5 · uk 6 · us 5.
// The ternary tests "ca", and the Canadian configs say "can". So:
//
//   5  Canadian products   ->  🇬🇧 Canada Revenue Agency (CRA) Verified …
//   10 global/nomad ones   ->  🇬🇧, including australia-smsf-residency, LIVE, where the live page
//                              reads "🇬🇧 Australian Taxation Office (ATO) Verified"
//   6  UK products         ->  🇬🇧, correctly
//
// Fifteen of forty-seven products flew the wrong flag, and the one legitimate case is why nobody
// noticed: the fallback was right often enough to look deliberate.
//
// generate-product-files.ts had already been bitten by this and fixed locally — its helper carries
// the comment "NEVER hardcode a flag (was leaking 🇬🇧 on AU)" and falls back to 🏳️ instead. But it
// was a SECOND implementation, keyed on "ca" as well, so Canadian file pages got 🏳️ while Canadian
// gate pages got 🇬🇧. Two wrong answers from two copies of one rule. Hence one module.
//
// ── THE RULE ──
// Flag the JURISDICTION WHOSE RULES THE PRODUCT STATES. `country` names it directly except for
// "global", which is a ROUTE (the nomad/expat family), not a jurisdiction — for those the market is
// the jurisdiction, and australia-smsf-residency is the case in point: country "global", market
// "Australia", ATO rules throughout.
//
// ── AND WHEN IT CANNOT BE DETERMINED, NO FLAG IS CLAIMED ──
// 🏳️ rather than a guess. A product genuinely about several jurisdictions (a treaty navigator) has
// no single flag, and inventing one is the defect this module exists to end.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** country code (as configs write it) -> flag. Both "ca" and "can" appear in the estate. */
const BY_COUNTRY: Record<string, string> = {
  au: "🇦🇺", aus: "🇦🇺",
  uk: "🇬🇧", gb: "🇬🇧",
  us: "🇺🇸", usa: "🇺🇸",
  nz: "🇳🇿",
  ca: "🇨🇦", can: "🇨🇦",
  es: "🇪🇸",
};

/**
 * market name -> flag, for products whose `country` is the nomad route rather than a jurisdiction.
 * Matched on the whole trimmed value, so "Global (cross-border)" deliberately matches nothing.
 */
const BY_MARKET: Record<string, string> = {
  "australia": "🇦🇺",
  "united kingdom": "🇬🇧",
  "united states": "🇺🇸",
  "new zealand": "🇳🇿",
  "canada": "🇨🇦",
  "spain": "🇪🇸",
};

/** The neutral flag. Shown when the jurisdiction cannot be determined — never a guess. */
export const NO_FLAG = "🏳️";

export function jurisdictionFlag(country: string | undefined, market?: string | undefined): string {
  const c = (country ?? "").trim().toLowerCase();
  const direct = BY_COUNTRY[c];
  if (direct) return direct;
  // "global" is a route, not a jurisdiction: fall through to the market it actually states rules for.
  const m = (market ?? "").trim().toLowerCase().replace(/\s*\(.*\)\s*$/, "").trim();
  return BY_MARKET[m] ?? NO_FLAG;
}
