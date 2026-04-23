"use client";

/**
 * UK-06 — Pension IHT Trap 2027 Engine (NEW)
 * Pattern: G (ThresholdTest — £325k nil-rate band) + C (Classification — beneficiary type)
 *
 * Core question: Under the October 2024 consultation proposal, what IHT exposure
 * would arise on this person's pension from April 2027 — and what is the planning
 * window before potential enactment?
 *
 * CRITICAL LEGAL STATUS: PROPOSAL, NOT YET LAW
 * - HMRC consultation published October 2024
 * - Draft legislation published July 2024
 * - Government has confirmed intent to proceed
 * - Royal Assent has NOT yet occurred as of April 2026
 * - Proposed effective date: 6 April 2027
 *
 * Key facts (April 2026):
 *   Nil-rate band: £325,000 individual / £650,000 couple (transferable)
 *   Residence NRB: up to £175,000 if home passes to direct descendants
 *   IHT rate: 40% on value above NRB
 *   Income tax on inherited pension withdrawals: beneficiary marginal rate (up to 45%)
 *   Combined IHT + income tax under proposal: potentially over 60% effective
 *
 * Legal anchors: Inheritance Tax Act 1984 · Finance Act 2024 (proposed amendments)
 *   · HM Treasury consultation "Reform of IHT treatment of pensions" Oct 2024
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type ExposureStatus =
  | "SPOUSE_PROTECTED"       // spouse beneficiary — exempt on first death (risk on second)
  | "BELOW_NIL_RATE_BAND"    // combined estate under NRB — minimal risk
  | "PROPOSED_IHT_EXPOSURE"  // over NRB + non-spouse beneficiary = IHT applies if enacted
  | "DOUBLE_TAX_EXPOSURE";   // pension IHT + income tax on withdrawals

interface IhtResult {
  pension: number;
  estate: number;
  totalEstate: number;
  married: boolean;
  beneficiaries: string;
  effectiveNilRateBand: number;
  estateTaxable: number;            // estate portion above NRB (current rules)
  pensionTaxable: number;            // pension portion above remaining NRB (proposed)
  currentIht: number;                // IHT under CURRENT rules (pension outside estate)
  proposedIht: number;               // IHT if proposal enacted
  proposedPensionIht: number;        // IHT attributable to pension under proposal
  incomeTaxOnWithdrawals: number;    // estimated income tax on inherited pension
  combinedPensionCost: number;       // pensionIht + incomeTaxOnWithdrawals
  effectivePensionRate: number;      // combined cost as % of pension value
  exposureStatus: ExposureStatus;
  residenceNrbMaybeApplies: boolean; // user may have additional £175k RNRB
}

interface VerdictResult {
  status: string;
  statusClass: string;
  panelClass: string;
  headline: string;
  stats: Array<{ label: string; value: string; highlight?: boolean }>;
  consequences: string[];
  legalStatusBanner: string;         // reminder that this is proposal, not law
  confidence: ConfidenceLevel;
  confidenceNote: string;
  tier: Tier;
  ctaLabel: string;
  altTierLabel: string;
  productKey67: string;
  productKey147: string;
  result: IhtResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const NIL_RATE_BAND = 325000;
const RESIDENCE_NIL_RATE_BAND = 175000;
const IHT_RATE = 0.40;
const ASSUMED_BENEFICIARY_INCOME_TAX = 0.40;  // higher-rate assumption for adult children
const PROPOSED_EFFECTIVE_DATE = "6 April 2027";

const PENSION_MAP: Record<string, number> = {
  under_100k:      60000,
  "100k_to_325k":  200000,
  "325k_to_500k":  400000,
  "500k_to_1m":    750000,
  over_1m:         1500000,
};

const ESTATE_MAP: Record<string, number> = {
  under_325k:      150000,
  "325k_to_500k":  400000,
  "500k_to_1m":    750000,
  over_1m:         1500000,
};

const PRODUCT_KEYS = {
  p67:  "uk_67_pension_iht_trap",
  p147: "uk_147_pension_iht_trap",
};

function formatGBP(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

function formatGBPShort(n: number): string {
  if (n >= 1_000_000) return "£" + (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 1_000) return "£" + (n / 1_000).toFixed(0) + "k";
  return "£" + Math.round(n).toLocaleString("en-GB");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function calcIht(answers: AnswerMap): IhtResult {
  const pension = PENSION_MAP[String(answers.pension_value || "325k_to_500k")] ?? 400000;
  const estate  = ESTATE_MAP[String(answers.estate_value || "500k_to_1m")]   ?? 750000;
  const married = answers.marital_status === "married";
  const beneficiaries = String(answers.beneficiaries || "children");

  const effectiveNilRateBand = married ? NIL_RATE_BAND * 2 : NIL_RATE_BAND;
  const totalEstate = pension + estate;

  // Estate-only taxable (current rules)
  const estateTaxable = Math.max(0, estate - effectiveNilRateBand);
  const currentIht = estateTaxable * IHT_RATE;

  // Proposed rules: pension added to estate
  const totalTaxable = Math.max(0, totalEstate - effectiveNilRateBand);
  const proposedIht = totalTaxable * IHT_RATE;

  // Attribute the IHT increment to pension (estate uses NRB first)
  const nrbRemainingAfterEstate = Math.max(0, effectiveNilRateBand - estate);
  const pensionTaxable = Math.max(0, pension - nrbRemainingAfterEstate);
  let proposedPensionIht = pensionTaxable * IHT_RATE;

  // Spouse beneficiary: exempt on first death regardless of estate size
  if (beneficiaries === "spouse_only") {
    proposedPensionIht = 0;
  }

  // Income tax on remaining pension withdrawals by beneficiaries
  // Assume higher-rate beneficiaries (40%) for headline figure
  const remainingPensionAfterIht = Math.max(0, pension - proposedPensionIht);
  const incomeTaxOnWithdrawals = remainingPensionAfterIht * ASSUMED_BENEFICIARY_INCOME_TAX;

  const combinedPensionCost = proposedPensionIht + incomeTaxOnWithdrawals;
  const effectivePensionRate = pension > 0 ? combinedPensionCost / pension : 0;

  // Exposure classification
  let exposureStatus: ExposureStatus;
  if (beneficiaries === "spouse_only") {
    exposureStatus = "SPOUSE_PROTECTED";
  } else if (totalEstate <= effectiveNilRateBand) {
    exposureStatus = "BELOW_NIL_RATE_BAND";
  } else if (proposedPensionIht > 100000 || (pension >= NIL_RATE_BAND && estate > effectiveNilRateBand)) {
    exposureStatus = "DOUBLE_TAX_EXPOSURE";
  } else {
    exposureStatus = "PROPOSED_IHT_EXPOSURE";
  }

  // RNRB check — user may qualify for additional £175k if home passes to descendants
  const residenceNrbMaybeApplies = beneficiaries !== "spouse_only" && beneficiaries !== "unnominated";

  return {
    pension,
    estate,
    totalEstate,
    married,
    beneficiaries,
    effectiveNilRateBand,
    estateTaxable,
    pensionTaxable,
    currentIht,
    proposedIht,
    proposedPensionIht,
    incomeTaxOnWithdrawals,
    combinedPensionCost,
    effectivePensionRate,
    exposureStatus,
    residenceNrbMaybeApplies,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

const LEGAL_BANNER = `⚠ Proposal status (April 2026): The October 2024 HMRC consultation proposes bringing unused DC pensions into scope for IHT from ${PROPOSED_EFFECTIVE_DATE}. Draft legislation has been published. Government has confirmed intent to proceed. But Royal Assent has NOT yet occurred. Numbers shown are IF ENACTED — not current law.`;

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcIht(answers);

  // ── SPOUSE PROTECTED ─────────────────────────────────────────────────────
  if (result.exposureStatus === "SPOUSE_PROTECTED") {
    return {
      status: "SPOUSE BENEFICIARY — PROTECTED ON FIRST DEATH",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your pension beneficiary is your spouse or civil partner — under both current law and the October 2024 proposal, transfers to a spouse are IHT-exempt. However, the risk arises on SECOND death when the pension eventually passes to children. Under the proposal, IF ENACTED from ${PROPOSED_EFFECTIVE_DATE}, that second-death event would bring the pension into the IHT scope.`,
      stats: [
        { label: "Pension value", value: formatGBP(result.pension) },
        { label: "First-death IHT (spouse)", value: "£0 ✓" },
        { label: "Second-death exposure (proposed)", value: formatGBP(Math.max(0, result.pension * IHT_RATE)), highlight: true },
      ],
      consequences: [
        "✓ Spouse exemption: transfers to a UK-domiciled spouse or civil partner are exempt from IHT under current law (Inheritance Tax Act 1984 s18) and remain exempt under the October 2024 proposal. Your pension passes to them without IHT on the first death.",
        `⚠ Second-death trap: when your spouse later dies, the pension (now in their estate) passes to the ultimate beneficiaries. If the proposal is enacted, the pension at that point would be within IHT scope. Estimated second-death IHT exposure on ${formatGBP(result.pension)}: approximately ${formatGBP(result.pension * IHT_RATE)} (40% on the portion above the combined nil-rate band).`,
        "Transferable nil-rate band (NRB): on your death, your unused NRB transfers to your spouse — meaning the survivor can potentially use up to £650,000 NRB on second death. Residence NRB (£175,000) may also be available if the home passes to direct descendants.",
        `Planning window: now to ${PROPOSED_EFFECTIVE_DATE} — IF the proposal is enacted. Options for couples include: coordinate pension drawdown strategy between both partners, consider whole-of-life insurance in trust to fund potential IHT liability, and review beneficiary nominations for tax-efficient ordering.`,
        "Action before 2027: (a) confirm spouse is listed as primary beneficiary and children as contingent, (b) model second-death exposure at current and projected pension values, (c) consider whether drawdown during your lifetime reduces exposure vs leaving untouched.",
        "Pension vs ISA split: the proposal affects pensions specifically. ISAs are already within your estate for IHT. Post-2027, the IHT advantage of pensions would disappear — meaning ISA vs pension is no longer a tax-efficiency decision but a flexibility decision.",
      ],
      legalStatusBanner: LEGAL_BANNER,
      confidence: "HIGH",
      confidenceNote: "Spouse exemption is certain under IHTA 1984 s18 — both current law and proposal retain it. Second-death exposure depends on proposal enactment.",
      tier: 147,
      ctaLabel: "Get My Second-Death Planning Pack — £147 →",
      altTierLabel: "Just want the exposure audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── BELOW NIL-RATE BAND ──────────────────────────────────────────────────
  if (result.exposureStatus === "BELOW_NIL_RATE_BAND") {
    return {
      status: "BELOW NIL-RATE BAND — LOWER RISK",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your combined estate of ${formatGBP(result.totalEstate)} (pension + other assets) is within the nil-rate band of ${formatGBP(result.effectiveNilRateBand)}${result.married ? " (transferable NRB for couples)" : ""}. IHT exposure is low even under the October 2024 proposal — but beneficiary nominations and future growth are worth reviewing before ${PROPOSED_EFFECTIVE_DATE}.`,
      stats: [
        { label: "Combined estate", value: formatGBP(result.totalEstate) },
        { label: "Nil-rate band", value: formatGBP(result.effectiveNilRateBand) },
        { label: "Proposed IHT exposure", value: "£0 (under NRB)" },
      ],
      consequences: [
        `Your combined estate (pension ${formatGBP(result.pension)} + other assets ${formatGBP(result.estate)}) totals ${formatGBP(result.totalEstate)} — below the ${result.married ? "combined" : ""} nil-rate band of ${formatGBP(result.effectiveNilRateBand)}.`,
        "Under current law, pension is outside your estate entirely. Under the October 2024 proposal (if enacted), pension would be included in estate — but your total remains below the nil-rate band, so no IHT arises.",
        `${result.residenceNrbMaybeApplies ? "If your main residence passes to direct descendants (children, grandchildren), you may also qualify for the £175,000 Residence Nil-Rate Band — increasing your tax-free estate to up to £500,000 individual or £1,000,000 couple. Confirm this applies to your situation." : "Residence nil-rate band (£175,000) is available if you own a home that passes to direct descendants — adds protection."}`,
        "Watch for estate growth: property values, pension growth, and investment appreciation can push you above the NRB over time. A 30% rise in property value alone could change your position.",
        "Beneficiary review: even at this level, make sure your pension beneficiary nomination matches your current wishes. Update on any life event (marriage, divorce, birth of children).",
        `Long-term planning: if you expect estate growth toward or beyond ${formatGBP(result.effectiveNilRateBand)}, start modelling IHT exposure now. Pension IHT treatment is proposed to change from ${PROPOSED_EFFECTIVE_DATE} — planning options differ before vs after enactment.`,
      ],
      legalStatusBanner: LEGAL_BANNER,
      confidence: "HIGH",
      confidenceNote: "Nil-rate band is statutory under IHTA 1984 s8A. Below-NRB estates are unaffected by the proposal regardless of whether it is enacted.",
      tier: 67,
      ctaLabel: "Get My IHT Position Check — £67 →",
      altTierLabel: "Want the full planning pack? — £147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── DOUBLE TAX EXPOSURE ──────────────────────────────────────────────────
  if (result.exposureStatus === "DOUBLE_TAX_EXPOSURE") {
    return {
      status: "DOUBLE TAX EXPOSURE — IHT + INCOME TAX IF PROPOSAL ENACTED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `If the October 2024 proposal is enacted from ${PROPOSED_EFFECTIVE_DATE}, your pension would face 40% IHT on approximately ${formatGBP(result.proposedPensionIht)} of its value, followed by income tax on withdrawals by beneficiaries at their marginal rate (up to 45%). Combined effective rate on your pension: approximately ${(result.effectivePensionRate * 100).toFixed(0)}%. Planning window: now to ${PROPOSED_EFFECTIVE_DATE}.`,
      stats: [
        { label: "Proposed pension IHT", value: formatGBP(result.proposedPensionIht), highlight: true },
        { label: "Est. income tax on withdrawals", value: formatGBP(result.incomeTaxOnWithdrawals), highlight: true },
        { label: "Combined effective rate", value: `${(result.effectivePensionRate * 100).toFixed(0)}%`, highlight: true },
      ],
      consequences: [
        `🔒 IF the October 2024 proposal is enacted as currently drafted, from ${PROPOSED_EFFECTIVE_DATE} your DC pension of ${formatGBP(result.pension)} would be included in your estate for IHT. Estimated IHT on the pension portion: ${formatGBP(result.proposedPensionIht)} at 40% on the amount above remaining nil-rate band.`,
        `🔒 On top of IHT, your beneficiaries would still pay income tax on withdrawals from the inherited pension at their marginal rate (up to 45%). Estimated income tax on ${formatGBP(result.pension - result.proposedPensionIht)} remaining pension: ${formatGBP(result.incomeTaxOnWithdrawals)} at assumed 40% higher-rate beneficiary.`,
        `🔒 Combined family exposure on pension value: ${formatGBP(result.combinedPensionCost)} — an effective rate of ${(result.effectivePensionRate * 100).toFixed(0)}% on the ${formatGBP(result.pension)} pension. This is the DOUBLE TAX scenario the proposal creates: IHT and income tax stacking on the same money.`,
        `🔓 Planning window — now to ${PROPOSED_EFFECTIVE_DATE}. IF the proposal is enacted, the following options may be more effective if taken BEFORE the change: (a) drawdown strategy — spend pension first, preserve ISA/other assets (which remain fully exempt from income tax on withdrawal), (b) gift pension drawdowns during lifetime (potentially exempt after 7 years), (c) whole-of-life insurance written in trust to fund IHT liability, (d) pension vs ISA rebalancing.`,
        "Review beneficiary nominations: when the IHT treatment changes, the optimal beneficiary structure changes too. Spouse nominations remain IHT-exempt. Child nominations trigger the full exposure. Mixed or discretionary nominations create flexibility for the executor to optimise at the time of death.",
        "⚠ Critical caveat: this is a PROPOSAL. The proposal may be amended before Royal Assent, implementation may be delayed, or thresholds may change. Planning should be flexible enough to work under multiple scenarios.",
      ],
      legalStatusBanner: LEGAL_BANNER,
      confidence: "MEDIUM",
      confidenceNote: "IHT rate (40%) and nil-rate band are statutory. The pension-in-estate proposal is published in consultation and draft legislation but not yet enacted — numbers are illustrative of proposed treatment.",
      tier: 147,
      ctaLabel: "Get My Full Pension IHT Strategy — £147 →",
      altTierLabel: "Just want the exposure audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── PROPOSED IHT EXPOSURE (standard case) ────────────────────────────────
  return {
    status: "PROPOSED IHT EXPOSURE — ACTION NEEDED BEFORE APRIL 2027",
    statusClass: "text-red-700",
    panelClass: "border-red-200 bg-red-50",
    headline: `IF the October 2024 proposal is enacted from ${PROPOSED_EFFECTIVE_DATE}, your pension of ${formatGBP(result.pension)} would be brought into your estate for IHT. Estimated additional IHT under the proposal: ${formatGBP(result.proposedPensionIht)}. Combined with potential income tax on inherited withdrawals, total family exposure: ${formatGBP(result.combinedPensionCost)} on the pension alone.`,
    stats: [
      { label: "Total estate (pension + other)", value: formatGBP(result.totalEstate), highlight: true },
      { label: "Proposed pension IHT", value: formatGBP(result.proposedPensionIht), highlight: true },
      { label: "Planning window", value: `To ${PROPOSED_EFFECTIVE_DATE}`, highlight: true },
    ],
    consequences: [
      `Under CURRENT rules: your pension (${formatGBP(result.pension)}) is outside your estate for IHT. No IHT on the pension. Beneficiaries pay income tax on withdrawals only if you die aged 75 or over.`,
      `Under the OCTOBER 2024 PROPOSAL (if enacted from ${PROPOSED_EFFECTIVE_DATE}): your pension would be included in your estate. Estimated IHT on pension portion above remaining nil-rate band: ${formatGBP(result.proposedPensionIht)} at 40%.`,
      `Total combined estate under proposal: ${formatGBP(result.totalEstate)}. Nil-rate band: ${formatGBP(result.effectiveNilRateBand)}${result.married ? " (combined couple NRB)" : " (individual)"}. Taxable estate: ${formatGBP(Math.max(0, result.totalEstate - result.effectiveNilRateBand))}.`,
      `${result.residenceNrbMaybeApplies ? "Residence Nil-Rate Band (£175,000 per person, tapering above £2M estate): available if your home passes to direct descendants. Could reduce exposure by up to £70,000 per person (£175k × 40%). Verify this applies to your estate." : "Residence NRB may not apply given your beneficiary structure."}`,
      `🔓 Planning options if proposal enacted: (a) drawdown strategy — consume pension during lifetime, leave other assets for inheritance, (b) lifetime gifting of pension drawdowns (potentially exempt from IHT after 7 years under PET rules), (c) whole-of-life insurance in trust to fund IHT, (d) ISA vs pension rebalancing. Most of these work BETTER if started before enactment.`,
      `⚠ Legal status: PROPOSAL, not yet law. HMRC consultation October 2024, draft legislation published. Government has confirmed intent to proceed. Royal Assent has not yet occurred. Numbers shown are IF ENACTED — not current law.`,
    ],
    legalStatusBanner: LEGAL_BANNER,
    confidence: "MEDIUM",
    confidenceNote: "Current IHT rules under IHTA 1984 confirmed. Proposed changes are in consultation and draft legislation — subject to potential amendment before Royal Assent.",
    tier: 147,
    ctaLabel: "Get My Pension IHT Strategy — £147 →",
    altTierLabel: "Just want the exposure audit? — £67 instead",
    productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
    result,
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
    id: "pension_value", step: 1, type: "button_group",
    label: "What is your total defined contribution pension value?",
    subLabel: "Include all DC pensions — SIPP, personal pension, workplace pensions (not defined benefit pensions).",
    options: [
      { label: "Under £100,000",         value: "under_100k",     subLabel: "Modest exposure under proposal" },
      { label: "£100,000–£325,000",       value: "100k_to_325k",  subLabel: "May fall within nil-rate band" },
      { label: "£325,000–£500,000",       value: "325k_to_500k",  subLabel: "Likely above NRB when combined with estate" },
      { label: "£500,000–£1,000,000",     value: "500k_to_1m",    subLabel: "Significant IHT exposure if proposal enacted" },
      { label: "Over £1,000,000",         value: "over_1m",        subLabel: "Substantial exposure — double tax likely" },
    ],
    required: true,
  },
  {
    id: "estate_value", step: 2, type: "button_group",
    label: "Total estate value EXCLUDING your pension?",
    subLabel: "Property, savings, investments, business interests, chattels — everything except DC pensions. This determines how much of your nil-rate band is already absorbed.",
    options: [
      { label: "Under £325,000",         value: "under_325k",     subLabel: "Some NRB headroom for pension" },
      { label: "£325,000–£500,000",       value: "325k_to_500k",  subLabel: "Estate already at/above single NRB" },
      { label: "£500,000–£1,000,000",     value: "500k_to_1m",    subLabel: "Estate above NRB — pension fully exposed" },
      { label: "Over £1,000,000",         value: "over_1m",        subLabel: "Estate above couples' NRB — high exposure" },
    ],
    required: true,
  },
  {
    id: "marital_status", step: 3, type: "button_group",
    label: "What is your marital status?",
    subLabel: "Spouse exemption applies to transfers between married couples and civil partners — both under current law AND the October 2024 proposal.",
    options: [
      { label: "Married / civil partnership", value: "married",  subLabel: "Spouse exemption + transferable NRB" },
      { label: "Single / widowed / divorced",  value: "single",    subLabel: "Single NRB — no spouse exemption available" },
    ],
    required: true,
  },
  {
    id: "beneficiaries", step: 4, type: "button_group",
    label: "Who are your pension beneficiaries (expression of wishes)?",
    subLabel: "The beneficiary designation determines whether spouse exemption applies AND affects the proposed IHT treatment.",
    options: [
      { label: "Spouse or civil partner only",       value: "spouse_only",   subLabel: "Exempt on first death, risk on second" },
      { label: "Children / grandchildren",            value: "children",      subLabel: "Full proposed IHT exposure" },
      { label: "Mix of spouse and children",          value: "mix",            subLabel: "Partial exemption, complex calc" },
      { label: "Not nominated / not sure",             value: "unnominated",   subLabel: "Default falls to estate — review urgently" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 4;

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

      {/* Legal status banner — CRITICAL for this product */}
      <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-xs">
        <p className="font-semibold text-amber-900">{verdict.legalStatusBanner}</p>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Current vs Proposed comparison */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Current law vs October 2024 proposal (if enacted)</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Pension value</span>
            <span className="font-mono font-bold text-neutral-950">{formatGBP(verdict.result.pension)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Estate value (excluding pension)</span>
            <span className="font-mono text-neutral-950">{formatGBP(verdict.result.estate)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Combined total estate</span>
            <span className="font-mono font-bold text-neutral-950">{formatGBP(verdict.result.totalEstate)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Effective nil-rate band</span>
            <span className="font-mono text-neutral-950">{formatGBP(verdict.result.effectiveNilRateBand)}{verdict.result.married ? " (couples)" : " (individual)"}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-neutral-200">
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 mb-1">Current law (pension outside estate)</p>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Current IHT on estate alone</span>
            <span className="font-mono text-emerald-700">{formatGBP(verdict.result.currentIht)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Current IHT on pension</span>
            <span className="font-mono text-emerald-700">£0 (outside estate)</span>
          </div>
          <div className="mt-2 pt-2 border-t border-neutral-200">
            <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1">If October 2024 proposal enacted (from 6 April 2027)</p>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Proposed IHT on total estate</span>
            <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.proposedIht)}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-100 pb-1">
            <span className="text-neutral-600">Pension-attributable IHT increment</span>
            <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.proposedPensionIht)}</span>
          </div>
          {verdict.result.beneficiaries !== "spouse_only" && verdict.result.proposedPensionIht > 0 && (
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Est. income tax on beneficiary withdrawals</span>
              <span className="font-mono text-red-700">{formatGBP(verdict.result.incomeTaxOnWithdrawals)}</span>
            </div>
          )}
          {verdict.result.beneficiaries !== "spouse_only" && verdict.result.combinedPensionCost > 0 && (
            <div className="flex justify-between pt-1">
              <span className="font-semibold text-neutral-800">Combined family cost on pension</span>
              <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.combinedPensionCost)} ({(verdict.result.effectivePensionRate * 100).toFixed(0)}%)</span>
            </div>
          )}
        </div>
      </div>

      {/* Fear framing — only if meaningful exposure */}
      {verdict.result.exposureStatus !== "BELOW_NIL_RATE_BAND" && verdict.result.combinedPensionCost > 0 && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ The proposed double tax — IF enacted</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-1">
            Up to {formatGBP(verdict.result.combinedPensionCost)} family exposure on a {formatGBP(verdict.result.pension)} pension — a {(verdict.result.effectivePensionRate * 100).toFixed(0)}% effective rate.
          </p>
          <p className="text-xs text-red-800 leading-relaxed">
            Under the October 2024 consultation proposal, if enacted from 6 April 2027: 40% IHT on pension value above remaining nil-rate band, PLUS income tax on withdrawals by beneficiaries at their marginal rate (up to 45%). Planning window: now to April 2027 — if enacted.
          </p>
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
          <strong className="text-neutral-950">This is a proposal, not yet law.</strong> Royal Assent has not yet occurred. But the direction of travel is clear — government has confirmed intent, draft legislation is published, and the proposed effective date is 6 April 2027. Planning options tend to work better BEFORE a legislative change than after.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact IHT exposure under current AND proposed rules</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Beneficiary nomination review and recommendations</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Drawdown strategy analysis — pension vs ISA vs other assets</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Whole-of-life insurance in trust — sizing and cost estimate</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant / IFA questions written for your exposure</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">£{verdict.tier} · One-time · Built around your pension + estate + beneficiaries</p>
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PensionIhtTrapCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ entity_type: "", urgency: "", accountant: "" });
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
        product_slug: "pension-iht-trap",
        source_path: "/uk/check/pension-iht-trap",
        country_code: "UK", currency_code: "GBP", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          exposure_status: verdict.result.exposureStatus,
          total_estate: verdict.result.totalEstate,
          proposed_pension_iht: verdict.result.proposedPensionIht,
          combined_pension_cost: verdict.result.combinedPensionCost,
          effective_rate: verdict.result.effectivePensionRate,
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
      body: JSON.stringify({ email, source: "pension_iht_trap", country_code: "UK", site: "taxchecknow" }),
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
    const sid = sessionId || `piht_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("pension-iht-trap_pension_value", String(answers.pension_value || ""));
    sessionStorage.setItem("pension-iht-trap_estate_value", String(answers.estate_value || ""));
    sessionStorage.setItem("pension-iht-trap_marital_status", String(answers.marital_status || ""));
    sessionStorage.setItem("pension-iht-trap_beneficiaries", String(answers.beneficiaries || ""));
    sessionStorage.setItem("pension-iht-trap_exposure_status", verdict.result.exposureStatus);
    sessionStorage.setItem("pension-iht-trap_total_estate", String(Math.round(verdict.result.totalEstate)));
    sessionStorage.setItem("pension-iht-trap_proposed_pension_iht", String(Math.round(verdict.result.proposedPensionIht)));
    sessionStorage.setItem("pension-iht-trap_combined_pension_cost", String(Math.round(verdict.result.combinedPensionCost)));
    sessionStorage.setItem("pension-iht-trap_status", verdict.status);
    sessionStorage.setItem("pension-iht-trap_tier", String(popupTier));

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
          success_url: `${window.location.origin}/uk/check/pension-iht-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/uk/check/pension-iht-trap`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your pension IHT exposure for your IFA or estate planner.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your position by email — free.</p>
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

      {/* Purchase popup */}
      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700","400")}`}>{verdict.status}</p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">
                    {popupTier === 67 ? "Your Pension IHT Decision Pack" : "Your Pension IHT Strategy Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">HMRC-referenced · IHTA 1984 · Oct 2024 Consultation · April 2026</p>
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
                      {popupTier === 67 ? "Pension IHT Decision Pack™" : "Pension IHT Strategy Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact IHT exposure under current AND proposed rules, beneficiary nomination review, planning window analysis, and 5 IFA questions — built around your pension + estate + beneficiary situation."
                        : "Full strategy: drawdown vs gifting analysis, whole-of-life insurance sizing, ISA vs pension rebalancing plan, trust planning options, couples optimisation strategy, and IFA/estate planner coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs text-amber-900 leading-relaxed">
                      <strong>Legal status reminder:</strong> the October 2024 proposal is NOT yet law. Royal Assent has not yet occurred. Your plan is structured to work if enacted, with fallback options if the proposal is delayed or amended.
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">£{popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic IHT overview. Your specific exposure + planning window + action list.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Exposure Audit →" : "Get My Strategy Pack →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the audit? — £67 instead" : "Want the full strategy pack? — £147 instead"}
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
                    { label: "Your situation", key: "entity_type", options: [["retired","Retired — drawing pension"],["pre_retirement","Pre-retirement — pension accumulated"],["widowed","Widowed — second-death planning"],["couple","Couple — joint estate planning"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before April 2027"],["monitoring","Monitoring the legislation"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an IFA or estate planner?", key: "accountant", options: [["ifa","Yes — IFA"],["estate_planner","Yes — estate planner / solicitor"],["both","Both"],["none","No — managing myself"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · HMRC-sourced content</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky bar */}
      {showVerdict && verdict && verdict.result.combinedPensionCost > 0 && verdict.result.exposureStatus !== "BELOW_NIL_RATE_BAND" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Proposed family exposure (if enacted)</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatGBP(verdict.result.combinedPensionCost)} ({(verdict.result.effectivePensionRate * 100).toFixed(0)}%)
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
