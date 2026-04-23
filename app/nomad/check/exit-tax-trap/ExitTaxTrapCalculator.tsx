"use client";

/**
 * NOMAD-04 — Exit Tax Trap Auditor
 * Pattern: Classification (Module C) + Timeline (Module B)
 *
 * Country-specific exit tax rules — NEVER universal. Calculator classifies
 * exposure by departure country, timing, asset mix, and prior advice status.
 *
 * COUNTRY RULES:
 *   Canada (ITA s128.1): deemed disposition on departure — worldwide property
 *     at FMV on departure day. Form T1244 deferral election available.
 *   Australia (ITAA 1997 s118-110 + s104-165): no exit tax BUT non-residents
 *     lose main residence CGT exemption + 50% CGT discount on AU property.
 *   United Kingdom (TCGA 1992 s10A + s14D): no exit tax BUT temporary non-
 *     residence claw-back within 5 years + non-resident CGT on UK property.
 *   United States (IRC §877A): expatriation tax on covered expatriates
 *     (net worth over $2M / avg tax over $201k / non-compliance) — deemed
 *     sale of worldwide assets with $821k exclusion (2026).
 *   New Zealand: NO exit tax — but bright-line + FIF continue to apply.
 *
 * Verdict paths:
 *   CA_DEEMED_DISPOSITION_HIGH        — Canada + shares/property exposure
 *   AU_MAIN_RESIDENCE_TRAP             — Australia + property held
 *   US_EXPATRIATION_TAX_TRIGGERED     — US renouncing + covered expatriate
 *   UK_TEMPORARY_NONRESIDENCE_RISK     — UK + recent departure within 5 yr
 *   NZ_NO_EXIT_TAX_CLEAR               — NZ + minimal departure event
 *   PAST_DEPARTURE_VOLUNTARY_DISCLOSURE — Already departed without advice
 *   FUTURE_PLANNING_OPPORTUNITY        — Planning ahead — pre-departure levers
 *   NO_MATERIAL_ASSETS                   — No significant asset exposure
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "CA_DEEMED_DISPOSITION_HIGH"
  | "CA_DEEMED_DISPOSITION_MEDIUM"
  | "AU_MAIN_RESIDENCE_TRAP"
  | "AU_NON_RESIDENT_RATES"
  | "US_EXPATRIATION_TAX_TRIGGERED"
  | "UK_TEMPORARY_NONRESIDENCE_RISK"
  | "UK_NR_CGT_ON_PROPERTY"
  | "NZ_NO_EXIT_TAX_CLEAR"
  | "PAST_DEPARTURE_VOLUNTARY_DISCLOSURE"
  | "FUTURE_PLANNING_OPPORTUNITY"
  | "NO_MATERIAL_ASSETS";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface ExitResult {
  departureCountry:   string;
  departureTiming:    string;
  assetTypes:         string;
  adviceTaken:        string;
  assetsSoldSince:    string;

  countryLabel:       string;
  primaryRule:        string;
  timingLabel:        string;

  status:             Status;
  statusLabel:        string;
  riskLevel:          "LOW" | "MEDIUM" | "HIGH";

  exitTaxApplies:     boolean;
  deferralAvailable:  boolean;
  voluntaryDisclosureOpen: boolean;
  prePlanningPossible: boolean;

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
  result: ExitResult;
}

interface PopupAnswers {
  departure_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_exit_tax_trap",
  p147: "nomad_147_exit_tax_trap",
};

const COUNTRY_LABEL: Record<string, string> = {
  ca:    "Canada",
  au:    "Australia",
  uk:    "United Kingdom",
  us:    "United States",
  nz:    "New Zealand",
  other: "Other jurisdiction",
};

const PRIMARY_RULE: Record<string, string> = {
  ca:    "Deemed disposition on departure (Income Tax Act s128.1) — worldwide property at FMV on departure day",
  au:    "No exit tax BUT non-residents lose main residence CGT exemption (ITAA 1997 s118-110) and 50% CGT discount (s104-165)",
  uk:    "No exit tax BUT temporary non-residence claw-back (TCGA 1992 s10A) within 5 years + non-resident CGT on UK property (s14D)",
  us:    "Expatriation tax on covered expatriates (IRC §877A) — deemed sale of worldwide assets, $821k exclusion (2026)",
  nz:    "No exit tax — but bright-line property rule and FIF rules continue to apply",
  other: "Country-specific rule — verify with national tax authority",
};

const TIMING_LABEL: Record<string, string> = {
  past_2_plus:       "Already departed — over 2 years ago",
  past_within_2:     "Already departed — within last 2 years",
  future_within_12:  "Planning to depart — within 12 months",
  future_long:       "Considering departure — 2+ years away",
};

const COUNTRY_ROUTE: Record<string, Route> = {
  ca: { label: "Canada — specialist cross-border advice",                      href: "/nomad",                                  note: "No dedicated CA engine — seek specialist Canadian advice on s128.1" },
  au: { label: "AU CGT Main Residence Trap — main residence + CGT treatment",   href: "/au/check/cgt-main-residence-trap",        note: "Main residence rules for AU property + non-resident CGT treatment" },
  uk: { label: "UK Allowance Sniper — allowances + CGT + temp non-residence",   href: "/uk/check/allowance-sniper",               note: "UK allowances + dividend tax + SRT position" },
  us: { label: "US FEIE Nomad Auditor — worldwide taxation for citizens",       href: "/us/check/feie-nomad-auditor",             note: "US citizens: FEIE §911 + expatriation analysis" },
  nz: { label: "NZ Bright-Line Property Tax Decision Engine",                   href: "/nz/check/bright-line-auditor",            note: "NZ bright-line + property sale timing" },
  other: { label: "Nomad Residency Risk Index",                                  href: "/nomad",                                  note: "Start with residency classification" },
};

function calcExit(answers: AnswerMap): ExitResult {
  const departureCountry = String(answers.departure_country || "ca");
  const departureTiming  = String(answers.departure_timing  || "future_within_12");
  const assetTypes       = String(answers.asset_types        || "shares");
  const adviceTaken      = String(answers.advice_taken       || "no");
  const assetsSoldSince  = String(answers.assets_sold_since || "no");

  const countryLabel = COUNTRY_LABEL[departureCountry] || departureCountry;
  const primaryRule  = PRIMARY_RULE[departureCountry]  || PRIMARY_RULE.other;
  const timingLabel  = TIMING_LABEL[departureTiming]   || departureTiming;

  const isPastDeparture = departureTiming === "past_2_plus" || departureTiming === "past_within_2";
  const isPastWithoutAdvice = isPastDeparture && (adviceTaken === "no" || adviceTaken === "yes_uncertain");
  const isFutureDeparture = departureTiming === "future_within_12" || departureTiming === "future_long";

  // Status determination — country + asset + timing + advice composite
  let status: Status;

  if (assetTypes === "none") {
    status = "NO_MATERIAL_ASSETS";
  } else if (isPastWithoutAdvice && (departureCountry === "ca" || departureCountry === "us" || (departureCountry === "au" && assetTypes === "property"))) {
    // Past departure without advice in country with material exit rule = VDP opportunity
    status = "PAST_DEPARTURE_VOLUNTARY_DISCLOSURE";
  } else if (departureCountry === "ca") {
    // Canada always has deemed disposition risk
    if (assetTypes === "shares" || assetTypes === "business" || assetTypes === "crypto" || assetTypes === "options") {
      status = "CA_DEEMED_DISPOSITION_HIGH";
    } else {
      status = "CA_DEEMED_DISPOSITION_MEDIUM";
    }
  } else if (departureCountry === "au") {
    if (assetTypes === "property") {
      status = "AU_MAIN_RESIDENCE_TRAP";
    } else if (assetTypes === "shares" || assetTypes === "business") {
      status = "AU_NON_RESIDENT_RATES";
    } else {
      status = isFutureDeparture ? "FUTURE_PLANNING_OPPORTUNITY" : "AU_NON_RESIDENT_RATES";
    }
  } else if (departureCountry === "us") {
    status = "US_EXPATRIATION_TAX_TRIGGERED";
  } else if (departureCountry === "uk") {
    if (assetTypes === "property") {
      status = "UK_NR_CGT_ON_PROPERTY";
    } else if (departureTiming === "past_within_2" || departureTiming === "future_within_12") {
      status = "UK_TEMPORARY_NONRESIDENCE_RISK";
    } else {
      status = isFutureDeparture ? "FUTURE_PLANNING_OPPORTUNITY" : "UK_TEMPORARY_NONRESIDENCE_RISK";
    }
  } else if (departureCountry === "nz") {
    status = "NZ_NO_EXIT_TAX_CLEAR";
  } else {
    status = isFutureDeparture ? "FUTURE_PLANNING_OPPORTUNITY" : "PAST_DEPARTURE_VOLUNTARY_DISCLOSURE";
  }

  const statusLabel = {
    CA_DEEMED_DISPOSITION_HIGH:          "CANADA — HIGH DEEMED DISPOSITION EXPOSURE (s128.1)",
    CA_DEEMED_DISPOSITION_MEDIUM:         "CANADA — DEEMED DISPOSITION APPLIES (s128.1)",
    AU_MAIN_RESIDENCE_TRAP:                "AUSTRALIA — MAIN RESIDENCE EXEMPTION TRAP",
    AU_NON_RESIDENT_RATES:                  "AUSTRALIA — NON-RESIDENT CGT TREATMENT",
    US_EXPATRIATION_TAX_TRIGGERED:          "UNITED STATES — EXPATRIATION TAX (IRC §877A)",
    UK_TEMPORARY_NONRESIDENCE_RISK:        "UK — TEMPORARY NON-RESIDENCE CLAW-BACK RISK",
    UK_NR_CGT_ON_PROPERTY:                   "UK — NON-RESIDENT CGT ON UK PROPERTY",
    NZ_NO_EXIT_TAX_CLEAR:                    "NEW ZEALAND — NO EXIT TAX (BRIGHT-LINE / FIF MAY CONTINUE)",
    PAST_DEPARTURE_VOLUNTARY_DISCLOSURE:     "PAST DEPARTURE — VOLUNTARY DISCLOSURE OPPORTUNITY",
    FUTURE_PLANNING_OPPORTUNITY:              "FUTURE PLANNING OPPORTUNITY — PRE-DEPARTURE LEVERS AVAILABLE",
    NO_MATERIAL_ASSETS:                        "NO MATERIAL ASSETS — MINIMAL EXIT TAX EXPOSURE",
  }[status];

  const riskLevel: ExitResult["riskLevel"] =
    (status === "CA_DEEMED_DISPOSITION_HIGH" || status === "AU_MAIN_RESIDENCE_TRAP" || status === "US_EXPATRIATION_TAX_TRIGGERED" || status === "PAST_DEPARTURE_VOLUNTARY_DISCLOSURE") ? "HIGH"
    : (status === "CA_DEEMED_DISPOSITION_MEDIUM" || status === "AU_NON_RESIDENT_RATES" || status === "UK_TEMPORARY_NONRESIDENCE_RISK" || status === "UK_NR_CGT_ON_PROPERTY") ? "MEDIUM"
    : "LOW";

  const exitTaxApplies = status === "CA_DEEMED_DISPOSITION_HIGH" || status === "CA_DEEMED_DISPOSITION_MEDIUM" || status === "US_EXPATRIATION_TAX_TRIGGERED";
  const deferralAvailable = departureCountry === "ca" && exitTaxApplies;
  const voluntaryDisclosureOpen = isPastDeparture && (adviceTaken === "no" || adviceTaken === "yes_uncertain");
  const prePlanningPossible = isFutureDeparture;

  // Build routes
  const routes: Route[] = [];
  const countryRoute = COUNTRY_ROUTE[departureCountry];
  if (countryRoute) routes.push(countryRoute);
  // Always offer residency check cross-link
  routes.push({ label: "183-Day Rule Reality Check — confirm residency status first", href: "/nomad/check/183-day-rule", note: "Exit tax only triggers if residency has actually ceased under domestic test" });
  routes.push({ label: "Tax Treaty Navigator — if dual-resident under treaty", href: "/nomad/check/tax-treaty-navigator", note: "Treaty tie-breaker may affect which country's exit tax applies" });
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    departureCountry, departureTiming, assetTypes, adviceTaken, assetsSoldSince,
    countryLabel, primaryRule, timingLabel,
    status, statusLabel, riskLevel,
    exitTaxApplies, deferralAvailable, voluntaryDisclosureOpen, prePlanningPossible,
    routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcExit(answers);

  if (result.status === "CA_DEEMED_DISPOSITION_HIGH") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Canada's deemed disposition rule under Income Tax Act s128.1 applies to your departure. On departure day, you are treated as having sold most worldwide property (shares, business interests, options, crypto) at fair market value. Capital gain = FMV at departure MINUS adjusted cost base. This tax is payable in your final Canadian return regardless of whether you actually sell. Form T1244 deferral election is available — pre-departure planning is material.`,
      stats: [
        { label: "Departure country",      value: "Canada",                                highlight: true },
        { label: "Applicable rule",          value: "s128.1 deemed disposition",           highlight: true },
        { label: "Exposure",                  value: "HIGH — most assets at FMV",          highlight: true },
      ],
      consequences: [
        `🔒 Income Tax Act s128.1 deemed disposition: on ceasing Canadian tax residency, you are treated as having disposed of most worldwide property at FMV on the departure date. This crystallises capital gain on unrealised appreciation — regardless of actual sale.`,
        `Exceptions: Canadian real property, Canadian business assets used in a Canadian business, and certain pension rights are NOT subject to deemed disposition. Most shares / investment portfolios / business interests / options / cryptocurrency ARE subject.`,
        "Deferral option: Form T1244 election allows you to defer payment of the departure tax by posting acceptable security with CRA (cash, bank guarantee, or other). The deferred tax is payable when the asset is actually sold — or at latest over 10 years. The election preserves cash flow; it does not reduce the tax.",
        "Pre-departure planning levers: (1) realise capital losses on loss-position assets BEFORE departure to directly offset deemed gains; (2) use lifetime capital gains exemption on qualifying small business shares (and qualifying farm/fishing property); (3) time departure across tax year boundary — a December 31 vs January 1 departure shifts the deemed disposition into different tax years; (4) consider asset-specific timing (e.g. exercise vested stock options before departure if advantageous).",
        "Departure-year filing: file T1 return for the departure year with Schedule 3 capital gains, Form T1161 (list of properties), and T1244 election if deferring. The return is due 30 April of the following year (or 15 June for self-employed).",
        "Voluntary disclosure: if you have already departed without filing correctly, CRA's Voluntary Disclosures Program (VDP) reduces penalties significantly. Pre-disclosure contact required. Disclose BEFORE CRA contact.",
        "Action urgency: if your departure is upcoming, engage a Canadian cross-border tax specialist NOW. Post-departure, the planning levers are no longer available and the tax liability is fixed at your departure-day FMV.",
      ],
      confidence: "HIGH",
      confidenceNote: "Canada deemed disposition is statutory and severe. Pre-departure planning materially reduces exposure; post-departure, only deferral + voluntary disclosure remain.",
      tier: 147,
      ctaLabel: "Get My Canada Exit Tax Strategy — $147 →",
      altTierLabel: "Just want the exposure estimate? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "CA_DEEMED_DISPOSITION_MEDIUM") {
    return {
      status: result.statusLabel,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Canada's deemed disposition rule (Income Tax Act s128.1) applies to your departure. Your stated asset mix has partial exposure — some assets are subject to deemed disposition (most shares / business interests / crypto) and some are excepted (Canadian real property, Canadian business assets, certain pensions). A specific asset-by-asset analysis is needed to quantify the exposure.`,
      stats: [
        { label: "Departure country",      value: "Canada",                              highlight: true },
        { label: "Applicable rule",          value: "s128.1 deemed disposition",         highlight: true },
        { label: "Exposure",                  value: "MEDIUM — mixed asset exposure",    highlight: true },
      ],
      consequences: [
        `⚠ Income Tax Act s128.1 deemed disposition applies on ceasing Canadian tax residency. Scope depends on asset type: most worldwide property is captured; Canadian real property, Canadian business assets, and certain pensions are excepted.`,
        "Asset-by-asset review required: list every property held at the departure date with FMV and ACB per asset. Identify which are within scope and which are excepted. Quantify the deemed gain.",
        "Form T1161 (List of Properties Owned at the Time of Emigration): required with departure-year return for reportable property over $25,000. Separate from the tax calculation but mandatory for compliance.",
        "Form T1244 deferral election: if the deemed disposition tax is material, elect to defer with security. Preserves cash flow; tax payable when asset actually sold or over 10 years.",
        "Pre-departure planning: if future, use the 90-day window before departure to (a) realise losses offsetting gains, (b) use lifetime capital gains exemption where eligible, (c) time sales across tax year boundary.",
        "Voluntary disclosure: if already departed without full compliance, CRA VDP reduces penalties. Disclose BEFORE CRA contact.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Exposure depends on specific asset mix. Canadian professional advice for asset-by-asset analysis.",
      tier: 147,
      ctaLabel: "Get My Canada Asset-by-Asset Analysis — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "AU_MAIN_RESIDENCE_TRAP") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Australia has no formal exit tax — but for Australian real property, the act of becoming a non-resident permanently changes the CGT treatment. Under ITAA 1997 s118-110 (as amended 9 May 2017), non-residents are NOT entitled to the main residence CGT exemption when they sell their Australian home. The 50% CGT discount is also unavailable. The CGT event occurs when you SELL — but leaving determines which rules apply to that sale.`,
      stats: [
        { label: "Departure country",      value: "Australia",                         highlight: true },
        { label: "Applicable rule",          value: "Main residence CGT exemption lost", highlight: true },
        { label: "Planning lever",            value: "Sell BEFORE departure",            highlight: true },
      ],
      consequences: [
        `🔒 ITAA 1997 s118-110 (as amended 9 May 2017): non-residents are NOT entitled to the main residence CGT exemption when they sell Australian real property. The full capital gain is taxable — even on a property that was your main residence while you were a resident.`,
        "Additional loss: non-residents do not receive the 50% CGT discount on Australian property (removed from 8 May 2012). For AU tax residents, the discount halves the taxable gain for assets held 12+ months. For non-residents, the full gain is assessed.",
        "Example: Sydney home bought for $800k, sold for $1.4M. Resident selling: $0 CGT (main residence exemption). Non-resident selling: $600k fully taxable at non-resident rates (no discount) = approximately $270k CGT.",
        "Critical planning lever: SELL BEFORE DEPARTURE to preserve the main residence exemption. Once you become non-resident, the exemption is permanently unavailable on Australian property.",
        "Transitional rules: the 2019 legislation includes limited transitional provisions for property held continuously since before 9 May 2017. Confirm whether transitional relief applies to your specific property with AU tax advice.",
        "Other AU-resident-only benefits lost: temporary resident exemption (s104-165) for foreign assets; various rollovers and concessions. Full audit of resident-only benefits needed.",
        "Voluntary disclosure: if you have already sold AU property as a non-resident without declaring the full gain, ATO voluntary disclosure reduces penalties substantially. Disclose BEFORE ATO contact.",
      ],
      confidence: "HIGH",
      confidenceNote: "Australian main residence exemption loss is a statutory rule from 9 May 2017. Sell-before-departure is the primary planning lever.",
      tier: 147,
      ctaLabel: "Get My AU Pre-Departure Strategy — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "AU_NON_RESIDENT_RATES") {
    return {
      status: result.statusLabel,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Australia has no exit tax on departure — but becoming a non-resident changes the tax treatment of any Australian assets you continue to hold. For shares and business interests: non-resident rates apply to any future sale; the 50% CGT discount is unavailable. Australian-sourced income continues to be taxable for foreign residents.`,
      stats: [
        { label: "Departure country",      value: "Australia",                          highlight: true },
        { label: "Applicable rule",          value: "Non-resident CGT treatment",        highlight: true },
        { label: "50% CGT discount",          value: "Unavailable on AU property",       highlight: true },
      ],
      consequences: [
        `⚠ No exit tax on Australian departure — the act of leaving does not trigger a CGT event. But the CGT treatment of Australian assets changes permanently on ceasing residency.`,
        "Non-resident CGT rates: no 50% CGT discount on Australian real property (from 8 May 2012). The full gain is assessable. For Australian shares: non-residents are taxed only on 'taxable Australian property' or shares with significant connection to AU property; most portfolio shares are NOT within non-resident CGT scope.",
        "Temporary resident rules (ITAA 1997 s104-165): if you were a temporary resident while in Australia, you may have been exempt from CGT on most foreign assets. This exemption is lost if you become permanent resident OR leave Australia.",
        "Pre-departure planning: realise CGT-discount-eligible gains while resident (12+ month hold + 50% discount). Sell loss positions to offset other gains. Time disposals across tax year boundaries.",
        "Ongoing AU-source income: if you retain AU-source income after departure (rental, interest, dividends), file non-resident returns in Australia + claim foreign tax credit in new country of residence.",
        "DASP (Departing Australia Superannuation Payment): for temporary residents with superannuation, special rules apply on departure. Preservation rules + DASP tax implications require specific planning.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "No exit tax on departure but ongoing non-resident CGT treatment affects future sales. Pre-departure planning can preserve resident-era concessions.",
      tier: 67,
      ctaLabel: "Get My AU Exit Assessment — $67 →",
      altTierLabel: "Full pre-departure strategy? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "US_EXPATRIATION_TAX_TRIGGERED") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `US expatriation tax under IRC §877A applies to covered expatriates renouncing US citizenship or surrendering a long-term green card. Covered = net worth over $2M OR average annual US tax liability over $201,000 (2026, indexed) OR failure to certify 5 years of US tax compliance. Covered expatriates are deemed to have sold all worldwide assets at FMV on the day BEFORE expatriation. First $821,000 of gain excluded (2026, indexed). Pre-expatriation planning is material.`,
      stats: [
        { label: "Applicable rule",          value: "IRC §877A (covered expatriate)",   highlight: true },
        { label: "Net worth threshold",       value: "$2,000,000",                        highlight: true },
        { label: "Gain exclusion (2026)",      value: "$821,000",                          highlight: true },
      ],
      consequences: [
        `🔒 IRC §877A expatriation tax: covered expatriates are treated as having sold all worldwide assets at fair market value on the day before expatriation. The resulting gain is included in the final US return; the first $821,000 (2026, indexed annually) is excluded.`,
        "Covered expatriate tests (meeting ANY makes you covered): (1) Net worth ≥ $2,000,000 on expatriation date; (2) Average annual net US income tax liability exceeds $201,000 (2026, inflation-adjusted) for the 5 years prior; (3) Fails to certify under penalties of perjury that all US tax obligations have been satisfied for the 5 years prior.",
        "Special rules: deferred compensation (non-US resident), specified tax deferred accounts (IRAs, §529 plans), interests in non-grantor trusts — each has its own expatriation tax treatment under §877A. Consult a US expatriation specialist.",
        "Pre-expatriation planning levers: (1) CERTIFY 5 years compliance before expatriating (file all outstanding returns and FBARs; this alone can eliminate covered expatriate status for compliance-only failures); (2) consider reducing net worth below $2M through gifting or charitable giving (gift tax rules apply to US-person transfers); (3) time gain realisation to use the $821k exclusion efficiently across expatriation year; (4) accelerate or defer income strategically.",
        "Filing: Form 8854 (Initial and Annual Expatriation Statement) required. Filed with final Form 1040 in year of expatriation. Failure to file Form 8854 itself triggers covered expatriate status regardless of other tests.",
        "Post-expatriation US obligations continue on US-source income (IRC §871, 881 — fixed/determinable income; §897 FIRPTA on US real property). Renunciation ends worldwide taxation but not source-country taxation.",
        "Voluntary disclosure for prior non-compliance: Streamlined Filing Compliance Procedures for non-wilful past non-filing (5% miscellaneous offshore penalty on highest account balance). Essential step before expatriation if past years are non-compliant.",
      ],
      confidence: "HIGH",
      confidenceNote: "US §877A expatriation tax is statutory. Pre-expatriation planning and compliance certification are material to the outcome.",
      tier: 147,
      ctaLabel: "Get My US Expatriation Strategy — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "UK_TEMPORARY_NONRESIDENCE_RISK") {
    return {
      status: result.statusLabel,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `The UK has no exit tax — but temporary non-residence rules under TCGA 1992 s10A can attribute certain gains and income made abroad back to the UK if you return within 5 complete UK tax years. If you leave and return within the window, gains on assets held at departure that are realised during the absence can be taxed on return. Planning a 5+ year absence avoids this claw-back.`,
      stats: [
        { label: "Departure country",      value: "United Kingdom",                    highlight: true },
        { label: "Applicable rule",          value: "TCGA 1992 s10A — temp non-residence", highlight: true },
        { label: "Safe absence",              value: "5 complete UK tax years",          highlight: true },
      ],
      consequences: [
        `⚠ No exit tax on UK departure — leaving the UK does not trigger a CGT event on the departure date. But the temporary non-residence rules can attribute abroad-year gains back to the UK if you return within 5 years.`,
        "Temporary non-residence rules (TCGA 1992 s10A): if you become UK non-resident and return within 5 complete UK tax years, certain gains made abroad during the absence are deemed to arise in the year of return and are UK-taxable. Applies to gains on assets held at the time of leaving the UK.",
        "Scope: the rules target gains on assets owned BEFORE the UK departure. Gains on assets acquired during the absence are generally outside scope (unless other specific rules apply).",
        "Planning lever: plan a 5+ complete UK tax year absence. The 5-year clock starts at the end of the tax year of departure (not the departure date itself). So a departure mid-year 2026/27 means the 5-year clock starts 6 April 2027 — meaning return on or after 6 April 2032 is safe.",
        "Non-resident CGT on UK property (TCGA 1992 s14D): independent of the temporary non-residence rules. Applies to UK residential property regardless of where you live. File a non-resident CGT return within 60 days of completion.",
        "Income counterpart: ITA 2007 s812C applies similar temporary non-residence rules to certain income (dividends, distributions from closely-held companies). Stock dividends and certain remuneration can be caught.",
        "Split-year election: if leaving or returning mid-UK-tax-year, the split-year treatment can separate resident and non-resident periods in the same year. Specific conditions apply.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Temporary non-residence claw-back risk depends on whether you return within 5 years. Planning a longer absence removes the risk.",
      tier: 67,
      ctaLabel: "Get My UK Departure Assessment — $67 →",
      altTierLabel: "Full UK exit + 5-year plan? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "UK_NR_CGT_ON_PROPERTY") {
    return {
      status: result.statusLabel,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `The UK has no exit tax — but non-resident CGT under TCGA 1992 s14D applies to gains on UK residential property regardless of where you live. Selling UK property as a non-resident triggers a non-resident CGT return within 60 days of completion. Separately, the temporary non-residence rules (s10A) can claw back other gains if you return within 5 years.`,
      stats: [
        { label: "Departure country",      value: "United Kingdom",                  highlight: true },
        { label: "Applicable rule",          value: "TCGA 1992 s14D — NR CGT on property", highlight: true },
        { label: "Filing deadline",            value: "60 days of completion",         highlight: true },
      ],
      consequences: [
        `⚠ Non-resident CGT on UK property (TCGA 1992 s14D): applies to gains on UK residential property regardless of the owner's residency. File a non-resident CGT return within 60 days of completion. Tax rates: 18% / 28% (residential) depending on rate band.`,
        "Rebasing: for UK property held before 6 April 2015 (or 6 April 2019 for commercial property), only the gain AFTER the rebasing date is taxable to non-residents. Obtain a professional valuation as at the rebasing date.",
        "Annual tax on enveloped dwellings (ATED): corporate-owned UK residential property may be subject to ATED separately from NR CGT. Different rules, different filings.",
        "Temporary non-residence (TCGA 1992 s10A): if you return to UK within 5 complete UK tax years, certain gains on assets held at departure and realised during absence can be attributed back to the UK and taxed on return.",
        "Planning: dispose of UK property as a non-resident if the CGT calculation on the rebased gain is favourable. Alternatively, retain until the temporary non-residence window expires if you plan to return.",
        "Filing mechanics: Real Time Transaction service for non-resident CGT returns. Penalties for late filing start immediately after the 60-day deadline.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Non-resident CGT on UK property is a filing requirement regardless of departure planning. Timing of sale vs timing of return to UK both affect the outcome.",
      tier: 147,
      ctaLabel: "Get My UK Property + Departure Strategy — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "NZ_NO_EXIT_TAX_CLEAR") {
    return {
      status: result.statusLabel,
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `New Zealand has NO exit tax on departure. Ceasing NZ tax residency does not trigger a deemed disposition or expatriation tax. However, two ongoing NZ rules continue to apply: (1) the bright-line property rule taxes gains on NZ property sold within the applicable period regardless of where you live; (2) the Foreign Investment Fund (FIF) regime applied while you were NZ resident but ceases on departure — any accrued liability in the final year must be settled.`,
      stats: [
        { label: "Departure country",      value: "New Zealand",                       highlight: true },
        { label: "Exit tax on departure?",    value: "NO",                                highlight: true },
        { label: "Ongoing NZ rules",           value: "Bright-line + FIF",                highlight: true },
      ],
      consequences: [
        `✓ No exit tax on NZ departure. Ceasing NZ tax residency under Income Tax Act 2007 s YD 1 does not itself create a taxable event.`,
        "Bright-line property rule continues: if you own NZ property and sell within the applicable bright-line period (2 years for purchases from 1 July 2024; 5 or 10 years for earlier purchases depending on settlement date), the profit is taxable at your marginal rate — regardless of where you now live. See /nz/check/bright-line-auditor for the full analysis.",
        "FIF (Foreign Investment Fund) regime: if you held offshore shares/investments while NZ resident, the FIF regime may have applied (fair dividend rate, comparative value, or other methods). On ceasing NZ residency, FIF no longer applies. Final-year FIF calculation and settlement needed.",
        "Departure return: file a final IR3 for the year of departure declaring all worldwide income up to the departure date + NZ-source income only for the remainder of the year. Cessation of residency must be notified to IRD.",
        "NZ-source income after departure: rental income from NZ property, dividends from NZ companies, NZ bank interest — all continue to be NZ-taxable (usually via non-resident withholding tax). File non-resident returns as required.",
        "NZ superannuation: if you retain NZ KiwiSaver or other retirement accounts, distributions may be taxable in NZ (at non-resident rates) and in your new country of residence. Treaty analysis may help allocate.",
      ],
      confidence: "HIGH",
      confidenceNote: "NZ has no exit tax. Ongoing bright-line and FIF treatments require specific attention but departure itself is not a tax event.",
      tier: 67,
      ctaLabel: "Get My NZ Departure Checklist — $67 →",
      altTierLabel: "Multi-country exit plan? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "PAST_DEPARTURE_VOLUNTARY_DISCLOSURE") {
    return {
      status: result.statusLabel,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `You have already departed ${result.countryLabel} without formal pre-departure planning or advice. The good news: voluntary disclosure programmes exist in most countries and reduce penalties materially — BUT only if initiated before the tax authority contacts you. The window narrows over time but is rarely closed. Engage a cross-border specialist immediately.`,
      stats: [
        { label: "Departure country",      value: result.countryLabel,                highlight: true },
        { label: "Departure timing",         value: result.timingLabel,                  highlight: true },
        { label: "Voluntary disclosure",       value: "OPEN — act before authority contact", highlight: true },
      ],
      consequences: [
        `⚠ Past departure without advice — the primary concern is that an exit tax event may have triggered (e.g. Canada deemed disposition under s128.1) without being reported in a departure return.`,
        `Country-specific rule that likely applies to your case: ${result.primaryRule}`,
        "Voluntary disclosure by country:",
        "Canada — Voluntary Disclosures Program (VDP): pre-disclosure contact required; reduces penalties to a percentage of tax owed; can cover unfiled departure returns and missed s128.1 reporting.",
        "Australia — ATO voluntary disclosure: reduces administrative penalty from up to 75% (intentional disregard) to 20% or less for voluntary non-careless cases.",
        "United Kingdom — Worldwide Disclosure Facility (WDF) for overseas tax non-compliance; Let Property Campaign for UK rental non-compliance; 12-month window from registration.",
        "United States — Streamlined Filing Compliance Procedures for non-wilful past non-filing; 5% miscellaneous offshore penalty on highest account balance; requires certification of non-wilful conduct.",
        "New Zealand — IRD voluntary disclosure: reduces shortfall penalty substantially for pre-audit disclosure.",
        "Timing: voluntary disclosure must be initiated BEFORE the authority contacts you. Audits, information requests, and formal investigations close the VDP window.",
        "Action: engage a cross-border tax specialist this week. Do not attempt self-service voluntary disclosure — the forms and procedures have specific requirements where errors can forfeit the programme's benefits.",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Voluntary disclosure is available but time-sensitive. Country-specific procedures with specific requirements — professional advice essential.",
      tier: 147,
      ctaLabel: "Get My Voluntary Disclosure Strategy — $147 →",
      altTierLabel: "Just want the rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "FUTURE_PLANNING_OPPORTUNITY") {
    return {
      status: result.statusLabel,
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `You are planning your departure with lead time — this is the optimal position. Pre-departure planning levers are available and materially reduce exit tax exposure in countries that have one. For ${result.countryLabel}: ${result.primaryRule}. The specific planning path depends on your asset mix and target country — but the opportunity exists to act NOW rather than remediate after the fact.`,
      stats: [
        { label: "Departure country",      value: result.countryLabel },
        { label: "Departure timing",         value: result.timingLabel },
        { label: "Planning status",            value: "LEVERS AVAILABLE" },
      ],
      consequences: [
        `✓ Pre-departure planning window open. ${result.countryLabel}: ${result.primaryRule}`,
        "Universal pre-departure levers: (1) establish target country residency FIRST (permanent home, ties, employment); (2) identify asset-specific exit tax implications; (3) time departure to capture favourable year-end positions; (4) realise any losses before departure to offset gains; (5) file departure return + relevant elections in departure country.",
        result.departureCountry === "ca" ? "Canada-specific: sell loss-position assets before departure (reduce deemed gain); use lifetime capital gains exemption on qualifying small business shares; file Form T1244 deferral election; time departure across tax year boundary." : "",
        result.departureCountry === "au" ? "Australia-specific: sell main residence BEFORE departure to preserve CGT exemption (non-residents lose it permanently); realise CGT-discount-eligible gains while resident; handle superannuation preservation rules." : "",
        result.departureCountry === "us" ? "US-specific: certify 5 years tax compliance; consider reducing net worth below $2M if close to threshold; time gain realisation to use $821k exclusion efficiently; plan Form 8854 filing." : "",
        result.departureCountry === "uk" ? "UK-specific: plan 5+ year absence to avoid temporary non-residence claw-back; dispose of UK property strategically (NR CGT applies regardless); use split-year election if mid-year departure." : "",
        "Action: engage a cross-border tax specialist 90 days before intended departure to execute the plan. Pre-departure planning is materially more valuable than post-departure remediation.",
      ].filter(c => c !== ""),
      confidence: "HIGH",
      confidenceNote: "Future departure with time to plan is the optimal position. Country-specific planning levers are available and should be executed before the departure date.",
      tier: 147,
      ctaLabel: "Get My Pre-Departure Planning Strategy — $147 →",
      altTierLabel: "Just want the country rules? — $67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // NO_MATERIAL_ASSETS
  return {
    status: result.statusLabel,
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: `You have indicated no significant asset exposure at departure. Exit tax rules primarily target unrealised gains on investments, property, and business interests — with no material assets, the exit tax exposure is minimal. However, departure compliance (formal notification to the tax authority of your departure) still applies regardless of asset exposure.`,
    stats: [
      { label: "Departure country",      value: result.countryLabel },
      { label: "Asset exposure",           value: "NO MATERIAL ASSETS" },
      { label: "Primary concern",           value: "Departure notification only" },
    ],
    consequences: [
      `✓ No material asset exposure — exit tax rules primarily target unrealised gains on investments, property, and business interests. Without these, the exit tax component of departure is minimal.`,
      "Departure compliance still required: each country has a formal departure notification / return that should be filed regardless of asset exposure. Without notification, the authority typically continues to treat you as resident.",
      "Future asset acquisition: if you acquire assets after departing, they are generally outside your former country's scope (except source-country income like rental property or employment in that country). The clean departure preserves this.",
      "Ongoing source-country income: if you retain any income arising in the old country (employer, rental, business), file non-resident returns as required. Treaty-reduced withholding may apply.",
      "183-day rule reality check: even without assets, the act of departure may still be contested under the domestic residency test if you retain ties. See /nomad/check/183-day-rule for confirmation that your departure is actually recognised.",
      "Future planning: if your asset position changes materially (employer stock vesting, inheritance, business sale), reassess exit tax exposure at that point.",
    ],
    confidence: "HIGH",
    confidenceNote: "No material assets = minimal exit tax exposure. Departure compliance and residency confirmation are the remaining items.",
    tier: 67,
    ctaLabel: "Get My Departure Notification Pack — $67 →",
    altTierLabel: "Planning to acquire assets? — $147",
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
    label: "Which country are you leaving or have left?",
    subLabel: "Exit tax rules vary dramatically by country — Canada has a deemed disposition, the US has IRC §877A for covered expatriates, others have no formal exit tax.",
    options: [
      { label: "Canada",                                        value: "ca",    subLabel: "Deemed disposition under ITA s128.1" },
      { label: "Australia",                                      value: "au",    subLabel: "No exit tax but non-resident CGT treatment changes" },
      { label: "United Kingdom",                                  value: "uk",    subLabel: "Temporary non-residence claw-back if return within 5 yr" },
      { label: "United States (renouncing citizenship / green card)", value: "us", subLabel: "Expatriation tax IRC §877A (covered expatriates)" },
      { label: "New Zealand",                                      value: "nz",    subLabel: "No exit tax (bright-line / FIF continue to apply)" },
      { label: "Other",                                             value: "other", subLabel: "Country-specific rule — verify locally" },
    ],
    required: true,
  },
  {
    id: "departure_timing", step: 2, type: "button_group",
    label: "When did you / will you depart?",
    subLabel: "Timing determines whether voluntary disclosure is relevant (past) or pre-departure planning is available (future).",
    options: [
      { label: "Already departed (over 2 years ago)",       value: "past_2_plus",     subLabel: "Voluntary disclosure may still be available" },
      { label: "Already departed (within last 2 years)",    value: "past_within_2",   subLabel: "Voluntary disclosure + recent remediation" },
      { label: "Planning to depart (within 12 months)",      value: "future_within_12", subLabel: "Pre-departure planning window OPEN" },
      { label: "Considering departure (2+ years away)",       value: "future_long",     subLabel: "Long planning window — maximum flexibility" },
    ],
    required: true,
  },
  {
    id: "asset_types", step: 3, type: "button_group",
    label: "Primary asset type at departure (highest exposure)?",
    subLabel: "If you have multiple asset types, select the one with highest value. The verdict addresses the primary rule for that asset.",
    options: [
      { label: "Shares / investment portfolio",                value: "shares",   subLabel: "Canada deemed disposed; AU non-resident rates" },
      { label: "Real property in departure country",            value: "property", subLabel: "AU main residence exemption lost; UK NR CGT; CA exception" },
      { label: "Business interests",                             value: "business", subLabel: "Canada deemed disposed (if not Canadian-used)" },
      { label: "Super / pension / retirement accounts",           value: "pension",  subLabel: "Special treatment in each country" },
      { label: "Stock options / equity compensation",             value: "options",  subLabel: "Separate rules — vesting vs exercise timing" },
      { label: "Cryptocurrency",                                   value: "crypto",   subLabel: "Property treatment — same as shares in most countries" },
      { label: "No significant assets",                             value: "none",     subLabel: "Minimal exit tax exposure" },
    ],
    required: true,
  },
  {
    id: "advice_taken", step: 4, type: "button_group",
    label: "Did you / will you seek tax advice before departing?",
    subLabel: "Pre-departure advice can materially reduce exit tax exposure. Post-departure advice can still help via voluntary disclosure.",
    options: [
      { label: "Yes — departure return filed correctly",     value: "yes_clean",     subLabel: "Clean pre-departure planning" },
      { label: "Yes — but not sure if exit tax was addressed",  value: "yes_uncertain", subLabel: "Review advisability" },
      { label: "No — just stopped filing",                       value: "no",            subLabel: "Voluntary disclosure likely needed" },
      { label: "Not yet — planning ahead",                         value: "planning",      subLabel: "Pre-departure planning window" },
    ],
    required: true,
  },
  {
    id: "assets_sold_since", step: 5, type: "button_group",
    label: "Have you sold any assets since departing?",
    subLabel: "Post-departure sales interact with country-specific rules differently.",
    options: [
      { label: "Yes — property or investments sold",           value: "yes",      subLabel: "CGT treatment at non-resident rates" },
      { label: "No — all assets still held",                    value: "no",       subLabel: "Future sale timing decision" },
      { label: "Partially — some sold",                          value: "partial", subLabel: "Mixed treatment" },
      { label: "Not applicable (future / planning)",              value: "na",       subLabel: "Pre-departure position" },
    ],
    required: true,
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

      {/* Country rule anchor */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Applicable rule — {result.countryLabel}</p>
        <p className="text-neutral-800 leading-relaxed">{result.primaryRule}</p>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Planning/disclosure availability */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Available levers</p>
        <div className="space-y-1 text-neutral-800">
          <p><strong>Exit tax applies on departure:</strong> {result.exitTaxApplies ? "Yes — immediate tax event" : "No — departure itself not a tax event"}</p>
          <p><strong>Deferral election available:</strong> {result.deferralAvailable ? "Yes (Canada Form T1244)" : "No / not applicable"}</p>
          <p><strong>Voluntary disclosure open:</strong> {result.voluntaryDisclosureOpen ? "Yes — engage before authority contact" : "Not applicable / not needed"}</p>
          <p><strong>Pre-departure planning possible:</strong> {result.prePlanningPossible ? "Yes — window is open" : "No — departure has occurred"}</p>
        </div>
      </div>

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
        }`}>Exit tax risk — {result.riskLevel}</p>
        <p className={`${
          result.riskLevel === "HIGH" ? "text-red-900"
          : result.riskLevel === "MEDIUM" ? "text-amber-900"
          : "text-emerald-900"
        } leading-relaxed`}>
          {result.riskLevel === "HIGH" && "Material exit tax exposure. Specialist cross-border advice essential. Time-sensitive: pre-departure planning or voluntary disclosure must be initiated promptly."}
          {result.riskLevel === "MEDIUM" && "Moderate exit tax exposure — ongoing non-resident treatment affects future sales, or temporary non-residence risk if return within 5 years. Plan sales timing and residence carefully."}
          {result.riskLevel === "LOW" && "Minimal exit tax exposure on departure itself. Standard departure compliance (formal notification) still required."}
        </p>
      </div>

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — country engines + residency + back to index</p>
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
          <strong className="text-neutral-950">Exit tax rules are country-specific, never universal.</strong> Canada has a deemed disposition. Australia has no exit tax but changes future sale treatment. US has IRC §877A for covered expatriates only. UK has temporary non-residence claw-back. New Zealand has no exit tax. Apply the specific rule to the specific country.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Exit tax exposure for your specific departure country + asset mix</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Country-specific statutory anchors + planning levers</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Deferral election / voluntary disclosure opportunity assessment</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Asset-by-asset departure impact (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Multi-country exit sequencing plan (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 cross-border accountant questions</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your specific departure country and asset profile</p>
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

export default function ExitTaxTrapCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ departure_role: "", urgency: "", accountant: "" });
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
        product_slug: "exit-tax-trap",
        source_path: "/nomad/check/exit-tax-trap",
        country_code: "GLOBAL", currency_code: "USD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          exit_status: verdict.result.status,
          departure_country: verdict.result.countryLabel,
          risk_level: verdict.result.riskLevel,
          exit_tax_applies: verdict.result.exitTaxApplies,
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
      body: JSON.stringify({ email, source: "exit_tax_trap", country_code: "GLOBAL", site: "taxchecknow" }),
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
    const sid = sessionId || `exittax_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("exit-tax-trap_departure_country", String(answers.departure_country || ""));
    sessionStorage.setItem("exit-tax-trap_departure_timing", String(answers.departure_timing || ""));
    sessionStorage.setItem("exit-tax-trap_asset_types", String(answers.asset_types || ""));
    sessionStorage.setItem("exit-tax-trap_advice_taken", String(answers.advice_taken || ""));
    sessionStorage.setItem("exit-tax-trap_assets_sold_since", String(answers.assets_sold_since || ""));
    sessionStorage.setItem("exit-tax-trap_exit_status", verdict.result.status);
    sessionStorage.setItem("exit-tax-trap_risk_level", verdict.result.riskLevel);
    sessionStorage.setItem("exit-tax-trap_exit_tax_applies", String(verdict.result.exitTaxApplies));
    sessionStorage.setItem("exit-tax-trap_status", verdict.status);
    sessionStorage.setItem("exit-tax-trap_tier", String(popupTier));

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
          success_url: `${window.location.origin}/nomad/check/exit-tax-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad/check/exit-tax-trap`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your exit tax risk report for your cross-border tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your exposure + planning levers by email — free.</p>
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
                    {popupTier === 67 ? "Your Exit Tax Risk Report" : "Your Exit Tax Strategy"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">Country-specific exit tax rules · April 2026</p>
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
                      {popupTier === 67 ? "Exit Tax Risk Report™" : "Exit Tax Strategy™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exit tax exposure under the specific rule of your departure country, asset-by-asset impact, voluntary disclosure assessment, and 5 cross-border accountant questions."
                        : "Full strategy: pre-departure optimisation plan + deferral election analysis + asset disposal sequencing + multi-country exit plan + audit-ready documentation pack + cross-border accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic departure advice. Your specific country + asset mix + timing.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Exit Tax Report →" : "Get My Exit Tax Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the report? — $67 instead" : "Want the full strategy? — $147 instead"}
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
                    { label: "Your role", key: "departure_role", options: [["leaving_with_advice","Leaving with specialist advice"],["leaving_no_advice","Leaving without advice yet"],["departed_remediation","Already departed — remediation"],["advisor","Cross-border advisor / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["authority_contact","Tax authority contact received"],["imminent_departure","Departure within 90 days"],["planning","Planning — no immediate event"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · Country-specific exit tax rules</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.riskLevel === "HIGH" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Exit tax risk — HIGH</p>
              <p className="text-sm font-bold text-neutral-950">
                {verdict.result.countryLabel} — material exposure; specialist advice essential
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
