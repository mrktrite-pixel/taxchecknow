"use client";

/**
 * NOMAD-03 — 183-Day Rule Reality Check
 * Pattern: StatusCheck (Module A) + Classification (Module C)
 *
 * The 183-day rule is NOT universal. Calculator applies country-specific tests:
 *   UK — Statutory Residence Test (Finance Act 2013 Sch 45)
 *     Automatic overseas tests (under 16 days / under 46 days / work abroad)
 *     Automatic UK tests (183+ days / only home UK / full-time work UK)
 *     Sufficient ties test (days × ties matrix — 16 days + 4 ties = UK resident)
 *   AU — Resides test + domicile test + 183-day statutory test (ITAA 1936 s6(1))
 *     Domicile can maintain AU residency regardless of days
 *   NZ — 183-day + permanent place of abode (ITA 2007 s YD 1)
 *     PPOA applies regardless of days if home kept
 *   CA — Factual residence based on ties (ITA s250) + 183-day deemed
 *   US — Substantial Presence Test + citizenship-based (IRC §7701(b) + §§1, 61)
 *     US citizens + green card holders: worldwide taxation regardless
 *
 * Verdict paths:
 *   NON_RESIDENT_CLEAR        — tests passed, ties severed, notified
 *   LIKELY_STILL_RESIDENT     — ties override days (ties-based test caught them)
 *   DAY_183_TRAP              — 183+ days triggered statutory presence
 *   AT_RISK_TIES_NOT_SEVERED  — left but property/family still retained
 *   NOT_NOTIFIED              — meets non-residence tests but didn't formally notify
 *   US_CITIZEN_WORLDWIDE      — US citizen — worldwide taxation regardless
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "NON_RESIDENT_CLEAR"
  | "LIKELY_STILL_RESIDENT_UK_SRT"
  | "LIKELY_STILL_RESIDENT_AU_DOMICILE"
  | "LIKELY_STILL_RESIDENT_NZ_PPOA"
  | "LIKELY_STILL_RESIDENT_CA_FACTUAL"
  | "DAY_183_TRAP"
  | "AT_RISK_TIES_NOT_SEVERED"
  | "NOT_NOTIFIED"
  | "US_CITIZEN_WORLDWIDE";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface ReviewResult {
  departureCountry:   string;
  daysInCountry:      string;
  ukTiesCount:        string;
  propertyRetained:   string;
  familyLocation:     string;
  formallyNotified:   string;

  countryLabel:       string;
  primaryTest:        string;
  daysLabel:          string;

  status:             Status;
  statusLabel:        string;
  riskLevel:          "LOW" | "MEDIUM" | "HIGH";

  tiesAssessment:     string[];   // list of ties found
  severanceChecklist: string[];   // actions to take

  routes: Route[];
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
  result: ReviewResult;
}

interface PopupAnswers {
  exit_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_183_day_rule",
  p147: "nomad_147_183_day_rule",
};

const COUNTRY_LABEL: Record<string, string> = {
  uk:    "United Kingdom",
  au:    "Australia",
  nz:    "New Zealand",
  ca:    "Canada",
  us:    "United States",
  other: "Other jurisdiction",
};

const PRIMARY_TEST: Record<string, string> = {
  uk:    "Statutory Residence Test (Finance Act 2013 Sch 45) — automatic tests + sufficient ties",
  au:    "Resides test + domicile + 183-day (ITAA 1936 s6(1))",
  nz:    "183-day + permanent place of abode (Income Tax Act 2007 s YD 1)",
  ca:    "Factual residence based on ties + 183-day deemed resident (ITA s250)",
  us:    "Substantial Presence Test + citizenship-based worldwide (IRC §7701(b) + §§1, 61)",
  other: "Country-specific domestic law (verify with national tax authority)",
};

const DAYS_LABEL: Record<string, string> = {
  under_16: "Under 16 days",
  "16_45":  "16 to 45 days",
  "46_90":  "46 to 90 days",
  "91_182": "91 to 182 days",
  "183_plus": "183+ days",
};

const COUNTRY_ROUTE: Record<string, Route> = {
  uk: { label: "UK Allowance Sniper — SRT + allowances + dividend tax", href: "/uk/check/allowance-sniper",             note: "Full UK position analysis — SRT score, allowances, dividend rates" },
  au: { label: "AU CGT Main Residence Trap — domicile + property + CGT",  href: "/au/check/cgt-main-residence-trap",     note: "Full AU position — main residence, CGT, property decisions" },
  nz: { label: "NZ Bright-Line Property Tax Decision Engine",              href: "/nz/check/bright-line-auditor",           note: "Full NZ position — bright-line, main home, property sale" },
  us: { label: "US FEIE Nomad Auditor — worldwide taxation for US citizens", href: "/us/check/feie-nomad-auditor",           note: "US citizens: FEIE §911, physical presence, Form 2555" },
  ca: { label: "Canada — specialist cross-border advice",                     href: "/nomad",                                   note: "No dedicated CA engine yet — seek specialist Canadian advice" },
  other: { label: "Back to Nomad Residency Risk Index",                       href: "/nomad",                                   note: "Start with residency risk classification" },
};

// UK SRT sufficient ties simplified logic
function ukSufficientTiesResolves(days: string, tiesCount: string): boolean {
  const ties = tiesCount === "4_plus" ? 4 : parseInt(tiesCount, 10);
  if (isNaN(ties)) return false;

  // Simplified SRT sufficient-ties thresholds (previously-UK-resident flavour)
  // 16-45 days: 4 ties = resident
  // 46-90 days: 3+ ties = resident
  // 91-120 days: 2+ ties = resident
  // 121-182 days: 1+ tie = resident
  // (For non-previously-UK-resident, thresholds are slightly different but we use this as a proxy.)
  if (days === "16_45")   return ties >= 4;
  if (days === "46_90")   return ties >= 3;
  if (days === "91_182")  return ties >= 2;   // covers both 91-120 + 121-182 bands conservatively
  return false;
}

function calcReview(answers: AnswerMap): ReviewResult {
  const departureCountry = String(answers.departure_country || "uk");
  const daysInCountry    = String(answers.days_in_country    || "91_182");
  const ukTiesCount      = String(answers.uk_ties_count      || "2");
  const propertyRetained = String(answers.property_retained  || "yes_own_rent");
  const familyLocation   = String(answers.family_location    || "home_country");
  const formallyNotified = String(answers.formally_notified  || "no");

  const countryLabel = COUNTRY_LABEL[departureCountry] || departureCountry;
  const primaryTest  = PRIMARY_TEST[departureCountry]  || PRIMARY_TEST.other;
  const daysLabel    = DAYS_LABEL[daysInCountry]        || daysInCountry;

  const propertyKept = propertyRetained === "yes_own_rent" || propertyRetained === "yes_family_home";
  const familyStayed = familyLocation === "home_country" || familyLocation === "split";

  const tiesAssessment: string[] = [];
  if (propertyKept) tiesAssessment.push(propertyRetained === "yes_own_rent" ? "Property owned/rented in " + countryLabel : "Family home available in " + countryLabel);
  if (familyStayed) tiesAssessment.push(familyLocation === "home_country" ? "Family (spouse/partner + dependants) in " + countryLabel : "Family split — some in " + countryLabel);
  if (formallyNotified !== "yes") tiesAssessment.push("No formal notification to tax authority of departure");

  const severanceChecklist: string[] = [];
  if (propertyKept) severanceChecklist.push("Sell, transfer, or end lease on property in " + countryLabel);
  if (familyStayed) severanceChecklist.push("Relocate family (spouse/partner + dependants) to new country");
  if (formallyNotified !== "yes") severanceChecklist.push("File formal departure notification with " + countryLabel + " tax authority");
  severanceChecklist.push("Sever secondary ties: bank accounts, memberships, drivers licence, health insurance");
  severanceChecklist.push("Maintain dated evidence of each severance step for audit defence");

  // Status determination — country-specific logic
  let status: Status;

  // US citizen layer — always worldwide regardless of days/ties
  if (departureCountry === "us") {
    status = "US_CITIZEN_WORLDWIDE";
  } else if (daysInCountry === "183_plus") {
    // 183+ days triggers statutory presence in most countries
    status = "DAY_183_TRAP";
  } else if (departureCountry === "uk") {
    // UK SRT logic
    if (daysInCountry === "under_16") {
      // Automatic overseas test (previously UK resident): under 16 days
      if (!propertyKept && !familyStayed && formallyNotified === "yes") {
        status = "NON_RESIDENT_CLEAR";
      } else if (formallyNotified !== "yes") {
        status = "NOT_NOTIFIED";
      } else {
        status = "AT_RISK_TIES_NOT_SEVERED";
      }
    } else if (ukSufficientTiesResolves(daysInCountry, ukTiesCount)) {
      // Sufficient ties test makes UK resident
      status = "LIKELY_STILL_RESIDENT_UK_SRT";
    } else {
      // Not caught by sufficient ties, but check severance + notification
      if (!propertyKept && !familyStayed && formallyNotified === "yes") {
        status = "NON_RESIDENT_CLEAR";
      } else if (formallyNotified !== "yes") {
        status = "NOT_NOTIFIED";
      } else {
        status = "AT_RISK_TIES_NOT_SEVERED";
      }
    }
  } else if (departureCountry === "au") {
    // AU domicile test — if property kept or family stayed, likely still AU resident
    if (propertyKept || familyStayed) {
      status = "LIKELY_STILL_RESIDENT_AU_DOMICILE";
    } else if (formallyNotified !== "yes") {
      status = "NOT_NOTIFIED";
    } else {
      status = "NON_RESIDENT_CLEAR";
    }
  } else if (departureCountry === "nz") {
    // NZ PPOA — if property kept, still resident regardless of days
    if (propertyKept) {
      status = "LIKELY_STILL_RESIDENT_NZ_PPOA";
    } else if (formallyNotified !== "yes") {
      status = "NOT_NOTIFIED";
    } else {
      status = "NON_RESIDENT_CLEAR";
    }
  } else if (departureCountry === "ca") {
    // CA factual residence — ties-based
    if (propertyKept || familyStayed) {
      status = "LIKELY_STILL_RESIDENT_CA_FACTUAL";
    } else if (formallyNotified !== "yes") {
      status = "NOT_NOTIFIED";
    } else {
      status = "NON_RESIDENT_CLEAR";
    }
  } else {
    // Other jurisdiction — generic at-risk
    if (propertyKept || familyStayed) {
      status = "AT_RISK_TIES_NOT_SEVERED";
    } else if (formallyNotified !== "yes") {
      status = "NOT_NOTIFIED";
    } else {
      status = "NON_RESIDENT_CLEAR";
    }
  }

  const statusLabel = {
    NON_RESIDENT_CLEAR:              "NON-RESIDENT — TESTS PASSED",
    LIKELY_STILL_RESIDENT_UK_SRT:    "LIKELY STILL UK RESIDENT — SRT SUFFICIENT TIES",
    LIKELY_STILL_RESIDENT_AU_DOMICILE: "LIKELY STILL AU RESIDENT — DOMICILE TEST",
    LIKELY_STILL_RESIDENT_NZ_PPOA:   "LIKELY STILL NZ RESIDENT — PERMANENT PLACE OF ABODE",
    LIKELY_STILL_RESIDENT_CA_FACTUAL: "LIKELY STILL CA RESIDENT — FACTUAL RESIDENCE (TIES)",
    DAY_183_TRAP:                     "183-DAY TRAP TRIGGERED — STATUTORY PRESENCE",
    AT_RISK_TIES_NOT_SEVERED:         "AT RISK — TIES NOT SEVERED",
    NOT_NOTIFIED:                     "NOT NOTIFIED — FORMAL DEPARTURE INCOMPLETE",
    US_CITIZEN_WORLDWIDE:             "US CITIZEN — WORLDWIDE TAXATION REGARDLESS",
  }[status];

  const riskLevel: ReviewResult["riskLevel"] =
    status === "NON_RESIDENT_CLEAR" ? "LOW"
    : (status === "NOT_NOTIFIED" || status === "AT_RISK_TIES_NOT_SEVERED") ? "MEDIUM"
    : "HIGH";

  // Build routes
  const routes: Route[] = [];
  const countryRoute = COUNTRY_ROUTE[departureCountry];
  if (countryRoute) routes.push(countryRoute);
  // Always offer US route if US citizen path (the user is NOT US citizen in this branch unless departureCountry === 'us', but always safe to add secondary)
  if (departureCountry !== "us" && status !== "NON_RESIDENT_CLEAR") {
    // Add Tax Treaty Navigator as secondary — if potentially dual resident, tie-breaker applies
    routes.push({ label: "Tax Treaty Navigator — Article 4 tie-breaker", href: "/nomad/check/tax-treaty-navigator", note: "If potentially resident in two countries, apply the OECD tie-breaker" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    departureCountry, daysInCountry, ukTiesCount, propertyRetained, familyLocation, formallyNotified,
    countryLabel, primaryTest, daysLabel,
    status, statusLabel, riskLevel,
    tiesAssessment, severanceChecklist, routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcReview(answers);

  if (result.status === "NON_RESIDENT_CLEAR") {
    return {
      status: result.statusLabel,
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your answers indicate you have met the non-residence tests for ${result.countryLabel}: low day count, ties severed, formal departure notification filed. Confirm departure return has been filed and keep supporting evidence. ${result.departureCountry === "uk" && result.daysInCountry === "under_16" ? "The UK automatic overseas test (under 16 days) applies — this is a hard threshold." : "The country-specific test is satisfied on your stated facts."}`,
      stats: [
        { label: "Departure country",        value: result.countryLabel },
        { label: "Days in country",            value: result.daysLabel },
        { label: "Residency outcome",          value: "Non-resident (tests passed)" },
      ],
      consequences: [
        `✓ Primary test: ${result.primaryTest}`,
        `Day count: ${result.daysLabel}. Ties: severed. Formal notification: filed. This is the clean-exit profile.`,
        "Documentation: retain evidence of each severance step (property disposal, family relocation, bank closures) and the departure return / notification filed with the tax authority. Non-residence challenges typically emerge years after the fact.",
        result.departureCountry === "uk" ? "UK-specific: confirm P85 filed OR self-assessment non-residence claim (NR pages) for the departure tax year. If mid-year departure, split-year election may apply." : "",
        result.departureCountry === "au" ? "AU-specific: confirm ATO 'Leaving Australia' statement filed + tax profile updated. Domicile change evidence essential." : "",
        result.departureCountry === "nz" ? "NZ-specific: confirm IRD notification + final return for departure year + 325 days continuously absent + no permanent place of abode retained." : "",
        result.departureCountry === "ca" ? "CA-specific: confirm departure return filed with T1243 deemed dispositions (taxable on appreciated property at departure). RRSP/TFSA treatment confirmed." : "",
        "Annual reassessment: residency can re-establish if you return and re-acquire ties. Re-run this check if you consider returning or re-acquiring property/family presence.",
        "Cross-border: if you are now resident in a new country AND the old country could still claim you, the tax treaty tie-breaker may apply. See /nomad/check/tax-treaty-navigator.",
      ].filter(c => c !== ""),
      confidence: "MEDIUM",
      confidenceNote: "Non-residence outcome based on stated facts. Final confirmation requires tax authority's acceptance of the departure return and severance evidence.",
      tier: 67,
      ctaLabel: "Get My Non-Residence Confirmation Pack — $67 →",
      altTierLabel: "Want full exit strategy + documentation? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "DAY_183_TRAP") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You spent 183+ days in ${result.countryLabel} in the last 12 months. The statutory presence test is triggered — regardless of intention in most countries. The UK automatic UK residence test (183+ days) makes you UK resident with no further analysis. Australia, New Zealand, and Canada each have 183-day presence rules that apply — though AU has a 'usual place of abode' rebuttal.`,
      stats: [
        { label: "Departure country",        value: result.countryLabel,           highlight: true },
        { label: "Days in country",           value: result.daysLabel,               highlight: true },
        { label: "Residency outcome",         value: "Resident (183+ days)",         highlight: true },
      ],
      consequences: [
        `🔒 183+ days in ${result.countryLabel} triggers the statutory presence test. In the UK, this is an automatic UK residence test — no override. In NZ, Canada, and (to varying extents) Australia, 183+ days makes you deemed resident under domestic law.`,
        `Primary test now resolved by presence: ${result.primaryTest}`,
        "Intention does not override presence in most 183-day rules. Being present 183+ days is a HARD trigger for residency under most country tests — even if you had intended to be non-resident.",
        result.departureCountry === "au" ? "AU-specific rebuttal: the 183-day statutory test can be REBUTTED under ITAA 1936 s6(1)(a)(ii) if (a) usual place of abode is outside Australia AND (b) no intention to take up residence. This is a fact-heavy argument requiring significant evidence — usually unsuccessful if a home was maintained in Australia." : "",
        "Filing: you are required to file a full resident return in " + result.countryLabel + " for the year, declaring worldwide income. Foreign tax credits may apply for tax paid elsewhere on the same income.",
        "Tax treaty interaction: if you are ALSO resident in another country under that country's domestic law, the bilateral treaty tie-breaker may resolve the conflict in favour of the other country — even if 183+ days are in this one. Apply Article 4: permanent home → vital interests → habitual abode → nationality. See /nomad/check/tax-treaty-navigator.",
        "Voluntary disclosure: if you have been filing as non-resident in error, voluntary disclosure reduces penalties significantly. Disclose BEFORE authority contact.",
      ].filter(c => c !== ""),
      confidence: "HIGH",
      confidenceNote: "183+ days triggers statutory presence in most countries. Resolution (if dual-resident in another country) via treaty tie-breaker.",
      tier: 147,
      ctaLabel: "Get My 183-Day Trap Remediation Pack — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "LIKELY_STILL_RESIDENT_UK_SRT") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `The UK Statutory Residence Test sufficient-ties test applies to you. At ${result.daysLabel} and approximately ${result.ukTiesCount === "4_plus" ? "4+" : result.ukTiesCount} UK ties, you are UK tax resident under the sufficient-ties matrix. The 183-day rule is NOT the test — the combination of days × ties decides, and your combination triggers UK residency even under the 183-day threshold.`,
      stats: [
        { label: "Days in UK",               value: result.daysLabel,                highlight: true },
        { label: "UK ties (approximate)",     value: result.ukTiesCount === "4_plus" ? "4+" : result.ukTiesCount,  highlight: true },
        { label: "SRT outcome",                value: "UK resident (sufficient ties)", highlight: true },
      ],
      consequences: [
        `🔒 UK Statutory Residence Test (Finance Act 2013 Sch 45) — sufficient ties test. Thresholds (for previously-UK-resident): 16-45 days = 4 ties needed; 46-90 days = 3 ties; 91-120 days = 2 ties; 121-182 days = 1 tie. Your combination exceeds the threshold → UK resident.`,
        "UK tax obligation: worldwide income is UK-taxable. File UK Self Assessment (SA100) including all worldwide income sources. Foreign tax credit available for tax paid in other countries on same income.",
        "Severance path: reduce the days OR reduce the ties to exit UK residency. Most common strategy: eliminate the accommodation tie (sell UK property or have it unavailable continuously) and the family tie (relocate family). Each tie removed raises the day threshold for UK residency.",
        "UK ties — what counts: family tie (spouse/partner or minor children UK resident); accommodation tie (a place to live in UK continuously available AND used 1+ night OR a close relative's home used 16+ nights); work tie (40+ days substantive UK work, defined as 3+ hours); 90-day tie (90+ days in UK in either of the 2 previous tax years); country tie (more days in UK than any other single country in the year).",
        "Treaty interaction: if you are ALSO resident in another country under its domestic law, the UK-other country treaty tie-breaker may shift primary taxing rights away from UK. Article 4 tie-breaker applies (permanent home → vital interests → habitual abode → nationality). See /nomad/check/tax-treaty-navigator.",
        "Voluntary disclosure: if you have been filing as UK non-resident in error, HMRC's Worldwide Disclosure Facility reduces penalties substantially. Disclose BEFORE HMRC contact for best terms.",
        `Ties assessment for your situation: ${result.tiesAssessment.join(" · ")}.`,
      ],
      confidence: "HIGH",
      confidenceNote: "UK SRT sufficient ties test is a hard matrix. Your stated combination triggers UK residency. Treaty tie-breaker may provide relief if also resident elsewhere.",
      tier: 147,
      ctaLabel: "Get My UK Residency Remediation Pack — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "LIKELY_STILL_RESIDENT_AU_DOMICILE") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Australia's domicile test applies. Under ITAA 1936 s6(1)(a)(i), a person whose domicile is Australia remains tax resident in Australia UNLESS the ATO is satisfied their permanent place of abode is elsewhere. Maintaining property or family in Australia is strong evidence of continuing Australian domicile — day count is not the primary test.`,
      stats: [
        { label: "Days in AU",                value: result.daysLabel,                  highlight: true },
        { label: "Domicile test",               value: "Likely AU domicile retained",    highlight: true },
        { label: "Residency outcome",          value: "Likely still AU resident",        highlight: true },
      ],
      consequences: [
        `🔒 AU ITAA 1936 s6(1) — domicile test. Australian domicile is presumed unless a permanent place of abode has been established elsewhere. Simply living overseas is insufficient — establishing a new permanent home is required.`,
        `Your situation: ${result.tiesAssessment.join(" · ")} — these are strong indicators of continuing Australian domicile.`,
        "Australian tax obligation: worldwide income is Australia-taxable for Australian residents. File individual tax return declaring all worldwide income. Foreign tax credits available.",
        "Severance path: establish a permanent place of abode elsewhere (lease or title + settled life + intention). Sell or formally transfer Australian property. Relocate family if possible. File ATO 'Leaving Australia' statement when domicile change is effected.",
        "Treaty interaction: if also resident in another country under its domestic law, treaty Article 4 tie-breaker may shift primary taxing rights. See /nomad/check/tax-treaty-navigator.",
        "ATO Ruling IT 2650: the seminal ATO ruling on 'permanent place of abode' establishes that it requires more than physical presence overseas — settled life, stable home, intention to remain. A vague 'intention to return to Australia eventually' can be sufficient for ATO to find Australian domicile retained.",
        "Voluntary disclosure: ATO voluntary disclosure reduces penalty from up to 75% (gross negligence) to around 20% or less for voluntary non-careless cases. Disclose BEFORE ATO contact.",
      ],
      confidence: "HIGH",
      confidenceNote: "Domicile test applies regardless of days. Evidence of permanent place of abode elsewhere is the resolution path.",
      tier: 147,
      ctaLabel: "Get My AU Residency Remediation Pack — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "LIKELY_STILL_RESIDENT_NZ_PPOA") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `New Zealand's permanent place of abode (PPOA) test applies. Under Income Tax Act 2007 s YD 1, a person is NZ tax resident if they have a PPOA in NZ — regardless of days. Maintaining a dwelling available to you in NZ on a continuing basis satisfies the PPOA test. The 183-day rule is independent — either triggers residency.`,
      stats: [
        { label: "Days in NZ",                 value: result.daysLabel,                  highlight: true },
        { label: "Permanent place of abode",    value: "Likely PPOA retained in NZ",      highlight: true },
        { label: "Residency outcome",          value: "Likely still NZ resident",        highlight: true },
      ],
      consequences: [
        `🔒 NZ Income Tax Act 2007 s YD 1 — permanent place of abode test. A person has a NZ PPOA if they maintain a dwelling available to them on a continuing basis. Test is independent of days — even 0 days can result in residency.`,
        `Your situation: ${result.tiesAssessment.join(" · ")} — property retained in NZ is the key PPOA factor.`,
        "NZ tax obligation: worldwide income is NZ-taxable. File IR3 declaring all worldwide income. Foreign tax credits available.",
        "Severance path: remove the NZ PPOA — sell the property or end the lease or make it continuously unavailable. NZ case law (Diamond v CIR) considers whether the dwelling is 'sufficiently permanent' and 'available for the taxpayer's use'. Transfer to arm's-length tenant removes PPOA.",
        "325-day rule: a person can cease NZ residency if they have NO NZ PPOA AND have been out of NZ for 325 days in any 12-month period. Both conditions must be met.",
        "Treaty interaction: if also resident in another country, treaty Article 4 tie-breaker may shift primary taxing rights. See /nomad/check/tax-treaty-navigator.",
        "Voluntary disclosure: IRD voluntary disclosure reduces shortfall penalty substantially. Disclose BEFORE IRD contact for best terms.",
      ],
      confidence: "HIGH",
      confidenceNote: "NZ PPOA test is statutory — property retained is strong evidence of continuing NZ residency regardless of days.",
      tier: 147,
      ctaLabel: "Get My NZ Residency Remediation Pack — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "LIKELY_STILL_RESIDENT_CA_FACTUAL") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Canada's factual residence test applies. Residency is determined by residential ties — primary ties (dwelling, spouse/partner, dependants in Canada) and secondary ties. There is NO day threshold for the primary test. Maintaining property or family in Canada is strong evidence of continuing Canadian residency.`,
      stats: [
        { label: "Days in Canada",             value: result.daysLabel,                  highlight: true },
        { label: "Factual residence",          value: "Ties retained",                    highlight: true },
        { label: "Residency outcome",          value: "Likely still CA resident",        highlight: true },
      ],
      consequences: [
        `🔒 Canada ITA s250 — factual residence based on ties. Primary ties: dwelling place in Canada, spouse/partner in Canada, dependants in Canada. Secondary ties: other property, social and economic ties, drivers licence, health insurance, memberships.`,
        `Your situation: ${result.tiesAssessment.join(" · ")} — primary or secondary ties retained.`,
        "Canadian tax obligation: worldwide income taxable for Canadian tax residents. File T1 return declaring all worldwide income. Foreign tax credits available.",
        "Severance path: sever primary ties first (sell/transfer home, relocate spouse/partner and dependants). Then secondary ties (bank accounts, memberships, drivers licence). File a DEPARTURE RETURN for the year of departure including Form T1243 — Deemed Dispositions.",
        "Deemed dispositions on departure: most property is deemed disposed of at fair market value on the day Canadian residency ceases. Tax payable on the deemed gain (with optional deferral election). This is a one-time event on departure.",
        "Treaty interaction: if also resident in another country, treaty Article 4 tie-breaker may shift primary taxing rights. See /nomad/check/tax-treaty-navigator.",
        "Voluntary disclosure: CRA Voluntary Disclosures Program (VDP) reduces penalties. Pre-disclosure contact required. Disclose BEFORE CRA contact.",
      ],
      confidence: "HIGH",
      confidenceNote: "Canadian factual residence is ties-based. No day threshold for primary test. Severance of ties + departure return with deemed dispositions is the exit path.",
      tier: 147,
      ctaLabel: "Get My CA Residency Remediation Pack — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "US_CITIZEN_WORLDWIDE") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `US citizens and green card holders are subject to worldwide taxation regardless of residency, regardless of days, regardless of ties. The substantial presence test applies only to non-citizens. For US citizens, the only way to end US tax residency is to renounce citizenship — which triggers exit tax under IRC §877A for covered expatriates. The 183-day rule is irrelevant to US citizens.`,
      stats: [
        { label: "US citizenship status",       value: "Worldwide taxation applies",    highlight: true },
        { label: "Substantial presence test",    value: "N/A for citizens",              highlight: true },
        { label: "Exit mechanism",                value: "Renunciation + IRC §877A exit tax", highlight: true },
      ],
      consequences: [
        `🔒 IRC §§1 and 61: US citizens are taxed on worldwide income regardless of where they live. IRC §7701(b) (substantial presence test) applies only to non-citizens determining whether they are US tax resident.`,
        "US filing obligation continues: Form 1040 always required for US citizens regardless of residence. Foreign tax credits (IRC §901) offset foreign tax paid. Foreign Earned Income Exclusion (IRC §911 / Form 2555) excludes limited earned income if physical presence test (330+ days abroad) or bona fide residence test is met. FBAR (FinCEN 114) for foreign accounts over $10,000 aggregate.",
        "See /us/check/feie-nomad-auditor for full FEIE analysis and filing approach.",
        "Renunciation: the only way to end US tax residency permanently. Performed at US embassy or consulate abroad. Irrevocable. Triggers IRC §877A exit tax for 'covered expatriates' (net worth ≥ $2M OR average US tax liability over 5 years ≥ ~$190,000 inflation-adjusted OR non-compliance certification failure).",
        "Exit tax mechanics: deemed sale of all worldwide assets on day before expatriation at fair market value. Gain above exemption (~$866,000 in 2024, inflation-adjusted) taxed as capital gain. Specific rules for IRAs, pensions, and deferred compensation.",
        "Treaty interaction: treaties can redirect some US taxing rights but do NOT end citizenship-based taxation. Most US tax treaties contain a 'saving clause' preserving US taxation of citizens regardless of treaty residence.",
        "Green card holders: 'abandonment' of green card (Form I-407) ends US tax residency going forward. Long-term green card holders (8+ of last 15 years) are also subject to §877A exit tax on abandonment.",
      ],
      confidence: "HIGH",
      confidenceNote: "US citizenship-based taxation is foundational and does not depend on days or ties. Only renunciation + exit tax ends it.",
      tier: 147,
      ctaLabel: "Get My US Worldwide Taxation Pack — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "AT_RISK_TIES_NOT_SEVERED") {
    return {
      status: result.statusLabel,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `You have left ${result.countryLabel} but ties remain (property, family, or both). The day count alone does not resolve your position — ties-based tests in most countries can maintain residency regardless of physical absence. Do not assume non-residence without severing ties and obtaining professional confirmation.`,
      stats: [
        { label: "Departure country",         value: result.countryLabel,            highlight: true },
        { label: "Days in country",             value: result.daysLabel,                highlight: true },
        { label: "Ties retained",                value: "Yes — material ties still present", highlight: true },
      ],
      consequences: [
        `⚠ Ties identified: ${result.tiesAssessment.join(" · ")}. Each tie is a factor pointing toward continuing residency in ${result.countryLabel}.`,
        `The primary residency test for ${result.countryLabel}: ${result.primaryTest}. Ties override day count in most of these tests.`,
        "Action: sever ties systematically. Priority: (1) property (sell, transfer, or end lease); (2) family (relocate spouse/partner and dependants); (3) work and economic ties; (4) secondary ties (bank accounts, memberships, drivers licence, health insurance).",
        "Severance checklist for your situation: " + result.severanceChecklist.join(" · "),
        "Formal notification: once ties are severed, file a departure return with the tax authority. Without formal notification, the authority typically continues to treat you as resident.",
        "Dual-country risk: if you are now resident in a new country AND ties remain in the old one, you may be dual-resident. Treaty Article 4 tie-breaker applies if a treaty exists. See /nomad/check/tax-treaty-navigator.",
        "Voluntary disclosure: if you have incorrectly filed (or not filed) in the old country, voluntary disclosure reduces penalties substantially. Disclose BEFORE authority contact.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Ties retained = residency risk. Severance + formal notification resolves. Professional cross-border advice recommended.",
      tier: 147,
      ctaLabel: "Get My Ties Severance Strategy — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // NOT_NOTIFIED
  return {
    status: result.statusLabel,
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: `Your day count and ties suggest non-residence in ${result.countryLabel} — but you have not formally notified the tax authority of your departure. Without formal notification, most countries continue to treat you as resident and will expect full resident filings. Formalise the departure now to confirm the non-resident position.`,
    stats: [
      { label: "Departure country",       value: result.countryLabel },
      { label: "Days in country",            value: result.daysLabel },
      { label: "Formal notification",         value: "NOT FILED",              highlight: true },
    ],
    consequences: [
      `⚠ Days and ties indicate non-residence — but formal notification to ${result.countryLabel} tax authority has not been filed. Authority presumes continued residency until formally notified.`,
      "Action: file the departure return / notification now for the tax year(s) covered by your departure. Country-specific:",
      result.departureCountry === "uk" ? "UK: Form P85 (leaving UK) + self-assessment non-residence claim for departure tax year + split-year election if mid-year. Online via HMRC account or paper form." : "",
      result.departureCountry === "au" ? "Australia: 'Leaving Australia' statement via ATO online + update tax profile. Declare the domicile change and establish permanent place of abode elsewhere as evidence." : "",
      result.departureCountry === "nz" ? "New Zealand: IRD non-residence notification via myIR + final IR3 for departure year. Must confirm no PPOA in NZ." : "",
      result.departureCountry === "ca" ? "Canada: Departure return including Form T1243 (Deemed Dispositions of Property) for year of departure. Report departure date on T1. RRSP/TFSA treatment update." : "",
      result.departureCountry === "us" ? "US citizens: renunciation at US embassy or consulate; Form 8854 (expatriation statement); IRC §877A exit tax for covered expatriates." : "",
      "Voluntary disclosure: if you have NOT filed resident returns for years since departure (assuming you were still technically resident), use the country's voluntary disclosure programme to reduce penalties. UK Worldwide Disclosure Facility / AU voluntary disclosure / NZ voluntary disclosure / CA VDP.",
      "Documentation: retain copies of the departure filing + evidence of severance (property, family, work) for 7 years minimum. Future residency challenges are evidence-heavy.",
    ].filter(c => c !== ""),
    confidence: "MEDIUM",
    confidenceNote: "Non-residence outcome contingent on formal notification. Without filing, the authority continues to presume residency.",
    tier: 67,
    ctaLabel: "Get My Departure Compliance Pack — $67 →",
    altTierLabel: "Full exit strategy + multi-country? — $147",
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
    id: "departure_country", step: 1, type: "button_group",
    label: "Which country are you trying to leave (or have already left)?",
    subLabel: "Each country has its own statutory residency test. The 183-day rule is NOT universal.",
    options: [
      { label: "United Kingdom",      value: "uk",    subLabel: "UK SRT — automatic tests + sufficient ties" },
      { label: "Australia",             value: "au",    subLabel: "Resides + domicile + 183-day (ITAA 1936 s6(1))" },
      { label: "New Zealand",            value: "nz",    subLabel: "183-day + permanent place of abode (ITA 2007)" },
      { label: "Canada",                  value: "ca",    subLabel: "Factual residence + 183-day deemed (ITA s250)" },
      { label: "United States",           value: "us",    subLabel: "Substantial presence + citizenship (IRC §7701(b))" },
      { label: "Other jurisdiction",       value: "other", subLabel: "Country-specific domestic law" },
    ],
    required: true,
  },
  {
    id: "days_in_country", step: 2, type: "button_group",
    label: "Days spent in that country in last 12 months?",
    subLabel: "Part-days generally count under most tests. Passport or flight records are the best evidence.",
    options: [
      { label: "Under 16 days",        value: "under_16",  subLabel: "May qualify for UK automatic overseas test" },
      { label: "16 to 45 days",          value: "16_45",    subLabel: "UK sufficient-ties territory" },
      { label: "46 to 90 days",          value: "46_90",    subLabel: "UK sufficient-ties territory" },
      { label: "91 to 182 days",          value: "91_182",  subLabel: "UK sufficient-ties territory" },
      { label: "183 or more days",         value: "183_plus", subLabel: "Statutory presence triggered in most countries" },
    ],
    required: true,
  },
  {
    id: "uk_ties_count", step: 3, type: "button_group",
    label: "How many UK ties apply to you?",
    subLabel: "Family (spouse/partner or minor children UK resident); accommodation (home available + used 1+ night OR close relative's home 16+ nights); work (40+ days substantive UK work); 90-day (90+ days in either of 2 previous tax years); country (more UK days than any single other country).",
    options: [
      { label: "0 ties",    value: "0",       subLabel: "No UK ties identified" },
      { label: "1 tie",     value: "1",       subLabel: "Light UK connection" },
      { label: "2 ties",    value: "2",       subLabel: "Moderate UK connection" },
      { label: "3 ties",    value: "3",       subLabel: "Strong UK connection" },
      { label: "4+ ties",   value: "4_plus",  subLabel: "4+ ties can trigger SRT at 16 days" },
    ],
    required: true,
    showIf: (a) => a.departure_country === "uk",
  },
  {
    id: "property_retained", step: 4, type: "button_group",
    label: "Do you still have a property available to you in that country?",
    subLabel: "Property availability is a strong tie in UK SRT, AU domicile, NZ PPOA, and CA factual residence tests.",
    options: [
      { label: "Yes — own or rent a property",      value: "yes_own_rent",     subLabel: "Strong tie — likely still resident" },
      { label: "Yes — family home available",        value: "yes_family_home", subLabel: "Accommodation tie" },
      { label: "No — all property connections severed", value: "no_severed",     subLabel: "Supports non-residence" },
      { label: "Not sure",                              value: "unsure",           subLabel: "Verify — usually means ties remain" },
    ],
    required: true,
  },
  {
    id: "family_location", step: 5, type: "button_group",
    label: "Where is your family (spouse/partner + dependent children)?",
    subLabel: "Family location is a strong tie in UK SRT (family tie), AU domicile, and CA factual residence tests.",
    options: [
      { label: "All in the country I am leaving", value: "home_country",  subLabel: "Strong family tie — likely still resident" },
      { label: "Split between countries",           value: "split",          subLabel: "Partial tie — likely still resident" },
      { label: "All in new country",                 value: "new_country",   subLabel: "Supports non-residence" },
      { label: "No dependants / single",              value: "none",          subLabel: "No family tie" },
    ],
    required: true,
  },
  {
    id: "formally_notified", step: 6, type: "button_group",
    label: "Have you formally notified the tax authority of your departure?",
    subLabel: "UK: P85 / self-assessment non-residence. AU: ATO departing Australia statement. NZ: IRD notification. CA: departure return with Form T1243.",
    options: [
      { label: "Yes — filed departure return / notified",   value: "yes", subLabel: "Formal exit path complete" },
      { label: "No — just stopped filing",                     value: "no",  subLabel: "Authority likely still treats you as resident" },
      { label: "Not applicable / not sure",                    value: "na",  subLabel: "Verify — may be required" },
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

  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* Country test anchor */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Primary residency test for {result.countryLabel}</p>
        <p className="text-neutral-800 leading-relaxed">{result.primaryTest}</p>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Ties assessment — always visible when ties exist */}
      {result.tiesAssessment.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-700">Ties identified in your situation</p>
          <ul className="space-y-1 text-amber-900">
            {result.tiesAssessment.map((t, i) => <li key={i}>→ {t}</li>)}
          </ul>
        </div>
      )}

      {/* Severance checklist */}
      {result.severanceChecklist.length > 0 && (result.status !== "NON_RESIDENT_CLEAR" && result.status !== "US_CITIZEN_WORLDWIDE") && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Severance checklist to establish non-residence</p>
          <ul className="space-y-1 text-neutral-700">
            {result.severanceChecklist.map((s, i) => <li key={i}>□ {s}</li>)}
          </ul>
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
          {result.riskLevel === "LOW" && "Clean non-residence profile with tests passed and formal notification filed. Maintain documentation."}
          {result.riskLevel === "MEDIUM" && "Position not fully resolved — ties remain or notification missing. Action required to confirm non-residence."}
          {result.riskLevel === "HIGH" && "Likely still tax resident under country-specific ties test. Worldwide income may be taxable. Specialist cross-border advice essential."}
        </p>
      </div>

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — country engines + tie-breaker + back to index</p>
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
          <strong className="text-neutral-950">Ties, not days, decide most cases.</strong> The 183-day rule is one factor in some country tests — not the universal non-residence threshold. Leaving a country does not end tax residency; severing ties + formal notification does.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Residency outcome under the specific statutory test of your country</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Ties assessment + severance checklist tailored to your situation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Country-specific departure return / formal notification guidance</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Voluntary disclosure assessment if prior years need remediation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Treaty tie-breaker interaction if potentially dual-resident</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 cross-border accountant questions</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your specific departure country and ties profile</p>
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

export default function Day183RuleCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ exit_role: "", urgency: "", accountant: "" });
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
        product_slug: "day-183-rule",
        source_path: "/nomad/check/183-day-rule",
        country_code: "GLOBAL", currency_code: "USD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          residency_status: verdict.result.status,
          departure_country: verdict.result.countryLabel,
          days_in_country: verdict.result.daysLabel,
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
      body: JSON.stringify({ email, source: "day_183_rule", country_code: "GLOBAL", site: "taxchecknow" }),
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
    const sid = sessionId || `day183_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("day-183-rule_departure_country", String(answers.departure_country || ""));
    sessionStorage.setItem("day-183-rule_days_in_country", String(answers.days_in_country || ""));
    sessionStorage.setItem("day-183-rule_uk_ties_count", String(answers.uk_ties_count || ""));
    sessionStorage.setItem("day-183-rule_property_retained", String(answers.property_retained || ""));
    sessionStorage.setItem("day-183-rule_family_location", String(answers.family_location || ""));
    sessionStorage.setItem("day-183-rule_formally_notified", String(answers.formally_notified || ""));
    sessionStorage.setItem("day-183-rule_residency_status", verdict.result.status);
    sessionStorage.setItem("day-183-rule_risk_level", verdict.result.riskLevel);
    sessionStorage.setItem("day-183-rule_status", verdict.status);
    sessionStorage.setItem("day-183-rule_tier", String(popupTier));

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
          success_url: `${window.location.origin}/nomad/check/183-day-rule/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad/check/183-day-rule`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your 183-day reality check for your cross-border tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your residency outcome by email — free.</p>
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
                    {popupTier === 67 ? "Your 183-Day Residency Check" : "Your Global Residency Strategy"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">Country-specific residency tests · April 2026</p>
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
                      {popupTier === 67 ? "183-Day Residency Check™" : "Global Residency Strategy™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your specific residency outcome under the statutory test of your departure country, ties assessment, severance checklist, country-specific departure filing guidance, and 5 cross-border accountant questions."
                        : "Full strategy: residency outcome + full ties severance sequence + multi-country overlap analysis + voluntary disclosure assessment + treaty tie-breaker interaction + audit-ready documentation pack + cross-border accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic nomad advice. Your specific country + ties + severance path.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Residency Check →" : "Get My Full Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the check? — $67 instead" : "Want the full strategy? — $147 instead"}
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
                    { label: "Your role", key: "exit_role", options: [["leaving","Leaving current country"],["already_left","Already left — verifying"],["unfiled","Unfiled prior years"],["advisor","Cross-border advisor / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["authority_letter","Tax authority letter / challenge"],["filing_due","Filing deadline approaching"],["planning","Planning departure"]] },
                    { label: "Do you have a cross-border tax advisor?", key: "accountant", options: [["cross_border","Yes — cross-border specialist"],["single_country","Yes — single-country"],["diy","Self-managed"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · Country-specific residency tests referenced</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.riskLevel === "HIGH" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Residency status — high risk</p>
              <p className="text-sm font-bold text-neutral-950">
                Likely still {verdict.result.countryLabel} resident — worldwide income may be taxable
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
