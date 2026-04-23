"use client";

/**
 * NOMAD-07 — Australian Expat CGT Trap Auditor
 * Pattern: Timeline + Classification -> exemption availability + CGT exposure
 *
 * Legal anchor: ITAA 1997 s118-110 (main residence exemption)
 *               + s118-115 (foreign residents denied from 9 May 2017)
 *               + s104-15 (CGT event A1 — contract date is the test)
 *
 * DETERMINATION ORDER:
 *   1. Life event exception (s118-115(3)) — narrow override path
 *   2. Investment property (never main residence) — no exemption regardless
 *   3. Not yet sold — planning window still open
 *   4. Uncertain residency — determine SRT/domicile/183-day first
 *   5. Australian resident at contract date — exemption may apply
 *   6. Foreign resident at contract date + signed — exemption denied (s118-115)
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "EXEMPTION_APPLIES_AUSTRALIAN_RESIDENT"
  | "EXEMPTION_DENIED_FOREIGN_RESIDENT"
  | "PLAN_NOW_NOT_YET_SOLD"
  | "LIFE_EVENTS_EXCEPTION"
  | "INVESTMENT_PROPERTY_NO_EXEMPTION"
  | "UNCLEAR_RESIDENCY";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface CGTResult {
  auResidency:      string;
  purchaseDate:     string;
  mainResidence:    string;
  departureTiming:  string;
  contractSigned:   string;
  estimatedGain:    string;
  lifeEvent:        string;

  gainMidpoint:     number;
  nonResTax:        number;   // at 45% if non-res, full gain
  withholding:      number;   // 12.5% placeholder on sample sale price if withholding applies
  potentialSaving:  number;   // tax saved if exemption preserved vs non-res outcome

  status:           Status;
  statusLabel:      string;
  isExemptionDenied: boolean;
  isForeignResident: boolean;

  reasoningChain:   Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:           Route[];
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
  result: CGTResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_au_expat_cgt",
  p147: "nomad_147_au_expat_cgt",
};

const GAIN_MIDPOINT: Record<string, number> = {
  under_100k:     50000,
  "100k_to_300k": 200000,
  "300k_to_700k": 500000,
  over_700k:      1000000,
};

const GAIN_LABEL: Record<string, string> = {
  under_100k:     "Under $100,000",
  "100k_to_300k": "$100,000-$300,000",
  "300k_to_700k": "$300,000-$700,000",
  over_700k:      "Over $700,000",
};

function aud(n: number): string {
  return `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function calcCGT(answers: AnswerMap): CGTResult {
  const auResidency    = String(answers.au_residency      || "no");
  const purchaseDate   = String(answers.purchase_date       || "post_2017");
  const mainResidence  = String(answers.main_residence      || "yes");
  const departureTiming = String(answers.departure_timing   || "2_5_years");
  const contractSigned = String(answers.contract_signed     || "not_yet");
  const estimatedGain  = String(answers.estimated_gain      || "300k_to_700k");
  const lifeEvent      = String(answers.life_event          || "none");

  const gainMidpoint = GAIN_MIDPOINT[estimatedGain] ?? 500000;
  // Non-resident marginal rate assumption (45% top bracket)
  const nonResTax = Math.round(gainMidpoint * 0.45);
  // Withholding illustrative: 12.5% of a sale price ~= gain + roughly purchase price proxy (use 2x gain as rough sale-price proxy, floored at $750k test)
  const saleProxy = Math.max(gainMidpoint * 2, 800000);
  const withholding = saleProxy > 750000 ? Math.round(saleProxy * 0.125) : 0;

  const reasoningChain: CGTResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";

  // LAYER 1 — life events exception (narrow override)
  if (lifeEvent !== "none" && mainResidence !== "no") {
    reasoningChain.push({ layer: "Layer 1 — Life events (s118-115(3))", outcome: `Life event identified: ${lifeEvent === "death" ? "death of spouse/partner" : lifeEvent === "terminal" ? "terminal medical condition" : "Family Law Act order (divorce/separation)"} — main residence exemption may be preserved despite foreign residency, subject to strict conditions`, resolved: true });
    status = "LIFE_EVENTS_EXCEPTION";
    statusLabel = "LIFE EVENTS EXCEPTION — EXEMPTION MAY APPLY";
  } else {
    reasoningChain.push({ layer: "Layer 1 — Life events (s118-115(3))", outcome: "No qualifying life event — exception pathway not available", resolved: false });
  }

  // LAYER 2 — investment property (no exemption regardless)
  if (status === null && mainResidence === "no") {
    reasoningChain.push({ layer: "Layer 2 — Property classification", outcome: "Never main residence (investment property) — no main residence exemption available under any scenario", resolved: true });
    status = "INVESTMENT_PROPERTY_NO_EXEMPTION";
    statusLabel = "INVESTMENT PROPERTY — NO EXEMPTION";
  } else if (status === null) {
    reasoningChain.push({ layer: "Layer 2 — Property classification", outcome: `Main residence status: ${mainResidence === "yes" ? "main residence entire period" : "partial — lived then rented"} — exemption available if residency allows`, resolved: false });
  }

  // LAYER 3 — uncertain residency
  if (status === null && auResidency === "uncertain") {
    reasoningChain.push({ layer: "Layer 3 — Residency determination", outcome: "Australian residency status uncertain (split time) — ITAA 1936 s6(1) tests must be applied before CGT outcome can be determined", resolved: true });
    status = "UNCLEAR_RESIDENCY";
    statusLabel = "UNCLEAR — RESIDENCY DETERMINATION NEEDED";
  } else if (status === null) {
    reasoningChain.push({ layer: "Layer 3 — Residency determination", outcome: auResidency === "yes" ? "Currently Australian resident" : "Currently foreign resident for CGT purposes", resolved: false });
  }

  // LAYER 4 — contract not yet signed (planning window open)
  if (status === null && (contractSigned === "not_yet" || contractSigned === "not_listed")) {
    reasoningChain.push({ layer: "Layer 4 — Contract status", outcome: "Contract not yet signed — residency-at-contract-date is still open for planning. Current residency position determines default outcome; returning to residency before signing can preserve exemption", resolved: true });
    status = "PLAN_NOW_NOT_YET_SOLD";
    statusLabel = "PLAN NOW — CONTRACT NOT YET SIGNED";
  } else if (status === null) {
    reasoningChain.push({ layer: "Layer 4 — Contract status", outcome: "Contract signed — residency position at signing date is the binding test", resolved: false });
  }

  // LAYER 5 — Australian resident at contract date
  if (status === null && auResidency === "yes") {
    reasoningChain.push({ layer: "Layer 5 — Exemption test", outcome: "Australian resident at contract date + main residence history — s118-110 main residence exemption may apply (subject to full/partial exemption rules)", resolved: true });
    status = "EXEMPTION_APPLIES_AUSTRALIAN_RESIDENT";
    statusLabel = "EXEMPTION APPLIES — AUSTRALIAN RESIDENT";
  }

  // LAYER 6 — foreign resident at contract date + contract signed (exemption denied)
  if (status === null && auResidency === "no") {
    reasoningChain.push({ layer: "Layer 5 — Exemption test", outcome: "Not Australian resident at contract date — main residence exemption denied under s118-115 (post 9 May 2017)", resolved: true });
    status = "EXEMPTION_DENIED_FOREIGN_RESIDENT";
    statusLabel = "EXEMPTION DENIED — FOREIGN RESIDENT";
  }

  // Fallback
  if (status === null) {
    status = "UNCLEAR_RESIDENCY";
    statusLabel = "UNCLEAR — RESIDENCY DETERMINATION NEEDED";
  }

  const isExemptionDenied = status === "EXEMPTION_DENIED_FOREIGN_RESIDENT" || status === "INVESTMENT_PROPERTY_NO_EXEMPTION";
  const isForeignResident = auResidency === "no";

  const potentialSaving = isExemptionDenied && mainResidence !== "no" ? nonResTax : 0;

  // Routing
  const routes: Route[] = [];
  if (status === "UNCLEAR_RESIDENCY") {
    routes.push({ label: "183-Day Rule Reality Check — determine Australian residency", href: "/nomad/check/183-day-rule", note: "Apply ITAA 1936 s6(1) tests — resides / domicile / 183-day" });
    routes.push({ label: "Nomad Residency Risk Index", href: "/nomad", note: "Full country-by-country residency snapshot" });
  } else if (status === "PLAN_NOW_NOT_YET_SOLD") {
    routes.push({ label: "AU Main Residence CGT Trap", href: "/au/check/cgt-main-residence-trap", note: "Deep dive on main residence rules + 6-year rule" });
    routes.push({ label: "AU CGT Discount Timing Sniper", href: "/au/check/cgt-discount-timing-sniper", note: "12-month hold + discount mechanics (residents)" });
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Confirm residency position before contract" });
  } else if (status === "EXEMPTION_APPLIES_AUSTRALIAN_RESIDENT") {
    routes.push({ label: "AU Main Residence CGT Trap", href: "/au/check/cgt-main-residence-trap", note: "Full/partial exemption modelling + 6-year rule" });
    routes.push({ label: "AU CGT Discount Timing Sniper", href: "/au/check/cgt-discount-timing-sniper", note: "50% discount mechanics for Australian residents" });
  } else if (status === "LIFE_EVENTS_EXCEPTION") {
    routes.push({ label: "AU Main Residence CGT Trap", href: "/au/check/cgt-main-residence-trap", note: "Life events exception documentation + ATO ruling pathway" });
  } else {
    // Denied or investment
    routes.push({ label: "AU CGT Discount Timing Sniper", href: "/au/check/cgt-discount-timing-sniper", note: "Timing levers (limited for non-residents)" });
    routes.push({ label: "Tax Treaty Navigator", href: "/nomad/check/tax-treaty-navigator", note: "Treaty allocation of capital gains between Australia and your residence country" });
    routes.push({ label: "Exit Tax Trap Auditor", href: "/nomad/check/exit-tax-trap", note: "Cross-check departure tax treatment" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    auResidency, purchaseDate, mainResidence, departureTiming, contractSigned, estimatedGain, lifeEvent,
    gainMidpoint, nonResTax, withholding, potentialSaving,
    status,
    statusLabel,
    isExemptionDenied,
    isForeignResident,
    reasoningChain,
    routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcCGT(answers);

  const headline = (() => {
    if (result.status === "EXEMPTION_APPLIES_AUSTRALIAN_RESIDENT") return `You are an Australian resident. The main residence CGT exemption may apply to ${result.mainResidence === "partial" ? "the period the property was your principal place of abode (partial exemption)" : "your sale"} if conditions under s118-110 are met. You may also access the 50% CGT discount if the asset was held for 12+ months. Confirm the years of actual residence for partial exemption calculation and the 6-year rule where relevant.`;
    if (result.status === "EXEMPTION_DENIED_FOREIGN_RESIDENT") return `You are a foreign resident at the time of sale. The main residence CGT exemption is denied under s118-115 ITAA 1997 (rule effective from 9 May 2017). Your capital gain of approximately ${aud(result.gainMidpoint)} is taxable at non-resident rates — up to 45% — with no 50% CGT discount available. Estimated tax: ${aud(result.nonResTax)}. A 12.5% withholding of approximately ${aud(result.withholding)} may apply at settlement if the sale exceeds $750,000 and you have not obtained an ATO clearance certificate.`;
    if (result.status === "PLAN_NOW_NOT_YET_SOLD") return `You have not yet signed a contract. Residency at contract date is the only test — if you are Australian resident when you sign, the main residence exemption may apply; if you are foreign resident when you sign, it is denied permanently for this sale. Your current position is ${result.auResidency === "yes" ? "Australian resident (clean)" : result.auResidency === "no" ? "foreign resident (exemption would be denied if you sign now)" : "uncertain — determine residency first"}. Plan the contract timing around residency status.`;
    if (result.status === "LIFE_EVENTS_EXCEPTION") return `A life events exception under s118-115(3) may preserve the main residence exemption despite foreign residency. This is a narrow provision — all conditions must be met: the property must have been your main residence for the entire relevant period (or a continuous period ending at the life event), AND the disposal must be connected to the qualifying life event. Seek specific tax advice and consider an ATO private ruling before relying on this exception.`;
    if (result.status === "INVESTMENT_PROPERTY_NO_EXEMPTION") return `The main residence exemption does not apply to investment properties that were never a principal place of abode. CGT applies to the full gain regardless of your residency status. As a foreign resident, the 50% CGT discount is also unavailable on Australian real property (removed 8 May 2012). Estimated tax on a ${aud(result.gainMidpoint)} gain at 45% non-resident rate: ${aud(result.nonResTax)}.`;
    if (result.status === "UNCLEAR_RESIDENCY") return `Your Australian residency status is unclear — determine this first under ITAA 1936 s6(1) (resides test, domicile test, 183-day test, Commonwealth superannuation test). Residency at the contract signature date is the single test that determines whether the main residence exemption applies. Use the 183-Day Rule Reality Check to anchor your position before continuing.`;
    return `Your Australian expat CGT position needs full review.`;
  })();

  const consequences: string[] = [];

  if (result.status === "EXEMPTION_APPLIES_AUSTRALIAN_RESIDENT") {
    consequences.push(`✓ Main residence exemption available (s118-110) — your capital gain may be fully or partially exempt from CGT.`);
    consequences.push(`Partial exemption: if the property was only main residence for part of the ownership period, a days-based formula applies. Non-main-residence days × gain ÷ total ownership days = assessable gain.`);
    consequences.push(`50% CGT discount (s115-25): available to Australian residents on assets held 12+ months. Applied after partial exemption calculation.`);
    consequences.push(`6-year rule (s118-145): if you left the property and rented it, you can treat it as main residence for up to 6 years (unlimited if not rented). Only works while you remain Australian resident at contract date.`);
    consequences.push(`Clearance certificate: as Australian resident, obtain ATO clearance certificate to prevent automatic 12.5% withholding at settlement (for sales of $750,000+). Apply early — processing can take 2-4 weeks.`);
    consequences.push(`Documentation: retain evidence of main residence status (bills, voter registration, driver's licence, statutory declarations from neighbours), cost base records (purchase contract, improvements, legal fees), and ATO clearance certificate.`);
  } else if (result.status === "EXEMPTION_DENIED_FOREIGN_RESIDENT") {
    consequences.push(`🔒 Main residence exemption denied — s118-115 applies because you are foreign resident at contract date.`);
    consequences.push(`📊 Estimated CGT: ${aud(result.gainMidpoint)} gain × 45% non-resident rate = ${aud(result.nonResTax)} tax (no 50% discount for foreign residents on Australian real property).`);
    consequences.push(`💰 Withholding: purchaser required to withhold 12.5% of purchase price (~${aud(result.withholding)} on a sample sale) if sale over $750,000 and no ATO clearance certificate. Variation can reduce this percentage if estimated final tax is lower.`);
    consequences.push(`No 50% CGT discount: removed for foreign residents on taxable Australian real property from 8 May 2012 (s115-105). Cannot be reinstated regardless of prior residency periods.`);
    consequences.push(`6-year rule (s118-145): does NOT save you — only available to Australian residents at contract date.`);
    consequences.push(`Planning lever: returning to genuine Australian residency before signing could preserve the exemption — but substance over form. ATO examines intent and facts, not just a visit to sign papers.`);
    consequences.push(`Life events exception: check whether any s118-115(3) trigger applies to your specific circumstances. Narrow but worth validating.`);
    consequences.push(`Lodgment obligation: file Australian tax return declaring the CGT event in the year of contract date (not settlement date). Credit any 12.5% withholding against final CGT liability.`);
  } else if (result.status === "PLAN_NOW_NOT_YET_SOLD") {
    consequences.push(`⏰ Planning window open — contract not yet signed. Residency at signing date is the only test.`);
    if (result.auResidency === "no") {
      consequences.push(`Current position: foreign resident. If you sign now, the main residence exemption is denied. Estimated tax at your gain level: ${aud(result.nonResTax)} (vs potentially much less if exemption applied).`);
      consequences.push(`Option A — sign as Australian resident: re-establish genuine Australian residency well before listing. Requires physical presence + closing overseas ties + resumption of Australian primary activities. Not a paper exercise — ATO scrutinises substance.`);
      consequences.push(`Option B — sign as foreign resident and accept the tax: model the full exposure; apply for FRCGW variation to reduce 12.5% withholding if final CGT will be lower; plan cashflow accordingly.`);
      consequences.push(`Option C — delay the sale until residency change is viable (e.g. planned future return to Australia). Weigh ongoing holding costs against tax saved.`);
    } else {
      consequences.push(`Current position: Australian resident. If you sign now while still resident, the main residence exemption may apply (subject to s118-110 conditions).`);
      consequences.push(`Guard against accidental foreign residency before signing — a change of circumstances (moving abroad, losing Australian ties) could flip your position before contract signature.`);
      consequences.push(`Clearance certificate: apply in advance of listing to avoid 12.5% withholding at settlement.`);
    }
    consequences.push(`Contract date = CGT event date (s104-15 CGT event A1). Do NOT assume settlement date matters — it doesn't, for residency test purposes.`);
    consequences.push(`Document residency: the more evidence of genuine Australian residency at contract date (utility bills, employment, visa/citizenship status, family location), the stronger the position.`);
  } else if (result.status === "LIFE_EVENTS_EXCEPTION") {
    consequences.push(`🔬 Life events exception (s118-115(3)) — narrow preservation of exemption despite foreign residency.`);
    consequences.push(`All conditions must be met: the property must have been main residence for the entire relevant period (or a continuous period ending at the life event), AND the disposal must be connected to the specific triggering event.`);
    consequences.push(`Qualifying events: (a) death of spouse or de facto partner; (b) terminal medical condition of owner, spouse, or minor child; (c) Family Law Act order resulting from divorce or separation.`);
    consequences.push(`Documentation required: death certificate / medical diagnosis / Family Court order + evidence of main residence status + timeline connecting event to disposal.`);
    consequences.push(`ATO private ruling: strongly recommended before relying on this exception — the ATO reviews specific facts against the statutory tests, and positions adopted without a ruling are vulnerable in audit.`);
    consequences.push(`If the exception applies: main residence exemption calculated as if you had remained Australian resident. 50% CGT discount still denied for foreign residents (exception preserves the main residence exemption only, not the discount).`);
  } else if (result.status === "INVESTMENT_PROPERTY_NO_EXEMPTION") {
    consequences.push(`🔒 Investment property — no main residence exemption ever available. CGT applies to the full gain regardless of residency status.`);
    consequences.push(`Foreign resident: no 50% CGT discount available on Australian real property (removed 8 May 2012). Full gain taxed at non-resident marginal rate up to 45%.`);
    consequences.push(`Estimated CGT: ${aud(result.gainMidpoint)} × 45% = ${aud(result.nonResTax)}. Note: lower-rate brackets apply up to threshold levels, so tax at the bracket boundaries will be less than pure 45% for gains below the top bracket.`);
    consequences.push(`Australian resident alternative: if you had been Australian resident, the 50% CGT discount would halve the taxable gain — effectively capping CGT at ~22.5%. Returning to residency before signing a contract would preserve this discount (though it is a much smaller benefit than the full main residence exemption).`);
    consequences.push(`Cost base maximisation: include all eligible cost base items (purchase price + stamp duty + conveyancing + capital improvements + element 3 holding costs for non-deductible periods).`);
    consequences.push(`Withholding: 12.5% on sale over $750,000 unless FRCGW variation obtained based on estimated final tax.`);
  } else if (result.status === "UNCLEAR_RESIDENCY") {
    consequences.push(`Australian residency is the single determinative factor — you must settle this before any CGT analysis is reliable.`);
    consequences.push(`Tests to apply (ITAA 1936 s6(1)): resides test (ordinary meaning), domicile test (Australian domicile + no permanent place of abode overseas), 183-day test (more than 183 days in Australia), Commonwealth superannuation test.`);
    consequences.push(`Default treatment while uncertain: letting agents and conveyancers default to foreign resident treatment (12.5% withholding applied) unless clearance certificate is produced. Your own SA position aligns with whichever test you apply honestly.`);
    consequences.push(`Cross-check via the 183-Day Rule Reality Check — covers Australian residency tests against comparator tests for other countries you may be resident in.`);
    consequences.push(`Do not sign a contract until residency is determined — the signing date is the single binding snapshot.`);
  }

  const isNegative = result.isExemptionDenied;
  const statusClass = isNegative ? "text-red-700" : (result.status === "UNCLEAR_RESIDENCY" ? "text-amber-700" : result.status === "LIFE_EVENTS_EXCEPTION" ? "text-amber-700" : "text-emerald-700");
  const panelClass  = isNegative ? "border-red-200 bg-red-50" : (result.status === "UNCLEAR_RESIDENCY" || result.status === "LIFE_EVENTS_EXCEPTION" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50");

  const confidence: ConfidenceLevel = result.status === "UNCLEAR_RESIDENCY" ? "LOW" : (result.status === "LIFE_EVENTS_EXCEPTION" ? "MEDIUM" : "HIGH");
  const confidenceNote = result.status === "UNCLEAR_RESIDENCY"
    ? "Residency uncertain — determine position under ITAA 1936 s6(1) before CGT outcome is reliable."
    : result.status === "LIFE_EVENTS_EXCEPTION"
      ? "Life events exception is narrow — ATO private ruling recommended before relying on it."
      : "CGT outcome determined deterministically from residency at contract date + property classification.";

  // Tier selection
  const tier2Triggers = [
    result.status === "EXEMPTION_DENIED_FOREIGN_RESIDENT",
    result.status === "PLAN_NOW_NOT_YET_SOLD" && result.auResidency === "no",
    result.status === "LIFE_EVENTS_EXCEPTION",
    result.estimatedGain === "over_700k",
    result.status === "UNCLEAR_RESIDENCY",
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "CGT position",              value: result.isExemptionDenied ? "Exemption denied" : (result.status === "EXEMPTION_APPLIES_AUSTRALIAN_RESIDENT" ? "Exemption may apply" : result.status === "LIFE_EVENTS_EXCEPTION" ? "Life event — narrow" : "Planning open"), highlight: result.isExemptionDenied },
      { label: "Estimated gain band",         value: GAIN_LABEL[result.estimatedGain]                                                                                                                                                                                                                           },
      { label: "Est. tax if foreign res.",     value: aud(result.nonResTax),                                                                                                                                                                                                                             highlight: result.isExemptionDenied },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My Expat CGT Strategy — $147 →" : "Get My Expat CGT Risk Report — $67 →",
    altTierLabel: tier === 147 ? "Just want the risk report? — $67 instead" : "Want the full strategy + contract timing plan? — $147",
    productKey67: PRODUCT_KEYS.p67,
    productKey147: PRODUCT_KEYS.p147,
    result,
  };
}

type Q = {
  id: string;
  step: number;
  type: "button_group";
  label: string;
  subLabel?: string;
  options: { label: string; value: string; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "au_residency", step: 1, type: "button_group",
    label: "Are you currently an Australian tax resident?",
    subLabel: "ITAA 1936 s6(1) — resides test, domicile test, 183-day test. Fail all three = foreign resident for CGT.",
    options: [
      { label: "Yes — living in Australia",               value: "yes",        subLabel: "Main residence exemption may apply" },
      { label: "No — living overseas, non-resident",       value: "no",         subLabel: "Exemption denied (post 9 May 2017)" },
      { label: "Uncertain — split time",                     value: "uncertain",  subLabel: "Residency determination needed" },
    ],
    required: true,
  },
  {
    id: "purchase_date", step: 2, type: "button_group",
    label: "When did you purchase the property?",
    subLabel: "9 May 2017 is the operative date. Pre-2017 transitional provisions have now expired.",
    options: [
      { label: "Before 9 May 2017",                      value: "pre_2017",  subLabel: "Transitional provisions expired" },
      { label: "9 May 2017 or later",                      value: "post_2017", subLabel: "Full s118-115 rule applies" },
    ],
    required: true,
  },
  {
    id: "main_residence", step: 3, type: "button_group",
    label: "Was this property your main residence (principal place of abode)?",
    subLabel: "Main residence = your principal place of abode under s118-110. 6-year rule for renting may extend treatment (for Australian residents only).",
    options: [
      { label: "Yes — main home entire period",         value: "yes",     subLabel: "Full exemption potentially available" },
      { label: "Partially — lived there then rented",    value: "partial", subLabel: "Partial exemption by days calculation" },
      { label: "No — always an investment property",      value: "no",      subLabel: "No main residence exemption ever" },
    ],
    required: true,
  },
  {
    id: "departure_timing", step: 4, type: "button_group",
    label: "When did you leave Australia / become non-resident?",
    subLabel: "Affects residency trajectory and whether return-to-residency strategy is viable before contract date.",
    options: [
      { label: "Still Australian resident",                value: "still_resident", subLabel: "Exemption pathway clear" },
      { label: "Left within last 2 years",                  value: "recent",          subLabel: "Return to residency may be straightforward" },
      { label: "Left 2-5 years ago",                         value: "2_5_years",       subLabel: "Return possible but requires substance" },
      { label: "Left more than 5 years ago",                  value: "over_5_years",     subLabel: "Return to residency is a major life decision" },
      { label: "Never was Australian resident",                value: "never",             subLabel: "Exemption not available under any scenario" },
    ],
    required: true,
  },
  {
    id: "contract_signed", step: 5, type: "button_group",
    label: "Have you signed the contract of sale yet?",
    subLabel: "CGT event A1 (s104-15) occurs at contract date — NOT settlement. This is the single residency snapshot that matters.",
    options: [
      { label: "No — property not yet sold",              value: "not_yet",    subLabel: "Planning window open" },
      { label: "Yes — contract signed",                     value: "signed",     subLabel: "Residency at signing date is locked in" },
      { label: "Property not yet listed",                    value: "not_listed", subLabel: "Maximum planning window" },
    ],
    required: true,
  },
  {
    id: "estimated_gain", step: 6, type: "button_group",
    label: "Estimated capital gain (sale price minus purchase price + costs)?",
    subLabel: "Used to estimate CGT liability at non-resident marginal rate (up to 45%) with no 50% CGT discount.",
    options: [
      { label: "Under $100,000",                value: "under_100k",     subLabel: "Lower marginal bracket applies" },
      { label: "$100,000-$300,000",              value: "100k_to_300k",   subLabel: "Part higher bracket" },
      { label: "$300,000-$700,000",              value: "300k_to_700k",   subLabel: "Top marginal bracket exposure" },
      { label: "Over $700,000",                    value: "over_700k",      subLabel: "Substantial CGT — strategy material" },
    ],
    required: true,
  },
  {
    id: "life_event", step: 7, type: "button_group",
    label: "Does a life events exception apply?",
    subLabel: "s118-115(3) narrow exception — all conditions must be met AND property must have been main residence for the entire relevant period.",
    options: [
      { label: "Death of spouse/partner",                  value: "death",     subLabel: "May preserve exemption under s118-115(3)" },
      { label: "Terminal medical condition",                 value: "terminal", subLabel: "Owner, spouse, or minor child" },
      { label: "Divorce/separation (Family Law Act order)", value: "divorce",  subLabel: "Family Court order required" },
      { label: "None of these apply",                        value: "none",     subLabel: "Exception pathway not available" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 7;

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

      {/* CGT logic chain — always visible */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Expat CGT test applied in sequence — ITAA 1997 s118-110 + s118-115 + s104-15</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (result.isExemptionDenied ? "bg-red-100" : "bg-emerald-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (result.isExemptionDenied ? "text-red-700" : "text-emerald-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (result.isExemptionDenied ? "text-red-700" : "text-emerald-700") : "text-neutral-700"}`}>{r.layer}</p>
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

      {/* CGT math visual */}
      {result.isExemptionDenied && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Expat CGT math — foreign resident treatment</p>
          <p className="font-bold text-red-900">
            {aud(result.gainMidpoint)} gain × 45% = {aud(result.nonResTax)} tax (no 50% discount)
          </p>
          <p className="mt-1 text-xs text-red-800">
            Plus 12.5% withholding ~{aud(result.withholding)} at settlement (if sale over $750k without ATO clearance certificate). Final CGT reconciled in Australian tax return.
          </p>
        </div>
      )}

      {/* Planning window visual */}
      {result.status === "PLAN_NOW_NOT_YET_SOLD" && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">⏰ Planning window open</p>
          <p className="font-bold text-amber-900">
            Contract not yet signed — residency at signing date determines the outcome
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Signing as foreign resident: exemption denied, ~{aud(result.nonResTax)} tax. Signing as Australian resident: exemption may apply (s118-110 conditions). Contract date = CGT event date, NOT settlement.
          </p>
        </div>
      )}

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — AU CGT engines + residency cross-check</p>
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
          <strong className="text-neutral-950">The residency test is at contract date — not settlement.</strong> ITAA 1997 s104-15 sets CGT event A1 at the date the contract is made. s118-115 denies the main residence exemption to foreign residents at that date, regardless of property history. Contract timing is the single planning lever.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific CGT position with residency reasoning chain</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Estimated CGT exposure across foreign resident vs Australian resident scenarios</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Contract timing strategy + residency alignment pathway</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>ATO clearance certificate + FRCGW variation process (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Life events exception eligibility analysis (if applicable)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 Australian tax advisor questions</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your exact expat CGT position</p>
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
  onAnswer: (id: string, v: string) => void;
}) {
  const sel = (v: string) => value === v;
  const base = "rounded-xl border px-4 py-3 text-left transition";
  const active = "border-neutral-950 bg-neutral-950 text-white";
  const inactive = "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400";

  return (
    <div>
      <h2 className="mb-1 font-serif text-base font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-xs text-neutral-500">{q.subLabel}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map(opt => (
          <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value)}
            className={`${base} ${sel(opt.value) ? active : inactive}`}>
            <span className="block text-sm font-medium">{opt.label}</span>
            {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AuExpatCgtCalculator() {
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
    if (!visibleQs.length && step <= TOTAL_STEPS) {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
      return;
    }
    if (!stepComplete) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, 300);
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
        product_slug: "au-expat-cgt",
        source_path: "/nomad/check/au-expat-cgt",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          cgt_status: verdict.result.status,
          is_exemption_denied: verdict.result.isExemptionDenied,
          is_foreign_resident: verdict.result.isForeignResident,
          estimated_tax: verdict.result.nonResTax,
          tier: verdict.tier,
        },
        recommended_tier: verdict.tier,
      }),
    }).then(r => r.json()).then(d => { if (d.id) setSessionId(d.id); }).catch(() => {});
  }, [showVerdict]);

  function answer(id: string, v: string) {
    setAnswers(p => ({ ...p, [id]: v }));
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) {
      let prev = step - 1;
      while (prev > 1 && !QUESTIONS.some(q => q.step === prev && (!q.showIf || q.showIf(answers)))) {
        prev -= 1;
      }
      setStep(prev);
    }
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "au_expat_cgt", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `auexpatcgt_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("au-expat-cgt_au_residency",      String(answers.au_residency      || ""));
    sessionStorage.setItem("au-expat-cgt_purchase_date",      String(answers.purchase_date     || ""));
    sessionStorage.setItem("au-expat-cgt_main_residence",     String(answers.main_residence    || ""));
    sessionStorage.setItem("au-expat-cgt_departure_timing",   String(answers.departure_timing  || ""));
    sessionStorage.setItem("au-expat-cgt_contract_signed",    String(answers.contract_signed   || ""));
    sessionStorage.setItem("au-expat-cgt_estimated_gain",     String(answers.estimated_gain    || ""));
    sessionStorage.setItem("au-expat-cgt_life_event",         String(answers.life_event        || ""));
    sessionStorage.setItem("au-expat-cgt_cgt_status",         verdict.result.status);
    sessionStorage.setItem("au-expat-cgt_is_exemption_denied", String(verdict.result.isExemptionDenied));
    sessionStorage.setItem("au-expat-cgt_estimated_tax",       String(verdict.result.nonResTax));
    sessionStorage.setItem("au-expat-cgt_status",               verdict.status);
    sessionStorage.setItem("au-expat-cgt_tier",                  String(popupTier));

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
          success_url: `${window.location.origin}/nomad/check/au-expat-cgt/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad/check/au-expat-cgt`,
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
              {visibleQs.map(q => <QuestionBlock key={q.id} q={q} value={answers[q.id] as string} onAnswer={answer} />)}
            </div>
          </div>
        )}

        {showVerdict && verdict && (
          <div ref={verdictRef} className="space-y-4">
            <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Change my answers</button>
            <VerdictBlock verdict={verdict} onCheckout={openPopup} loading={loading} />
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your expat CGT decision for your Australian tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your CGT outcome by email — free.</p>
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
                    {popupTier === 67 ? "Your Expat CGT Risk Report" : "Your Expat CGT Strategy System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ITAA 1997 s118-110 + s118-115 + s104-15 · ATO · April 2026</p>
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
                      {popupTier === 67 ? "Expat CGT Risk Report™" : "Expat CGT Strategy System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your specific CGT position, residency-at-contract-date risk, estimated tax liability, withholding obligation, and life event eligibility."
                        : "Full expat CGT strategy: contract timing, residency alignment options, CGT minimisation, ATO clearance certificate process, and audit-ready documentation."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic AU CGT content. Your specific expat position + contract timing + residency alignment plan.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Expat CGT Risk →" : "Get My Expat CGT Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the risk report? — $67 instead" : "Want the full strategy? — $147 instead"}
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
                    { label: "Your role", key: "filing_role", options: [["expat_overseas","Expat — living overseas, Australian property"],["returning_aus","Returning to Australia — considering sale timing"],["dual_citizen","Dual citizen — split time"],["advisor","Australian tax advisor / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["contract_imminent","Contract signing in next 30 days"],["listing_soon","Listing within next 3 months"],["planning_year","Planning within next 12 months"],["strategic","Long-term strategy"]] },
                    { label: "Do you have an Australian tax advisor?", key: "accountant", options: [["ca_cpa","Yes — CA/CPA with international expertise"],["general","Yes — general accountant"],["diy","Self-managed"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · ATO expat CGT (ITAA 1997 s118-110 + s118-115)</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.isExemptionDenied && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Exemption denied — foreign resident</p>
              <p className="text-sm font-bold text-neutral-950">
                Est. {aud(verdict.result.nonResTax)} CGT at risk
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
