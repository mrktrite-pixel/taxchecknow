"use client";

/**
 * NOMAD-05 — UK Statutory Residence Test Auditor
 * Pattern: GateTest (Module D) — strict sequential SRT layers
 *
 * Legal anchor: Finance Act 2013, Schedule 45 — SRT
 *
 * THREE LAYERS (applied in strict order):
 *
 * LAYER 1 — AUTOMATIC OVERSEAS TESTS (AOTs) — non-residence if any applies:
 *   AOT1: under 16 UK days (AND previously UK resident in prior 3 years)
 *   AOT2: under 46 UK days (AND NOT previously UK resident in prior 3 years)
 *   AOT3: full-time overseas + under 91 UK days + under 31 UK work days
 *
 * LAYER 2 — AUTOMATIC UK TESTS (ARTs) — residence if any applies:
 *   ART1: 183+ UK days
 *   ART2: only home in UK (UK home 91+ continuous days + no overseas home
 *     used 30+ days)
 *   ART3: full-time UK work (35+ hr/wk, 75%+ UK days, no significant breaks)
 *
 * LAYER 3 — SUFFICIENT TIES TEST (days × ties matrix):
 *   Previously resident — 16-45 + 4 ties / 46-90 + 3 ties / 91-120 + 2 ties /
 *     121-182 + 1 tie
 *   Not previously resident — 46-90 + 4 ties / 91-120 + 3 ties / 121-182 + 2 ties
 *
 * 5 UK ties — family / accommodation / work / 90-day / country (prev res only)
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "NON_RESIDENT_AOT1"
  | "NON_RESIDENT_AOT2"
  | "NON_RESIDENT_AOT3"
  | "UK_RESIDENT_ART1"
  | "UK_RESIDENT_ART2"
  | "UK_RESIDENT_ART3"
  | "UK_RESIDENT_SUFFICIENT_TIES"
  | "NON_RESIDENT_SUFFICIENT_TIES"
  | "BORDERLINE";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface SRTResult {
  ukDays:                string;
  daysNumeric:           number;        // representative midpoint for the band
  previouslyUkResident:  string;
  aot3FullTimeOverseas:  string;
  automaticUkTest:       string;

  // Tie presence
  tieFamily:             boolean;
  tieAccommodation:      boolean;
  tieWork:               boolean;
  tie90Day:              boolean;
  tieCountry:            boolean;
  tiesCount:             number;
  tiesList:              string[];

  // Sufficient ties threshold
  tiesRequired:          number | null; // null if outside matrix
  tiesMatrixBand:        string;

  // SRT outcome
  status:                Status;
  statusLabel:           string;
  isResident:            boolean;
  reasoningChain:        Array<{ layer: string; outcome: string; resolved: boolean }>;

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
  result: SRTResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_uk_residency",
  p147: "nomad_147_uk_residency",
};

const DAYS_NUMERIC: Record<string, number> = {
  under_16:  8,
  "16_45":   30,
  "46_90":   68,
  "91_120":  105,
  "121_182": 150,
  "183_plus": 183,
};

const DAYS_LABEL: Record<string, string> = {
  under_16:  "Under 16 days",
  "16_45":   "16-45 days",
  "46_90":   "46-90 days",
  "91_120":  "91-120 days",
  "121_182": "121-182 days",
  "183_plus": "183+ days",
};

function getTiesRequired(ukDays: string, previouslyResident: boolean): number | null {
  if (ukDays === "under_16") return null;
  if (ukDays === "183_plus") return null; // covered by ART1
  if (previouslyResident) {
    if (ukDays === "16_45")   return 4;
    if (ukDays === "46_90")   return 3;
    if (ukDays === "91_120")  return 2;
    if (ukDays === "121_182") return 1;
  } else {
    if (ukDays === "16_45")   return null; // AOT2 covers
    if (ukDays === "46_90")   return 4;
    if (ukDays === "91_120")  return 3;
    if (ukDays === "121_182") return 2;
  }
  return null;
}

function getTiesMatrixBand(ukDays: string, previouslyResident: boolean, tiesRequired: number | null): string {
  if (tiesRequired === null) return "N/A (automatic test resolves)";
  const prefix = previouslyResident ? "Previously resident" : "Not previously resident";
  return `${prefix}, ${DAYS_LABEL[ukDays]}: resident if ties ≥ ${tiesRequired}`;
}

function calcSRT(answers: AnswerMap): SRTResult {
  const ukDays               = String(answers.uk_days                  || "46_90");
  const previouslyUkResident = String(answers.previously_uk_resident   || "yes");
  const aot3FullTimeOverseas = String(answers.aot3_full_time_overseas || "no");
  const automaticUkTest      = String(answers.automatic_uk_test        || "neither");

  const tieFamily            = String(answers.tie_family         || "no") === "yes";
  const tieAccommodation     = String(answers.tie_accommodation  || "no") === "yes";
  const tieWork              = String(answers.tie_work           || "no") === "yes";
  const tie90Day             = String(answers.tie_90_day         || "no") === "yes";
  // Country tie only applies to previously resident
  const tieCountryRaw        = String(answers.tie_country        || "no") === "yes";
  const tieCountry           = tieCountryRaw && previouslyUkResident === "yes";

  const previouslyResident = previouslyUkResident === "yes";
  const daysNumeric = DAYS_NUMERIC[ukDays] ?? 50;

  // Build tie list
  const tiesList: string[] = [];
  if (tieFamily)         tiesList.push("Family tie");
  if (tieAccommodation)  tiesList.push("Accommodation tie");
  if (tieWork)           tiesList.push("Work tie");
  if (tie90Day)          tiesList.push("90-day tie");
  if (tieCountry)        tiesList.push("Country tie");
  const tiesCount = tiesList.length;

  const reasoningChain: SRTResult["reasoningChain"] = [];

  // LAYER 1 — AOTs in order
  let status: Status | null = null;
  let statusLabel = "";

  // AOT1: under 16 days AND previously resident
  if (ukDays === "under_16" && previouslyResident) {
    reasoningChain.push({ layer: "Layer 1 — AOT1", outcome: "Under 16 UK days + previously UK resident in prior 3 years → automatic NON-RESIDENT", resolved: true });
    status = "NON_RESIDENT_AOT1";
    statusLabel = "NON-RESIDENT — AUTOMATIC OVERSEAS TEST 1 (under 16 days)";
  } else if (ukDays === "under_16" && !previouslyResident) {
    // under 16 without prior residence — AOT2 also applies
    reasoningChain.push({ layer: "Layer 1 — AOT1", outcome: "Under 16 UK days but NOT previously resident — AOT1 not applicable", resolved: false });
    reasoningChain.push({ layer: "Layer 1 — AOT2", outcome: "Under 16 UK days + not previously UK resident → automatic NON-RESIDENT (AOT2 satisfied via under-46 threshold)", resolved: true });
    status = "NON_RESIDENT_AOT2";
    statusLabel = "NON-RESIDENT — AUTOMATIC OVERSEAS TEST 2 (under 46 days, not previously resident)";
  } else if (ukDays === "16_45" && !previouslyResident) {
    // AOT2: under 46 AND not previously resident
    reasoningChain.push({ layer: "Layer 1 — AOT1", outcome: "16-45 UK days — AOT1 requires under 16 days", resolved: false });
    reasoningChain.push({ layer: "Layer 1 — AOT2", outcome: "16-45 UK days (under 46) + not previously resident → automatic NON-RESIDENT", resolved: true });
    status = "NON_RESIDENT_AOT2";
    statusLabel = "NON-RESIDENT — AUTOMATIC OVERSEAS TEST 2 (under 46 days, not previously resident)";
  }

  // If still unresolved, check AOT3
  if (status === null) {
    reasoningChain.push({ layer: "Layer 1 — AOT1", outcome: ukDays === "under_16" ? "Not previously resident" : "Days exceed 16", resolved: false });
    reasoningChain.push({ layer: "Layer 1 — AOT2", outcome: previouslyResident ? "Previously UK resident — AOT2 requires not previously resident" : "Days exceed 46", resolved: false });

    if (aot3FullTimeOverseas === "yes") {
      // AOT3 requires full-time overseas + under 91 UK days + under 31 UK work days
      // We accept the user's self-assessment that conditions are met
      if (ukDays === "46_90" || ukDays === "91_120" || ukDays === "16_45" || ukDays === "under_16") {
        // Under 91 days condition met
        reasoningChain.push({ layer: "Layer 1 — AOT3", outcome: "Full-time overseas work + under 91 UK days + under 31 UK work days → automatic NON-RESIDENT", resolved: true });
        status = "NON_RESIDENT_AOT3";
        statusLabel = "NON-RESIDENT — AUTOMATIC OVERSEAS TEST 3 (full-time overseas work)";
      } else {
        reasoningChain.push({ layer: "Layer 1 — AOT3", outcome: "Claimed full-time overseas but UK days ≥ 91 — AOT3 NOT satisfied (requires under 91 UK days)", resolved: false });
      }
    } else {
      reasoningChain.push({ layer: "Layer 1 — AOT3", outcome: "Not full-time overseas — AOT3 not applicable", resolved: false });
    }
  }

  // LAYER 2 — ARTs (if still unresolved)
  if (status === null) {
    if (ukDays === "183_plus") {
      reasoningChain.push({ layer: "Layer 2 — ART1", outcome: "183+ UK days → automatic UK RESIDENT", resolved: true });
      status = "UK_RESIDENT_ART1";
      statusLabel = "UK RESIDENT — AUTOMATIC UK RESIDENCE TEST 1 (183+ days)";
    } else {
      reasoningChain.push({ layer: "Layer 2 — ART1", outcome: "Under 183 UK days — ART1 not applicable", resolved: false });

      if (automaticUkTest === "art2_only_home") {
        reasoningChain.push({ layer: "Layer 2 — ART2", outcome: "Only home in UK (91+ days + no qualifying overseas home) → automatic UK RESIDENT", resolved: true });
        status = "UK_RESIDENT_ART2";
        statusLabel = "UK RESIDENT — AUTOMATIC UK RESIDENCE TEST 2 (only home in UK)";
      } else if (automaticUkTest === "art3_full_time_work") {
        reasoningChain.push({ layer: "Layer 2 — ART2", outcome: "Not only home in UK — ART2 not applicable", resolved: false });
        reasoningChain.push({ layer: "Layer 2 — ART3", outcome: "Full-time UK work (35+ hr/wk, 75%+ UK days, no significant breaks) → automatic UK RESIDENT", resolved: true });
        status = "UK_RESIDENT_ART3";
        statusLabel = "UK RESIDENT — AUTOMATIC UK RESIDENCE TEST 3 (full-time UK work)";
      } else {
        reasoningChain.push({ layer: "Layer 2 — ART2", outcome: "Not only home in UK — ART2 not applicable", resolved: false });
        reasoningChain.push({ layer: "Layer 2 — ART3", outcome: "Not full-time UK work — ART3 not applicable", resolved: false });
      }
    }
  }

  // LAYER 3 — Sufficient Ties Test (if still unresolved)
  let tiesRequired: number | null = null;
  if (status === null) {
    tiesRequired = getTiesRequired(ukDays, previouslyResident);
    if (tiesRequired === null) {
      // Shouldn't happen if AOT1/AOT2 flow was correct; fallback
      status = "NON_RESIDENT_SUFFICIENT_TIES";
      statusLabel = "NON-RESIDENT — SUFFICIENT TIES (no ties threshold for band)";
      reasoningChain.push({ layer: "Layer 3 — Sufficient Ties", outcome: "No threshold applies for this day band", resolved: true });
    } else {
      if (tiesCount >= tiesRequired) {
        status = "UK_RESIDENT_SUFFICIENT_TIES";
        statusLabel = "UK RESIDENT — SUFFICIENT TIES TEST";
        reasoningChain.push({ layer: "Layer 3 — Sufficient Ties", outcome: `${tiesCount} ties at ${DAYS_LABEL[ukDays]} (requires ≥ ${tiesRequired}) → UK RESIDENT`, resolved: true });
      } else {
        // Check borderline — 1 tie or 1 day band away
        const oneAway = (tiesCount + 1) >= tiesRequired;
        if (oneAway) {
          status = "BORDERLINE";
          statusLabel = "BORDERLINE — 1 TIE SHORT OF UK RESIDENCY";
          reasoningChain.push({ layer: "Layer 3 — Sufficient Ties", outcome: `${tiesCount} ties at ${DAYS_LABEL[ukDays]} (requires ≥ ${tiesRequired}) → NON-RESIDENT but 1 tie away`, resolved: true });
        } else {
          status = "NON_RESIDENT_SUFFICIENT_TIES";
          statusLabel = "NON-RESIDENT — SUFFICIENT TIES TEST";
          reasoningChain.push({ layer: "Layer 3 — Sufficient Ties", outcome: `${tiesCount} ties at ${DAYS_LABEL[ukDays]} (requires ≥ ${tiesRequired}) → NON-RESIDENT`, resolved: true });
        }
      }
    }
  }

  const tiesMatrixBand = getTiesMatrixBand(ukDays, previouslyResident, tiesRequired);
  const isResident = status === "UK_RESIDENT_ART1" || status === "UK_RESIDENT_ART2" || status === "UK_RESIDENT_ART3" || status === "UK_RESIDENT_SUFFICIENT_TIES";

  // Routing
  const routes: Route[] = [];
  if (isResident) {
    routes.push({ label: "UK Allowance Sniper — UK resident analysis", href: "/uk/check/allowance-sniper", note: "Full UK resident filing + allowances + dividend tax" });
    routes.push({ label: "Tax Treaty Navigator — if dual resident", href: "/nomad/check/tax-treaty-navigator", note: "If also resident in another country, treaty tie-breaker may apply" });
  } else {
    routes.push({ label: "183-Day Rule Reality Check — cross-verify", href: "/nomad/check/183-day-rule", note: "Full country-by-country residency test check" });
    routes.push({ label: "Exit Tax Trap Auditor — if departing with assets", href: "/nomad/check/exit-tax-trap", note: "UK temporary non-residence claw-back if return within 5 years" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    ukDays, daysNumeric, previouslyUkResident, aot3FullTimeOverseas, automaticUkTest,
    tieFamily, tieAccommodation, tieWork, tie90Day, tieCountry,
    tiesCount, tiesList,
    tiesRequired, tiesMatrixBand,
    status: status ?? "NON_RESIDENT_SUFFICIENT_TIES",
    statusLabel,
    isResident,
    reasoningChain,
    routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcSRT(answers);

  const isNonResident = !result.isResident;
  const headline = (() => {
    if (result.status === "NON_RESIDENT_AOT1") return `You meet Automatic Overseas Test 1 (under 16 UK days + previously UK resident in prior 3 years). You are NOT UK tax resident for the 2025/26 tax year. Only UK-source income (e.g. UK employment, UK property, UK dividends) is taxable in the UK. Worldwide income is outside UK scope.`;
    if (result.status === "NON_RESIDENT_AOT2") return `You meet Automatic Overseas Test 2 (under 46 UK days + not previously UK resident in prior 3 years). You are NOT UK tax resident for the 2025/26 tax year. Only UK-source income is taxable in the UK. This is the cleanest non-residence outcome for first-time arrivals or those who have been out long enough.`;
    if (result.status === "NON_RESIDENT_AOT3") return `You meet Automatic Overseas Test 3 (full-time overseas work + under 91 UK days + under 31 UK work days). You are NOT UK tax resident for the 2025/26 tax year. Only UK-source income is taxable in the UK. Keep evidence of the full-time overseas work condition — HMRC may request it.`;
    if (result.status === "UK_RESIDENT_ART1") return `You meet Automatic UK Residence Test 1 (183+ UK days in the tax year). You ARE UK tax resident. Your worldwide income is taxable in the UK. This test is absolute — ties are irrelevant when 183+ days are present.`;
    if (result.status === "UK_RESIDENT_ART2") return `You meet Automatic UK Residence Test 2 (only home in UK). You ARE UK tax resident. Your worldwide income is taxable in the UK. The 'only home' test applies when you have a UK home for 91+ continuous days AND no overseas home used 30+ days in the year.`;
    if (result.status === "UK_RESIDENT_ART3") return `You meet Automatic UK Residence Test 3 (full-time UK work). You ARE UK tax resident. Your worldwide income is taxable in the UK. Full-time UK work (35+ hr/wk, 75%+ UK work days, no significant breaks) makes you UK resident regardless of day count.`;
    if (result.status === "UK_RESIDENT_SUFFICIENT_TIES") return `You meet the Sufficient Ties Test: ${result.tiesCount} UK ties at ${DAYS_LABEL[result.ukDays]} (${result.previouslyUkResident === "yes" ? "previously resident" : "not previously resident"} — requires ≥ ${result.tiesRequired}). You ARE UK tax resident. Your worldwide income is taxable in the UK. The sufficient ties test is the second most common path to UK residency after the 183-day automatic test.`;
    if (result.status === "BORDERLINE") return `You are 1 tie short of UK residence under the sufficient ties test. At ${result.tiesCount} ties and ${DAYS_LABEL[result.ukDays]}, you are NOT UK tax resident — but acquiring one additional tie (new UK property, UK work days over 40, UK partner) would flip you into UK residence. Only UK-source income is currently taxable.`;
    return `At ${result.tiesCount} ties and ${DAYS_LABEL[result.ukDays]} (requires ≥ ${result.tiesRequired} to be UK resident), you are NOT UK tax resident. Only UK-source income is taxable in the UK.`;
  })();

  const consequences: string[] = [];

  if (result.isResident) {
    consequences.push(`🔒 UK tax resident — under ${result.statusLabel}. UK tax scope: WORLDWIDE income (employment, self-employment, rental, dividends, interest, capital gains) — not just UK-source.`);
    consequences.push("Filing obligation: UK Self Assessment return (SA100) — online deadline 31 January following tax year end; paper deadline 31 October. Pages required: SA100 + SA109 (Residence) + SA106 (Foreign) + SA108 (Capital Gains) + others as relevant.");
    consequences.push("Foreign tax credit: available for foreign tax paid on the same income (Section 6 TIOPA 2010). Prevents double taxation on foreign-source income.");
    consequences.push("Remittance basis: available only for non-domiciled UK residents (separate and specific regime; £30k+ annual charge for long-term residents). Does not change whether you are resident — changes how foreign-source unremitted income is taxed.");
    consequences.push("Dual residency check: if also tax resident in another country under its domestic law, the applicable treaty tie-breaker (OECD Article 4) may shift primary taxing rights. See /nomad/check/tax-treaty-navigator.");
    if (result.tiesCount > 0 && result.status === "UK_RESIDENT_SUFFICIENT_TIES") {
      consequences.push(`Tie reduction opportunity for future years: your current ties are ${result.tiesList.join(", ")}. Each tie can be targeted specifically (sell/end UK home → accommodation tie removed; relocate family → family tie removed; limit UK work days under 40 → work tie removed; wait 2 years without 90+ UK days → 90-day tie falls away). See tier 2 tie reduction plan.`);
    }
    consequences.push("Penalty risk: failure to notify HMRC of UK residence (by 5 October following tax year end) = £100 automatic penalty + further daily penalties. Failure to file Self Assessment = £100 + £10 per day after 3 months + 5% of tax due. Notification + filing in time, even if tax due, prevents this escalation.");
    consequences.push("Voluntary disclosure: if you have been filing as non-resident incorrectly, HMRC's Worldwide Disclosure Facility (or tailored disclosure route) reduces penalties substantially. Disclose BEFORE HMRC contact for best terms.");
  } else {
    consequences.push(`✓ NOT UK tax resident — under ${result.statusLabel}. UK tax scope: UK-source income ONLY (UK employment physically performed in UK; UK-located property rental; UK company dividends; UK-source interest; UK-specific capital gains e.g. UK residential property under NR CGT).`);
    consequences.push("Filing obligation: UK Self Assessment may still be required if you have UK-source income. Use SA109 (Residence) to claim non-resident status. Non-resident CGT return required within 60 days for UK residential property disposals.");
    consequences.push("Foreign-source income: outside UK scope for non-residents. Overseas employment, rental, investment returns remain untaxed by the UK (subject to UK-source withholding on some interest/dividends).");
    consequences.push("Temporary non-residence risk (TCGA 1992 s10A / ITA 2007 s812C): if you return to UK within 5 complete UK tax years, certain gains and income accrued abroad during the absence can be attributed back to the UK on return. Plan 5+ year absence for clean claw-back avoidance.");
    consequences.push(`Evidence to retain: passport with entry/exit stamps; flight records; accommodation evidence (overseas lease/title + UK property status); work logs showing UK vs overseas days; family location evidence (spouse, children). HMRC may challenge non-residence position years later — evidence must be assembled contemporaneously.`);
    if (result.status === "BORDERLINE") {
      consequences.push(`⚠ Borderline warning: at ${result.tiesCount} ties and ${DAYS_LABEL[result.ukDays]}, one additional tie would flip you into UK residence. Changes to watch: acquiring UK property (accommodation tie); spending 40+ UK work days (work tie); UK partner moving in (family tie); crossing 90+ UK days in a year (90-day tie for future years). Annual reassessment essential.`);
    }
    consequences.push("Annual reassessment: SRT applies to each tax year independently — prior year non-residence does not carry forward automatically. Day count + tie count changes year-to-year require fresh application of the SRT.");
  }

  const statusClass = isNonResident ? "text-emerald-700" : "text-red-700";
  const panelClass = isNonResident ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50";

  const confidence: ConfidenceLevel = (result.status === "BORDERLINE") ? "MEDIUM" : "HIGH";
  const confidenceNote = result.status === "BORDERLINE"
    ? "Borderline — 1 tie short of UK residency. Annual reassessment essential; any change in ties could flip the outcome."
    : "SRT outcome determined by the test that resolved your position. Evidence retention required for future HMRC review.";

  const tier: Tier = result.isResident || result.status === "BORDERLINE" ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "UK days this year",       value: DAYS_LABEL[result.ukDays]                                 },
      { label: "Previously UK resident",    value: result.previouslyUkResident === "yes" ? "Yes" : "No"     },
      { label: "UK ties count",             value: String(result.tiesCount),                                  highlight: result.tiesCount >= 3 },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My UK Residency Strategy — £147 →" : "Get My UK Residency Decision Pack — £67 →",
    altTierLabel: tier === 147 ? "Just want the decision? — £67 instead" : "Want tie reduction + strategy? — £147",
    productKey67: PRODUCT_KEYS.p67,
    productKey147: PRODUCT_KEYS.p147,
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
    id: "uk_days", step: 1, type: "button_group",
    label: "Days in UK this tax year (6 April – 5 April)?",
    subLabel: "Count days you were present in UK at midnight. Transit days generally excluded.",
    options: [
      { label: "Under 16 days",        value: "under_16", subLabel: "AOT1 territory if previously resident" },
      { label: "16 to 45 days",          value: "16_45",   subLabel: "Sufficient ties test applies" },
      { label: "46 to 90 days",          value: "46_90",   subLabel: "Sufficient ties territory" },
      { label: "91 to 120 days",         value: "91_120", subLabel: "Sufficient ties territory" },
      { label: "121 to 182 days",        value: "121_182", subLabel: "Sufficient ties territory" },
      { label: "183 or more days",        value: "183_plus", subLabel: "Automatic UK residence (ART1)" },
    ],
    required: true,
  },
  {
    id: "previously_uk_resident", step: 2, type: "button_group",
    label: "Were you UK tax resident in any of the previous 3 tax years?",
    subLabel: "Affects which AOT applies (AOT1 vs AOT2) AND the sufficient ties threshold. Country tie only available to previously resident.",
    options: [
      { label: "Yes — previously UK resident",          value: "yes", subLabel: "AOT1 may apply; 4 ties needed at 16-45 days" },
      { label: "No — NOT previously UK resident",         value: "no",  subLabel: "AOT2 may apply at under 46 days; different ties threshold" },
    ],
    required: true,
  },
  {
    id: "aot3_full_time_overseas", step: 3, type: "button_group",
    label: "AOT3 — full-time overseas work + under 91 UK days + under 31 UK work days?",
    subLabel: "Full-time = average 35+ hours/week overseas with no significant breaks (over 31 days without overseas work).",
    options: [
      { label: "Yes — AOT3 conditions met",           value: "yes", subLabel: "Automatic NON-RESIDENT" },
      { label: "No / not applicable",                    value: "no",  subLabel: "Move to next layer" },
    ],
    required: true,
  },
  {
    id: "automatic_uk_test", step: 4, type: "button_group",
    label: "Automatic UK Tests — does one apply? (skip if already non-resident under AOTs)",
    subLabel: "ART2 — only home in UK (UK home 91+ days + no overseas home used 30+ days). ART3 — full-time UK work (35+ hr/wk, 75%+ UK days, no significant breaks).",
    options: [
      { label: "ART2 — only home is in UK",           value: "art2_only_home",       subLabel: "Automatic UK RESIDENT" },
      { label: "ART3 — full-time work in UK",          value: "art3_full_time_work", subLabel: "Automatic UK RESIDENT" },
      { label: "Neither applies",                        value: "neither",              subLabel: "Move to sufficient ties test" },
    ],
    required: true,
  },
  {
    id: "tie_family", step: 5, type: "two_button",
    label: "Family tie — UK-resident spouse/civil partner OR minor child AND seen during year?",
    subLabel: "Both conditions required: the relative is UK tax resident AND you saw them in person during the year.",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No",  value: "no" },
    ],
    required: true,
  },
  {
    id: "tie_accommodation", step: 5, type: "two_button",
    label: "Accommodation tie — accessible UK home for 91+ continuous days AND used 1+ night?",
    subLabel: "Close relative's home counts only if used 16+ nights in the year.",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No",  value: "no" },
    ],
    required: true,
  },
  {
    id: "tie_work", step: 5, type: "two_button",
    label: "Work tie — 40+ days of substantive UK work (3+ hours) in the year?",
    subLabel: "Both employed and self-employed UK work counts; partial days (3+ hours) count.",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No",  value: "no" },
    ],
    required: true,
  },
  {
    id: "tie_90_day", step: 5, type: "two_button",
    label: "90-day tie — 90+ UK days in EITHER of the previous 2 tax years?",
    subLabel: "Look at each prior year separately — either year independently having 90+ days triggers this tie.",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No",  value: "no" },
    ],
    required: true,
  },
  {
    id: "tie_country", step: 5, type: "two_button",
    label: "Country tie — UK is the country where you spent the MOST days this year? (previously resident only)",
    subLabel: "Single comparison per country — if UK is highest, country tie applies. Only applies to previously-UK-resident individuals.",
    options: [
      { label: "Yes — UK is highest", value: "yes" },
      { label: "No / not previously resident", value: "no" },
    ],
    required: true,
    showIf: (a) => a.previously_uk_resident === "yes",
  },
];

const TOTAL_STEPS = 5;

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

      {/* SRT logic chain — always visible */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">SRT applied in sequence — Finance Act 2013 Schedule 45</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (verdict.result.isResident ? "bg-red-100" : "bg-emerald-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (verdict.result.isResident ? "text-red-700" : "text-emerald-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (verdict.result.isResident ? "text-red-700" : "text-emerald-700") : "text-neutral-700"}`}>{r.layer}</p>
                <p className="text-xs text-neutral-700">{r.outcome}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Ties breakdown when sufficient ties test applied */}
      {result.tiesCount > 0 && (result.status === "UK_RESIDENT_SUFFICIENT_TIES" || result.status === "NON_RESIDENT_SUFFICIENT_TIES" || result.status === "BORDERLINE") && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your UK ties + matrix band</p>
          <ul className="space-y-1 text-neutral-800">
            {result.tiesList.map((t, i) => <li key={i}>✓ {t}</li>)}
          </ul>
          <p className="mt-2 pt-2 border-t border-neutral-200 text-neutral-600"><strong>Matrix band:</strong> {result.tiesMatrixBand}</p>
          <p className="mt-1 text-neutral-600"><strong>Your ties:</strong> {result.tiesCount} · <strong>Threshold:</strong> {result.tiesRequired ?? "N/A"}</p>
        </div>
      )}

      {/* Tax scope visual */}
      <div className={`mb-4 rounded-xl border-2 px-4 py-3 text-sm ${verdict.result.isResident ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"}`}>
        <p className={`mb-1 font-mono text-[10px] uppercase tracking-widest ${verdict.result.isResident ? "text-red-700" : "text-emerald-700"}`}>UK tax scope</p>
        <p className={`font-bold ${verdict.result.isResident ? "text-red-900" : "text-emerald-900"}`}>
          {verdict.result.isResident ? "WORLDWIDE income taxable in the UK" : "UK-SOURCE income only taxable in the UK"}
        </p>
        <p className={`mt-1 text-xs ${verdict.result.isResident ? "text-red-800" : "text-emerald-800"}`}>
          {verdict.result.isResident ? "Employment (any country), rental (any country), dividends, interest, capital gains — all UK-taxable for UK residents." : "Foreign-source income (overseas employment, overseas rental, overseas investments) is outside UK scope. UK employment, UK property, UK company dividends remain taxable."}
        </p>
      </div>

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — UK engines + cross-check + nomad index</p>
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
          <strong className="text-neutral-950">SRT is deterministic but layered.</strong> AOTs → ARTs → sufficient ties — applied in strict order. Day count alone is never the test; ties matter equally or more. The test must be applied fresh to each tax year&apos;s facts.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Which SRT test resolved your position with exact reasoning</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Tie-by-tie assessment with HMRC definitions</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Filing obligations (SA100 + SA109 + relevant supplementary pages)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Split year treatment eligibility (Cases 1-8)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Tie reduction plan for future-year non-residence (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 UK tax advisor questions</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">£{verdict.tier} · One-time · Built around your exact SRT position</p>
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
      <h2 className="mb-1 font-serif text-base font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-xs text-neutral-500">{q.subLabel}</p>}

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

