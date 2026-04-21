"use client";

/**
 * AU-06 — Small Business CGT Concessions Engine
 * Pattern: Module D (GateTest) — strict eligibility sequence
 * Brief: entity → size gate → active asset → ownership duration → retirement/age → significant individual → objective
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface ConcessionPath {
  name: string;
  available: boolean;
  reason: string;
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
  concessionPaths: ConcessionPath[];
  failingGate: string;
  estimatedSaving: string;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC — strict gate sequence
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const entityType       = String(answers.entity_type || "");
  const sizeGate         = answers.size_gate;
  const activeAsset      = answers.active_asset;
  const activeAssetRatio = String(answers.active_asset_ratio || "");
  const ownershipYears   = String(answers.ownership_years || "");
  const ageRetirement    = answers.age_retirement;
  const significantIndiv = answers.significant_individual;
  const saleObjective    = String(answers.sale_objective || "");
  const propertyOnly     = answers.property_only;

  const KEYS = {
    p67:  "au_67_small_business_cgt_concessions",
    p147: "au_147_small_business_cgt_concessions",
  };

  // ── GATE 1: Size test — turnover < $2M OR net assets < $6M ───────────────
  if (sizeGate === false) {
    return {
      status: "DOES NOT QUALIFY — FAILS SIZE TEST",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "Your business does not pass the size gate — turnover must be under $2 million OR net assets under $6 million to access small business CGT concessions.",
      stats: [
        { label: "Turnover test", value: "Under $2M", highlight: true },
        { label: "Net asset test", value: "Under $6M", highlight: true },
        { label: "Your status", value: "Fails both ✗", highlight: true },
      ],
      consequences: [
        "The small business CGT concessions are not available — your entity is too large",
        "The general 50% CGT discount (12+ months ownership) still applies if you are an individual or trust",
        "Speak to your accountant about other CGT strategies available to larger businesses",
      ],
      confidence: "HIGH",
      confidenceNote: "Size gate is a hard ATO requirement — no exceptions.",
      tier: 67,
      ctaLabel: "Get My CGT Strategy Memo — $67 →",
      altTierLabel: "Want the full exit blueprint? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      concessionPaths: [
        { name: "15-year exemption", available: false, reason: "Fails size gate" },
        { name: "50% active asset reduction", available: false, reason: "Fails size gate" },
        { name: "Retirement exemption", available: false, reason: "Fails size gate" },
        { name: "Rollover", available: false, reason: "Fails size gate" },
      ],
      failingGate: "Size test — turnover or net assets too large",
      estimatedSaving: "$0 — concessions not available",
    };
  }

  // ── GATE 2: Active asset test ─────────────────────────────────────────────
  if (activeAsset === false) {
    return {
      status: "FAILS ACTIVE ASSET TEST — CONCESSIONS NOT AVAILABLE",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: "The asset must have been used in your business for at least 50% of your ownership period — or 7.5 years — to pass the active asset test.",
      stats: [
        { label: "Active asset test", value: "Failed ✗", highlight: true },
        { label: "Required", value: "50% of ownership or 7.5 years" },
        { label: "Concessions available", value: "None", highlight: true },
      ],
      consequences: [
        "The active asset test is the most common reason businesses fail to access the small business CGT concessions",
        "Property held as an investment (not used in the business) typically fails this test",
        propertyOnly ? "Passive investment property does not pass the active asset test — even if owned by a business entity" : "",
        "The general 50% CGT discount still applies if you held the asset for more than 12 months",
      ].filter(Boolean),
      confidence: "HIGH",
      confidenceNote: "Active asset test is a mandatory eligibility gate.",
      tier: 67,
      ctaLabel: "Get My CGT Eligibility Memo — $67 →",
      altTierLabel: "Want the full exit blueprint? — $147",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      concessionPaths: [
        { name: "15-year exemption", available: false, reason: "Fails active asset test" },
        { name: "50% active asset reduction", available: false, reason: "Fails active asset test" },
        { name: "Retirement exemption", available: false, reason: "Fails active asset test" },
        { name: "Rollover", available: false, reason: "Fails active asset test" },
      ],
      failingGate: "Active asset test — asset not sufficiently used in the business",
      estimatedSaving: "$0 — active asset test failed",
    };
  }

  // ── GATE 3: Active asset ratio — borderline ───────────────────────────────
  if (activeAsset === true && activeAssetRatio === "borderline") {
    return {
      status: "ACTIVE ASSET TEST — BORDERLINE RISK",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: "Your active asset test position is borderline — the ATO requires at least 50% of your ownership period or 7.5 years of active business use.",
      stats: [
        { label: "Active asset test", value: "Borderline ⚠", highlight: true },
        { label: "Required", value: "50% of period or 7.5 yrs" },
        { label: "Risk", value: "ATO may challenge" },
      ],
      consequences: [
        "If challenged, you must demonstrate the asset was used or available for use in a business for the required period",
        "Mixed-use assets (part business, part personal or investment) require careful calculation",
        "Get a qualified accountant to calculate the active asset percentage before assuming eligibility",
        "If the test is failed on audit, the entire concession claim is reversed — with penalties",
      ],
      confidence: "LOW",
      confidenceNote: "Active asset ratio is borderline — professional calculation required before claiming.",
      tier: 147,
      ctaLabel: "Get My Exit Concession Blueprint — $147 →",
      altTierLabel: "Just want the eligibility memo? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      concessionPaths: [
        { name: "15-year exemption", available: ownershipYears === "over_15" && !!ageRetirement, reason: ownershipYears === "over_15" ? "Possible — confirm active asset ratio" : "Requires 15+ years" },
        { name: "50% active asset reduction", available: true, reason: "Borderline — needs calculation" },
        { name: "Retirement exemption", available: !!ageRetirement, reason: ageRetirement ? "Possible if retirement conditions met" : "Age/retirement conditions not confirmed" },
        { name: "Rollover", available: true, reason: "Available if reinvesting in replacement asset" },
      ],
      failingGate: "Active asset test — borderline ratio requires calculation",
      estimatedSaving: "Potentially significant — depends on active asset calculation",
    };
  }

  // ── Past active asset — now determine which concessions apply ─────────────

  const has15Year       = ownershipYears === "over_15" && ageRetirement === true;
  const hasRetirement   = ageRetirement === true || ageRetirement === false; // available regardless of age with conditions
  const has50Pct        = true; // passes size + active asset
  const hasRollover     = true;
  const hasSigIndiv     = significantIndiv !== false;

  // ── 15-year exemption — best outcome ─────────────────────────────────────
  if (ownershipYears === "over_15" && ageRetirement === true && significantIndiv !== false) {
    return {
      status: "STRONG ELIGIBILITY — 15-YEAR EXEMPTION LIKELY",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: "You appear to meet the conditions for the 15-year exemption — potentially the most powerful concession, allowing you to disregard the entire capital gain.",
      stats: [
        { label: "15-year exemption", value: "Likely eligible ✓", highlight: false },
        { label: "Tax on gain", value: "Potentially $0", highlight: false },
        { label: "Structure", value: hasSigIndiv ? "Sig. individual confirmed" : "Confirm sig. individual" },
      ],
      consequences: [
        "The 15-year exemption allows you to disregard the entire capital gain — this is more powerful than the retirement exemption",
        "You must have owned the asset for at least 15 continuous years and be aged 55+ and retiring (or permanently incapacitated)",
        "The asset must pass the active asset test for the ownership period",
        "A significant individual (20%+ stake) must exist — confirm this for your entity structure",
        "Application is not automatic — your accountant must actively elect and document the concession",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Strong eligibility indicators — professional confirmation required before lodging.",
      tier: 147,
      ctaLabel: "Get My Exit Concession Blueprint — $147 →",
      altTierLabel: "Just want the eligibility memo? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      concessionPaths: [
        { name: "15-year exemption", available: true, reason: "15+ years, 55+, retiring — strongest path" },
        { name: "50% active asset reduction", available: true, reason: "Available as fallback or stack" },
        { name: "Retirement exemption", available: true, reason: "Up to $500,000 lifetime cap" },
        { name: "Rollover", available: true, reason: "Available if reinvesting" },
      ],
      failingGate: "None detected — confirm significant individual and active asset ratio",
      estimatedSaving: "Potentially 100% of the capital gain — up to full tax exemption",
    };
  }

  // ── Retirement exemption path ─────────────────────────────────────────────
  if (ageRetirement === true && significantIndiv !== false) {
    const under55 = false; // retirement exemption still available under 55 if paid into super
    return {
      status: "ELIGIBLE — RETIREMENT EXEMPTION AND CONCESSIONS AVAILABLE",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: "You pass the key eligibility gates and appear eligible for the retirement exemption — up to $500,000 lifetime cap — plus the 50% active asset reduction.",
      stats: [
        { label: "Retirement exemption", value: "Up to $500,000", highlight: false },
        { label: "50% reduction", value: "Available", highlight: false },
        { label: "Order matters", value: "Apply in sequence ✓", highlight: false },
      ],
      consequences: [
        "Apply concessions in the correct ATO order: 1. General 50% CGT discount → 2. 50% active asset reduction → 3. Retirement exemption",
        "The retirement exemption lifetime cap is $500,000 — prior use reduces what is available now",
        "If you are under 55, the exempted amount must be paid into a superannuation fund",
        "A significant individual with a 20%+ stake must exist — confirm for your entity structure",
        "Get this wrong and the ATO will reverse the concession on audit — penalties apply",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Strong eligibility — confirm significant individual, active asset ratio, and prior retirement exemption use.",
      tier: 147,
      ctaLabel: "Get My Exit Concession Blueprint — $147 →",
      altTierLabel: "Just want the eligibility memo? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      concessionPaths: [
        { name: "15-year exemption", available: ownershipYears === "over_15", reason: ownershipYears === "over_15" ? "Possible — confirm age/retirement conditions" : "Requires 15+ years ownership" },
        { name: "50% active asset reduction", available: true, reason: "Passes size and active asset gates" },
        { name: "Retirement exemption", available: true, reason: "Up to $500,000 lifetime cap — apply in correct order" },
        { name: "Rollover", available: true, reason: "Available if reinvesting in replacement active asset" },
      ],
      failingGate: "None detected — confirm ordering and significant individual",
      estimatedSaving: "Up to $500,000 retirement exemption + 50% active asset reduction",
    };
  }

  // ── 50% active asset + rollover — no retirement ───────────────────────────
  if (significantIndiv !== false) {
    return {
      status: "PARTIAL ELIGIBILITY — 50% REDUCTION AND ROLLOVER AVAILABLE",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: "You pass the size and active asset gates — the 50% active asset reduction and rollover are available, but the retirement exemption conditions are not met.",
      stats: [
        { label: "50% active reduction", value: "Available ✓" },
        { label: "Retirement exemption", value: "Conditions not met ✗", highlight: true },
        { label: "Rollover", value: "Available ✓" },
      ],
      consequences: [
        "The 50% active asset reduction halves your capital gain — stacked on top of the general 50% CGT discount for 12+ month assets",
        "The retirement exemption requires you to be retiring or aged 55+ — if not, this concession is not available",
        "The rollover allows you to defer the gain into a replacement asset — useful if reinvesting in a new business",
        "Apply in the correct order: 1. CGT discount → 2. 50% active asset reduction → 3. Rollover if applicable",
        "Concessions are not automatic — your accountant must elect and document each one",
      ],
      confidence: "MEDIUM",
      confidenceNote: "Two concessions confirmed — retirement exemption not available without retirement conditions.",
      tier: 147,
      ctaLabel: "Get My Exit Concession Blueprint — $147 →",
      altTierLabel: "Just want the eligibility memo? — $67 instead",
      productKey67: KEYS.p67, productKey147: KEYS.p147,
      concessionPaths: [
        { name: "15-year exemption", available: false, reason: ownershipYears === "over_15" ? "15 years met but retirement conditions not confirmed" : "Requires 15+ years ownership" },
        { name: "50% active asset reduction", available: true, reason: "Passes size and active asset gates" },
        { name: "Retirement exemption", available: false, reason: "Retirement or age 55+ conditions not met" },
        { name: "Rollover", available: true, reason: "Available if reinvesting in replacement active asset" },
      ],
      failingGate: "Retirement exemption — age/retirement conditions not confirmed",
      estimatedSaving: "50% active asset reduction — halves the remaining gain after CGT discount",
    };
  }

  // ── Significant individual missing ────────────────────────────────────────
  return {
    status: "SIGNIFICANT INDIVIDUAL TEST — ELIGIBILITY AT RISK",
    statusClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
    headline: "Your entity structure may not have a significant individual — a person with a 20%+ direct or indirect stake is required for most concessions in company and trust structures.",
    stats: [
      { label: "Significant individual", value: "Not confirmed ✗", highlight: true },
      { label: "Required stake", value: "20%+ direct or indirect" },
      { label: "Concessions at risk", value: "Most paths affected" },
    ],
    consequences: [
      "A significant individual is required for the 15-year exemption and retirement exemption in company and trust structures",
      "A CGT concession stakeholder must also exist — typically a significant individual or their spouse",
      "Complex trust and company structures often fail this test without careful pre-sale restructuring",
      "This is one of the most frequently missed eligibility conditions — get professional advice before assuming eligibility",
    ],
    confidence: "LOW",
    confidenceNote: "Significant individual test not confirmed — professional mapping of ownership structure required.",
    tier: 147,
    ctaLabel: "Get My Exit Concession Blueprint — $147 →",
    altTierLabel: "Just want the eligibility memo? — $67 instead",
    productKey67: KEYS.p67, productKey147: KEYS.p147,
    concessionPaths: [
      { name: "15-year exemption", available: false, reason: "Significant individual not confirmed" },
      { name: "50% active asset reduction", available: true, reason: "May be available — confirm significant individual" },
      { name: "Retirement exemption", available: false, reason: "Significant individual required" },
      { name: "Rollover", available: true, reason: "May be available for reinvestment" },
    ],
    failingGate: "Significant individual test — ownership structure needs mapping",
    estimatedSaving: "Unknown — depends on significant individual confirmation",
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
    id: "entity_type", step: 1, type: "button_group",
    label: "Who owns the asset being sold?",
    subLabel: "The entity structure affects which concessions are available and the significant individual test",
    options: [
      { label: "Individual", value: "individual", subLabel: "You personally own the asset" },
      { label: "Company", value: "company", subLabel: "Pty Ltd or other company structure" },
      { label: "Trust", value: "trust", subLabel: "Discretionary or unit trust" },
      { label: "Partnership", value: "partnership", subLabel: "Business partnership" },
    ],
    required: true,
  },
  {
    id: "size_gate", step: 2, type: "two_button",
    label: "Does your business pass the size test?",
    subLabel: "Turnover under $2 million OR max net asset value under $6 million (including connected entities and affiliates)",
    options: [
      { label: "Yes — under $2M turnover OR under $6M net assets", value: true },
      { label: "No — over both thresholds", value: false },
    ],
    required: true,
  },
  {
    id: "active_asset", step: 3, type: "two_button",
    label: "Was the asset actively used in your business?",
    subLabel: "Must be used in a business for at least 50% of your ownership period or 7.5 years — passive investment property typically fails",
    options: [
      { label: "Yes — used in the business", value: true },
      { label: "No — investment or passive use only", value: false },
    ],
    showIf: (a) => a.size_gate === true,
    required: true,
  },
  {
    id: "property_only", step: 4, type: "two_button",
    label: "Is the asset a property held as an investment (not used in business operations)?",
    subLabel: "Passive investment property — including commercial property leased to third parties — often fails the active asset test",
    options: [
      { label: "No — business asset (goodwill, equipment, shares in operating company)", value: false },
      { label: "Yes — investment property or passive asset", value: true },
    ],
    showIf: (a) => a.size_gate === true && a.active_asset === true,
  },
  {
    id: "active_asset_ratio", step: 5, type: "button_group",
    label: "For what proportion of your ownership period was the asset actively used in the business?",
    subLabel: "ATO requires at least 50% of the ownership period OR 7.5 years minimum",
    options: [
      { label: "More than 50% of the period", value: "over_50", subLabel: "Clearly passes the active asset test" },
      { label: "Around 50% — hard to determine", value: "borderline", subLabel: "May require ATO calculation" },
      { label: "Less than 50% of the period", value: "under_50", subLabel: "Likely fails the active asset test" },
    ],
    showIf: (a) => a.size_gate === true && a.active_asset === true,
    required: true,
  },
  {
    id: "ownership_years", step: 6, type: "button_group",
    label: "How long have you owned the asset?",
    subLabel: "15+ years of continuous ownership opens the 15-year exemption — the most powerful concession",
    options: [
      { label: "Under 7 years", value: "under_7" },
      { label: "7–15 years", value: "7_to_15" },
      { label: "Over 15 years", value: "over_15", subLabel: "15-year exemption may apply" },
    ],
    showIf: (a) => a.size_gate === true && a.active_asset === true,
    required: true,
  },
  {
    id: "age_retirement", step: 7, type: "two_button",
    label: "Are you aged 55 or over and retiring (or permanently incapacitated)?",
    subLabel: "Required for the 15-year exemption — the retirement exemption is available at any age but has different conditions under 55",
    options: [
      { label: "Yes — 55+ and retiring", value: true },
      { label: "No — under 55 or not retiring", value: false },
    ],
    showIf: (a) => a.size_gate === true && a.active_asset === true,
    required: true,
  },
  {
    id: "significant_individual", step: 8, type: "two_button",
    label: "Is there a significant individual — a person with a 20%+ direct or indirect stake in the business?",
    subLabel: "Required for the 15-year and retirement exemptions in company and trust structures — individuals always meet this",
    options: [
      { label: "Yes — clear 20%+ stakeholder exists", value: true },
      { label: "No or unsure — complex structure", value: false },
    ],
    showIf: (a) => a.size_gate === true && a.active_asset === true && a.entity_type !== "individual",
  },
  {
    id: "sale_objective", step: 9, type: "button_group",
    label: "What outcome matters most to you?",
    subLabel: "Shapes which concession path is emphasised in your personalised plan",
    options: [
      { label: "Pay zero tax now", value: "zero_tax", subLabel: "15-year or stacked exemptions" },
      { label: "Defer the gain", value: "defer", subLabel: "Rollover into replacement asset" },
      { label: "Fund retirement", value: "retirement", subLabel: "Retirement exemption into super" },
      { label: "Unsure — show me all options", value: "unsure" },
    ],
    showIf: (a) => a.size_gate === true && a.active_asset === true,
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
  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* Stats */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Concession paths — the sequencing table */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
          The 4 concessions — applied in order
        </p>
        <div className="space-y-2">
          {[
            { step: "1", label: "General 50% CGT discount", note: "12+ months ownership — applies first" },
            ...verdict.concessionPaths.map((c, i) => ({ step: String(i + 2), label: c.name, note: c.reason, available: c.available })),
          ].map((row, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-neutral-400">{row.step}.</span>
              <div className="flex-1">
                <span className={`font-medium ${"available" in row && row.available === false ? "text-neutral-400 line-through" : "text-neutral-950"}`}>
                  {row.label}
                </span>
                {"available" in row && (
                  <span className={`ml-2 text-xs ${"available" in row && row.available ? "text-emerald-600" : "text-red-500"}`}>
                    {"available" in row && row.available ? "✓ available" : "✗ not available"}
                  </span>
                )}
                <p className="text-xs text-neutral-500 mt-0.5">{row.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Failing gate */}
      {verdict.failingGate && verdict.failingGate !== "None detected — confirm significant individual and active asset ratio" && verdict.failingGate.startsWith("None") === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-1">Strongest risk trigger</p>
          <p className="text-xs text-amber-900">→ {verdict.failingGate}</p>
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

      {/* Estimated saving */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Estimated tax saving</p>
        <p className="text-sm font-bold text-neutral-950">{verdict.estimatedSaving}</p>
      </div>

      {/* Conversion line */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-700 leading-relaxed">
          Get this wrong, and you could pay tens or even hundreds of thousands in unnecessary tax when selling your business.
          <strong className="text-neutral-950"> This check shows which concessions apply to your exact structure.</strong>
        </p>
      </div>

      {/* What you get */}
      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What's in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Active asset test worksheet — pass/fail calculation for your ownership period</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Size gate summary — turnover and max net asset value confirmation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Concession path memo — which of the 4 concessions apply to your entity</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Application order — correct sequencing to maximise your tax saving</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions tailored to your entity structure and concession path</span></li>
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
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value as string | boolean)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition text-center ${sel(opt.value as string | boolean) ? active : inactive}`}>
              <span className="block">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value as string | boolean) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
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

export default function SmallBusinessCgtConcessionsCalculator() {
  const [answers, setAnswers]     = useState<AnswerMap>({});
  const [step, setStep]           = useState(1);
  const [showVerdict, setVerdict] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showQuestions, setShowQ] = useState(false);
  const [popupTier, setPopupTier] = useState<Tier>(147);
  const [popupAnswers, setPopupA] = useState<PopupAnswers>({ entity_type: "", urgency: "", accountant: "" });
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
        product_slug: "small-business-cgt-concessions",
        source_path: "/au/check/small-business-cgt-concessions",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: { status: verdict.status, failing_gate: verdict.failingGate, tier: verdict.tier },
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
      body: JSON.stringify({ email, source: "small_business_cgt_concessions", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `sbcgt_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("small-business-cgt-concessions_entity_type", String(answers.entity_type || ""));
    sessionStorage.setItem("small-business-cgt-concessions_failing_gate", verdict.failingGate);
    sessionStorage.setItem("small-business-cgt-concessions_status", verdict.status);
    sessionStorage.setItem("small-business-cgt-concessions_ownership_years", String(answers.ownership_years || ""));
    sessionStorage.setItem("small-business-cgt-concessions_estimated_saving", verdict.estimatedSaving);
    sessionStorage.setItem("small-business-cgt-concessions_tier", String(popupTier));

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
          success_url: `${window.location.origin}/au/check/small-business-cgt-concessions/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/small-business-cgt-concessions`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your eligibility result to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Free — email yourself the concession path summary.</p>
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
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>Small Business CGT</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {verdict.estimatedSaving}
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
                      {popupTier === 67 ? "Your CGT Concession Eligibility Memo™" : "Your Exit Concession Blueprint™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Active asset test worksheet, turnover/net asset gate summary, concession path notes, significant individual checklist, and accountant questions — built around your entity structure."
                        : "Recommended concession stacking order, pre-sale clean-up issues, stakeholder mapping, and an implementation pack your accountant can use to validate and lodge the claim."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic CGT guide. Built around your entity and situation.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My Eligibility Memo →" : "Get My Exit Blueprint →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the eligibility memo? — $67 instead" : "Want the full exit blueprint? — $147 instead"}
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
                    { label: "Entity that owns the asset", key: "entity_type", options: [["individual","Individual"],["company","Company / Pty Ltd"],["trust","Trust"],["partnership","Partnership"]] },
                    { label: "Where are you in the sale process?", key: "urgency", options: [["pre_sale","Pre-sale — planning now"],["in_progress","Sale in progress"],["post_sale","Sale completed — need to lodge"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["yes_active","Yes — speaking with them soon"],["yes_inactive","Yes — not spoken recently"],["no","No — managing myself"]] },
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

      {showVerdict && verdict && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Small Business CGT</p>
              <p className="text-sm font-bold text-neutral-950 truncate">{verdict.estimatedSaving}</p>
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
