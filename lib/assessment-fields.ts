// lib/assessment-fields.ts
//
// Single source of truth for the /api/assess `fields` list per product+tier, so the
// PAID DELIVERABLE is identical whether it's built by the WEBHOOK path or the client
// success-page fallback (PQ-C0 latent defect: the webhook used generic fields while
// each success page passed per-product fields → divergent assessments per path).
//
// getAssessmentFields() falls back to GENERIC_FIELDS for any unregistered product —
// which is byte-identical to the webhook's historical hardcoded lists, so unregistered
// manual products are UNCHANGED. Registered products get their per-product list, which
// MUST mirror that product's success-page `fields` array (webhook == client).

export interface TierFields {
  tier1: string[];
  tier2: string[];
}

// The webhook's historical hardcoded lists — kept verbatim as the safe fallback.
export const GENERIC_FIELDS: TierFields = {
  tier1: ["status", "keyFinding", "exposureAmount", "mainRiskTrigger", "recommendedAction", "confidenceLevel", "firstAction"],
  tier2: ["status", "keyFinding", "exposureAmount", "mainRiskTrigger", "recommendedAction", "confidenceLevel", "implementationPlan", "scenarioAnalysis", "evidenceRequired", "timelineStrategy"],
};

// Per-product overrides — each MUST equal that product's success-page `fields` array.
// medicare-levy-surcharge-trap verified against success/assess (tier1) + success/plan (tier2).
export const PRODUCT_ASSESSMENT_FIELDS: Record<string, TierFields> = {
  "medicare-levy-surcharge-trap": {
    tier1: ["mlsStatus", "incomeForMLSPurposes", "surchargeRateTier", "estimatedMLSPayable", "coverCostEstimate", "netSavingFromCover", "coverTimingStrategy", "thresholdPosition", "strongestRiskTrigger", "confidenceLevel", "firstAction"],
    tier2: ["mlsStatus", "incomeForMLSPurposes", "surchargeRateTier", "estimatedMLSPayable", "coverCostEstimate", "netSavingFromCover", "coverTimingStrategy", "partnerCoverAnalysis", "familyThresholdPosition", "superContributionOpportunity", "policyExcessCheck", "integratedPlan", "nextYearCalendar", "strongestRiskTrigger", "confidenceLevel"],
  },
  // Machine product — MUST equal config.tier{1,2}AssessmentFields (which feed its success pages).
  "superannuation-tax-leaving-australia-confusion-2026": {
    tier1: ["daspStatus", "taxByVisaClass", "paymentTimeline", "idDocRequirements", "unclaimedSuperRisk", "confidenceLevel", "firstAction"],
    tier2: ["daspStatus", "taxByVisaClass", "taxedVsUntaxedBreakdown", "paymentTimeline", "idDocRequirements", "unclaimedSuperRisk", "residencyInteraction", "superBalanceStrategy", "adviserDecisionFramework", "returnPlanningNote", "nextStepsCalendar", "strongestRiskTrigger", "confidenceLevel", "firstAction"],
  },
};

/** The assess `fields` for a product+tier; per-product when registered, else generic (unchanged). */
export function getAssessmentFields(productId: string, tier: number): string[] {
  const entry = PRODUCT_ASSESSMENT_FIELDS[productId] ?? GENERIC_FIELDS;
  return tier >= 147 ? entry.tier2 : entry.tier1;
}
