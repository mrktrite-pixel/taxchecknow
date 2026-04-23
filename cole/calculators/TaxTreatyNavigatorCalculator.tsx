"use client";

/**
 * NOMAD-02 — Double Tax Treaty Navigator
 * Pattern: GateTest (Module D) — strict sequential tests, each only runs if
 * the prior did not resolve.
 *
 * Legal anchor: OECD Model Tax Convention Article 4(2). Applied through
 * 3,000+ bilateral tax treaties worldwide.
 *
 * TIE-BREAKER SEQUENCE (strict order):
 *   Test 1 — Permanent home available
 *   Test 2 — Centre of vital interests (personal + economic ties)
 *   Test 3 — Habitual abode (relative time, NOT 183-day)
 *   Test 4 — Nationality
 *   Test 5 — Mutual agreement (rare)
 *
 * Each test runs ONLY if the prior did not resolve.
 *
 * No-treaty case: both countries tax under domestic law; no automatic relief.
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type ResolvedAt = "TEST_1" | "TEST_2" | "TEST_3" | "TEST_4" | "TEST_5_MUTUAL" | "NO_TREATY" | "TREATY_UNKNOWN";
type Winner = "A" | "B" | "UNRESOLVED";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface TreatyResult {
  countryA:          string;
  countryB:          string;
  permanentHome:     string;
  vitalInterests:    string;
  habitualAbode:     string;
  nationality:       string;
  treatyStatus:      string;

  resolvedAt:        ResolvedAt;
  winner:            Winner;
  primaryCountry:    string;   // human-readable label
  primaryCountryCode: string;   // uk/au/nz/ca/us/eu/other
  secondaryCountry:  string;
  secondaryCountryCode: string;

  testsApplied:      Array<{ test: string; outcome: string }>;
  riskLevel:         "LOW" | "MEDIUM" | "HIGH";
  routes:            Route[];
}

interface VerdictResult {
  status: string;
  statusClass: string;
  panelClass: string;
  headline: string;
  stats: Array<{ label: string; value: string; highlight?: boolean }>;
  consequences: string[];
  confidence: ConfidenceLevel;
  confidenceNote: string;
  tier: Tier;
  ctaLabel: string;
  altTierLabel: string;
  productKey67: string;
  productKey147: string;
  result: TreatyResult;
}

interface PopupAnswers {
  advisor_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_tax_treaty_navigator",
  p147: "nomad_147_tax_treaty_navigator",
};

const COUNTRY_LABEL: Record<string, string> = {
  uk: "United Kingdom",
  au: "Australia",
  nz: "New Zealand",
  ca: "Canada",
  us: "United States",
  eu: "Germany / France / other EU",
  other: "Other jurisdiction",
};

const COUNTRY_ROUTE: Record<string, Route> = {
  uk: { label: "UK Allowance Sniper — resident return + 60% trap + dividend tax", href: "/uk/check/allowance-sniper",             note: "If UK is primary taxing country, resolve UK filing position" },
  au: { label: "AU CGT Main Residence Trap — domicile + CGT + property",           href: "/au/check/cgt-main-residence-trap",         note: "If AU is primary, resolve main residence + CGT + bright-line" },
  nz: { label: "NZ Bright-Line Property Tax Decision Engine",                       href: "/nz/check/bright-line-auditor",             note: "If NZ is primary, resolve bright-line + main home" },
  us: { label: "US FEIE Nomad Auditor — worldwide taxation regardless",             href: "/us/check/feie-nomad-auditor",              note: "US citizens: always file US + treaty position on Form 8833" },
  ca: { label: "Canada — specialist advice recommended",                             href: "/nomad",                                     note: "No dedicated engine yet — seek specialist Canadian advice" },
  eu: { label: "EU country — specialist advice recommended",                          href: "/nomad",                                     note: "EU country rules vary widely — specialist advice needed" },
  other: { label: "Other jurisdiction — specialist advice recommended",               href: "/nomad",                                     note: "Engage cross-border tax specialist for this country pair" },
};

function labelFor(code: string): string {
  return COUNTRY_LABEL[code] || code;
}

function runTieBreaker(answers: AnswerMap): TreatyResult {
  const countryA       = String(answers.country_a       || "uk");
  const countryB       = String(answers.country_b       || "au");
  const permanentHome  = String(answers.permanent_home  || "both");
  const vitalInterests = String(answers.vital_interests || "split");
  const habitualAbode  = String(answers.habitual_abode  || "equal");
  const nationality    = String(answers.nationality     || "a_only");
  const treatyStatus   = String(answers.treaty_status   || "known");

  const testsApplied: TreatyResult["testsApplied"] = [];
  let winner: Winner = "UNRESOLVED";
  let resolvedAt: ResolvedAt = "TEST_5_MUTUAL";

  // No-treaty short-circuit
  if (treatyStatus === "none") {
    resolvedAt = "NO_TREATY";
    winner = "UNRESOLVED";
    testsApplied.push({ test: "No treaty", outcome: "Tie-breaker does not apply — both countries tax under domestic law" });
  } else if (treatyStatus === "unknown") {
    resolvedAt = "TREATY_UNKNOWN";
    winner = "UNRESOLVED";
    testsApplied.push({ test: "Treaty existence", outcome: "Verify whether a treaty exists between " + labelFor(countryA) + " and " + labelFor(countryB) });
  } else {
    // Test 1 — Permanent home
    if (permanentHome === "a_only") {
      winner = "A";
      resolvedAt = "TEST_1";
      testsApplied.push({ test: "Test 1 — Permanent home", outcome: "Resolved: permanent home in " + labelFor(countryA) + " only" });
    } else if (permanentHome === "b_only") {
      winner = "B";
      resolvedAt = "TEST_1";
      testsApplied.push({ test: "Test 1 — Permanent home", outcome: "Resolved: permanent home in " + labelFor(countryB) + " only" });
    } else {
      testsApplied.push({ test: "Test 1 — Permanent home", outcome: permanentHome === "both" ? "Permanent home in BOTH — not resolved; move to Test 2" : "Permanent home in NEITHER — not resolved; move to Test 2" });

      // Test 2 — Vital interests
      if (vitalInterests === "a_stronger") {
        winner = "A";
        resolvedAt = "TEST_2";
        testsApplied.push({ test: "Test 2 — Centre of vital interests", outcome: "Resolved: family + work centred in " + labelFor(countryA) });
      } else if (vitalInterests === "b_stronger") {
        winner = "B";
        resolvedAt = "TEST_2";
        testsApplied.push({ test: "Test 2 — Centre of vital interests", outcome: "Resolved: family + work centred in " + labelFor(countryB) });
      } else {
        testsApplied.push({ test: "Test 2 — Centre of vital interests", outcome: vitalInterests === "split" ? "Ties split across countries — not resolved; move to Test 3" : "No clearly stronger ties — not resolved; move to Test 3" });

        // Test 3 — Habitual abode
        if (habitualAbode === "a_more") {
          winner = "A";
          resolvedAt = "TEST_3";
          testsApplied.push({ test: "Test 3 — Habitual abode", outcome: "Resolved: significantly more time in " + labelFor(countryA) });
        } else if (habitualAbode === "b_more") {
          winner = "B";
          resolvedAt = "TEST_3";
          testsApplied.push({ test: "Test 3 — Habitual abode", outcome: "Resolved: significantly more time in " + labelFor(countryB) });
        } else {
          testsApplied.push({ test: "Test 3 — Habitual abode", outcome: "Roughly equal time — not resolved; move to Test 4" });

          // Test 4 — Nationality
          if (nationality === "a_only") {
            winner = "A";
            resolvedAt = "TEST_4";
            testsApplied.push({ test: "Test 4 — Nationality", outcome: "Resolved: national of " + labelFor(countryA) + " only" });
          } else if (nationality === "b_only") {
            winner = "B";
            resolvedAt = "TEST_4";
            testsApplied.push({ test: "Test 4 — Nationality", outcome: "Resolved: national of " + labelFor(countryB) + " only" });
          } else {
            testsApplied.push({ test: "Test 4 — Nationality", outcome: nationality === "both" ? "Dual national of both — not resolved; Test 5 (mutual agreement) required" : "National of neither — not resolved; Test 5 (mutual agreement) required" });
            resolvedAt = "TEST_5_MUTUAL";
            winner = "UNRESOLVED";
          }
        }
      }
    }
  }

  const primaryCountryCode = winner === "A" ? countryA : winner === "B" ? countryB : "";
  const secondaryCountryCode = winner === "A" ? countryB : winner === "B" ? countryA : "";
  const primaryCountry = primaryCountryCode ? labelFor(primaryCountryCode) : "UNRESOLVED";
  const secondaryCountry = secondaryCountryCode ? labelFor(secondaryCountryCode) : "UNRESOLVED";

  // Risk level
  let riskLevel: TreatyResult["riskLevel"];
  if (resolvedAt === "NO_TREATY" || resolvedAt === "TEST_5_MUTUAL") riskLevel = "HIGH";
  else if (resolvedAt === "TEST_3" || resolvedAt === "TEST_4" || resolvedAt === "TREATY_UNKNOWN") riskLevel = "MEDIUM";
  else riskLevel = "LOW";

  // Build routes
  const routes: Route[] = [];
  if (winner !== "UNRESOLVED" && primaryCountryCode) {
    const r = COUNTRY_ROUTE[primaryCountryCode];
    if (r) routes.push(r);
  }
  // Always offer secondary country route for source filings
  if (secondaryCountryCode) {
    const r = COUNTRY_ROUTE[secondaryCountryCode];
    if (r && !routes.some(x => x.href === r.href)) routes.push(r);
  }
  // US layer — if either country is US, always link US engine
  if ((countryA === "us" || countryB === "us") && !routes.some(r => r.href.includes("/us/"))) {
    routes.push(COUNTRY_ROUTE.us);
  }
  // Back to index
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify risk state with updated answers" });

  return {
    countryA, countryB, permanentHome, vitalInterests, habitualAbode, nationality, treatyStatus,
    resolvedAt, winner, primaryCountry, primaryCountryCode, secondaryCountry, secondaryCountryCode,
    testsApplied, riskLevel, routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = runTieBreaker(answers);

  if (result.resolvedAt === "NO_TREATY") {
    return {
      status: "NO TREATY — GENUINE DOUBLE TAXATION RISK",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `No bilateral tax treaty is in force between ${labelFor(result.countryA)} and ${labelFor(result.countryB)}. The OECD Article 4 tie-breaker does NOT apply. Both countries may tax the same income under their domestic laws without automatic relief. Unilateral relief (a domestic foreign tax credit) may be available in some cases — but the scope varies and is not guaranteed. This is the highest-risk dual residency scenario.`,
      stats: [
        { label: "Treaty status",         value: "NONE — domestic law governs", highlight: true },
        { label: "Primary country",        value: "Both independently",           highlight: true },
        { label: "Risk level",              value: "HIGH",                          highlight: true },
      ],
      consequences: [
        `🔒 Without a treaty, both ${labelFor(result.countryA)} and ${labelFor(result.countryB)} can tax you as a resident under their domestic law. There is no automatic mechanism to resolve the overlap.`,
        "Unilateral relief: check each country's domestic foreign tax credit rules. Some countries offer a credit for foreign tax paid; others offer a deduction; others offer nothing. The scope and cap vary widely.",
        "Source-country vs residence-country: where income arises in one of the two countries, you may be able to allocate some taxation to the source country only — but without a treaty framework, the allocation is driven by each country's domestic law, not a negotiated outcome.",
        "Action: engage a cross-border tax specialist qualified in BOTH jurisdictions. This is the most complex residency state and requires formal residency change or domicile shift to resolve permanently.",
        "Documentation: build comprehensive evidence of permanent home, ties, and day counts for each country. Even without a treaty, the evidence supports arguments about primary residence under each domestic law — which may affect the taxation scope.",
        "Consider restructuring: if the no-treaty situation is unsustainable, the long-term solution may be to establish residency definitively in ONE of the two countries (or a third treaty-country) and sever ties with the other.",
      ],
      confidence: "HIGH",
      confidenceNote: "No-treaty dual residency has no automatic relief mechanism. Resolution requires domestic-law analysis in each country and typically professional intervention.",
      tier: 147,
      ctaLabel: "Get My No-Treaty Strategy Pack — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.resolvedAt === "TREATY_UNKNOWN") {
    return {
      status: "VERIFY — TREATY EXISTENCE MUST BE CONFIRMED",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `The tie-breaker analysis depends on whether a tax treaty is in force between ${labelFor(result.countryA)} and ${labelFor(result.countryB)}. Most common country pairs have a treaty (over 3,000 worldwide), but some pairings do not — and treaties occasionally enter into force or are replaced. Confirm treaty existence and current text before applying the tie-breaker.`,
      stats: [
        { label: "Treaty status",   value: "UNKNOWN — verify first",       highlight: true },
        { label: "Applicable test",   value: "Depends on treaty status",    highlight: true },
        { label: "Risk level",         value: "MEDIUM",                     highlight: true },
      ],
      consequences: [
        `⚠ Before applying Article 4, confirm that a bilateral tax treaty is in force between ${labelFor(result.countryA)} and ${labelFor(result.countryB)}, and obtain the current text.`,
        "Sources to verify treaty: OECD Model Tax Convention database; each country's tax authority website (HMRC International Manual for UK, ATO International Agreements for AU, IRD NZ Double Tax Agreements, CRA Tax Treaties, IRS Tax Treaties for US).",
        "Most major country pairs have treaties: UK-AU, UK-NZ, UK-CA, UK-US, AU-NZ, AU-CA, AU-US, NZ-CA, NZ-US, CA-US, each major EU country with each other, etc. Less-common pairings require specific verification.",
        "Treaty version matters: some treaties have been updated multiple times. The applicable version is the one in force at the time of the tax year in question. Recent MLI (Multilateral Instrument) modifications may apply.",
        "Once confirmed: re-run the tie-breaker with the correct treaty-status answer. If treaty exists, Tests 1-5 apply. If no treaty, domestic-law-only applies (see NO TREATY path).",
        "Professional advice: a cross-border tax specialist will confirm treaty existence and any recent amendments in the context of your specific year.",
      ],
      confidence: "LOW",
      confidenceNote: "Cannot complete tie-breaker analysis without confirming treaty existence. Verification is the immediate next step.",
      tier: 147,
      ctaLabel: "Get My Treaty Verification + Analysis — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.resolvedAt === "TEST_5_MUTUAL") {
    return {
      status: "UNRESOLVED — MUTUAL AGREEMENT PROCEDURE REQUIRED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Tests 1-4 did not resolve. Under Article 4(2)(d), the competent authorities of ${labelFor(result.countryA)} and ${labelFor(result.countryB)} must resolve by mutual agreement. This is the rarest and slowest outcome — typically a 2-3 year formal process (MAP — Mutual Agreement Procedure) with professional representation essential. Specialist cross-border advice required immediately.`,
      stats: [
        { label: "Resolved at",        value: "Test 5 — Mutual agreement",  highlight: true },
        { label: "Process",             value: "MAP — 2-3 years typical",    highlight: true },
        { label: "Risk level",           value: "HIGH",                        highlight: true },
      ],
      consequences: [
        `🔒 Permanent homes in both, equal vital interests, equal time, and either dual national or national of neither — an uncommon combination that does not resolve at Tests 1-4.`,
        "MAP (Mutual Agreement Procedure) under Article 25 of the treaty: the two tax authorities negotiate to reach a common position. The taxpayer participates via submissions and representation. Typical timeline: 2-3 years, occasionally longer.",
        "In the interim, each country may continue to claim you as resident under its domestic law. Interim filings are often required in BOTH countries pending resolution, with subsequent refunds or credits once the MAP concludes.",
        "Action: engage a tax advisor with MAP experience immediately. This is specialised work — most general tax accountants have never conducted a MAP. Ask for prior case experience before engaging.",
        "Documentation: build a comprehensive case file — permanent home evidence in both countries, vital interests documentation, day counts, nationality documents, employment records, family records. This file will form the basis of your MAP submission.",
        "Interim filings: typically file resident returns in both countries, pay the tax assessed, claim treaty-based credits where available, and flag the MAP submission to both authorities. Do NOT stop filing in either country while MAP is pending.",
        "Cost: MAP is expensive — specialist legal and tax advisory fees often $20,000-$100,000+ depending on complexity. The alternative (double taxation) is usually far more costly, so MAP is worth pursuing where genuine dual residency persists.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Test 5 mutual agreement is a rare outcome requiring specialist representation. The tie-breaker does not resolve self-serve.",
      tier: 147,
      ctaLabel: "Get My MAP Strategy + Evidence Pack — $147 →",
      altTierLabel: "Just want the overview? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // Resolved at Test 1, 2, 3, or 4
  const testNumber = { TEST_1: 1, TEST_2: 2, TEST_3: 3, TEST_4: 4 }[result.resolvedAt as "TEST_1" | "TEST_2" | "TEST_3" | "TEST_4"];
  const testLabel = {
    TEST_1: "Permanent home",
    TEST_2: "Centre of vital interests",
    TEST_3: "Habitual abode",
    TEST_4: "Nationality",
  }[result.resolvedAt as "TEST_1" | "TEST_2" | "TEST_3" | "TEST_4"];

  const statusColor = result.riskLevel === "LOW" ? "emerald" : result.riskLevel === "MEDIUM" ? "amber" : "red";

  return {
    status: `RESOLVED AT TEST ${testNumber} — ${result.primaryCountry.toUpperCase()} HAS PRIMARY TAXING RIGHTS`,
    statusClass: `text-${statusColor}-700`,
    panelClass: `border-${statusColor}-200 bg-${statusColor}-50`,
    headline: `The tie-breaker resolves at Test ${testNumber} (${testLabel}) in favour of ${result.primaryCountry}. ${result.primaryCountry} has PRIMARY taxing rights on your worldwide income. ${result.secondaryCountry} retains source-country taxing rights only (on income arising there — e.g. rental property, employment physically performed there, business from a permanent establishment). Treaty relief must be actively claimed on returns in BOTH countries.`,
    stats: [
      { label: "Resolved at",              value: `Test ${testNumber} — ${testLabel}`,     highlight: false },
      { label: "Primary taxing country",     value: result.primaryCountry,                    highlight: true },
      { label: "Secondary (source rights)",   value: result.secondaryCountry,                  highlight: false },
    ],
    consequences: [
      `✓ Test ${testNumber} (${testLabel}) resolves in favour of ${result.primaryCountry}. Tests ${testNumber < 4 ? (testNumber + 1) + "-5" : "5"} are NOT applied — once the sequence resolves, remaining tests are ignored.`,
      `Primary country (${result.primaryCountry}): taxes your WORLDWIDE income. You file a full resident return there including income from all sources globally.`,
      `Secondary country (${result.secondaryCountry}): retains SOURCE-COUNTRY taxing rights only — on income that arises in that country. Examples: rental income from property there, employment income physically performed there, business profits from a permanent establishment there, dividends/interest with reduced treaty withholding.`,
      `Filing approach: file a full resident return in ${result.primaryCountry} (worldwide income) + claim foreign tax credit for any tax paid to ${result.secondaryCountry} on source income. File a non-resident return in ${result.secondaryCountry} (source income only, typically at treaty-reduced rates).`,
      `Treaty position disclosure: most countries require a specific form (e.g. US Form 8833, UK DT-Individual, AU treaty residency statement) to claim the treaty position. Failure to file can forfeit the relief. Check each country's requirements.`,
      (result.countryA === "us" || result.countryB === "us") ? "⚠ US overlay: US citizens and green card holders are subject to worldwide taxation regardless of treaty residence. The treaty determines allocations but does NOT end the US filing obligation. FEIE §911 and foreign tax credits apply; Form 8833 disclosure required." : "",
      `Documentation: retain evidence supporting the Test ${testNumber} resolution. If ${testLabel.toLowerCase()} is later challenged, this evidence is your defence.`,
      `Annual reassessment: your treaty residence can change year-to-year if your facts change. Re-run the tie-breaker annually.`,
    ].filter(c => c !== ""),
    confidence: result.riskLevel === "LOW" ? "HIGH" : "MEDIUM",
    confidenceNote: `Tie-breaker resolved cleanly at Test ${testNumber}. Implementation requires treaty-position disclosure and foreign tax credit claims in the correct forms.`,
    tier: result.riskLevel === "LOW" ? 67 : 147,
    ctaLabel: result.riskLevel === "LOW" ? "Get My Treaty Position Pack — $67 →" : "Get My Treaty Filing Strategy — $147 →",
    altTierLabel: result.riskLevel === "LOW" ? "Want the full filing strategy? — $147" : "Just want the resolution? — $67",
    productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
    result,
  };
}

type Q = {
  id: string;
  step: number;
  type: "button_group" | "two_button";
  label: string;
  subLabel?: string;
  options: { label: string; value: string | boolean; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "country_a", step: 1, type: "button_group",
    label: "Country A — prior residency / first claimant?",
    subLabel: "The country you were previously tax resident in, or that currently claims you under its domestic law.",
    options: [
      { label: "United Kingdom",                         value: "uk",     subLabel: "UK SRT applies" },
      { label: "Australia",                                value: "au",     subLabel: "Resides + 183 + domicile" },
      { label: "New Zealand",                               value: "nz",     subLabel: "183 + permanent place of abode" },
      { label: "Canada",                                     value: "ca",     subLabel: "Factual residence" },
      { label: "United States",                             value: "us",     subLabel: "SPT + citizenship-based" },
      { label: "Germany / France / other EU",                value: "eu",    subLabel: "Country-specific rules" },
      { label: "Other",                                       value: "other", subLabel: "Specify with advisor" },
    ],
    required: true,
  },
  {
    id: "country_b", step: 1, type: "button_group",
    label: "Country B — current presence / second claimant?",
    subLabel: "The other country that also claims you as tax resident under its domestic law.",
    options: [
      { label: "United Kingdom",                         value: "uk" },
      { label: "Australia",                                value: "au" },
      { label: "New Zealand",                               value: "nz" },
      { label: "Canada",                                     value: "ca" },
      { label: "United States",                             value: "us" },
      { label: "Germany / France / other EU",                value: "eu" },
      { label: "Other",                                       value: "other" },
    ],
    required: true,
  },
  {
    id: "permanent_home", step: 2, type: "button_group",
    label: "Test 1 — Where is a permanent home available to you?",
    subLabel: "'Permanent' = available on a continuing basis (not a hotel or temporary stay). Ownership is NOT required — a continuously available rental qualifies.",
    options: [
      { label: "Permanent home in Country A only",  value: "a_only",  subLabel: "Test 1 RESOLVES — Country A wins" },
      { label: "Permanent home in Country B only",  value: "b_only",  subLabel: "Test 1 RESOLVES — Country B wins" },
      { label: "Permanent home in BOTH countries",   value: "both",    subLabel: "Test 1 does not resolve — move to Test 2" },
      { label: "No permanent home in either",          value: "neither", subLabel: "Test 1 does not resolve — move to Test 2" },
    ],
    required: true,
  },
  {
    id: "vital_interests", step: 3, type: "button_group",
    label: "Test 2 — Centre of vital interests (personal + economic ties)?",
    subLabel: "Only applies if Test 1 did not resolve. Consider family location, employment/business, financial administration, social/cultural activities. Qualitative test — usually decisive.",
    options: [
      { label: "Stronger ties in Country A (family + work)",     value: "a_stronger", subLabel: "Test 2 RESOLVES — Country A wins" },
      { label: "Stronger ties in Country B (family + work)",     value: "b_stronger", subLabel: "Test 2 RESOLVES — Country B wins" },
      { label: "Ties split — family one country, business other",  value: "split",      subLabel: "Test 2 does not resolve — move to Test 3" },
      { label: "No clearly stronger ties — equal",                    value: "equal",      subLabel: "Test 2 does not resolve — move to Test 3" },
    ],
    required: true,
    showIf: (a) => a.permanent_home === "both" || a.permanent_home === "neither",
  },
  {
    id: "habitual_abode", step: 4, type: "button_group",
    label: "Test 3 — Habitual abode (relative time comparison)?",
    subLabel: "Only applies if Tests 1 and 2 did not resolve. RELATIVE time comparison between the two countries — NOT a 183-day threshold.",
    options: [
      { label: "Significantly more time in Country A",   value: "a_more", subLabel: "Test 3 RESOLVES — Country A wins" },
      { label: "Significantly more time in Country B",   value: "b_more", subLabel: "Test 3 RESOLVES — Country B wins" },
      { label: "Roughly equal time in both",              value: "equal",   subLabel: "Test 3 does not resolve — move to Test 4" },
    ],
    required: true,
    showIf: (a) => (a.permanent_home === "both" || a.permanent_home === "neither") && (a.vital_interests === "split" || a.vital_interests === "equal"),
  },
  {
    id: "nationality", step: 5, type: "button_group",
    label: "Test 4 — Nationality?",
    subLabel: "Only applies if Tests 1, 2, and 3 did not resolve. National = citizen.",
    options: [
      { label: "National of Country A only",  value: "a_only",  subLabel: "Test 4 RESOLVES — Country A wins" },
      { label: "National of Country B only",  value: "b_only",  subLabel: "Test 4 RESOLVES — Country B wins" },
      { label: "National of BOTH countries",   value: "both",    subLabel: "Test 4 does not resolve — Test 5 (mutual agreement)" },
      { label: "National of NEITHER country",  value: "neither", subLabel: "Test 4 does not resolve — Test 5 (mutual agreement)" },
    ],
    required: true,
    showIf: (a) => (a.permanent_home === "both" || a.permanent_home === "neither") && (a.vital_interests === "split" || a.vital_interests === "equal") && a.habitual_abode === "equal",
  },
  {
    id: "treaty_status", step: 6, type: "button_group",
    label: "Treaty status between these countries?",
    subLabel: "Most common country pairs have a tax treaty (over 3,000 worldwide). Without a treaty, the tie-breaker does not apply and both countries may tax under domestic law.",
    options: [
      { label: "I know a treaty exists",       value: "known",    subLabel: "Apply tie-breaker" },
      { label: "Not sure if a treaty exists",   value: "unknown", subLabel: "Verify treaty existence first" },
      { label: "I believe no treaty exists",    value: "none",     subLabel: "No tie-breaker; domestic law governs both countries" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 6;

function VerdictBlock({ verdict, onCheckout, loading }: {
  verdict: VerdictResult;
  onCheckout: (t: Tier) => void;
  loading: boolean;
}) {
  const result = verdict.result;

  // panel background classes — use explicit Tailwind-safe classes
  const panelBg = verdict.panelClass;

  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${panelBg}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* Tie-breaker sequence visual — always visible */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">OECD Model Tax Convention Article 4(2) — applied in strict sequence</p>
        <div className="space-y-1.5">
          {result.testsApplied.map((t, i) => {
            const resolved = t.outcome.startsWith("Resolved") || t.outcome.startsWith("Tie-breaker does not apply") || t.outcome.startsWith("Verify");
            return (
              <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${resolved ? "bg-emerald-100" : "bg-white"}`}>
                <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${resolved ? "text-emerald-700" : "text-neutral-500"}`}>{resolved ? "✓" : "→"}</span>
                <div className="flex-1">
                  <p className={`text-[11px] font-bold ${resolved ? "text-emerald-700" : "text-neutral-700"}`}>{t.test}</p>
                  <p className="text-xs text-neutral-700">{t.outcome}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-neutral-950 bg-white" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className="font-serif text-lg font-bold text-neutral-950">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Primary vs secondary country split — only when resolved */}
      {result.winner !== "UNRESOLVED" && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Primary vs secondary taxing rights</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-emerald-700">Primary — {result.primaryCountry}</p>
              <ul className="space-y-1 text-xs text-emerald-900">
                <li>Taxes WORLDWIDE income</li>
                <li>Full resident return required</li>
                <li>Foreign tax credit for source-country tax paid</li>
                <li>Treaty-position disclosure on return</li>
              </ul>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-700">Secondary — {result.secondaryCountry}</p>
              <ul className="space-y-1 text-xs text-neutral-800">
                <li>Source-country rights ONLY</li>
                <li>Non-resident return (source income only)</li>
                <li>Treaty-reduced withholding rates</li>
                <li>No worldwide taxation under the treaty</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* US citizen note */}
      {(result.countryA === "us" || result.countryB === "us") && result.winner !== "UNRESOLVED" && result.primaryCountryCode !== "us" && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ US overlay — worldwide taxation continues regardless of treaty</p>
          <p className="text-red-900 leading-relaxed">
            US citizens and green card holders are subject to US worldwide taxation under IRC §§1, 61 regardless of treaty residence. The treaty determines allocations between countries but does NOT end the US filing obligation. File US Form 1040 + 2555 (FEIE §911) + 1116 (foreign tax credits) + 8833 (treaty position disclosure) + FBAR where applicable.
          </p>
        </div>
      )}

      {/* Risk level box */}
      <div className={`mb-4 rounded-xl border-2 px-4 py-3 text-xs ${
        result.riskLevel === "HIGH" ? "border-red-300 bg-red-50"
        : result.riskLevel === "MEDIUM" ? "border-amber-300 bg-amber-50"
        : "border-emerald-300 bg-emerald-50"
      }`}>
        <p className={`mb-1 font-mono text-[10px] uppercase tracking-widest ${
          result.riskLevel === "HIGH" ? "text-red-700"
          : result.riskLevel === "MEDIUM" ? "text-amber-700"
          : "text-emerald-700"
        }`}>Risk level — {result.riskLevel}</p>
        <p className={`${
          result.riskLevel === "HIGH" ? "text-red-900"
          : result.riskLevel === "MEDIUM" ? "text-amber-900"
          : "text-emerald-900"
        } leading-relaxed`}>
          {result.riskLevel === "LOW" && "Clean resolution at Test 1 or 2 with clear evidence. Treaty position is well-supported. Standard filing with treaty-position disclosure."}
          {result.riskLevel === "MEDIUM" && "Resolution at Test 3 (habitual abode) or 4 (nationality) — requires careful day-count documentation or citizenship evidence. Evidence file matters."}
          {result.riskLevel === "HIGH" && "Unresolved (Test 5 mutual agreement) or no treaty — specialist cross-border advice essential; potential MAP procedure."}
        </p>
      </div>

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — country-specific engines + back to index</p>
          <div className="space-y-2">
            {result.routes.map((r, i) => (
              <a key={i} href={r.href} className="block rounded-lg border border-emerald-300 bg-white px-3 py-2 hover:border-emerald-500 transition">
                <p className="text-sm font-semibold text-neutral-950">{r.label}</p>
                <p className="text-xs text-neutral-600 mt-0.5">{r.note}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
        <strong className="text-neutral-950">What this means:</strong>
        <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
          {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
        </ul>
      </div>

      <div className={`mb-4 rounded-xl border px-4 py-2 text-xs ${
        verdict.confidence === "HIGH" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : verdict.confidence === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800"
      }`}>
        <strong>Confidence: {verdict.confidence}</strong> — {verdict.confidenceNote}
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-800 leading-relaxed">
          <strong className="text-neutral-950">Tie-breaker is fact-driven, not preference-driven.</strong> The OECD Article 4 tests apply to objective facts in strict sequence. You cannot choose where to be taxed — the treaty determines it. Treaty relief must be actively claimed in each country with the correct forms.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Tie-breaker outcome with test-level reasoning</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Primary vs secondary country filing obligations</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Treaty position disclosure forms per country</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Evidence requirements for your resolving test</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Source-country taxing-rights allocation by income type</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 cross-border accountant questions</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your specific country pair and tie-breaker resolution</p>
      <p className="mt-2 text-center">
        <button onClick={() => onCheckout(verdict.tier === 67 ? 147 : 67)} disabled={loading}
          className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
          {verdict.altTierLabel}
        </button>
      </p>
    </div>
  );
}

function QuestionBlock({ q, value, onAnswer }: {
  q: Q;
  value: AnswerMap[string];
  onAnswer: (id: string, v: string | boolean) => void;
}) {
  const sel = (v: string | boolean) => value === v;
  const base = "rounded-xl border px-4 py-3 text-left transition";
  const active = "border-neutral-950 bg-neutral-950 text-white";
  const inactive = "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400";

  return (
    <div>
      <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-sm text-neutral-500">{q.subLabel}</p>}

      {q.type === "two_button" ? (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map(opt => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string | boolean)}
              className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${sel(opt.value as string | boolean) ? active : inactive}`}>
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map(opt => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string)}
              className={`${base} ${sel(opt.value as string) ? active : inactive}`}>
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as string) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TaxTreatyNavigatorCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ advisor_role: "", urgency: "", accountant: "" });
  const [email, setEmail]           = useState("");
  const [emailSent, setEmailSent]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const verdictRef                  = useRef<HTMLDivElement>(null);

  const verdict = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);
  const visibleQs = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));
  const stepComplete = !visibleQs.length || visibleQs.filter(q => q.required !== false).every(q => answers[q.id] !== undefined && answers[q.id] !== "");
  const popupComplete = Object.values(popupAnswers).every(v => v !== "");
  const maxStep = TOTAL_STEPS;

  useEffect(() => {
    if (!stepComplete) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, visibleQs.length ? 300 : 0);
    return () => clearTimeout(t);
  }, [stepComplete, step, visibleQs.length]);

  useEffect(() => {
    if (showVerdict && verdictRef.current)
      setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [showVerdict]);

  useEffect(() => {
    document.body.style.overflow = showPopup ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPopup]);

  useEffect(() => {
    if (!showVerdict || !verdict) return;
    fetch("/api/decision-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_slug: "tax-treaty-navigator",
        source_path: "/nomad/check/tax-treaty-navigator",
        country_code: "GLOBAL", currency_code: "USD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          resolved_at: verdict.result.resolvedAt,
          winner: verdict.result.winner,
          primary_country: verdict.result.primaryCountry,
          secondary_country: verdict.result.secondaryCountry,
          risk_level: verdict.result.riskLevel,
          tier: verdict.tier,
        },
        recommended_tier: verdict.tier,
      }),
    }).then(r => r.json()).then(d => { if (d.id) setSessionId(d.id); }).catch(() => {});
  }, [showVerdict]);

  function answer(id: string, v: string | boolean) {
    setAnswers(p => ({ ...p, [id]: v }));
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) setStep(s => s - 1);
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "tax_treaty_navigator", country_code: "GLOBAL", site: "taxchecknow" }),
    }).catch(() => {});
    setEmailSent(true);
  }

  function openPopup(tier: Tier) {
    setPopupTier(tier);
    setShowQ(false);
    setShowPopup(true);
    setError("");
  }

  async function handleCheckout() {
    if (loading || !verdict) return;
    setLoading(true); setError("");
    const sid = sessionId || `treaty_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("tax-treaty-navigator_country_a", String(answers.country_a || ""));
    sessionStorage.setItem("tax-treaty-navigator_country_b", String(answers.country_b || ""));
    sessionStorage.setItem("tax-treaty-navigator_permanent_home", String(answers.permanent_home || ""));
    sessionStorage.setItem("tax-treaty-navigator_vital_interests", String(answers.vital_interests || ""));
    sessionStorage.setItem("tax-treaty-navigator_habitual_abode", String(answers.habitual_abode || ""));
    sessionStorage.setItem("tax-treaty-navigator_nationality", String(answers.nationality || ""));
    sessionStorage.setItem("tax-treaty-navigator_treaty_status", String(answers.treaty_status || ""));
    sessionStorage.setItem("tax-treaty-navigator_resolved_at", verdict.result.resolvedAt);
    sessionStorage.setItem("tax-treaty-navigator_primary_country", verdict.result.primaryCountry);
    sessionStorage.setItem("tax-treaty-navigator_secondary_country", verdict.result.secondaryCountry);
    sessionStorage.setItem("tax-treaty-navigator_risk_level", verdict.result.riskLevel);
    sessionStorage.setItem("tax-treaty-navigator_status", verdict.status);
    sessionStorage.setItem("tax-treaty-navigator_tier", String(popupTier));

    if (sessionId) {
      fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, tier_intended: popupTier, product_key: key, questionnaire_payload: popupAnswers, email: email || undefined }),
      }).catch(() => {});
    }

    try {
      const successPath = popupTier === 67 ? "assess" : "plan";
      const res = await fetch("/api/create-checkout-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_session_id: sid, tier: popupTier, product_key: key,
          success_url: `${window.location.origin}/nomad/check/tax-treaty-navigator/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad/check/tax-treaty-navigator`,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setError(data.error || "Checkout failed."); setLoading(false); }
    } catch {
      setError("Checkout failed — please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {!showVerdict && visibleQs.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Step {step} of {maxStep}</p>
              {step > 1 && <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Back</button>}
            </div>
            <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full bg-neutral-950 transition-all duration-300" style={{ width: `${((step - 1) / maxStep) * 100}%` }} />
            </div>
            <div className="space-y-6">
              {visibleQs.map(q => <QuestionBlock key={q.id} q={q} value={answers[q.id] as string | boolean} onAnswer={answer} />)}
            </div>
          </div>
        )}

        {showVerdict && verdict && (
          <div ref={verdictRef} className="space-y-4">
            <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Change my answers</button>
            <VerdictBlock verdict={verdict} onCheckout={openPopup} loading={loading} />
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your tie-breaker outcome for your cross-border tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your Article 4 analysis by email — free.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">Save</button>
                </div>
              ) : <p className="text-sm font-semibold text-emerald-700">✓ Saved — check your inbox.</p>}
            </div>
          </div>
        )}
      </div>

      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>{verdict.status}</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {popupTier === 67 ? "Your Treaty Decision Pack" : "Your Global Tax Residency System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">OECD Model Article 4(2) · 3,000+ treaties · April 2026</p>
                </div>
                <button onClick={() => { setShowPopup(false); setShowQ(false); }}
                  className="rounded-lg bg-white/10 px-2 py-1 font-mono text-xs text-neutral-300 hover:bg-white/20 transition">✕ close</button>
              </div>
            </div>
            <div className="px-6 pt-5">
              {!showQuestions ? (
                <>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">What you get</p>
                    <p className="text-sm font-bold text-neutral-950 mb-2">
                      {popupTier === 67 ? "Treaty Decision Pack™" : "Global Tax Residency System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your tie-breaker outcome with test-level reasoning, primary vs secondary country filing obligations, treaty-position disclosure forms, evidence requirements for your resolving test, and 5 cross-border accountant questions."
                        : "Full strategy: tie-breaker outcome + multi-country filing sequence + treaty optimisation plan + MAP (Mutual Agreement Procedure) guidance if unresolved + long-term residency strategy + audit defence documentation pack."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic treaty content. Your specific country pair + tie-breaker + filing obligations.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Treaty Decision →" : "Get My Full Treaty System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the decision? — $67 instead" : "Want the full treaty system? — $147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">${popupTier}</p>
                  </div>
                  {[
                    { label: "Your role", key: "advisor_role", options: [["cross_border_individual","Cross-border individual"],["expat","Expat / relocating"],["partner","Partner / senior professional"],["advisor","Cross-border advisor / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["tax_authority_letter","Tax authority letter / challenge"],["filing_deadline","Filing deadline approaching"],["planning","Planning next year"]] },
                    { label: "Do you have a cross-border tax advisor?", key: "accountant", options: [["cross_border","Yes — cross-border specialist"],["single_country","Yes — single-country advisor"],["diy","Self-managed"],["none","No — need one"]] },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">{field.label}</label>
                      <select value={popupAnswers[field.key as keyof PopupAnswers]}
                        onChange={e => setPopupA(p => ({ ...p, [field.key]: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400">
                        <option value="">Select…</option>
                        {field.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </div>
                  ))}
                  <button onClick={handleCheckout} disabled={!popupComplete || loading}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50">
                    {loading ? "Redirecting to Stripe…" : `Pay $${popupTier} →`}
                  </button>
                  {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                </div>
              )}
              <button onClick={() => { setShowPopup(false); setShowQ(false); }}
                className="mt-3 w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-500 hover:bg-neutral-50 transition">
                Not now — keep reading
              </button>
            </div>
            <div className="px-6 pb-5 pt-2">
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · OECD Article 4 referenced content</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && (verdict.result.resolvedAt === "NO_TREATY" || verdict.result.resolvedAt === "TEST_5_MUTUAL") && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{verdict.result.resolvedAt === "NO_TREATY" ? "NO TREATY — urgent" : "UNRESOLVED — MAP required"}</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.result.resolvedAt === "NO_TREATY" ? "Genuine double taxation — specialist advice" : "Mutual agreement procedure — specialist advice"}
              </p>
            </div>
            <button onClick={() => openPopup(verdict.tier)}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white whitespace-nowrap">
              From $67 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
