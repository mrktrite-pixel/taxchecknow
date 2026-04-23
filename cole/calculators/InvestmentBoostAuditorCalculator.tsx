"use client";

/**
 * NZ-05 — Investment Boost Timing Engine (formerly Investment Boost Auditor)
 * Pattern: ThresholdTest (Module G) + Timeline (Module B)
 *
 * CORE FRAMING — MUST BE CONSISTENT:
 *   Investment Boost does NOT reduce total tax.
 *   Total lifetime deductions are unchanged.
 *   The benefit is CASHFLOW — tax relief brought forward.
 *   Year 1 tax is lower; later-year tax is higher; total is the same.
 *
 * CORE RULES:
 *   20% upfront deduction in year asset first available for use
 *   Remaining 80% depreciated at normal rate over asset life
 *   Total deductions = same as without boost
 *
 * ELIGIBILITY:
 *   Available for use ON OR AFTER 22 May 2025
 *   New assets or new-to-NZ assets
 *   Depreciable business property (machinery, equipment, vehicles,
 *     computers, fit-out, plant, tools, hardware)
 *
 * NOT ELIGIBLE:
 *   Residential rental property (explicitly excluded)
 *   Second-hand assets already in NZ
 *   Land (never depreciable)
 *   Intangibles (patents, goodwill — separate rules)
 *   Assets available for use before 22 May 2025
 *   Personal use assets
 *
 * Legal anchor: Income Tax Act 2007 as amended by Budget 2025 legislation
 * (enacted May 2025), including s EE 31B.
 *
 * KEY MATH (verify with spec):
 *   Additional year 1 tax relief = 0.20 × cost × tax_rate × (1 − dep_rate)
 *   $100k × 28% × (1 − 30%) = $3,920 ✓ matches spec
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type BoostStatus =
  | "ELIGIBLE_POST_22_MAY"          // available on or after 22 May 2025, eligible type
  | "NOT_ELIGIBLE_PRE_22_MAY"       // available before 22 May 2025
  | "NOT_ELIGIBLE_RESIDENTIAL"      // residential rental property excluded
  | "NOT_ELIGIBLE_SECOND_HAND_NZ"   // second-hand asset already in NZ
  | "NOT_ELIGIBLE_LAND_INTANGIBLE"  // land or intangibles
  | "DATE_UNCERTAIN_VERIFY";        // available-for-use date not confirmed

interface BoostResult {
  availability:    string;
  assetType:       string;
  assetCost:       number;
  depRate:         number;
  depRateLabel:    string;
  taxRate:         number;
  taxRateLabel:    string;
  cashflowImportance: string;

  withoutBoostYear1Deduction: number;
  withoutBoostYear1Tax:       number;
  withBoostYear1Deduction:    number;
  withBoostYear1Tax:          number;
  additionalYear1Relief:      number;
  boostAmount:                 number;         // 20% × cost (if eligible)

  eligible: boolean;
  status: BoostStatus;
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
  result: BoostResult;
}

interface PopupAnswers {
  buyer_role: string;
  urgency: string;
  accountant: string;
}

const COST_MIDPOINT: Record<string, number> = {
  under_10k:   7_500,
  "10k_50k":   25_000,
  "50k_200k":  100_000,
  over_200k:   350_000,
};

const DEP_RATE: Record<string, { rate: number; label: string }> = {
  under_15: { rate: 0.10,  label: "~10% (long life)" },
  "15_30":  { rate: 0.225, label: "~22.5% (mid range)" },
  "30_67":  { rate: 0.45,  label: "~45% (short life)" },
  unsure:   { rate: 0.30,  label: "30% (placeholder — verify IRD schedule)" },
};

const TAX_RATE: Record<string, { rate: number; label: string }> = {
  "28":      { rate: 0.28,  label: "28% (company)" },
  "33":      { rate: 0.33,  label: "33% (trust / top individual)" },
  "17_5":    { rate: 0.175, label: "17.5% (individual lower)" },
  not_sure:  { rate: 0.28,  label: "28% (assumed company — verify)" },
};

const PRODUCT_KEYS = {
  p67:  "nz_67_investment_boost_auditor",
  p147: "nz_147_investment_boost_auditor",
};

function formatNZD(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-NZ");
}

function calcBoost(answers: AnswerMap): BoostResult {
  const availability       = String(answers.availability        || "post_may");
  const assetType          = String(answers.asset_type           || "machinery");
  const costKey            = String(answers.asset_cost           || "50k_200k");
  const depKey             = String(answers.dep_rate             || "15_30");
  const taxKey             = String(answers.tax_rate             || "28");
  const cashflowImportance = String(answers.cashflow_importance || "yes");

  const assetCost = COST_MIDPOINT[costKey] ?? 100_000;
  const depInfo   = DEP_RATE[depKey] ?? DEP_RATE["15_30"];
  const taxInfo   = TAX_RATE[taxKey] ?? TAX_RATE["28"];

  // Eligibility determination
  let status: BoostStatus;
  let eligible = false;

  if (assetType === "residential_rental") {
    status = "NOT_ELIGIBLE_RESIDENTIAL";
  } else if (assetType === "second_hand_nz") {
    status = "NOT_ELIGIBLE_SECOND_HAND_NZ";
  } else if (assetType === "land_intangible") {
    status = "NOT_ELIGIBLE_LAND_INTANGIBLE";
  } else if (availability === "pre_may") {
    status = "NOT_ELIGIBLE_PRE_22_MAY";
  } else if (availability === "not_sure") {
    status = "DATE_UNCERTAIN_VERIFY";
  } else {
    status = "ELIGIBLE_POST_22_MAY";
    eligible = true;
  }

  // Math — compute both scenarios whether eligible or not for comparison purposes
  const withoutBoostYear1Deduction = assetCost * depInfo.rate;
  const withoutBoostYear1Tax = withoutBoostYear1Deduction * taxInfo.rate;
  const withBoostYear1Deduction = assetCost * 0.20 + assetCost * 0.80 * depInfo.rate;
  const withBoostYear1Tax = withBoostYear1Deduction * taxInfo.rate;
  const additionalYear1Relief = withBoostYear1Tax - withoutBoostYear1Tax;
  const boostAmount = assetCost * 0.20;

  return {
    availability, assetType, assetCost,
    depRate: depInfo.rate, depRateLabel: depInfo.label,
    taxRate: taxInfo.rate, taxRateLabel: taxInfo.label,
    cashflowImportance,
    withoutBoostYear1Deduction, withoutBoostYear1Tax,
    withBoostYear1Deduction, withBoostYear1Tax,
    additionalYear1Relief, boostAmount,
    eligible, status,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcBoost(answers);

  if (result.status === "ELIGIBLE_POST_22_MAY") {
    return {
      status: "ELIGIBLE — 20% UPFRONT DEDUCTION APPLIES IN YEAR ONE",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: `Your asset is first available for use on or after 22 May 2025 and qualifies for Investment Boost. On ${formatNZD(result.assetCost)} at ${result.taxRateLabel} marginal rate with ${result.depRateLabel} depreciation, year 1 tax is ${formatNZD(result.additionalYear1Relief)} lower than standard depreciation alone (${formatNZD(result.withBoostYear1Tax)} vs ${formatNZD(result.withoutBoostYear1Tax)}). Total tax over the asset's life is UNCHANGED — this is cashflow acceleration, not a permanent tax saving.`,
      stats: [
        { label: "Year 1 tax (with boost)",           value: formatNZD(result.withBoostYear1Tax),     highlight: false },
        { label: "Year 1 tax (without boost)",        value: formatNZD(result.withoutBoostYear1Tax),  highlight: false },
        { label: "Additional year 1 cashflow",         value: formatNZD(result.additionalYear1Relief), highlight: true },
      ],
      consequences: [
        `✓ Eligible. Asset first available for use on or after 22 May 2025, eligible type (not residential / second-hand NZ / land / intangible).`,
        `Year 1 deduction with Investment Boost: ${formatNZD(result.withBoostYear1Deduction)} = ${formatNZD(result.boostAmount)} (20% boost) + ${formatNZD(result.assetCost * 0.80 * result.depRate)} (normal depreciation on remaining 80%).`,
        `Year 1 deduction without boost: ${formatNZD(result.withoutBoostYear1Deduction)}. Difference in year 1: ${formatNZD(result.withBoostYear1Deduction - result.withoutBoostYear1Deduction)} extra deduction — worth ${formatNZD(result.additionalYear1Relief)} in year 1 tax at ${result.taxRateLabel}.`,
        "⚠ Critical framing: Investment Boost does NOT reduce total tax. Total lifetime deductions on this asset are the same with or without the boost. The 20% upfront deduction is offset by smaller deductions in later years. The benefit is WHEN the tax relief arrives — front-loaded into year 1 — not HOW MUCH tax you pay in total.",
        "Why this still matters: cashflow in year 1 is usually worth more than cashflow in year 5 or 10 (time value of money). For a business that needs the cash now, front-loading is genuinely valuable. For a business that doesn't, the boost still costs nothing to claim.",
        "Available-for-use documentation: keep the commissioning certificate, installation date record, or first-use record. IRD can audit this specifically. The operative trigger is when the asset was AVAILABLE FOR USE — not when it was purchased or paid for.",
        "IR10 Box 60 disclosure: required for all Investment Boost claims. Box 60 records the total value of boost assets claimed (excluding any private-use portion). Box 52 includes the boost amount within total depreciation.",
        "Disposal: when you sell the asset in future, depreciation recovered rules apply. The accelerated 20% boost is included in the depreciation base that's recovered if the sale exceeds adjusted tax value. This reinforces the 'accelerated not additional' framing.",
      ],
      confidence: "HIGH",
      confidenceNote: "Eligible asset under Income Tax Act 2007 (as amended by Budget 2025). Cashflow benefit confirmed; total tax is unchanged across asset life.",
      tier: 67,
      ctaLabel: "Get My Year 1 Cashflow Calculation — $67 →",
      altTierLabel: "Multiple assets / planning purchase timing? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "NOT_ELIGIBLE_PRE_22_MAY") {
    return {
      status: "NOT ELIGIBLE — ASSET AVAILABLE BEFORE 22 MAY 2025",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your asset was first available for use before 22 May 2025. Investment Boost does NOT apply. Only standard depreciation applies: ${formatNZD(result.withoutBoostYear1Deduction)} year 1 deduction at ${result.depRateLabel} = ${formatNZD(result.withoutBoostYear1Tax)} year 1 tax relief at ${result.taxRateLabel}. The missed cashflow benefit (had the asset been available after 22 May): ${formatNZD(result.additionalYear1Relief)} of year 1 tax brought forward.`,
      stats: [
        { label: "Year 1 tax (standard)",        value: formatNZD(result.withoutBoostYear1Tax), highlight: false },
        { label: "Boost NOT applicable",           value: "—",                                      highlight: true },
        { label: "Missed year 1 cashflow",         value: formatNZD(result.additionalYear1Relief), highlight: true },
      ],
      consequences: [
        `🔒 Asset available for use before 22 May 2025. Investment Boost requires the asset to be first available for use ON OR AFTER 22 May 2025.`,
        "Test specifics: the operative trigger is the AVAILABLE FOR USE date — not the purchase date, invoice date, or payment date. An asset purchased in March 2025 but not commissioned until June 2025 qualifies. An asset purchased in June 2025 but available since April 2025 does not.",
        "Common misunderstanding: many businesses assume 'bought it recently so it qualifies'. The Budget 2025 legislation is specific — the in-use date is the trigger, not the transaction date.",
        `Standard depreciation: ${formatNZD(result.withoutBoostYear1Deduction)} year 1 at ${result.depRateLabel} rate = ${formatNZD(result.withoutBoostYear1Tax)} in year 1 tax relief at ${result.taxRateLabel}. This continues at the diminishing value rate over the asset's life.`,
        "Forward planning for future assets: any new asset you commission from today onwards will qualify for Investment Boost (assuming eligible type). For material purchases, delivery and commissioning timing is now a tax-planning variable.",
        "Capital allowances note: Investment Boost is a one-time cashflow accelerator. It is not a new permanent deduction. Even if this asset had qualified, total tax over its life would be the same — just shifted earlier.",
      ],
      confidence: "HIGH",
      confidenceNote: "Pre-22-May availability excludes Investment Boost under the Budget 2025 legislation. Standard depreciation applies.",
      tier: 67,
      ctaLabel: "Get My Standard Depreciation Plan — $67 →",
      altTierLabel: "Planning future purchases? — $147 timing strategy",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "NOT_ELIGIBLE_RESIDENTIAL") {
    return {
      status: "NOT ELIGIBLE — RESIDENTIAL RENTAL PROPERTY EXCLUDED",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Residential rental property is explicitly excluded from Investment Boost under the Budget 2025 legislation. This applies to the building itself, regardless of availability date. Standard residential rental rules apply — building depreciation is not available under the current depreciation regime, and tenant fit-out / chattels are treated separately under normal depreciation.`,
      stats: [
        { label: "Residential rental",       value: "EXCLUDED by statute", highlight: true },
        { label: "Boost NOT applicable",      value: "—",                    highlight: true },
        { label: "Alternative",                 value: "Commercial use may qualify" },
      ],
      consequences: [
        `🔒 Residential rental property is explicitly excluded from Investment Boost. The policy intent is to direct the cashflow incentive toward productive business investment rather than residential rental activity.`,
        "Scope of exclusion: the exclusion covers the residential rental BUILDING itself. Separately-identified chattels and fit-outs used in a residential rental (e.g. appliances, carpets) are depreciable under normal rules but do not qualify for the boost.",
        "Adjacent treatment: residential rental property also has 0% building depreciation under current NZ tax rules (long-standing policy since 2011). The Investment Boost exclusion is consistent with that treatment.",
        "Commercial use alternative: if part of the property is used commercially (e.g. home office, dedicated commercial space in a mixed-use building), the commercial portion may qualify. Requires clean apportionment.",
        "Related NZ-01 / NZ-03 cross-reference: for residential rental property, check the Bright-Line Property Tax Decision Engine (sale timing) and the Property Interest Deductibility Recovery Engine (100% interest deductibility restored from 1 April 2025).",
        "Do not attempt reclassification: characterising residential rental activity as 'business' to access Investment Boost is the exact type of arrangement challenged under BG 1 general anti-avoidance. The policy exclusion is explicit and specific.",
      ],
      confidence: "HIGH",
      confidenceNote: "Residential rental property is statutorily excluded from Investment Boost. No structural workaround available.",
      tier: 67,
      ctaLabel: "Get My Residential Rental Tax Plan — $67 →",
      altTierLabel: "Mixed commercial + residential? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "NOT_ELIGIBLE_SECOND_HAND_NZ") {
    return {
      status: "NOT ELIGIBLE — SECOND-HAND NZ ASSET",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `The asset is second-hand and already in New Zealand. Investment Boost requires the asset to be new or new to New Zealand. Second-hand assets that have been used in NZ before do not qualify regardless of who owns them now. Standard depreciation applies from your acquisition date.`,
      stats: [
        { label: "Second-hand NZ asset",     value: "EXCLUDED",   highlight: true },
        { label: "Boost NOT applicable",      value: "—",          highlight: true },
        { label: "Standard depreciation",      value: "Applies from your acquisition" },
      ],
      consequences: [
        `🔒 Investment Boost applies to NEW assets or assets NEW TO NEW ZEALAND. A second-hand asset previously used in NZ does not qualify — the boost cannot apply twice to the same physical asset.`,
        "What would qualify instead: (a) a NEW asset acquired from a NZ supplier — qualifies (assuming eligible type and available-for-use date); (b) a USED asset imported from overseas that has not been used in NZ before — qualifies as 'new to NZ'. What does NOT qualify: a used asset you bought from another NZ business.",
        "Imported asset documentation: if you are acquiring an imported used asset, keep the bill of lading / airway bill, NZ Customs import entry, purchase contract showing overseas origin, and first-use-in-NZ commissioning record. IRD expects this evidence if challenged.",
        "Standard depreciation for second-hand NZ assets: you can still claim ordinary depreciation from your acquisition date at the IRD schedule rate for that asset class. This is reduced by any depreciation already claimed by the previous owner (tax book value, not market value, carries forward in some cases).",
        "Forward planning: if you have a choice between buying an existing NZ second-hand asset or importing a used asset from overseas, the boost eligibility may shift the economics in favour of importing — but weigh against shipping costs, commissioning delays, and after-sales support.",
      ],
      confidence: "HIGH",
      confidenceNote: "Second-hand NZ asset is outside Investment Boost scope. Standard depreciation only.",
      tier: 67,
      ctaLabel: "Get My Standard Depreciation Plan — $67 →",
      altTierLabel: "Considering imports? — $147 timing strategy",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  if (result.status === "NOT_ELIGIBLE_LAND_INTANGIBLE") {
    return {
      status: "NOT ELIGIBLE — LAND OR INTANGIBLE ASSET",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Land and intangible assets (patents, goodwill, trademarks) are outside the Investment Boost regime. Land is not depreciable under NZ tax law. Intangible assets are subject to separate amortisation / depreciation regimes — not the boost. For a transaction that includes both qualifying and non-qualifying components, only the qualifying portion attracts the boost.`,
      stats: [
        { label: "Land / intangible",      value: "NOT DEPRECIABLE / SEPARATE RULES", highlight: true },
        { label: "Boost NOT applicable",    value: "—",                                 highlight: true },
        { label: "Qualifying components",    value: "May apply if separately identifiable" },
      ],
      consequences: [
        `🔒 Land is never depreciable in NZ tax law (standard principle, not specific to Investment Boost). Intangible assets are subject to their own amortisation regimes — not the boost.`,
        "Mixed-component transactions: if you purchase a package that includes LAND + BUILDING + EQUIPMENT, the boost applies asset-by-asset. The land portion is excluded; the building portion may qualify (if commercial, post-22 May 2025); the equipment portion may qualify. A formal cost apportionment is required.",
        "Intangibles excluded: goodwill, patents, trademarks, software licences, and similar intangibles have specific treatment under NZ tax rules — typically amortisation over a specified life or no deduction at all depending on the asset class. Investment Boost does not apply.",
        "Goodwill note: goodwill acquired as part of a business purchase is generally not deductible in NZ. It sits on the balance sheet until sold. Investment Boost does not change this.",
        "Software specifics: custom-developed software and externally-purchased software licences have specific depreciation rules. Some software can be depreciated; some is treated as intangible with different treatment. Check with your accountant — software classification is its own rabbit hole.",
      ],
      confidence: "HIGH",
      confidenceNote: "Land not depreciable; intangibles under separate regimes. Investment Boost does not apply to either category.",
      tier: 67,
      ctaLabel: "Get My Asset Classification Plan — $67 →",
      altTierLabel: "Mixed-asset transaction? — $147",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // DATE_UNCERTAIN_VERIFY
  return {
    status: "VERIFY — AVAILABLE-FOR-USE DATE MUST BE CONFIRMED",
    statusClass: "text-amber-700",
    panelClass: "border-amber-200 bg-amber-50",
    headline: `The eligibility of the Investment Boost turns entirely on the date the asset was first AVAILABLE FOR USE. Without confirming that date, eligibility cannot be assessed. The difference between eligible (post-22 May 2025) and not eligible (pre-22 May 2025) is ${formatNZD(result.additionalYear1Relief)} of year 1 cashflow on a ${formatNZD(result.assetCost)} asset at your rates.`,
    stats: [
      { label: "If available on/after 22 May",     value: formatNZD(result.withBoostYear1Tax) + " year 1 tax",     highlight: true },
      { label: "If available before 22 May",        value: formatNZD(result.withoutBoostYear1Tax) + " year 1 tax", highlight: true },
      { label: "Year 1 cashflow difference",         value: formatNZD(result.additionalYear1Relief),                highlight: true },
    ],
    consequences: [
      `⚠ The available-for-use date is the sole eligibility trigger for Investment Boost. Not the purchase date, invoice date, payment date, or delivery date. AVAILABILITY for use — when the asset could have been used in your business — is the test.`,
      "Documents that establish available-for-use date: (a) for machinery: commissioning certificate, installation completion record, supplier sign-off; (b) for buildings: Code Compliance Certificate, handover from builder, first operational use record; (c) for vehicles: registration completion + keys received + business-use commenced; (d) for software / hardware: install completion and commissioning.",
      "Common edge cases: (a) delivered but not installed — not yet available; (b) installed but not commissioned / tested — not yet available; (c) installed and operational but you chose to delay first use — generally still 'available for use'; (d) installed pre-22 May but first actual use was post-22 May — still not eligible (availability, not use, is the test).",
      "Action sequence: (1) pull the commissioning / handover document; (2) verify the date against 22 May 2025; (3) if on/after → eligible (assuming eligible asset type); (4) if before → not eligible — standard depreciation only; (5) document the evidence for any future IRD query.",
      "For ongoing projects: if a project is mid-build with staged completion, IRD accepts Investment Boost on an identifiable stage that is complete, adds capital value, and is available for use. You do not need to wait for full project completion. Documentation of staged completion is essential.",
      "If close to the boundary: aim for documentation clarity rather than stretched interpretations. An asset available 20 May 2025 (two days before the threshold) is not eligible regardless of any arguments to the contrary. The threshold is hard.",
    ],
    confidence: "LOW",
    confidenceNote: "Cannot assess eligibility without confirmed available-for-use date. Evidence gathering is the first action.",
    tier: 147,
    ctaLabel: "Get My Date-Verification + Planning Pack — $147 →",
    altTierLabel: "Just want the rules? — $67 instead",
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
    id: "availability", step: 1, type: "button_group",
    label: "When will the asset be first available for use?",
    subLabel: "The AVAILABLE-FOR-USE date is the sole eligibility trigger — not the purchase date, invoice date, or payment date.",
    options: [
      { label: "Already in use (before 22 May 2025)",    value: "pre_may",   subLabel: "No Investment Boost — standard depreciation only" },
      { label: "On or after 22 May 2025",                  value: "post_may", subLabel: "Investment Boost applies if eligible type" },
      { label: "Not sure of exact date",                    value: "not_sure", subLabel: "Verify commissioning date before claiming" },
    ],
    required: true,
  },
  {
    id: "asset_type", step: 2, type: "button_group",
    label: "Asset type?",
    subLabel: "Residential rental, second-hand NZ, land, and intangibles are explicitly excluded from Investment Boost.",
    options: [
      { label: "Machinery / plant / equipment",                   value: "machinery",           subLabel: "Eligible" },
      { label: "Computers / technology / hardware",                value: "technology",          subLabel: "Eligible" },
      { label: "Vehicles (commercial use)",                         value: "vehicles",            subLabel: "Eligible — business use portion only" },
      { label: "Fit-out / leasehold improvements",                 value: "fitout",              subLabel: "Eligible" },
      { label: "Residential rental property",                       value: "residential_rental", subLabel: "EXCLUDED — statute" },
      { label: "Second-hand asset already in NZ",                   value: "second_hand_nz",    subLabel: "EXCLUDED — must be new or new-to-NZ" },
      { label: "Land or intangible (patent, goodwill)",             value: "land_intangible",   subLabel: "EXCLUDED — not depreciable / separate rules" },
    ],
    required: true,
  },
  {
    id: "asset_cost", step: 3, type: "button_group",
    label: "Asset cost (GST exclusive)?",
    subLabel: "Cost net of GST. For mixed-use assets, apportion to the business-use proportion.",
    options: [
      { label: "Under $10,000",        value: "under_10k", subLabel: "Modest — cashflow benefit still real" },
      { label: "$10,000 – $50,000",     value: "10k_50k",  subLabel: "Mid-range equipment / vehicles" },
      { label: "$50,000 – $200,000",   value: "50k_200k", subLabel: "Substantial — boost is material" },
      { label: "Over $200,000",         value: "over_200k", subLabel: "Major — timing decision is strategic" },
    ],
    required: true,
  },
  {
    id: "dep_rate", step: 4, type: "button_group",
    label: "Normal depreciation rate for this asset?",
    subLabel: "From the IRD depreciation schedule. Common: vehicles 30% DV, computers 50% DV, buildings 0%. Unsure? Pick the range or check IRD.",
    options: [
      { label: "Under 15% (long life asset — buildings, heavy plant)", value: "under_15", subLabel: "Boost impact larger in year 1" },
      { label: "15% – 30% (mid range)",                                   value: "15_30",   subLabel: "Typical equipment" },
      { label: "30% – 67% (short life — tech, vehicles)",                  value: "30_67",   subLabel: "Boost impact smaller relative to annual dep" },
      { label: "Unsure — need to check IRD schedule",                     value: "unsure",  subLabel: "Verify with accountant before claiming" },
    ],
    required: true,
  },
  {
    id: "tax_rate", step: 5, type: "button_group",
    label: "Business entity tax rate?",
    subLabel: "Rate applied to the deduction to calculate cashflow benefit. Higher rate = larger cashflow impact.",
    options: [
      { label: "28% (company)",                      value: "28",       subLabel: "Standard NZ company rate" },
      { label: "33% (trust / individual top)",        value: "33",       subLabel: "Trust or high-income individual" },
      { label: "17.5% (individual lower)",             value: "17_5",    subLabel: "Low-income individual" },
      { label: "Not sure",                              value: "not_sure", subLabel: "Default to 28% (company) for modelling" },
    ],
    required: true,
  },
  {
    id: "cashflow_importance", step: 6, type: "button_group",
    label: "Is cashflow timing important to your business?",
    subLabel: "Investment Boost is a CASHFLOW accelerator — total tax is unchanged. Importance of year-1 relief varies by business.",
    options: [
      { label: "Yes — we need tax relief early",        value: "yes",       subLabel: "Boost is valuable — claim it" },
      { label: "Somewhat — helpful but not critical",    value: "somewhat", subLabel: "Small but positive benefit" },
      { label: "No — total tax is what matters",          value: "no",        subLabel: "Boost still worth claiming at $0 cost" },
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
  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* CRITICAL FRAMING — visible on every verdict */}
      <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-xs">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">⚠ Investment Boost is cashflow acceleration — not a tax saving</p>
        <p className="text-amber-900 leading-relaxed">
          Total lifetime deductions on the asset are UNCHANGED with or without the boost. Total tax over the asset's life is the same. The 20% upfront deduction is offset by smaller deductions in later years. The benefit is WHEN the tax relief arrives — year 1 cashflow is better. The boost brings tax relief forward; it does not reduce the total tax paid.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Legal anchor — Income Tax Act 2007 (as amended by Budget 2025 legislation, enacted May 2025)</p>
        <div className="space-y-1 text-neutral-800">
          <p><strong>20% upfront deduction</strong> in year asset first available for use</p>
          <p><strong>Remaining 80%</strong> depreciated at normal rate over asset life</p>
          <p><strong>Trigger date:</strong> first available for use ON OR AFTER 22 May 2025</p>
          <p><strong>Eligible:</strong> new business assets, new-to-NZ imports, depreciable tangible property</p>
          <p><strong>Excluded:</strong> residential rental, second-hand NZ assets, land, intangibles, pre-22-May availability</p>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-emerald-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Before/After cashflow table */}
      {verdict.result.assetCost > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Year 1 cashflow — with vs without Investment Boost (same total tax over asset life)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-700">Without boost (standard depreciation)</p>
              <ul className="space-y-1 text-xs text-neutral-800">
                <li>Year 1 deduction: {formatNZD(verdict.result.withoutBoostYear1Deduction)}</li>
                <li>Tax rate: {verdict.result.taxRateLabel}</li>
                <li>Year 1 tax relief: {formatNZD(verdict.result.withoutBoostYear1Tax)}</li>
                <li className="font-bold mt-1 pt-1 border-t border-neutral-300">Remaining deductions spread over years 2+</li>
              </ul>
            </div>
            <div className={`rounded-lg border px-3 py-3 ${verdict.result.eligible ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"}`}>
              <p className={`mb-1 text-xs font-bold uppercase tracking-wider ${verdict.result.eligible ? "text-emerald-700" : "text-neutral-700"}`}>With Investment Boost {verdict.result.eligible ? "(applies)" : "(would apply if eligible)"}</p>
              <ul className={`space-y-1 text-xs ${verdict.result.eligible ? "text-emerald-900" : "text-neutral-700"}`}>
                <li>20% upfront: {formatNZD(verdict.result.boostAmount)}</li>
                <li>+ 30% DV on remaining 80%: {formatNZD(verdict.result.assetCost * 0.80 * verdict.result.depRate)}</li>
                <li>Year 1 deduction total: {formatNZD(verdict.result.withBoostYear1Deduction)}</li>
                <li>Year 1 tax relief: {formatNZD(verdict.result.withBoostYear1Tax)}</li>
                <li className={`font-bold mt-1 pt-1 border-t ${verdict.result.eligible ? "border-emerald-300" : "border-neutral-300"}`}>Additional year 1 cashflow: {formatNZD(verdict.result.additionalYear1Relief)}</li>
              </ul>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-neutral-500">
            Both scenarios deliver the SAME total deductions over the asset's life. The boost shifts when the deduction lands — not how much.
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
          <strong className="text-neutral-950">Same total tax — better year 1 cashflow.</strong> Investment Boost is a timing tool. It brings tax relief forward by accelerating 20% of the depreciation into year 1. Over the asset's life, the total deduction and the total tax are unchanged. The operative trigger is availability for use on or after 22 May 2025 — not the purchase date.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Eligibility verdict with specific reasoning</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Year 1 tax relief math (with and without boost)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Available-for-use documentation checklist</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>IR10 Box 60 disclosure guidance</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Timing strategy for planned future purchases</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant questions specific to your situation</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} NZD · One-time · Built around your exact asset and rates</p>
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

export default function InvestmentBoostAuditorCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(147);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ buyer_role: "", urgency: "", accountant: "" });
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
        product_slug: "investment-boost-auditor",
        source_path: "/nz/check/investment-boost-auditor",
        country_code: "NZ", currency_code: "NZD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          boost_status: verdict.result.status,
          asset_cost: verdict.result.assetCost,
          without_boost_year1_tax: verdict.result.withoutBoostYear1Tax,
          with_boost_year1_tax: verdict.result.withBoostYear1Tax,
          additional_year1_relief: verdict.result.additionalYear1Relief,
          eligible: verdict.result.eligible,
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
      body: JSON.stringify({ email, source: "investment_boost_auditor", country_code: "NZ", site: "taxchecknow" }),
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
    const sid = sessionId || `boost_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("investment-boost-auditor_availability", String(answers.availability || ""));
    sessionStorage.setItem("investment-boost-auditor_asset_type", String(answers.asset_type || ""));
    sessionStorage.setItem("investment-boost-auditor_asset_cost", String(answers.asset_cost || ""));
    sessionStorage.setItem("investment-boost-auditor_dep_rate", String(answers.dep_rate || ""));
    sessionStorage.setItem("investment-boost-auditor_tax_rate", String(answers.tax_rate || ""));
    sessionStorage.setItem("investment-boost-auditor_cashflow_importance", String(answers.cashflow_importance || ""));
    sessionStorage.setItem("investment-boost-auditor_boost_status", verdict.result.status);
    sessionStorage.setItem("investment-boost-auditor_eligible", String(verdict.result.eligible));
    sessionStorage.setItem("investment-boost-auditor_additional_year1_relief", String(Math.round(verdict.result.additionalYear1Relief)));
    sessionStorage.setItem("investment-boost-auditor_status", verdict.status);
    sessionStorage.setItem("investment-boost-auditor_tier", String(popupTier));

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
          success_url: `${window.location.origin}/nz/check/investment-boost-auditor/success/${successPath}`,
          cancel_url: `${window.location.origin}/nz/check/investment-boost-auditor`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your Investment Boost timing analysis for your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your year 1 cashflow math by email — free.</p>
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
                    {popupTier === 67 ? "Your Investment Boost Timing Pack" : "Your Timing + Portfolio Planning Pack"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">IRD · Income Tax Act 2007 (Budget 2025) · April 2026</p>
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
                      {popupTier === 67 ? "Investment Boost Timing Pack™" : "Timing + Portfolio Planning Pack™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Eligibility verdict, year 1 cashflow math, available-for-use documentation checklist, IR10 Box 60 disclosure guidance, and 5 accountant questions — built around your exact asset, rate and timing."
                        : "Full strategy: eligibility + year 1 math + multi-asset portfolio view + staged-claim strategy for projects + available-for-use documentation + disposal recovery planning + change-of-use risk analysis + accountant coordination brief."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier} NZD</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic depreciation advice. Your specific eligibility, year 1 math, and IR10 disclosure.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Timing Analysis →" : "Get My Full Strategy →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the timing? — $67 instead" : "Want the full strategy + portfolio? — $147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">${popupTier} NZD</p>
                  </div>
                  {[
                    { label: "Your role", key: "buyer_role", options: [["business_owner","Business owner"],["cfo","CFO / finance lead"],["accountant","Accountant / advisor"],["multi_entity","Multi-entity portfolio"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["return_now","Filing 2025/26 return now"],["planning_purchase","Planning purchase timing"],["reviewing","Review existing assets"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["accountant","Yes — accountant"],["bookkeeper","Yes — bookkeeper"],["diy","Self-managed"],["none","No — need one"]] },
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
                    {loading ? "Redirecting to Stripe…" : `Pay $${popupTier} NZD →`}
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · IRD-referenced content</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sticky bar — when eligible and material cashflow */}
      {showVerdict && verdict && verdict.result.eligible && verdict.result.additionalYear1Relief > 1_000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Year 1 cashflow boost</p>
              <p className="text-sm font-bold text-neutral-950">
                {formatNZD(verdict.result.additionalYear1Relief)} earlier tax relief — same total tax
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
