"use client";

/**
 * CAN-01 — Canada Departure Tax Trap Auditor
 * Pattern: Timeline + CashflowModel -> deemed disposition exposure + optimisation
 *
 * Legal anchor: Income Tax Act (Canada) s128.1 (deemed disposition on departure)
 *
 * DETERMINATION ORDER:
 *   1. Not yet left / still in Canada -> PLAN_NOW window open
 *   2. Already left + no departure return filed -> COMPLIANCE_GAP
 *   3. Already left + return filed -> POST_DEPARTURE_OPTIMISE
 *   4. Leaving soon + high portfolio -> DEPARTURE_TAX_TRIGGERED (major)
 *   5. Minimal portfolio / mostly excluded -> LOW_EXPOSURE
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "PLAN_NOW_PRE_DEPARTURE"
  | "DEPARTURE_TAX_TRIGGERED"
  | "COMPLIANCE_GAP_RETURN_NOT_FILED"
  | "POST_DEPARTURE_OPTIMISE"
  | "LOW_EXPOSURE_MOSTLY_EXCLUDED"
  | "UNCERTAIN_NEEDS_REVIEW";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface DepartureResult {
  departureStatus:      string;
  departureReturnFiled:  string;
  assetTypes:             string;
  portfolioFmv:             string;
  gainLevel:                 string;
  destinationCountry:         string;
  hasRrsp:                      string;

  fmvMidpoint:                  number;
  deemedGain:                    number;
  taxableGain:                    number;
  departureTax:                    number;
  rrspWithholdingRange:             string;

  status:                            Status;
  statusLabel:                        string;
  isTriggered:                         boolean;
  isCompliance:                         boolean;
  hasPlanningWindow:                     boolean;

  reasoningChain:                          Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:                                    Route[];
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
  result: DepartureResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "can_67_departure_tax_trap",
  p147: "can_147_departure_tax_trap",
};

const FMV_MIDPOINT: Record<string, number> = {
  under_100k:     60000,
  "100k_to_300k": 200000,
  "300k_to_750k": 525000,
  over_750k:      1200000,
};

const FMV_LABEL: Record<string, string> = {
  under_100k:     "Under $100,000",
  "100k_to_300k": "$100,000-$300,000",
  "300k_to_750k": "$300,000-$750,000",
  over_750k:      "Over $750,000",
};

// Gain ratio as fraction of FMV (rough heuristic for modelling)
const GAIN_RATIO: Record<string, number> = {
  minimal:     0.08,   // ~10% gain over 90% ACB
  "25_to_50":  0.27,
  "50_to_100": 0.45,
  over_100:    0.60,
  unsure:      0.35,
};

// RRSP withholding range per destination treaty (approximate)
const RRSP_WHT_BY_DEST: Record<string, string> = {
  uk:       "10-25% (treaty)",
  au:       "15% (treaty)",
  us:       "15% (treaty)",
  eu:       "15% (treaty)",
  zero_tax: "25% (no treaty)",
  other:    "25% default (check treaty)",
};

function cad(n: number): string {
  return `$${Math.round(n).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
}

function calcDeparture(answers: AnswerMap): DepartureResult {
  const departureStatus      = String(answers.departure_status       || "leaving_12mo");
  const departureReturnFiled  = String(answers.departure_return_filed  || "not_applicable");
  const assetTypes             = String(answers.asset_types             || "portfolio_rrsp");
  const portfolioFmv            = String(answers.portfolio_fmv            || "300k_to_750k");
  const gainLevel                = String(answers.gain_level               || "50_to_100");
  const destinationCountry        = String(answers.destination_country      || "uk");
  const hasRrsp                     = String(answers.has_rrsp                 || "yes_modest");

  const fmvMidpoint = FMV_MIDPOINT[portfolioFmv] ?? 525000;
  const gainRatio = GAIN_RATIO[gainLevel] ?? 0.35;

  // Asset-mix adjustment: if mostly real estate or mostly registered, scale down portfolio FMV contribution
  let effectiveFmv = fmvMidpoint;
  if (assetTypes === "mostly_real_estate") effectiveFmv = fmvMidpoint * 0.25;
  if (assetTypes === "mostly_registered") effectiveFmv = fmvMidpoint * 0.20;
  if (assetTypes === "portfolio_real_estate") effectiveFmv = fmvMidpoint * 0.70;

  const deemedGain = Math.round(effectiveFmv * gainRatio);
  const taxableGain = Math.round(deemedGain * 0.50);
  // Combined federal + provincial top-bracket rate ~53% (Ontario top); use 50% as reasonable average
  const departureTax = Math.round(taxableGain * 0.50);

  const rrspWithholdingRange = hasRrsp === "no" ? "N/A" : RRSP_WHT_BY_DEST[destinationCountry] ?? "25% (check treaty)";

  const reasoningChain: DepartureResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";

  // STATE 1 — Still in Canada (planning horizon)
  if (departureStatus === "still_canada") {
    reasoningChain.push({ layer: "Status — Still Canadian resident", outcome: "Not planning imminent departure — full planning toolkit available if future move contemplated. No immediate departure tax exposure.", resolved: true });
    status = "LOW_EXPOSURE_MOSTLY_EXCLUDED";
    statusLabel = "NO DEPARTURE — STILL CANADIAN RESIDENT";
  }

  // STATE 2 — Considering 1-3 years out or leaving in 12mo (planning window)
  if (status === null && (departureStatus === "considering_1_3yr" || departureStatus === "leaving_12mo")) {
    reasoningChain.push({ layer: "Status — Pre-departure", outcome: `Departure ${departureStatus === "leaving_12mo" ? "within 12 months" : "1-3 years away"} — planning window open for pre-departure optimisation.`, resolved: true });
    reasoningChain.push({ layer: "s128.1 deemed disposition preview", outcome: `On departure: effective FMV ≈ ${cad(effectiveFmv)} × ${Math.round(gainRatio * 100)}% gain ratio = ${cad(deemedGain)} deemed gain. Taxable ≈ ${cad(taxableGain)} × marginal rate ≈ ${cad(departureTax)} tax.`, resolved: true });
    status = "PLAN_NOW_PRE_DEPARTURE";
    statusLabel = departureStatus === "leaving_12mo" ? "PLAN NOW — DEPARTURE WITHIN 12 MONTHS" : "PLANNING WINDOW — DEPARTURE 1-3 YEARS";
  }

  // STATE 3 — Already left, no return filed (compliance gap)
  if (status === null && (departureStatus === "left_under_12mo" || departureStatus === "left_over_12mo") && departureReturnFiled === "no_not_filed") {
    reasoningChain.push({ layer: "Status — Post-departure compliance gap", outcome: "Already left Canada but no departure return filed. Mandatory T1 + T1161 (if FMV over $25k) still owing. Penalties + interest accruing.", resolved: true });
    reasoningChain.push({ layer: "s128.1 deemed disposition", outcome: `Deemed gain ≈ ${cad(deemedGain)} → taxable ≈ ${cad(taxableGain)} → tax ≈ ${cad(departureTax)}. Plus penalties and interest. Voluntary Disclosure Program (VDP) may reduce penalties if proactive.`, resolved: true });
    status = "COMPLIANCE_GAP_RETURN_NOT_FILED";
    statusLabel = "COMPLIANCE GAP — DEPARTURE RETURN NOT FILED";
  }

  // STATE 4 — Already left, return filed (post-departure optimisation)
  if (status === null && (departureStatus === "left_under_12mo" || departureStatus === "left_over_12mo") && departureReturnFiled === "yes_filed") {
    reasoningChain.push({ layer: "Status — Post-departure compliant", outcome: "Already left with departure return filed. Focus shifts to ongoing Canadian-source income management (RRSP withdrawals, rental property, pensions) and any T1244 deferral maintenance.", resolved: true });
    if (hasRrsp !== "no") {
      reasoningChain.push({ layer: "Ongoing RRSP/RRIF exposure", outcome: `RRSP withdrawals as non-resident subject to Canadian withholding: ${rrspWithholdingRange} depending on destination country treaty. Section 217 election may be beneficial for low-Canadian-income years.`, resolved: true });
    }
    status = "POST_DEPARTURE_OPTIMISE";
    statusLabel = "POST-DEPARTURE — ONGOING INCOME OPTIMISATION";
  }

  // STATE 5 — Already left, unsure/accountant handled
  if (status === null && (departureStatus === "left_under_12mo" || departureStatus === "left_over_12mo") && departureReturnFiled === "unsure") {
    reasoningChain.push({ layer: "Status — Post-departure review", outcome: "Already left; departure return status uncertain. Confirm with CRA via My Account or tax professional — if departure return was missed, voluntary disclosure (VDP) may apply.", resolved: true });
    status = "POST_DEPARTURE_OPTIMISE";
    statusLabel = "POST-DEPARTURE — CONFIRM FILING STATUS";
  }

  // STATE 6 — Low exposure path (mostly excluded assets)
  if (status === null && (assetTypes === "mostly_real_estate" || assetTypes === "mostly_registered")) {
    reasoningChain.push({ layer: "Status — Low deemed disposition exposure", outcome: "Most assets are excluded from s128.1 deemed disposition (Canadian real estate or registered accounts). Departure tax exposure minimal — but RRSP/RRIF withholding + Canadian real estate NRWHT applicable on future transactions.", resolved: true });
    status = "LOW_EXPOSURE_MOSTLY_EXCLUDED";
    statusLabel = "LOW EXPOSURE — MOSTLY EXCLUDED ASSETS";
  }

  // Fallback
  if (status === null) {
    status = "UNCERTAIN_NEEDS_REVIEW";
    statusLabel = "UNCERTAIN — REVIEW NEEDED";
    reasoningChain.push({ layer: "Fallback", outcome: "Input pattern does not map cleanly — Canadian tax specialist review recommended.", resolved: true });
  }

  // T1161 requirement layer
  if (status !== "LOW_EXPOSURE_MOSTLY_EXCLUDED" && effectiveFmv > 25000) {
    reasoningChain.push({ layer: "Filing — T1161", outcome: `FMV of deemed-disposition property ≈ ${cad(effectiveFmv)} exceeds $25,000 threshold — T1161 property list required with departure T1.`, resolved: true });
  }

  // Deferral (T1244) availability
  const statusStr: string = status;
  if ((statusStr === "PLAN_NOW_PRE_DEPARTURE" || statusStr === "DEPARTURE_TAX_TRIGGERED" || statusStr === "POST_DEPARTURE_OPTIMISE") && departureTax > 10000) {
    reasoningChain.push({ layer: "Deferral option — T1244", outcome: `Departure tax ≈ ${cad(departureTax)} — T1244 deferral election available by posting security (letter of credit, bonds) with CRA. Defers payment until actual disposal.`, resolved: true });
  }

  const isTriggered = statusStr === "DEPARTURE_TAX_TRIGGERED" || statusStr === "PLAN_NOW_PRE_DEPARTURE";
  const isCompliance = status === "COMPLIANCE_GAP_RETURN_NOT_FILED";
  const hasPlanningWindow = status === "PLAN_NOW_PRE_DEPARTURE" || departureStatus === "considering_1_3yr" || departureStatus === "still_canada";

  // Routing
  const routes: Route[] = [];
  if (statusStr === "PLAN_NOW_PRE_DEPARTURE" || statusStr === "DEPARTURE_TAX_TRIGGERED") {
    routes.push({ label: "Exit Tax Trap Auditor — cross-country comparison", href: "/nomad/check/exit-tax-trap", note: "Compare Canadian departure tax vs other countries' exit tax regimes" });
    routes.push({ label: "183-Day Rule Reality Check — destination residency", href: "/nomad/check/183-day-rule", note: "Confirm new country residency position timing" });
    routes.push({ label: "Tax Treaty Navigator", href: "/nomad/check/tax-treaty-navigator", note: "Treaty impact on Canadian-source income post-departure" });
  } else if (status === "COMPLIANCE_GAP_RETURN_NOT_FILED") {
    routes.push({ label: "Tax Treaty Navigator — destination treaty analysis", href: "/nomad/check/tax-treaty-navigator", note: "Treaty position for remediation planning" });
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Confirm current residency position" });
  } else if (status === "POST_DEPARTURE_OPTIMISE") {
    routes.push({ label: "Tax Treaty Navigator", href: "/nomad/check/tax-treaty-navigator", note: "Ongoing Canadian-source income treaty optimisation" });
    routes.push({ label: "Exit Tax Trap Auditor", href: "/nomad/check/exit-tax-trap", note: "If considering additional departures" });
  } else {
    routes.push({ label: "Exit Tax Trap Auditor", href: "/nomad/check/exit-tax-trap", note: "Cross-country exit tax overview" });
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Current residency position" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    departureStatus, departureReturnFiled, assetTypes, portfolioFmv, gainLevel, destinationCountry, hasRrsp,
    fmvMidpoint: effectiveFmv,
    deemedGain, taxableGain, departureTax,
    rrspWithholdingRange,
    status, statusLabel,
    isTriggered, isCompliance, hasPlanningWindow,
    reasoningChain, routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcDeparture(answers);

  const headline = (() => {
    if (result.status === "PLAN_NOW_PRE_DEPARTURE") return `Your estimated Canadian departure tax is approximately ${cad(result.departureTax)} on a deemed gain of ${cad(result.deemedGain)} (50% inclusion rate × marginal rate). This is triggered automatically under s128.1 on the date you cease Canadian residency — even without any actual sale. Your planning window is open — pre-departure gain/loss harvesting, T1244 deferral, and LCGE analysis can meaningfully reduce or defer this exposure.`;
    if (result.status === "COMPLIANCE_GAP_RETURN_NOT_FILED") return `You have already left Canada but did not file a departure return. Under s128.1 this triggered a deemed disposition of approximately ${cad(result.deemedGain)} — creating an estimated ${cad(result.departureTax)} tax liability. Form T1161 should also have been filed listing all property subject to the deemed disposition. Voluntary Disclosure Program (VDP) may reduce penalties if you act before CRA initiates contact.`;
    if (result.status === "POST_DEPARTURE_OPTIMISE") return `Your departure return was filed. Focus now shifts to ongoing Canadian-source income management — RRSP/RRIF withholding (${result.rrspWithholdingRange}), Canadian rental income (Section 216 election), and potential T1244 deferral maintenance if your departure tax was deferred. Section 217 election may be beneficial depending on total Canadian-source income.`;
    if (result.status === "LOW_EXPOSURE_MOSTLY_EXCLUDED") return `Your Canadian departure tax exposure is low — your assets are primarily Canadian real estate or registered accounts (RRSP/RRIF/TFSA), both of which are excluded from s128.1 deemed disposition. Tax triggers on real property only when actually sold (25% NRWHT under Part XIII); registered accounts are subject to withholding only on withdrawal (${result.rrspWithholdingRange}). Your departure would generate minimal immediate tax under Canadian rules.`;
    return `Your Canadian departure tax position requires specialist review — your inputs do not map cleanly to a single scenario.`;
  })();

  const consequences: string[] = [];

  if (result.status === "PLAN_NOW_PRE_DEPARTURE") {
    consequences.push(`📊 Estimated departure tax ~${cad(result.departureTax)} on deemed gain ~${cad(result.deemedGain)} (s128.1).`);
    consequences.push(`Pre-departure planning moves: (1) realise losses before departure to offset deemed gains (loss harvesting); (2) Lifetime Capital Gains Exemption on qualifying private company shares (up to $1.016M 2024); (3) time departure to lower-income year if feasible; (4) transfer assets to spouse pre-departure (attribution rules apply).`);
    consequences.push(`Form T1161 required listing all property subject to deemed disposition (FMV aggregate ~${cad(result.fmvMidpoint)} — well above $25k threshold). Filed with departure T1 return.`);
    consequences.push(`T1244 deferral election: post security (bank LOC, Canadian bonds) with CRA; defer tax payment until actual disposal. Annual security cost typically 1-3% of deferred tax. Cleanest cash flow management for large portfolios.`);
    if (result.hasRrsp !== "no") {
      consequences.push(`RRSP/RRIF ongoing exposure: withdrawals subject to ${result.rrspWithholdingRange} Part XIII withholding. Consider Section 217 election annually for graduated rates on pension income. TFSA remains tax-free in Canada (destination country may tax growth).`);
    }
    consequences.push(`Canadian real estate (if held): excluded from s128.1 but 25% NRWHT applies on actual sale. Section 116 certificate process reduces withholding to 25% of gain. Section 216 election for rental income at graduated rates.`);
    consequences.push(`Specialist engagement: CPA Canada member with international tax experience (not generic tax preparer). Typical pre-departure engagement fee $3,000-$7,000 — ROI vs departure tax savings typically 5-20x.`);
    consequences.push(`Timeline: departure T1 due 30 April following year; balance owing due same day (interest from 1 May). T1244 election filed with or shortly after departure T1.`);
  } else if (result.status === "COMPLIANCE_GAP_RETURN_NOT_FILED") {
    consequences.push(`🔒 Compliance gap — departure return + T1161 not filed. Penalties + interest accrued under ITA s150 / s162 / s163.`);
    consequences.push(`Estimated unfiled liability: ~${cad(result.departureTax)} deemed disposition tax + late-filing penalty (5% + 1%/month up to 17%) + interest (CRA prescribed rate, currently ~10% annually).`);
    consequences.push(`T1161 penalties: $25/day up to $2,500 for failure to file the property list — independent of tax penalty.`);
    consequences.push(`Voluntary Disclosure Program (VDP): if you come forward BEFORE CRA contacts you, penalties may be reduced significantly (often to zero) and prosecution risk eliminated. Must be voluntary, complete, and include payment arrangements.`);
    consequences.push(`Immediate action: engage Canadian international tax specialist within 30 days. Assemble records: asset FMV on departure date, ACB documentation, departure evidence.`);
    consequences.push(`Ongoing Canadian income — as non-resident: RRSP/RRIF withdrawals subject to ${result.rrspWithholdingRange} withholding; Canadian real estate rental 25% NRWHT (or Section 216 election for graduated rates); dividends 15-25%.`);
    consequences.push(`If CRA initiates contact first, VDP no longer available and penalties + potential criminal prosecution (gross negligence) may apply. Time-sensitive.`);
  } else if (result.status === "POST_DEPARTURE_OPTIMISE") {
    consequences.push(`✓ Departure return filed — initial compliance complete.`);
    consequences.push(`Ongoing RRSP/RRIF withholding: ${result.rrspWithholdingRange} on withdrawals. Annual Section 217 election analysis — may be beneficial vs flat withholding depending on other Canadian-source income.`);
    consequences.push(`If T1244 deferral in place: maintain security (letter of credit renewal annually); track any actual disposals triggering partial payment; notify CRA of sales.`);
    consequences.push(`Canadian real estate holdings: ongoing 25% NRWHT on rental income unless Section 216 election filed (graduated rates on net rental); Section 116 certificate required on any sale.`);
    consequences.push(`Canadian source income planning: time RRSP withdrawals to low-total-income years (Section 217 benefit); coordinate with destination country tax system for foreign tax credit.`);
    consequences.push(`Treaty position: ${result.destinationCountry === "uk" ? "Canada-UK treaty" : result.destinationCountry === "au" ? "Canada-Australia treaty" : result.destinationCountry === "us" ? "Canada-US treaty" : "destination treaty"} governs withholding rates and pension article treatment.`);
    consequences.push(`Return to Canada: if residency resumed before actual disposal of deferred property, s128.1(6) election reverses the deemed disposition (useful for temporary absences under 5 years).`);
  } else if (result.status === "LOW_EXPOSURE_MOSTLY_EXCLUDED") {
    consequences.push(`✓ Low s128.1 exposure — most assets excluded (real estate / registered accounts).`);
    consequences.push(`Canadian real estate: remains subject to Canadian tax on actual sale (Part XIII 25% NRWHT; Section 116 process reduces to gain-based amount).`);
    consequences.push(`Registered accounts (RRSP/RRIF/TFSA): no departure tax. Withdrawal withholding: ${result.rrspWithholdingRange}.`);
    consequences.push(`Any non-registered portfolio still subject to deemed disposition — even a modest portfolio over $25k FMV triggers T1161 filing.`);
    consequences.push(`Plan for any eventual Canadian real estate sale as non-resident: Section 116 process requires CRA clearance before closing; 25% on gross price withheld otherwise.`);
    consequences.push(`Ongoing Canadian-source income: dividends, pensions, rental income subject to Part XIII or elective graduated rate filing.`);
  } else if (result.status === "UNCERTAIN_NEEDS_REVIEW") {
    consequences.push(`Specialist review required — inputs do not map cleanly to a single departure scenario.`);
    consequences.push(`Engage CPA Canada member with international tax experience. Generic Canadian tax preparers often miss critical s128.1 planning moves.`);
    consequences.push(`Before specialist engagement: gather asset inventory with FMV + ACB; departure date evidence; destination country treaty position; registered account balances.`);
  }

  const statusClass = result.isCompliance ? "text-red-700" : (result.isTriggered ? "text-amber-700" : (result.status === "LOW_EXPOSURE_MOSTLY_EXCLUDED" ? "text-emerald-700" : "text-amber-700"));
  const panelClass  = result.isCompliance ? "border-red-200 bg-red-50" : (result.isTriggered ? "border-amber-200 bg-amber-50" : (result.status === "LOW_EXPOSURE_MOSTLY_EXCLUDED" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"));

  const confidence: ConfidenceLevel = result.status === "UNCERTAIN_NEEDS_REVIEW" ? "LOW" : (result.hasPlanningWindow ? "HIGH" : "MEDIUM");
  const confidenceNote = result.status === "UNCERTAIN_NEEDS_REVIEW"
    ? "Inputs do not map cleanly — Canadian specialist review required."
    : result.isCompliance
      ? "Compliance gap identified — immediate engagement with VDP pathway recommended."
      : "Departure tax outcome determined deterministically by s128.1 applied to your asset profile.";

  // Tier selection
  const tier2Triggers = [
    result.portfolioFmv === "over_750k",
    result.portfolioFmv === "300k_to_750k",
    result.gainLevel === "over_100",
    result.gainLevel === "50_to_100",
    result.departureStatus === "left_under_12mo",
    result.departureStatus === "leaving_12mo",
    result.departureReturnFiled === "no_not_filed",
    result.hasRrsp === "yes_significant",
    result.assetTypes === "private_company",
    result.isCompliance,
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "Estimated departure tax",     value: result.departureTax > 0 ? cad(result.departureTax) : "$0",            highlight: result.departureTax >= 30000 },
      { label: "Deemed gain",                   value: result.deemedGain > 0 ? cad(result.deemedGain) : "$0"                                                                        },
      { label: "RRSP withholding (if drawn)",    value: result.rrspWithholdingRange                                                                                                    },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My Exit Tax Strategy — $147 →" : "Get My Departure Tax Report — $67 →",
    altTierLabel: tier === 147 ? "Just want the risk report? — $67 instead" : "Want the full exit strategy? — $147",
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
    id: "departure_status", step: 1, type: "button_group",
    label: "Have you left Canada / are you planning to?",
    subLabel: "Timing determines planning window. Already-departed focuses on compliance + deferral; pre-departure has full optimisation toolkit.",
    options: [
      { label: "Already left — within last 12 months",        value: "left_under_12mo",     subLabel: "Departure tax recently triggered" },
      { label: "Already left — more than 12 months ago",        value: "left_over_12mo",      subLabel: "Focus on compliance + ongoing income" },
      { label: "Planning to leave within 12 months",              value: "leaving_12mo",         subLabel: "Maximum planning window" },
      { label: "Considering departure — 1-3 years away",           value: "considering_1_3yr",    subLabel: "Full optimisation toolkit" },
      { label: "Still in Canada — checking future position",        value: "still_canada",         subLabel: "No immediate exposure" },
    ],
    required: true,
  },
  {
    id: "departure_return_filed", step: 2, type: "button_group",
    label: "Did you file a departure return?",
    subLabel: "Canadian T1 for year of departure + T1161 (if FMV over $25k) is mandatory. Failure = penalties + interest + potential VDP remediation.",
    options: [
      { label: "Yes — departure return filed with CRA",       value: "yes_filed",        subLabel: "Initial compliance complete" },
      { label: "No — stopped filing but no departure return",   value: "no_not_filed",    subLabel: "Compliance gap — VDP may apply" },
      { label: "Not sure — accountant handled it",                value: "unsure",           subLabel: "Confirm via CRA My Account" },
      { label: "Not applicable — not yet left",                     value: "not_applicable",   subLabel: "Planning stage" },
    ],
    required: true,
  },
  {
    id: "asset_types", step: 3, type: "button_group",
    label: "Asset types held at departure date (primary)",
    subLabel: "Canadian real estate + registered accounts (RRSP/RRIF/TFSA) excluded from s128.1. Investment portfolio + private shares fully in scope.",
    options: [
      { label: "Investment portfolio only (stocks, ETFs, bonds)",    value: "portfolio_only",        subLabel: "Fully in s128.1 scope" },
      { label: "Portfolio + RRSP/RRIF",                                  value: "portfolio_rrsp",        subLabel: "Portfolio in scope; RRSP separate rules" },
      { label: "Portfolio + Canadian real estate",                        value: "portfolio_real_estate", subLabel: "Portfolio in scope; real estate separate NRWHT rules" },
      { label: "Private company shares / business interests",               value: "private_company",        subLabel: "High complexity — LCGE may apply" },
      { label: "Mostly Canadian real estate (limited portfolio)",             value: "mostly_real_estate",    subLabel: "Low s128.1 exposure" },
      { label: "Mostly registered accounts (RRSP/TFSA)",                        value: "mostly_registered",      subLabel: "Low s128.1 exposure" },
    ],
    required: true,
  },
  {
    id: "portfolio_fmv", step: 4, type: "button_group",
    label: "Estimated total FMV of assets subject to deemed disposition",
    subLabel: "Excluding Canadian real estate and registered accounts. T1161 required above $25,000 aggregate FMV.",
    options: [
      { label: "Under $100,000",          value: "under_100k",       subLabel: "Modest exposure" },
      { label: "$100,000-$300,000",         value: "100k_to_300k",    subLabel: "Material exposure" },
      { label: "$300,000-$750,000",          value: "300k_to_750k",    subLabel: "Substantial — planning essential" },
      { label: "Over $750,000",               value: "over_750k",        subLabel: "High-stakes restructure window" },
    ],
    required: true,
  },
  {
    id: "gain_level", step: 5, type: "button_group",
    label: "Estimated gain of those assets above their adjusted cost base (ACB)",
    subLabel: "Deemed gain = FMV minus ACB. Long-held appreciated assets create the largest departure tax exposure.",
    options: [
      { label: "Most assets near ACB (minimal gain)",           value: "minimal",        subLabel: "Low deemed gain" },
      { label: "Gains of 25-50% above ACB",                       value: "25_to_50",      subLabel: "Moderate deemed gain" },
      { label: "Gains of 50-100% above ACB",                       value: "50_to_100",     subLabel: "Substantial deemed gain" },
      { label: "Gains over 100% above ACB",                         value: "over_100",       subLabel: "Large deemed gain — planning critical" },
      { label: "Not sure of ACB",                                      value: "unsure",          subLabel: "Records reconstruction needed" },
    ],
    required: true,
  },
  {
    id: "destination_country", step: 6, type: "button_group",
    label: "Destination country",
    subLabel: "Treaty determines ongoing withholding on Canadian-source income + prevents double taxation on departure gain.",
    options: [
      { label: "United Kingdom",                   value: "uk",        subLabel: "Comprehensive treaty — favourable" },
      { label: "Australia",                          value: "au",        subLabel: "15% standard withholding rate" },
      { label: "United States",                       value: "us",        subLabel: "Extensive pension provisions" },
      { label: "European Union country",               value: "eu",        subLabel: "Most have Canadian treaties" },
      { label: "UAE / zero-tax country",                 value: "zero_tax",  subLabel: "No treaty — 25% default withholding" },
      { label: "Other",                                   value: "other",     subLabel: "Check specific treaty" },
    ],
    required: true,
  },
  {
    id: "has_rrsp", step: 7, type: "button_group",
    label: "Do you have an RRSP or RRIF?",
    subLabel: "RRSP/RRIF balance not deemed disposed but withdrawals subject to Canadian withholding as non-resident.",
    options: [
      { label: "Yes — significant balance (over $250k)",            value: "yes_significant",  subLabel: "Material ongoing exposure" },
      { label: "Yes — modest balance (under $250k)",                  value: "yes_modest",        subLabel: "Plan withdrawals carefully" },
      { label: "No",                                                     value: "no",                subLabel: "No RRSP exposure" },
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

      {/* s128.1 logic chain */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Departure tax logic — Income Tax Act (Canada) s128.1</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (result.isCompliance ? "bg-red-100" : result.isTriggered ? "bg-amber-100" : "bg-emerald-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (result.isCompliance ? "text-red-700" : result.isTriggered ? "text-amber-700" : "text-emerald-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (result.isCompliance ? "text-red-700" : result.isTriggered ? "text-amber-700" : "text-emerald-700") : "text-neutral-700"}`}>{r.layer}</p>
                <p className="text-xs text-neutral-700">{r.outcome}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-amber-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tax math visual */}
      {result.departureTax > 10000 && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">Departure tax math — s128.1 deemed disposition</p>
          <p className="font-bold text-amber-900">
            Effective FMV {cad(result.fmvMidpoint)} → deemed gain {cad(result.deemedGain)} × 50% inclusion × ~50% marginal = {cad(result.departureTax)} tax
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Due {result.departureStatus === "left_under_12mo" ? "by 30 April following departure" : "30 April of year after departure"} regardless of any actual sale. T1244 deferral available by posting security.
          </p>
        </div>
      )}

      {/* Compliance gap visual */}
      {result.isCompliance && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Compliance gap — departure return not filed</p>
          <p className="font-bold text-red-900">
            Unfiled tax ~{cad(result.departureTax)} + late-filing penalties + interest
          </p>
          <p className="mt-1 text-xs text-red-800">
            CRA Voluntary Disclosure Program may reduce penalties if you come forward BEFORE CRA initiates contact. Time-sensitive — engage specialist within 30 days.
          </p>
        </div>
      )}

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — cross-country exit tax + treaty analysis</p>
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
          <strong className="text-neutral-950">The deemed disposition happens without a sale.</strong> Section 128.1 creates a legal fiction — you are taxed as if you sold all taxable property at FMV on departure day, whether or not you actually sold anything. Cash flow management via T1244 deferral is the primary tool.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific deemed disposition exposure with reasoning chain</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Asset-by-asset departure impact (inclusions, exclusions, special rules)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>RRSP and registered account analysis + treaty withholding rates</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>T1161 and T1244 filing guide with timelines</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Pre-departure tax optimisation plan (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Post-departure Canadian income management (tier 2)</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your exact Canadian departure position</p>
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

export default function CanDepartureTaxCalculator() {
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
        product_slug: "can-departure-tax",
        source_path: "/can/check/departure-tax-trap",
        country_code: "CA", currency_code: "CAD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          departure_status: verdict.result.status,
          departure_tax: verdict.result.departureTax,
          deemed_gain: verdict.result.deemedGain,
          is_compliance_gap: verdict.result.isCompliance,
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
      body: JSON.stringify({ email, source: "can_departure_tax", country_code: "CA", site: "taxchecknow" }),
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
    const sid = sessionId || `candtt_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("can-departure-tax_departure_status",       String(answers.departure_status       || ""));
    sessionStorage.setItem("can-departure-tax_departure_return_filed",    String(answers.departure_return_filed  || ""));
    sessionStorage.setItem("can-departure-tax_asset_types",                 String(answers.asset_types             || ""));
    sessionStorage.setItem("can-departure-tax_portfolio_fmv",                String(answers.portfolio_fmv            || ""));
    sessionStorage.setItem("can-departure-tax_gain_level",                     String(answers.gain_level               || ""));
    sessionStorage.setItem("can-departure-tax_destination_country",              String(answers.destination_country      || ""));
    sessionStorage.setItem("can-departure-tax_has_rrsp",                           String(answers.has_rrsp                 || ""));
    sessionStorage.setItem("can-departure-tax_deemed_gain",                           String(verdict.result.deemedGain));
    sessionStorage.setItem("can-departure-tax_departure_tax",                           String(verdict.result.departureTax));
    sessionStorage.setItem("can-departure-tax_departure_tax_status",                      verdict.result.status);
    sessionStorage.setItem("can-departure-tax_status",                                      verdict.status);
    sessionStorage.setItem("can-departure-tax_tier",                                         String(popupTier));

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
          success_url: `${window.location.origin}/can/check/departure-tax-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/can/check/departure-tax-trap`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your departure tax decision for your Canadian tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your s128.1 assessment by email — free.</p>
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
                    {popupTier === 67 ? "Your Departure Tax Risk Report" : "Your Exit Tax Strategy System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">Income Tax Act (Canada) s128.1 · CRA · April 2026</p>
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
                      {popupTier === 67 ? "Departure Tax Risk Report™" : "Exit Tax Strategy System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your specific deemed disposition analysis, estimated departure tax, RRSP withholding exposure, filing obligations (T1161/T1244), and treaty assessment."
                        : "Full Canadian exit tax strategy: pre-departure optimisation, T1244 deferral election, LCGE analysis, departure date timing, and post-departure Canadian-source income management."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic Canadian tax content. Your specific s128.1 position + T1244 deferral pathway.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Departure Tax Report →" : "Get My Exit Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the risk report? — $67 instead" : "Want the full exit strategy? — $147 instead"}
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
                    { label: "Your role", key: "filing_role", options: [["departing_exec","Departing Canadian executive / professional"],["founder_departing","Founder / private company shareholder departing"],["retiree_departing","Retiree relocating from Canada"],["post_departure","Already departed — compliance review"],["advisor","Canadian CPA / tax specialist"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["departure_imminent","Departure in next 30 days"],["departure_3mo","Departure within 3 months"],["cra_letter","CRA letter / compliance enquiry"],["missed_filing","Missed departure return — VDP review"],["planning","General planning"]] },
                    { label: "Do you have a Canadian tax advisor?", key: "accountant", options: [["cpa_international","Yes — CPA with international/departure expertise"],["general_cpa","Yes — general Canadian CPA"],["diy","Self-managed (TurboTax etc.)"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · CRA departure tax (Income Tax Act s128.1)</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.departureTax >= 30000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Estimated departure tax</p>
              <p className="text-sm font-bold text-neutral-950">
                {cad(verdict.result.departureTax)} · T1244 deferral option
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
