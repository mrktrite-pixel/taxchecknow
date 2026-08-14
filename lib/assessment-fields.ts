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
  // C8 — FRCGW. Its DELIVERY_MAP productId and its config id are the same string
  // ("frcgw-clearance-certificate", webhook route.ts:124-125), so unlike 183-day-rule
  // there is no key mismatch to work around here.
  //
  // WHY THIS WAS MISSING AND WHAT IT COST. FRCGW was never registered, so
  // getAssessmentFields() fell through to GENERIC_FIELDS on the webhook path — while both
  // success pages POST the per-product list. The pages then render a hardcoded six of the
  // per-product keys, none of which the webhook ever produced. Verified against the live
  // `assessments` table on 2026-08-13: all five stored FRCGW rows carry the generic keys
  // (status/keyFinding/exposureAmount/…) and not one contains salePrice,
  // withholdingExposure, residencyStatusConfirm, certificateEligibility,
  // certificateProcessingTime or daysToSettlementAnalysis. So the paid "Your position"
  // block rendered EMPTY for every buyer on the normal purchase path.
  //
  // Lists read out of cole/config/au-19-frcgw-clearance-certificate.ts
  // (tier1/tier2AssessmentFields) and asserted element-by-element against the `fields:`
  // arrays the two emitted success pages POST — 9 and 13, identical on both sides.
  // Two names are corrected from the original spelling (witholdingExposure →
  // withholdingExposure, accountantImplementationCheckIist → …Checklist) and
  // evidenceGatheringChecklist → applicationDetailsChecklist; all three are changed in the
  // config and both pages in the same commit, so the three sides stay identical.
  // ── SIBLINGS (C8) ──────────────────────────────────────────────────────────────────
  // Registered in the same pass as FRCGW because they carry the identical latent defect:
  // engine-native, both success pages POST a per-product list, and the webhook fell through
  // to GENERIC_FIELDS — so their paid position blocks are populated by the client fallback
  // and empty on the normal purchase path.
  //
  // COLLISION CHECK, as dispatched. feat/183day-cg-narrow @8b8e7b1 is ALREADY MERGED into
  // origin/main (it is the "183-day-rule" entry above) and the branch is 0 commits ahead, so
  // nothing pending collides. The other sibling branches — fix/uk01-mtd-deadline-neutralise,
  // fix/au09-copy-alignment, fix/n43-registry-au09, feat/mtd-cg-align — are likewise all 0
  // ahead of origin/main. The only uncommitted sibling work in the tree is an MTD `temporal`
  // declaration in lib/temporal-registry.ts, which does not touch this map.
  //
  // For BOTH: DELIVERY_MAP productId == config.id (verified against webhook route.ts), so
  // unlike 183-day-rule there is no key mismatch. Lists read out of the configs and asserted
  // element-by-element against the `fields:` arrays the emitted success pages POST — 7/13 and
  // 8/12, identical on both sides.
  //
  // NOT REGISTERED HERE, AND WHY: medicare-levy-surcharge-trap is already in this map but its
  // entry (11/15 fields) no longer matches its config (9/9) — the config was narrowed and the
  // entry was not. That is the same divergence class, on a product outside this dispatch's
  // scope, and correcting it changes a live paid deliverable. Reported, deliberately untouched.
  "mtd-scorecard": {
    tier1: ["whichPartApplies", "whoMtdAppliesTo", "digitalRecordsRequired", "quarterlyUpdateCycle", "softwareAndAuthorisation", "whereToCheckThresholds", "firstAction"],
    tier2: ["whichPartApplies", "whoMtdAppliesTo", "digitalRecordsRequired", "quarterlyUpdateCycle", "softwareAndAuthorisation", "endOfYearProcess", "agentAuthorisation", "whereToCheckThresholds", "softwareMigrationPath", "multiPropertyReportingPlan", "accountantCoordinationBrief", "firstYearDryRunSchedule", "ongoingComplianceChecklist"],
  },
  "rental-property-deduction-audit": {
    tier1: ["deductionStatus", "expenseClassification", "initialRepairRisk", "overclaims", "missedDeductions", "recordQualityAssessment", "strongestRiskTrigger", "firstAction"],
    tier2: ["deductionStatus", "expenseClassification", "initialRepairRisk", "overclaims", "missedDeductions", "capitalWorksAnalysis", "depreciationOpportunity", "recordQualityAssessment", "evidenceRegister", "multiYearDeductionPlan", "auditRiskRating", "strongestRiskTrigger"],
  },
  "frcgw-clearance-certificate": {
    tier1: ["salePrice", "withholdingExposure", "residencyStatusConfirm", "certificateEligibility", "certificateProcessingTime", "daysToSettlementAnalysis", "applicationUrgency", "cashFlowImpact", "firstAction"],
    tier2: ["salePrice", "withholdingExposure", "residencyStatusConfirm", "certificateEligibility", "certificateProcessingTime", "daysToSettlementAnalysis", "applicationUrgency", "cashFlowImpact", "preSettlementExecutionPlan", "applicationDetailsChecklist", "buyerSolicitorInstruction", "withholdingContingencyPlan", "accountantImplementationChecklist"],
  },
};

/** The assess `fields` for a product+tier; per-product when registered, else generic (unchanged). */
export function getAssessmentFields(productId: string, tier: number): string[] {
  const entry = PRODUCT_ASSESSMENT_FIELDS[productId] ?? GENERIC_FIELDS;
  return tier >= 147 ? entry.tier2 : entry.tier1;
}

/**
 * C8 — which keys a success page should RENDER, given the assessment it actually received.
 *
 * Registering a product above fixes the deliverable from the next purchase onward. It does
 * NOT fix the assessments already sitting in the table, which were generated with the
 * generic keys and are what the five existing FRCGW buyers see when they revisit their page.
 * A page that renders only the per-product keys shows those buyers an empty block forever.
 *
 * So the page renders whichever of the two lists the assessment it was handed actually
 * populates. Both are legitimate outputs of the same generator, so this is a display concern,
 * not a data migration — and no assessment is ever rewritten.
 *
 * WHICHEVER COVERS MORE, NOT WHICHEVER MATCHES FIRST. The two lists can OVERLAP: FRCGW's
 * per-product tier-1 list and GENERIC_FIELDS.tier1 both contain `firstAction`. A
 * "per-product wins if it matches anything" rule therefore looked at a legacy generic
 * assessment, found its single shared key, and rendered a one-row position block — which is
 * barely better than the empty one it replaced. Comparing coverage picks the list the
 * assessment was actually generated against. Ties go to per-product, so a freshly generated
 * assessment is never displayed through the generic list.
 */
export function resolveDisplayFields(
  assessment: Record<string, unknown> | null | undefined,
  productId: string,
  tier: number,
  preferred?: string[],
): string[] {
  if (!assessment) return [];
  const present = (keys: string[]): string[] =>
    keys.filter((k) => typeof assessment[k] === "string" && (assessment[k] as string).trim().length > 0);

  const perProduct = present(preferred ?? getAssessmentFields(productId, tier));
  const generic = present(tier >= 147 ? GENERIC_FIELDS.tier2 : GENERIC_FIELDS.tier1);

  return perProduct.length >= generic.length ? perProduct : generic;
}

/** Human label for an assessment key: "withholdingExposure" → "Withholding exposure". */
export function humaniseFieldKey(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
