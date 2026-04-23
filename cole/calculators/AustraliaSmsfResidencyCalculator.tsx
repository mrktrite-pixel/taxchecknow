"use client";

/**
 * NOMAD-09 — Australian SMSF Residency Kill-Switch
 * Pattern: Classification + CashflowModel -> compliant / at risk / breach with tax quantum
 *
 * Legal anchor: SIS Act 1993 s 10(1) + ITAA 1997 s 295-95 + s 295-320
 *
 * DETERMINATION ORDER:
 *   1. Active member test failure -> BREACH (active member is binary)
 *   2. CM&C clearly overseas + long absence -> BREACH
 *   3. CM&C ambiguous + moderate absence -> AT RISK
 *   4. CM&C clearly in Australia / short absence / corporate trustee shield -> COMPLIANT
 *   5. Unclear / mixed -> UNCERTAIN
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "COMPLIANT_CLEAR"
  | "COMPLIANT_TEMPORARY_ABSENCE"
  | "AT_RISK_CMC_AMBIGUOUS"
  | "BREACH_RISK_CMC_OVERSEAS"
  | "BREACH_ACTIVE_MEMBER_FAIL"
  | "UNCERTAIN_NEEDS_REVIEW";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface SmsfResult {
  daysOutside:       string;
  trusteeLocation:   string;
  decisionLocation:  string;
  absenceIntent:     string;
  corporateTrustee:  string;
  activeMemberTest:  string;
  fundValue:         string;

  fundValueMidpoint: number;
  taxIfNonComplying: number;   // 45% × low tax component (approx 90% of fund value)
  ongoingAnnualTax:  number;   // 45% × assumed 5% earnings

  cmcScore:          number;   // 0-100 — higher = more in Australia
  riskScore:         number;   // 0-100 — higher = more risk

  status:            Status;
  statusLabel:       string;
  isBreach:          boolean;
  isAtRisk:          boolean;

  reasoningChain:    Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:            Route[];
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
  result: SmsfResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_au_smsf",
  p147: "nomad_147_au_smsf",
};

const FUND_MIDPOINT: Record<string, number> = {
  under_500k:    350000,
  "500k_to_1m":  750000,
  "1m_to_2m":    1500000,
  over_2m:       3000000,
};

const FUND_LABEL: Record<string, string> = {
  under_500k:    "Under $500,000",
  "500k_to_1m":  "$500,000-$1M",
  "1m_to_2m":    "$1M-$2M",
  over_2m:       "Over $2M",
};

function aud(n: number): string {
  return `$${Math.round(n).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function calcSmsf(answers: AnswerMap): SmsfResult {
  const daysOutside      = String(answers.days_outside        || "184_to_365");
  const trusteeLocation  = String(answers.trustee_location     || "mixed");
  const decisionLocation = String(answers.decision_location    || "mixed");
  const absenceIntent    = String(answers.absence_intent       || "medium_2_5yr");
  const corporateTrustee = String(answers.corporate_trustee    || "no");
  const activeMemberTest = String(answers.active_member_test   || "yes_over_50");
  const fundValue        = String(answers.fund_value           || "500k_to_1m");

  const fundValueMidpoint = FUND_MIDPOINT[fundValue] ?? 750000;
  // Low tax component ≈ 90% of fund value (leaving 10% for undeducted contributions as rough assumption)
  const lowTaxComponent = fundValueMidpoint * 0.90;
  const taxIfNonComplying = Math.round(lowTaxComponent * 0.45);
  // Ongoing earnings tax: assume 5% return, 45% vs 15% = 30% extra per year
  const ongoingAnnualTax = Math.round(fundValueMidpoint * 0.05 * 0.30);

  // CM&C Score — higher means CM&C more clearly in Australia
  let cmcScore = 50;
  // Trustee location contribution
  if (trusteeLocation === "all_au") cmcScore += 30;
  else if (trusteeLocation === "corporate_au_directors") cmcScore += 35;
  else if (trusteeLocation === "mixed") cmcScore += 10;
  else if (trusteeLocation === "all_overseas") cmcScore -= 30;
  else if (trusteeLocation === "corporate_overseas") cmcScore -= 25;

  // Decision location contribution
  if (decisionLocation === "always_au") cmcScore += 30;
  else if (decisionLocation === "mostly_au") cmcScore += 15;
  else if (decisionLocation === "mixed") cmcScore += 0;
  else if (decisionLocation === "mostly_overseas") cmcScore -= 20;
  else if (decisionLocation === "always_overseas") cmcScore -= 35;

  // Absence intent contribution
  if (absenceIntent === "temporary_under_2yr") cmcScore += 15;
  else if (absenceIntent === "medium_2_5yr") cmcScore -= 5;
  else if (absenceIntent === "long_over_5yr") cmcScore -= 20;
  else if (absenceIntent === "permanent") cmcScore -= 30;

  // Days outside contribution
  if (daysOutside === "under_90") cmcScore += 15;
  else if (daysOutside === "90_to_183") cmcScore += 5;
  else if (daysOutside === "184_to_365") cmcScore -= 5;
  else if (daysOutside === "over_365") cmcScore -= 15;
  else if (daysOutside === "over_2yr") cmcScore -= 25;

  // Corporate trustee shield boost
  if (corporateTrustee === "yes" && trusteeLocation === "corporate_au_directors") cmcScore += 10;

  cmcScore = Math.max(0, Math.min(100, cmcScore));
  const riskScore = 100 - cmcScore;

  const reasoningChain: SmsfResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";

  // LAYER 1 — active member test binary failure
  if (activeMemberTest === "no_majority_overseas") {
    reasoningChain.push({ layer: "Layer 1 — Active member test (SIS Act s 10(1)(c))", outcome: "Majority of active member balances held by non-AU residents — active member test FAILED. Fund becomes non-complying regardless of CM&C position.", resolved: true });
    status = "BREACH_ACTIVE_MEMBER_FAIL";
    statusLabel = "BREACH — ACTIVE MEMBER TEST FAILED";
  } else if (activeMemberTest === "no_active_members") {
    reasoningChain.push({ layer: "Layer 1 — Active member test", outcome: "No active members — test does not apply. Only establishment + CM&C tests relevant.", resolved: false });
  } else {
    reasoningChain.push({ layer: "Layer 1 — Active member test", outcome: activeMemberTest === "yes_over_50" ? "50%+ of active member balances held by AU residents — test PASSED" : "Active member position unclear — specialist review required", resolved: false });
  }

  // LAYER 2 — CM&C clearly overseas (breach zone)
  if (status === null && (trusteeLocation === "all_overseas" || trusteeLocation === "corporate_overseas") && (decisionLocation === "mostly_overseas" || decisionLocation === "always_overseas") && (absenceIntent === "long_over_5yr" || absenceIntent === "permanent" || daysOutside === "over_2yr")) {
    reasoningChain.push({ layer: "Layer 2 — CM&C test (SIS Act s 10(1)(b))", outcome: `All trustees overseas + strategic decisions made overseas + long-term/permanent absence — CM&C is NOT ordinarily in Australia. Breach risk high. Temporary absence rule does not apply (not temporary).`, resolved: true });
    status = "BREACH_RISK_CMC_OVERSEAS";
    statusLabel = "BREACH RISK — CM&C OVERSEAS";
  }

  // LAYER 3 — CM&C in Australia, short absence, all green
  if (status === null && cmcScore >= 75) {
    if (daysOutside === "under_90" && trusteeLocation === "all_au" && decisionLocation === "always_au") {
      reasoningChain.push({ layer: "Layer 2 — CM&C test", outcome: "All trustees in Australia + strategic decisions made in Australia — CM&C clearly in Australia. Fund compliant.", resolved: true });
      status = "COMPLIANT_CLEAR";
      statusLabel = "COMPLIANT — CM&C CLEARLY IN AUSTRALIA";
    } else {
      reasoningChain.push({ layer: "Layer 2 — CM&C test", outcome: `CM&C score ${cmcScore}/100 — strong position. ${absenceIntent === "temporary_under_2yr" ? "Temporary absence within 2-year ATO window + clear return intent preserves CM&C." : "Corporate trustee with AU-resident directors maintains AU control."}`, resolved: true });
      status = "COMPLIANT_TEMPORARY_ABSENCE";
      statusLabel = "COMPLIANT — CM&C PRESERVED (TEMPORARY ABSENCE OR SHIELD)";
    }
  }

  // LAYER 4 — At risk zone (score 40-74)
  if (status === null && cmcScore >= 40 && cmcScore < 75) {
    reasoningChain.push({ layer: "Layer 2 — CM&C test", outcome: `CM&C score ${cmcScore}/100 — ambiguous position. Mixed decision location + trustee location creates real breach risk. Structural fix (corporate trustee + AU-director shield) strongly recommended before departure or during absence.`, resolved: true });
    status = "AT_RISK_CMC_AMBIGUOUS";
    statusLabel = "AT RISK — CM&C POSITION AMBIGUOUS";
  }

  // LAYER 5 — Breach risk zone (score < 40)
  if (status === null && cmcScore < 40) {
    reasoningChain.push({ layer: "Layer 2 — CM&C test", outcome: `CM&C score ${cmcScore}/100 — strategic decisions being made overseas or trajectory toward overseas. Fund at high risk of CM&C breach. Immediate structural action required.`, resolved: true });
    status = "BREACH_RISK_CMC_OVERSEAS";
    statusLabel = "BREACH RISK — CM&C OVERSEAS";
  }

  // Fallback
  if (status === null) {
    status = "UNCERTAIN_NEEDS_REVIEW";
    statusLabel = "UNCERTAIN — SPECIALIST REVIEW NEEDED";
    reasoningChain.push({ layer: "Fallback", outcome: "Inputs do not clearly map to a binary position — specialist SMSF review required.", resolved: true });
  }

  const isBreach = status === "BREACH_RISK_CMC_OVERSEAS" || status === "BREACH_ACTIVE_MEMBER_FAIL";
  const isAtRisk = status === "AT_RISK_CMC_AMBIGUOUS";

  // Tax exposure reasoning — only show for at-risk/breach
  if (isBreach || isAtRisk) {
    reasoningChain.push({ layer: "Layer 3 — Tax exposure (ITAA 1997 s 295-320)", outcome: `If fund becomes non-complying: 'low tax component' ≈ ${aud(lowTaxComponent)} × 45% = ${aud(taxIfNonComplying)} in year of change. Ongoing earnings taxed at 45% (vs 15% complying) — approximately ${aud(ongoingAnnualTax)} additional annual tax.`, resolved: true });
  }

  // Routing
  const routes: Route[] = [];
  if (isBreach) {
    routes.push({ label: "AU CGT Discount Timing Sniper", href: "/au/check/cgt-discount-timing-sniper", note: "Cross-check any asset sale timing before breach year tax consequences" });
    routes.push({ label: "Tax Treaty Navigator — cross-border fund treatment", href: "/nomad/check/tax-treaty-navigator", note: "Treaty position if fund becomes non-complying" });
    routes.push({ label: "183-Day Rule Reality Check — confirm personal residency", href: "/nomad/check/183-day-rule", note: "SMSF residency + personal residency are different but interact" });
  } else if (isAtRisk) {
    routes.push({ label: "183-Day Rule Reality Check — personal residency cross-check", href: "/nomad/check/183-day-rule", note: "Personal residency status complements fund CM&C position" });
    routes.push({ label: "AU Expat CGT Trap — asset timing", href: "/nomad/check/au-expat-cgt", note: "If holding AU residential property in or outside SMSF" });
  } else {
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Confirm personal residency position annually" });
    routes.push({ label: "AU Expat CGT Trap — main residence rules", href: "/nomad/check/au-expat-cgt", note: "Separate but related exposure if selling AU property" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    daysOutside, trusteeLocation, decisionLocation, absenceIntent, corporateTrustee, activeMemberTest, fundValue,
    fundValueMidpoint, taxIfNonComplying, ongoingAnnualTax,
    cmcScore, riskScore,
    status,
    statusLabel,
    isBreach,
    isAtRisk,
    reasoningChain,
    routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcSmsf(answers);

  const headline = (() => {
    if (result.status === "COMPLIANT_CLEAR") return `Your SMSF is compliant — central management and control is clearly in Australia (all trustees AU + strategic decisions AU). The fund retains concessional 15% tax treatment on earnings. Annual residency review recommended if anything changes.`;
    if (result.status === "COMPLIANT_TEMPORARY_ABSENCE") return `Your SMSF is compliant — CM&C preserved through temporary absence rule or corporate trustee shield. The ATO accepts CM&C as 'ordinarily' in Australia during genuine temporary absences up to approximately 2 years. Documentation of the absence timeline + return intent is essential.`;
    if (result.status === "AT_RISK_CMC_AMBIGUOUS") return `Your SMSF is at risk — CM&C score ${result.cmcScore}/100 is in the ambiguous zone. Mixed trustee locations and/or decision locations create real breach risk. If the fund becomes non-complying, tax exposure on your ${FUND_LABEL[result.fundValue]} fund is approximately ${aud(result.taxIfNonComplying)} in the year of change PLUS ~${aud(result.ongoingAnnualTax)} per year additional ongoing. Structural fix (corporate trustee + AU-resident director) strongly recommended before the position hardens.`;
    if (result.status === "BREACH_RISK_CMC_OVERSEAS") return `Your SMSF is at high breach risk — central management and control is effectively overseas. Under ITAA 1997 s 295-320, if the fund becomes non-complying, the 'low tax component' (approximately ${aud(result.fundValueMidpoint * 0.9)}) is included in assessable income at 45% in the year of change — about ${aud(result.taxIfNonComplying)} tax. Ongoing earnings then taxed at 45% (vs 15% complying). Immediate structural action required: corporate trustee with AU-resident director, or alternatives (APRA roll-over / fund wind-up).`;
    if (result.status === "BREACH_ACTIVE_MEMBER_FAIL") return `Your SMSF has an active member test failure — majority of active member balances are held by non-AU residents. Under SIS Act s 10(1)(c), this alone causes the fund to fail the 'Australian superannuation fund' definition and become non-complying. CM&C position is secondary — the active member test is a hard gate. Tax exposure approximately ${aud(result.taxIfNonComplying)} plus ongoing 45% earnings tax.`;
    return `Your SMSF residency position requires specialist review — inputs do not map cleanly to the three SIS Act tests. Engage an SMSF specialist before making any further decisions.`;
  })();

  const consequences: string[] = [];

  if (result.status === "COMPLIANT_CLEAR") {
    consequences.push(`✓ Fund is compliant — all three tests (establishment, CM&C, active member) currently satisfied.`);
    consequences.push(`Annual 30 June snapshot: residency tests assessed each financial year. Preserve current structure for concessional treatment (15% earnings, 0% pension phase up to transfer balance cap).`);
    consequences.push(`Contribution rules normal — concessional cap $27,500 (2025/26), non-concessional cap $110,000, bring-forward up to $330,000 over 3 years (subject to total super balance limits).`);
    consequences.push(`If any member plans to move overseas: re-run this assessment before departure. Short-term (under 90 days) visits unlikely to affect CM&C; longer absences need structural review.`);
    consequences.push(`Audit ready: ensure annual SMSF audit confirms CM&C position; retain trustee minutes + investment committee records 10 years.`);
  } else if (result.status === "COMPLIANT_TEMPORARY_ABSENCE") {
    consequences.push(`✓ Fund is compliant via temporary absence rule OR corporate trustee shield — CM&C deemed 'ordinarily' in Australia.`);
    consequences.push(`Documentation critical: maintain evidence of temporary absence status (return ticket, visa with end date, AU property retained) OR AU-resident director decision records (minutes, chair signatures, dates).`);
    consequences.push(`2-year window (ATO guidance): CM&C position should be reassessed annually. Absences extending beyond 2 years without structural change become increasingly fragile.`);
    consequences.push(`Corporate trustee shield maintenance: AU-resident director must genuinely exercise control — not a nominee. Quarterly investment committee meetings in AU + annual strategy review minutes.`);
    consequences.push(`Annual residency snapshot at 30 June: re-confirm all three tests passed each financial year.`);
  } else if (result.status === "AT_RISK_CMC_AMBIGUOUS") {
    consequences.push(`⚠ Ambiguous CM&C position — fund could go either way on ATO review.`);
    consequences.push(`Structural fix (most common): restructure to corporate trustee with at least one AU-resident director who genuinely chairs investment committee. Cost ~$4,500-$7,000; ongoing ~$500/year.`);
    consequences.push(`Alternative fixes: (a) shorten absence to under 2 years with documented return intent; (b) roll over to APRA-regulated super fund (loses SMSF flexibility but removes residency risk); (c) wind up fund while still compliant.`);
    consequences.push(`Decision protocol during absence: AU-resident trustee/director makes binding decisions in AU; overseas member has advisory input only. Documented minutes confirm AU location.`);
    consequences.push(`Tax exposure if breach occurs: ${aud(result.taxIfNonComplying)} in year of change on a ${FUND_LABEL[result.fundValue]} fund — plus ~${aud(result.ongoingAnnualTax)}/year additional ongoing tax.`);
    consequences.push(`SMSF specialist engagement (not generic accountant): SMSF Specialist Association member or equivalent with international expertise.`);
  } else if (result.status === "BREACH_RISK_CMC_OVERSEAS") {
    consequences.push(`🔒 CM&C breach risk is high — strategic fund decisions are being made overseas with no AU-based decision-maker.`);
    consequences.push(`Tax exposure if non-complying: ~${aud(result.taxIfNonComplying)} in year of change (ITAA 1997 s 295-320) PLUS ~${aud(result.ongoingAnnualTax)}/year additional (45% vs 15% on earnings).`);
    consequences.push(`Immediate structural action: (1) restructure to corporate trustee + appoint trusted AU-resident director BEFORE 30 June residency snapshot; (2) document decision-making protocol where AU director makes all binding decisions; (3) retain AU-based accountant/adviser.`);
    consequences.push(`Alternative if structural fix not feasible: roll over to APRA fund BEFORE breach occurs. Contribution balance + asset allocation preserved; losses SMSF-specific investments (direct property, specific stocks).`);
    consequences.push(`Wind-up option: close the fund while still compliant; distribute to members / roll to APRA fund. Avoids 45% breach tax but loses accumulated concessional treatment going forward.`);
    consequences.push(`ATO detection: annual return + data matching with Border Force travel records + address change notifications. CM&C breach is detectable in audit.`);
    consequences.push(`Remediation after breach: requires ATO approval + evidence of rectified CM&C. Not automatic; 45% year-of-breach tax not refundable even if re-complying status granted later.`);
  } else if (result.status === "BREACH_ACTIVE_MEMBER_FAIL") {
    consequences.push(`🔒 Active member test fail — majority of active member balances held by non-AU residents. Under SIS Act s 10(1)(c), this alone breaches 'Australian superannuation fund' definition.`);
    consequences.push(`This is binary — unlike CM&C which has nuance around 'ordinarily', the active member test is a simple 50% threshold.`);
    consequences.push(`Fix options: (1) cease contributions from non-AU resident members (become not-active); (2) increase AU-resident member balance ratio; (3) move members to pension phase (pension members are typically not 'active'); (4) restructure fund / roll to APRA fund.`);
    consequences.push(`If fund has 'no active members' the test is inapplicable — pension-phase-only funds avoid this issue.`);
    consequences.push(`Tax exposure ~${aud(result.taxIfNonComplying)} in year of change plus ongoing 45% tax.`);
    consequences.push(`Strategic decision: often better to roll non-AU members' balances out of the SMSF than to let the fund breach.`);
  } else if (result.status === "UNCERTAIN_NEEDS_REVIEW") {
    consequences.push(`Specialist review required — input pattern doesn't clearly map to the three SIS Act tests.`);
    consequences.push(`Engage SMSF Specialist Association member with international expertise — not a generic accountant. CM&C analysis is fact-specific.`);
    consequences.push(`Before specialist engagement: gather trustee minutes (past 3 years), investment strategy document, member balances + contribution history, travel records for all trustees/members.`);
    consequences.push(`Consider obtaining an ATO private ruling for your specific facts if the position is unclear and the stakes are significant.`);
  }

  const statusClass = result.isBreach ? "text-red-700" : (result.isAtRisk ? "text-amber-700" : (result.status === "UNCERTAIN_NEEDS_REVIEW" ? "text-amber-700" : "text-emerald-700"));
  const panelClass  = result.isBreach ? "border-red-200 bg-red-50" : (result.isAtRisk ? "border-amber-200 bg-amber-50" : (result.status === "UNCERTAIN_NEEDS_REVIEW" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"));

  const confidence: ConfidenceLevel = result.status === "UNCERTAIN_NEEDS_REVIEW" ? "LOW" : (result.status === "AT_RISK_CMC_AMBIGUOUS" ? "MEDIUM" : "HIGH");
  const confidenceNote = result.status === "UNCERTAIN_NEEDS_REVIEW"
    ? "Inputs do not map cleanly — specialist review required before relying on outcome."
    : result.status === "AT_RISK_CMC_AMBIGUOUS"
      ? "CM&C is a fact-specific question — moderate-risk position should be resolved via structural fix + specialist opinion."
      : "SMSF residency position clearly determined by the three-test framework and your inputs.";

  // Tier selection — high-stakes or substantial restructure work -> tier 2
  const tier2Triggers = [
    result.isBreach,
    result.isAtRisk,
    result.fundValue === "over_2m",
    result.fundValue === "1m_to_2m",
    result.absenceIntent === "long_over_5yr" || result.absenceIntent === "permanent",
    result.corporateTrustee === "no" && (result.daysOutside === "over_365" || result.daysOutside === "over_2yr"),
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "CM&C score",                      value: `${result.cmcScore}/100`,                                                                                                                                  highlight: result.cmcScore < 50 },
      { label: "Fund value",                       value: FUND_LABEL[result.fundValue]                                                                                                                                                                         },
      { label: "Tax if non-complying",              value: aud(result.taxIfNonComplying),                                                                                                                             highlight: result.isBreach || result.isAtRisk },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My SMSF Residency Shield — $147 →" : "Get My SMSF Residency Fix Kit — $67 →",
    altTierLabel: tier === 147 ? "Just want the fix kit? — $67 instead" : "Want the full shield system? — $147",
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
    id: "days_outside", step: 1, type: "button_group",
    label: "Days outside Australia in the last 12 months (primary trustee/member)",
    subLabel: "Proxy for the CM&C test — longer absence with no AU-based control means higher breach risk.",
    options: [
      { label: "Under 90 days",                    value: "under_90",    subLabel: "Low CM&C risk from days alone" },
      { label: "90-183 days",                      value: "90_to_183",   subLabel: "Moderate — structure matters" },
      { label: "184-365 days",                      value: "184_to_365", subLabel: "Within 2-yr ATO window if genuinely temporary" },
      { label: "Over 365 days (over 1 year)",         value: "over_365",   subLabel: "Higher scrutiny — return intent critical" },
      { label: "Over 2 years — permanent relocation",  value: "over_2yr",   subLabel: "Temporary absence rule does not apply" },
    ],
    required: true,
  },
  {
    id: "trustee_location", step: 2, type: "button_group",
    label: "Where are the trustees located?",
    subLabel: "Individual trustees must be fund members. Corporate trustee separates fund control from member location.",
    options: [
      { label: "All trustees in Australia",                       value: "all_au",                   subLabel: "CM&C anchor strong" },
      { label: "Mixed — some AU, some overseas",                    value: "mixed",                     subLabel: "Moderate — structure matters" },
      { label: "All trustees overseas",                              value: "all_overseas",              subLabel: "High CM&C breach risk" },
      { label: "Corporate trustee — AU-resident directors",           value: "corporate_au_directors",   subLabel: "Standard shield structure" },
      { label: "Corporate trustee — overseas directors only",           value: "corporate_overseas",        subLabel: "Corporate form alone is not a fix" },
    ],
    required: true,
  },
  {
    id: "decision_location", step: 3, type: "button_group",
    label: "Where are strategic fund decisions made? (investment policy, strategy, significant assets)",
    subLabel: "This is the CM&C test in practice. Routine admin does not count — strategic decisions do.",
    options: [
      { label: "Always in Australia",                     value: "always_au",        subLabel: "Clean CM&C position" },
      { label: "Mostly in Australia — some remote",         value: "mostly_au",        subLabel: "Strong with AU decision cadence" },
      { label: "Mixed — roughly 50/50",                      value: "mixed",            subLabel: "Ambiguous — high risk" },
      { label: "Mostly overseas",                             value: "mostly_overseas",  subLabel: "Breach risk" },
      { label: "Always overseas",                              value: "always_overseas",  subLabel: "Clear breach position" },
    ],
    required: true,
  },
  {
    id: "absence_intent", step: 4, type: "button_group",
    label: "Is your overseas absence temporary or permanent?",
    subLabel: "ATO accepts CM&C as 'ordinarily' in Australia during genuine temporary absences — typically up to ~2 years.",
    options: [
      { label: "Temporary — definite return plan (under 2 years)",   value: "temporary_under_2yr", subLabel: "ATO 2-year window applies" },
      { label: "Medium-term — 2-5 year plan",                          value: "medium_2_5yr",        subLabel: "Beyond 2-year guidance" },
      { label: "Extended — over 5 years or unclear",                     value: "long_over_5yr",       subLabel: "Temporary rule does not save" },
      { label: "Permanent — not planning to return",                      value: "permanent",            subLabel: "Structural action required" },
    ],
    required: true,
  },
  {
    id: "corporate_trustee", step: 5, type: "button_group",
    label: "Does the fund use a corporate trustee?",
    subLabel: "Corporate trustee + AU-resident directors is the standard residency shield for expat-member SMSFs.",
    options: [
      { label: "Yes — corporate trustee",     value: "yes",    subLabel: "Enables AU-director shield" },
      { label: "No — individual trustees",     value: "no",     subLabel: "Trusteeship follows members" },
      { label: "Not sure",                      value: "unsure", subLabel: "Check your trust deed" },
    ],
    required: true,
  },
  {
    id: "active_member_test", step: 6, type: "button_group",
    label: "Majority of active member balances — held by Australian residents?",
    subLabel: "Active member test (SIS Act s 10(1)(c)): 50%+ of market value attributable to active members must be from AU residents, OR fund has no active members.",
    options: [
      { label: "Yes — 50%+ AU resident active members",       value: "yes_over_50",           subLabel: "Test passed" },
      { label: "No — majority non-resident active members",     value: "no_majority_overseas",  subLabel: "Test FAILED — breach" },
      { label: "No active members (all in pension phase)",       value: "no_active_members",    subLabel: "Test does not apply" },
      { label: "Not sure",                                         value: "unsure",                 subLabel: "Specialist review needed" },
    ],
    required: true,
  },
  {
    id: "fund_value", step: 7, type: "button_group",
    label: "Current total fund value (market value)?",
    subLabel: "Used to quantify tax exposure if fund becomes non-complying — 45% × 'low tax component' (approximately 90% of market value).",
    options: [
      { label: "Under $500,000",         value: "under_500k",   subLabel: "Smaller fund — breach still severe" },
      { label: "$500,000-$1M",            value: "500k_to_1m",  subLabel: "Typical SMSF size" },
      { label: "$1M-$2M",                  value: "1m_to_2m",    subLabel: "Substantial exposure" },
      { label: "Over $2M",                  value: "over_2m",     subLabel: "High-stakes restructure priority" },
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

      {/* SMSF logic chain */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">SMSF residency tests — SIS Act s 10(1) + ITAA 1997 s 295-320</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (result.isBreach ? "bg-red-100" : result.isAtRisk ? "bg-amber-100" : "bg-emerald-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (result.isBreach ? "text-red-700" : result.isAtRisk ? "text-amber-700" : "text-emerald-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (result.isBreach ? "text-red-700" : result.isAtRisk ? "text-amber-700" : "text-emerald-700") : "text-neutral-700"}`}>{r.layer}</p>
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

      {/* Tax exposure math visual */}
      {(result.isBreach || result.isAtRisk) && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Non-complying tax math — ITAA 1997 s 295-320</p>
          <p className="font-bold text-red-900">
            Low tax component {aud(result.fundValueMidpoint * 0.9)} × 45% = {aud(result.taxIfNonComplying)} in year of change
          </p>
          <p className="mt-1 text-xs text-red-800">
            Plus ongoing earnings at 45% (vs 15% complying) ≈ {aud(result.ongoingAnnualTax)} additional per year. Over 5 years at ~{aud(result.ongoingAnnualTax * 5)} additional ongoing.
          </p>
        </div>
      )}

      {/* Compliant shield visual */}
      {!result.isBreach && !result.isAtRisk && result.status !== "UNCERTAIN_NEEDS_REVIEW" && (
        <div className="mb-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700">Fund status — compliant</p>
          <p className="font-bold text-emerald-900">
            Concessional rate preserved: 15% on earnings (0% pension phase up to TBC)
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            CM&C ordinarily in Australia — all three SIS Act residency tests passed. Annual re-check at 30 June snapshot recommended.
          </p>
        </div>
      )}

      {/* CM&C Score meter */}
      <div className="mb-4 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-sm">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your CM&C score — where your fund is controlled from</p>
        <div className="relative h-6 w-full overflow-hidden rounded-full bg-neutral-100">
          <div className={`absolute left-0 top-0 h-full transition-all ${result.cmcScore >= 75 ? "bg-emerald-500" : result.cmcScore >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${result.cmcScore}%` }} />
          <div className="absolute left-0 top-0 flex h-full w-full items-center justify-between px-3 text-[10px] font-mono font-bold">
            <span className="text-neutral-400">Overseas</span>
            <span className={`${result.cmcScore >= 50 ? "text-white" : "text-neutral-900"}`}>{result.cmcScore}/100</span>
            <span className="text-neutral-400">Australia</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          Zero to 40: clear breach zone. Forty to 74: ambiguous — structural fix needed. Seventy-five to 100: compliant.
        </p>
      </div>

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — SMSF fix + AU nomad engines</p>
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
          <strong className="text-neutral-950">The kill-switch is binary.</strong> An SMSF is either compliant or non-complying — there is no middle ground. The central management and control test determines which side you are on. Where strategic decisions are made matters more than where members live.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific CM&C position with reasoning chain</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Three-test assessment (establishment, CM&C, active member)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Tax exposure quantified if fund becomes non-complying</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Trustee positioning strategy (individual vs corporate)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Corporate trustee restructure guide (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Audit-proof documentation framework (tier 2)</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your exact SMSF residency position</p>
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

export default function AustraliaSmsfResidencyCalculator() {
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
        product_slug: "australia-smsf-residency",
        source_path: "/nomad/check/australia-smsf-residency",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          smsf_status: verdict.result.status,
          cmc_score: verdict.result.cmcScore,
          tax_exposure: verdict.result.taxIfNonComplying,
          is_breach: verdict.result.isBreach,
          is_at_risk: verdict.result.isAtRisk,
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
      body: JSON.stringify({ email, source: "au_smsf_residency", country_code: "AU", site: "taxchecknow" }),
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
    const sid = sessionId || `ausmsf_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("au-smsf_days_outside",           String(answers.days_outside        || ""));
    sessionStorage.setItem("au-smsf_trustee_location",        String(answers.trustee_location     || ""));
    sessionStorage.setItem("au-smsf_decision_location",        String(answers.decision_location    || ""));
    sessionStorage.setItem("au-smsf_absence_intent",             String(answers.absence_intent       || ""));
    sessionStorage.setItem("au-smsf_corporate_trustee",            String(answers.corporate_trustee    || ""));
    sessionStorage.setItem("au-smsf_active_member_test",             String(answers.active_member_test   || ""));
    sessionStorage.setItem("au-smsf_fund_value",                       String(answers.fund_value           || ""));
    sessionStorage.setItem("au-smsf_cmc_score",                          String(verdict.result.cmcScore));
    sessionStorage.setItem("au-smsf_tax_exposure",                         String(verdict.result.taxIfNonComplying));
    sessionStorage.setItem("au-smsf_smsf_status",                           verdict.result.status);
    sessionStorage.setItem("au-smsf_is_breach",                              String(verdict.result.isBreach));
    sessionStorage.setItem("au-smsf_status",                                   verdict.status);
    sessionStorage.setItem("au-smsf_tier",                                      String(popupTier));

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
          success_url: `${window.location.origin}/nomad/check/australia-smsf-residency/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad/check/australia-smsf-residency`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your SMSF residency decision for your SMSF specialist.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your residency assessment by email — free.</p>
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
                    {popupTier === 67 ? "Your SMSF Residency Fix Kit" : "Your SMSF Residency Shield System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">SIS Act s 10(1) · ITAA 1997 s 295-320 · ATO · April 2026</p>
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
                      {popupTier === 67 ? "SMSF Residency Fix Kit™" : "SMSF Residency Shield System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your specific SMSF residency status, CM&C risk assessment, trustee positioning checklist, and compliance fix pathway."
                        : "Full SMSF residency protection: corporate trustee restructure guide, global decision framework, audit-proof documentation protocol, and multi-year transition plan."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic SMSF content. Your specific CM&C position + restructure pathway.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My SMSF Fix Kit →" : "Get My SMSF Shield System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the fix kit? — $67 instead" : "Want the full shield system? — $147 instead"}
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
                    { label: "Your role", key: "filing_role", options: [["smsf_member_overseas","SMSF member — moving/living overseas"],["smsf_trustee","SMSF trustee — structural review"],["smsf_planning","SMSF member — planning departure"],["advisor","SMSF specialist / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["departure_imminent","Departure in next 30 days"],["departure_planning","Departure in next 3 months"],["mid_absence","Already overseas — structural review"],["audit_letter","ATO letter / compliance enquiry"],["planning","General planning"]] },
                    { label: "Do you have an SMSF specialist?", key: "accountant", options: [["ssa_specialist","Yes — SMSF Specialist Association member"],["general_accountant","Yes — general accountant"],["diy","Self-managed / accountant handles returns only"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · ATO SMSF residency (SIS Act s 10(1))</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && (verdict.result.isBreach || verdict.result.isAtRisk) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{verdict.result.isBreach ? "Breach risk" : "At risk"} — tax exposure</p>
              <p className="text-sm font-bold text-neutral-950">
                {aud(verdict.result.taxIfNonComplying)} at stake
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
