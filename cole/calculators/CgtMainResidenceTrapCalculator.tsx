"use client";

/**
 * AU-01 — CGT Main Residence Trap Engine
 * Pattern: Module B (Timeline) + Module C (Classification)
 * Brief: property pathway → timeline → main residence use → absence rule → income use → overlap → improvements
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface ExemptionResult {
  exemptionStatus: "full" | "partial" | "none" | "at_risk";
  taxableFraction: number;  // 0 to 1
  strongestTrigger: string;
  riskFlags: string[];
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
  exemption: ExemptionResult;
}

interface PopupAnswers {
  property_value: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXEMPTION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcExemption(answers: AnswerMap): ExemptionResult {
  const pathway       = String(answers.pathway || "");
  const mainUse       = String(answers.main_residence_use || "");
  const absenceAction = String(answers.absence_action || "");
  const absenceYears  = String(answers.absence_years || "");
  const incomeUse     = String(answers.income_use || "");
  const overlap       = answers.overlap_property;
  const foreignResident = answers.foreign_resident;
  const firstUseIncome = answers.first_use_income;
  const businessUse   = answers.business_use;

  const riskFlags: string[] = [];
  let taxableFraction = 0;
  let exemptionStatus: "full" | "partial" | "none" | "at_risk" = "full";
  let strongestTrigger = "";

  // ── Foreign resident at time of sale ─────────────────────────────────────
  if (foreignResident === true) {
    riskFlags.push("Foreign resident at time of sale — main residence exemption may be entirely unavailable under post-2020 rules");
    exemptionStatus = "none";
    taxableFraction = 1;
    strongestTrigger = "Foreign resident at time of sale — entire gain may be taxable";
  }

  // ── Never lived in it ─────────────────────────────────────────────────────
  if (mainUse === "none" || pathway === "pure_investment") {
    riskFlags.push("Property never used as main residence — no exemption available");
    exemptionStatus = "none";
    taxableFraction = 1;
    strongestTrigger = "No main residence use — full gain is taxable";
  }

  // ── Overlap with another property ─────────────────────────────────────────
  if (overlap === true) {
    riskFlags.push("Owned another main residence simultaneously — nomination required to determine which property gets the exemption for the overlap period");
    if (exemptionStatus === "full") exemptionStatus = "partial";
    if (!strongestTrigger) strongestTrigger = "Overlap with another property — partial exemption at risk";
  }

  // ── Income use ────────────────────────────────────────────────────────────
  if (incomeUse === "whole_property") {
    riskFlags.push("Whole property rented — exemption only applies for periods of genuine main residence use");
    if (exemptionStatus === "full") exemptionStatus = "partial";
    taxableFraction = Math.max(taxableFraction, 0.4);
    if (!strongestTrigger) strongestTrigger = "Whole property rented during ownership — partial exemption only";
  } else if (incomeUse === "airbnb") {
    riskFlags.push("Airbnb / short-term rental — treated as income-producing use that can reduce the exemption");
    if (exemptionStatus === "full") exemptionStatus = "partial";
    taxableFraction = Math.max(taxableFraction, 0.2);
    if (!strongestTrigger) strongestTrigger = "Airbnb or short-term rental — partial exemption reduction";
  } else if (incomeUse === "part_property") {
    riskFlags.push("Part of property rented — the rented portion reduces the exemption proportionally");
    if (exemptionStatus === "full") exemptionStatus = "at_risk";
    if (!strongestTrigger) strongestTrigger = "Part-property rental — proportional reduction in exemption";
  }

  // ── Business / home office use ────────────────────────────────────────────
  if (businessUse === true) {
    riskFlags.push("Dedicated home office or business use claimed — if occupancy expenses were claimed (not just running costs), the exemption is partially lost for the business area");
    if (exemptionStatus === "full") exemptionStatus = "at_risk";
    if (!strongestTrigger) strongestTrigger = "Home office / business use — occupancy expense claims reduce main residence exemption";
  }

  // ── First used to produce income ─────────────────────────────────────────
  if (firstUseIncome === true) {
    riskFlags.push("Property first used to produce income before becoming main residence — market value reset rules (s118-192) apply to the cost base, changing the CGT calculation");
    if (exemptionStatus === "full") exemptionStatus = "at_risk";
    if (!strongestTrigger) strongestTrigger = "First used to produce income — market value reset rules apply to cost base (s118-192)";
  }

  // ── Absence analysis ──────────────────────────────────────────────────────
  if (mainUse === "partial" && absenceAction === "rented") {
    if (absenceYears === "over_6") {
      riskFlags.push("Absent and rented for over 6 years — the 6-year absence rule only covers 6 years per absence. The excess period creates a taxable fraction.");
      if (exemptionStatus === "full") exemptionStatus = "partial";
      taxableFraction = Math.max(taxableFraction, 0.3);
      if (!strongestTrigger) strongestTrigger = "Absence exceeds 6 years — excess period is taxable, exemption not extended";
    } else if (absenceYears === "under_6") {
      riskFlags.push("Rented during absence but within 6 years — the 6-year absence rule may preserve the exemption. Confirm the property was not treated as another main residence during this period.");
      if (exemptionStatus === "full") exemptionStatus = "at_risk";
      if (!strongestTrigger) strongestTrigger = "Rented during absence — 6-year rule applies. Confirm no other main residence nomination.";
    }
  } else if (mainUse === "partial" && absenceAction === "empty") {
    if (absenceYears === "over_6") {
      riskFlags.push("Left empty for over 6 years — the 6-year rule still requires the property be absent due to moving out. Confirm treatment with accountant.");
    }
  }

  // ── Determine final confidence ────────────────────────────────────────────
  const hasHighRisk = riskFlags.length >= 2 || exemptionStatus === "none" || taxableFraction > 0.3;

  return { exemptionStatus, taxableFraction, strongestTrigger, riskFlags };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const pathway       = String(answers.pathway || "");
  const mainUse       = String(answers.main_residence_use || "");
  const foreignResident = answers.foreign_resident;
  const incomeUse     = String(answers.income_use || "");
  const overlap       = answers.overlap_property;
  const exemption     = calcExemption(answers);

  const KEYS = {
    p67:  "au_67_cgt_main_residence_trap",
    p147: "au_147_cgt_main_residence_trap",
  };

  // ── Full exemption — no flags ─────────────────────────────────────────────
  if (exemption.exemptionStatus === "full" && exemption.riskFlags.length === 0) {
    return {
      status: "FULL EXEMPTION — NO CGT APPEARS TO APPLY",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: "Based on your answers, your property appears to qualify for the full main residence exemption — the entire capital gain is likely exempt from CGT.",
      stats: [
        { label: "Exemption status", value: "Full exemption ✓" },
        { label: "Taxable fraction", value: "0%" },
        { label: "CGT exposure", value: "Likely $0" },
      ],
      consequences: [
        "The full main residence exemption requires: (1) you lived there as your main residence the entire time, (2) no income-producing use, (3) no overlap with another main residence",
        "Confirm your purchase and sale contract dates — the exemption is measured from contract to contract, not settlement to settlement",
        "Keep all purchase records, improvement costs, and any occupancy history — the ATO can audit up to 5 years after disposal",
      ],
      confidence: "HIGH",
      confidenceNote: "Full exemption confirmed based on answers — verify exact facts with your accountant.",
      tier: 67,
      ctaLabel: "Get My CGT Exemption Confirmed — $67 →",
      altTierLabel: "Want sale timing scenarios and cost-base optimisation? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      exemption,
    };
  }

  // ── Foreign resident — no exemption ──────────────────────────────────────
  if (foreignResident === true) {
    return {
      status: "FOREIGN RESIDENT — EXEMPTION LIKELY UNAVAILABLE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "Foreign residents at the time of sale generally cannot access the main residence exemption under rules that changed in 2020. The entire gain may be taxable.",
      stats: [
        { label: "Residency at sale", value: "Non-resident ✗", highlight: true },
        { label: "Exemption status", value: "Likely lost ✗", highlight: true },
        { label: "Taxable fraction", value: "Up to 100%", highlight: true },
      ],
      consequences: [
        "From 9 May 2017 (with a 30 June 2020 transition deadline), foreign residents at the time of disposal can no longer access the main residence exemption in most cases",
        "The pre-2017 grandfathering period has ended — this applies to sales on or after 1 July 2020",
        "Some limited exceptions apply — confirm your specific circumstances with a tax adviser experienced in international tax",
        "Foreign resident capital gains withholding (FRCGW) may also apply — the purchaser withholds 15% of the purchase price",
      ],
      confidence: "HIGH",
      confidenceNote: "Foreign resident exemption denial applies broadly post-2020 — professional advice essential.",
      tier: 147,
      ctaLabel: "Get My Main Residence Shield System — $147 →",
      altTierLabel: "Just want the CGT exposure plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      exemption,
    };
  }

  // ── No main residence use — full CGT ─────────────────────────────────────
  if (exemption.exemptionStatus === "none" && exemption.taxableFraction >= 1) {
    return {
      status: "NO EXEMPTION — PROPERTY NEVER USED AS MAIN RESIDENCE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "The property was never your main residence — the main residence exemption does not apply. The full capital gain is assessable.",
      stats: [
        { label: "Main residence use", value: "None ✗", highlight: true },
        { label: "Exemption status", value: "Not available", highlight: true },
        { label: "Taxable fraction", value: "100%" },
      ],
      consequences: [
        "The main residence exemption only applies to a property you have lived in as your main home",
        "An investment property that was never your main residence is fully subject to CGT on the entire capital gain",
        "The 50% CGT discount applies if you held the asset for more than 12 months — measured from contract date to contract date",
        "Capital losses can be applied to reduce the gain before the discount is applied",
      ],
      confidence: "HIGH",
      confidenceNote: "No main residence use — full gain is taxable.",
      tier: 67,
      ctaLabel: "Get My CGT Exposure Plan — $67 →",
      altTierLabel: "Want sale timing and cost-base optimisation? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      exemption,
    };
  }

  // ── Partial exemption — high risk ─────────────────────────────────────────
  if (exemption.exemptionStatus === "partial" || exemption.taxableFraction > 0) {
    const pct = Math.round(exemption.taxableFraction * 100);
    return {
      status: `PARTIAL EXEMPTION — APPROXIMATELY ${pct}%+ OF GAIN MAY BE TAXABLE`,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your property qualifies for a partial main residence exemption — but ${pct}% or more of the capital gain may be taxable based on your answers.`,
      stats: [
        { label: "Exemption type", value: "Partial only", highlight: true },
        { label: "Taxable fraction est.", value: `~${pct}%+`, highlight: true },
        { label: "Risk flags", value: String(exemption.riskFlags.length) },
      ],
      consequences: [
        "A partial exemption means only the main-residence portion of your ownership period is exempt — the income-producing or absent period is taxable",
        "Taxable portion = (days NOT covered by exemption ÷ total days) × total gain, then apply 50% discount if held over 12 months",
        exemption.strongestTrigger ? `Strongest trigger: ${exemption.strongestTrigger}` : "",
        overlap === true ? "Multiple property ownership during the same period requires a nomination decision — the wrong choice can cost significantly more tax" : "",
      ].filter(Boolean),
      confidence: "MEDIUM",
      confidenceNote: "Partial exemption estimated — exact calculation requires confirmed dates and professional review.",
      tier: 147,
      ctaLabel: "Get My Main Residence Shield System — $147 →",
      altTierLabel: "Just want the CGT exposure plan? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      exemption,
    };
  }

  // ── At risk — flags detected ──────────────────────────────────────────────
  return {
    status: "AT RISK — EXEMPTION MAY BE PARTIAL OR LOST",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: `${exemption.riskFlags.length} risk flag${exemption.riskFlags.length > 1 ? "s" : ""} detected that could reduce or eliminate your main residence exemption.`,
    stats: [
      { label: "Risk flags", value: String(exemption.riskFlags.length), highlight: true },
      { label: "Exemption status", value: "At risk ⚠", highlight: true },
      { label: "Professional review", value: "Recommended" },
    ],
    consequences: [
      ...exemption.riskFlags.slice(0, 3),
      "Confirm your exact ownership and use history with an accountant before lodging your return",
    ],
    confidence: "LOW",
    confidenceNote: "Multiple risk flags — exact position depends on specific facts and dates.",
    tier: 147,
    ctaLabel: "Get My Main Residence Shield System — $147 →",
    altTierLabel: "Just want the CGT exposure plan? — $67 instead",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    exemption,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

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
    id: "pathway", step: 1, type: "button_group",
    label: "Which best describes your property situation?",
    subLabel: "This determines the legal path and which exemption rules apply to your specific case",
    options: [
      { label: "Lived in it the whole time", value: "full_residence", subLabel: "Never rented, no income use, no absence" },
      { label: "Lived in it then moved out", value: "moved_out", subLabel: "Moved out, rented or left vacant" },
      { label: "Bought as investment, then moved in", value: "investment_first", subLabel: "Originally rented out, then became your home" },
      { label: "Mixed use — Airbnb, home office, or rental", value: "mixed_use", subLabel: "Income-producing use while living there" },
      { label: "Pure investment — never lived there", value: "pure_investment", subLabel: "Never used as main residence" },
    ],
    required: true,
  },
  {
    id: "main_residence_use", step: 2, type: "button_group",
    label: "How long did you live in the property as your main residence?",
    subLabel: "The exemption applies only for the period you genuinely lived there as your main home",
    options: [
      { label: "The entire ownership period", value: "all", subLabel: "Continuously lived there" },
      { label: "Part of the ownership period", value: "partial", subLabel: "Moved in and/or out at some point" },
      { label: "Never — investment only", value: "none", subLabel: "No main residence use" },
    ],
    showIf: (a) => a.pathway !== "pure_investment",
    required: true,
  },
  {
    id: "foreign_resident", step: 3, type: "two_button",
    label: "Were you a foreign resident for tax purposes at the time of sale?",
    subLabel: "Foreign residents at time of sale lost access to the main residence exemption in most cases from 1 July 2020",
    options: [
      { label: "No — Australian resident at time of sale", value: false },
      { label: "Yes — non-resident or uncertain", value: true, subLabel: "Exemption may be entirely unavailable" },
    ],
    required: true,
  },
  {
    id: "income_use", step: 4, type: "button_group",
    label: "Was any part of the property used to produce income?",
    subLabel: "Income-producing use reduces the exemption — the type and extent of use determines how much",
    options: [
      { label: "No — purely residential use", value: "none" },
      { label: "Whole property rented at some point", value: "whole_property", subLabel: "Full rental periods reduce exemption" },
      { label: "Part of property rented", value: "part_property", subLabel: "Proportional reduction for rented portion" },
      { label: "Airbnb or short-term rental", value: "airbnb", subLabel: "Treated as income-producing use" },
    ],
    showIf: (a) => a.foreign_resident !== true && a.pathway !== "pure_investment",
    required: true,
  },
  {
    id: "absence_action", step: 5, type: "button_group",
    label: "After you moved out, what happened to the property?",
    subLabel: "The 6-year absence rule can extend the exemption — but only under specific conditions",
    options: [
      { label: "Rented out", value: "rented", subLabel: "6-year rule may apply — check duration" },
      { label: "Left empty", value: "empty", subLabel: "No income use — exemption may continue" },
      { label: "Moved back in before selling", value: "moved_back", subLabel: "Resets the exemption period" },
      { label: "Sold immediately after moving out", value: "sold_immediately" },
    ],
    showIf: (a) => a.main_residence_use === "partial" && a.foreign_resident !== true,
  },
  {
    id: "absence_years", step: 6, type: "two_button",
    label: "Was the absence more or less than 6 years?",
    subLabel: "The 6-year rule only covers up to 6 years per absence — any excess period creates a taxable fraction",
    options: [
      { label: "6 years or less", value: "under_6", subLabel: "6-year rule may preserve exemption" },
      { label: "More than 6 years", value: "over_6", subLabel: "Excess period is taxable — no extension available" },
    ],
    showIf: (a) => a.absence_action === "rented" || a.absence_action === "empty",
  },
  {
    id: "first_use_income", step: 7, type: "two_button",
    label: "Was the property first used to produce income before you moved in as your main residence?",
    subLabel: "The market value reset rules (s118-192 ITAA 1997) apply if income-producing use came first — this changes the cost base calculation",
    options: [
      { label: "No — I moved in first, then rented later", value: false },
      { label: "Yes — rented first, then became my main home", value: true, subLabel: "Market value reset applies to your cost base" },
    ],
    showIf: (a) => a.pathway === "investment_first" || a.income_use !== "none",
  },
  {
    id: "business_use", step: 8, type: "two_button",
    label: "Did you use part of the property as a dedicated business place or claim occupancy expenses?",
    subLabel: "Claiming occupancy expenses (not just running costs) or having a dedicated business room can partially reduce the main residence exemption",
    options: [
      { label: "No — standard working from home or no claims", value: false },
      { label: "Yes — dedicated room, claimed occupancy expenses", value: true, subLabel: "Partial reduction in exemption for the business portion" },
    ],
    showIf: (a) => a.foreign_resident !== true && a.pathway !== "pure_investment",
  },
  {
    id: "overlap_property", step: 9, type: "two_button",
    label: "Did you own and treat another property as your main residence during any overlapping period?",
    subLabel: "You can only have one main residence at a time — owning two properties simultaneously requires a nomination that affects both exemptions",
    options: [
      { label: "No — only one property at a time", value: false },
      { label: "Yes — owned another main residence at the same time", value: true, subLabel: "Nomination required — one property loses exemption for the overlap" },
    ],
    showIf: (a) => a.foreign_resident !== true && a.pathway !== "pure_investment",
  },
];

const TOTAL_STEPS = 9;

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT BLOCK
// ─────────────────────────────────────────────────────────────────────────────

function VerdictBlock({ verdict, onCheckout, loading }: {
  verdict: VerdictResult;
  onCheckout: (t: Tier) => void;
  loading: boolean;
}) {
  const ex = verdict.exemption;

  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Risk flags */}
      {ex.riskFlags.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-red-700">Exemption risk flags</p>
          <ul className="space-y-2 text-xs text-red-900">
            {ex.riskFlags.map((f, i) => <li key={i}>→ {f}</li>)}
          </ul>
        </div>
      )}

      {/* Strongest trigger */}
      {ex.strongestTrigger && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-1">Strongest risk trigger</p>
          <p className="text-xs text-amber-900">→ {ex.strongestTrigger}</p>
        </div>
      )}

      {/* Partial exemption formula */}
      {ex.taxableFraction > 0 && ex.taxableFraction < 1 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">How the partial exemption is calculated</p>
          <div className="space-y-1 text-xs text-neutral-700">
            <p>→ Taxable portion = (days NOT covered by exemption ÷ total days owned) × capital gain</p>
            <p>→ Apply 50% CGT discount if held for 12+ months (contract to contract)</p>
            <p>→ Adjust for market value reset if asset was first used to produce income</p>
          </div>
        </div>
      )}

      {/* Consequences */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <strong className="text-sm text-neutral-950">What this means:</strong>
        <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
          {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
        </ul>
      </div>

      {/* Confidence */}
      <div className={`mb-4 rounded-xl border px-4 py-2 text-xs ${
        verdict.confidence === "HIGH" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : verdict.confidence === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800"
      }`}>
        <strong>Confidence: {verdict.confidence}</strong> — {verdict.confidenceNote}
      </div>

      {/* Conversion line */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-700 leading-relaxed">
          Most people assume their home is automatically tax-free. Renting, absence, business use, or owning another property can each reduce or eliminate the exemption without you realising.
          <strong className="text-neutral-950"> This check shows your exact exemption position.</strong>
        </p>
      </div>

      {/* What you get */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Exemption memo — your main residence position with the specific ATO rules applied</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Timeline map — ownership, occupancy, and income-use periods charted</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>6-year rule check — whether absence period is within the allowable window</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Taxable fraction worksheet — the formula applied to your specific dates</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions written for your exact exemption situation</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your answers above</p>
      <p className="mt-2 text-center">
        <button onClick={() => onCheckout(verdict.tier === 67 ? 147 : 67)} disabled={loading}
          className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
          {verdict.altTierLabel}
        </button>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BLOCK
// ─────────────────────────────────────────────────────────────────────────────

function QuestionBlock({ q, value, onAnswer }: {
  q: Q;
  value: AnswerMap[string];
  onAnswer: (id: string, v: string | boolean) => void;
}) {
  const sel = (v: string | boolean) => value === v || String(value) === String(v);
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
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as boolean)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition text-center ${sel(opt.value as boolean) ? active : inactive}`}>
              <span className="block">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as boolean) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CgtMainResidenceTrapCalculator() {
  const [answers, setAnswers]     = useState<AnswerMap>({});
  const [step, setStep]           = useState(1);
  const [showVerdict, setVerdict] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showQuestions, setShowQ] = useState(false);
  const [popupTier, setPopupTier] = useState<Tier>(147);
  const [popupAnswers, setPopupA] = useState<PopupAnswers>({ property_value: "", urgency: "", accountant: "" });
  const [email, setEmail]         = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const verdictRef                = useRef<HTMLDivElement>(null);

  const verdict   = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);
  const visibleQs = QUESTIONS.filter(q => q.step === step && (!q.showIf || q.showIf(answers)));
  const stepComplete = !visibleQs.length || visibleQs.filter(q => q.required !== false).every(q => {
    const v = answers[q.id];
    return v !== undefined && v !== "" && v !== null;
  });

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
        product_slug: "cgt-main-residence-trap",
        source_path: "/au/check/cgt-main-residence-trap",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          exemption_status: verdict.exemption.exemptionStatus,
          taxable_fraction: verdict.exemption.taxableFraction,
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
      body: JSON.stringify({ email, source: "cgt_main_residence_trap", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `cgtr_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("cgt-main-residence-trap_pathway", String(answers.pathway || ""));
    sessionStorage.setItem("cgt-main-residence-trap_exemption_status", verdict.exemption.exemptionStatus);
    sessionStorage.setItem("cgt-main-residence-trap_taxable_fraction", String(verdict.exemption.taxableFraction));
    sessionStorage.setItem("cgt-main-residence-trap_strongest_trigger", verdict.exemption.strongestTrigger);
    sessionStorage.setItem("cgt-main-residence-trap_status", verdict.status);
    sessionStorage.setItem("cgt-main-residence-trap_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/cgt-main-residence-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/cgt-main-residence-trap`,
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

  const maxStep     = QUESTIONS.reduce((acc, q) => (!q.showIf || q.showIf(answers)) ? Math.max(acc, q.step) : acc, 1);
  const popupComplete = Object.values(popupAnswers).every(v => v !== "");

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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your CGT main residence result.</p>
              <p className="mb-2 text-xs text-neutral-500">Email yourself the exemption summary — free.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">Send</button>
                </div>
              ) : <p className="text-sm font-semibold text-emerald-700">✓ Sent — check your inbox.</p>}
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
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>CGT Main Residence</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {verdict.exemption.exemptionStatus === "full" ? "Full exemption confirmed"
                    : verdict.exemption.exemptionStatus === "none" ? "No exemption — full gain taxable"
                    : `Partial exemption — ~${Math.round(verdict.exemption.taxableFraction * 100)}% taxable`}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · April 2026</p>
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
                      {popupTier === 67 ? "Your CGT Exposure Plan™" : "Your Main Residence Shield System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Exemption memo, timeline map, 6-year rule check, taxable fraction worksheet, evidence checklist, and accountant questions — built around your specific ownership history."
                        : "Everything in the exposure plan plus cost-base adjustment map, sale-timing scenarios, overlap nomination analysis, document pack, and next-action recommendation."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic CGT guide. Built around your property history.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My CGT Exposure Plan →" : "Get My Residence Shield System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the exposure plan? — $67 instead" : "Want timing scenarios and cost-base optimisation? — $147 instead"}
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
                    { label: "Approximate property value", key: "property_value", options: [["under_500k","Under $500,000"],["500k_1m","$500,000–$1 million"],["1m_2m","$1M–$2M"],["over_2m","Over $2 million"]] },
                    { label: "Where are you in the process?", key: "urgency", options: [["planning_sale","Planning to sell — not yet listed"],["under_contract","Under contract now"],["post_sale","Sold — preparing return"]] },
                    { label: "Do you have a tax adviser?", key: "accountant", options: [["yes_active","Yes — speaking with them soon"],["yes_inactive","Yes — not recently"],["no","No — managing myself"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · ATO-sourced content</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.exemption.exemptionStatus !== "full" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">CGT Main Residence</p>
              <p className="text-sm font-bold text-neutral-950 truncate">
                {verdict.exemption.exemptionStatus === "none" ? "No exemption — get your CGT plan"
                : `Partial exemption — ~${Math.round(verdict.exemption.taxableFraction * 100)}% taxable`}
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