export default function UkResidencyCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ filing_role: "", urgency: "", accountant: "" });
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
        product_slug: "uk-residency",
        source_path: "/nomad/check/uk-residency",
        country_code: "UK", currency_code: "GBP", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          srt_status: verdict.result.status,
          is_resident: verdict.result.isResident,
          ties_count: verdict.result.tiesCount,
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
      body: JSON.stringify({ email, source: "uk_residency", country_code: "UK", site: "taxchecknow" }),
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
    const sid = sessionId || `uksrt_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("uk-residency_uk_days", String(answers.uk_days || ""));
    sessionStorage.setItem("uk-residency_previously_uk_resident", String(answers.previously_uk_resident || ""));
    sessionStorage.setItem("uk-residency_aot3_full_time_overseas", String(answers.aot3_full_time_overseas || ""));
    sessionStorage.setItem("uk-residency_automatic_uk_test", String(answers.automatic_uk_test || ""));
    sessionStorage.setItem("uk-residency_ties_count", String(verdict.result.tiesCount));
    sessionStorage.setItem("uk-residency_srt_status", verdict.result.status);
    sessionStorage.setItem("uk-residency_is_resident", String(verdict.result.isResident));
    sessionStorage.setItem("uk-residency_status", verdict.status);
    sessionStorage.setItem("uk-residency_tier", String(popupTier));

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
          success_url: `${window.location.origin}/nomad/check/uk-residency/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad/check/uk-residency`,
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
            {step === 5 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p><strong>UK Ties — Step 5:</strong> Answer each tie question below. The sufficient ties matrix combines your UK days (Step 1) with the number of ties that apply.</p>
              </div>
            )}
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your SRT decision for your UK tax advisor.</p>
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
                    {popupTier === 67 ? "Your UK Residency Decision Pack" : "Your UK Residency Strategy System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">Finance Act 2013 Sch 45 · HMRC SRT · April 2026</p>
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
                      {popupTier === 67 ? "UK Residency Decision Pack™" : "UK Residency Strategy System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your specific SRT outcome, tie-by-tie assessment, filing obligations, split-year eligibility, and 5 UK tax advisor questions."
                        : "Full strategy: SRT decision + tie reduction plan + residency optimisation sequence + dual-residency treaty tie-breaker + UK-source income management + audit-ready documentation pack."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">£{popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic UK tax content. Your specific SRT outcome + tie-reduction path.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My UK Decision →" : "Get My UK Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the decision? — £67 instead" : "Want the full strategy? — £147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">£{popupTier}</p>
                  </div>
                  {[
                    { label: "Your role", key: "filing_role", options: [["leaving_uk","Leaving UK — planning"],["returning_uk","Returning to UK — SRT check"],["expat","UK expat maintaining UK ties"],["advisor","UK tax advisor / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["hmrc_letter","HMRC letter / compliance enquiry"],["filing_deadline","Self Assessment deadline approaching"],["planning","Planning next year"]] },
                    { label: "Do you have a UK tax advisor?", key: "accountant", options: [["icaew_citot","Yes — ICAEW / CIOT / ATT qualified"],["general","Yes — general accountant"],["diy","Self-managed"],["none","No — need one"]] },
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
                    {loading ? "Redirecting to Stripe…" : `Pay £${popupTier} →`}
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · HMRC SRT (Finance Act 2013 Sch 45)</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.isResident && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">UK resident — worldwide income</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.result.statusLabel}
              </p>
            </div>
            <button onClick={() => openPopup(verdict.tier)}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white whitespace-nowrap">
              From £67 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
