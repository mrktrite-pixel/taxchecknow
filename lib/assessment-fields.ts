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
  // ⚠ THE KEY IS "183-day-rule", NOT THE CONFIG'S id "day-183-rule". THIS IS DELIBERATE.
  // This map is only ever read by the webhook, as getAssessmentFields(delivery.productId, tier)
  // (app/api/stripe/webhook/route.ts:203), so the key that can be looked up is the DELIVERY_MAP
  // productId — and this is one of the products whose DELIVERY_MAP productId ("183-day-rule",
  // route.ts:70-71) differs from its config id ("day-183-rule"). For the two entries above the
  // two names happen to coincide, which is why the distinction has not come up before.
  // Keyed on the config id this entry would parse, typecheck and never once be read.
  // Same mismatch class that assess-core.ts:33 RULES_SLUG already maps for seven products —
  // it carries "183-day-rule" → "day-183-rule" so the corpus fetch resolves, which is why the
  // webhook path grounds correctly today even though it was falling back to GENERIC_FIELDS.
  // Lists READ OUT OF cole/config/nomad-03-183-day-rule.ts (tier1/tier2AssessmentFields) and
  // asserted element-by-element against the `fields:` arrays the two emitted success pages
  // actually POST — 8 and 13, identical on both sides.
  "183-day-rule": {
    tier1: ["residencyStatus", "dayCountAnalysis", "currentYearMinimumCheck", "excludedDaysAssessment", "form8843Position", "filingObligations", "riskLevel", "immediateActions"],
    tier2: ["residencyStatus", "dayCountAnalysis", "currentYearMinimumCheck", "excludedDaysAssessment", "form8843Position", "filingObligations", "riskLevel", "immediateActions", "priorYearCountReview", "exclusionEvidenceStrategy", "closerConnectionAssessment", "recordKeepingSystem", "auditDefenceDocumentation"],
  },
};

/** The assess `fields` for a product+tier; per-product when registered, else generic (unchanged). */
export function getAssessmentFields(productId: string, tier: number): string[] {
  const entry = PRODUCT_ASSESSMENT_FIELDS[productId] ?? GENERIC_FIELDS;
  return tier >= 147 ? entry.tier2 : entry.tier1;
}
