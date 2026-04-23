"use client";

/**
 * NOMAD-10 — Spain Beckham Eligibility Wall
 * Pattern: Sequential GateTest -> eligibility determination + tax saving quantification
 *
 * Legal anchor: Ley 35/2006 Art. 93 + Ley 28/2022 (Startup Law)
 *
 * CRITICAL LANGUAGE RULE: Never say "you qualify" deterministically.
 * Always conditional: "may qualify" / "appears to meet" / "confirm with Spanish adviser".
 *
 * DETERMINATION ORDER (sequential gates — fail any = stop):
 *   1. Passive income only / retired -> NOT_APPLICABLE
 *   2. Prior 5-year Spanish residency -> DISQUALIFIED_PRIOR_RESIDENCY
 *   3. Arrived over 6 months ago -> DISQUALIFIED_TIMING_CLOSED
 *   4. Director 25%+ non-startup -> AT_RISK_DIRECTOR_OWNERSHIP
 *   5. Autónomo without qualifying structure -> CONDITIONAL_STRUCTURE_REVIEW
 *   6. Digital nomad without DNV -> CONDITIONAL_STRUCTURE_REVIEW
 *   7. SS coverage unclear -> CONDITIONAL_STRUCTURE_REVIEW
 *   8. All gates pass -> LIKELY_ELIGIBLE
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "LIKELY_ELIGIBLE"
  | "CONDITIONAL_STRUCTURE_REVIEW"
  | "DISQUALIFIED_PRIOR_RESIDENCY"
  | "DISQUALIFIED_TIMING_CLOSED"
  | "AT_RISK_DIRECTOR_OWNERSHIP"
  | "NOT_APPLICABLE_PASSIVE"
  | "UNCERTAIN_NEEDS_REVIEW";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface BeckhamResult {
  moveReason:          string;
  priorResidency:       string;
  ssCoverage:            string;
  directorOwnership:      string;
  dnvStatus:               string;
  applicationTiming:        string;
  annualIncome:              string;

  incomeMidpoint:           number;
  beckhamTax:                number;   // 24% up to €600k + 47% above
  standardIrpfTax:            number;   // progressive estimate
  annualSaving:                number;
  sixYearSaving:                number;

  status:                      Status;
  statusLabel:                  string;
  isEligible:                    boolean;
  isDisqualified:                 boolean;
  isConditional:                   boolean;

  reasoningChain:                 Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:                            Route[];
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
  result: BeckhamResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_spain_beckham",
  p147: "nomad_147_spain_beckham",
};

const INCOME_MIDPOINT: Record<string, number> = {
  under_60k:        40000,
  "60k_to_120k":    90000,
  "120k_to_300k":   200000,
  "300k_to_600k":   450000,
  over_600k:        800000,
};

const INCOME_LABEL: Record<string, string> = {
  under_60k:        "Under €60,000",
  "60k_to_120k":    "€60,000-€120,000",
  "120k_to_300k":   "€120,000-€300,000",
  "300k_to_600k":   "€300,000-€600,000",
  over_600k:        "Over €600,000",
};

function eur(n: number): string {
  return `€${Math.round(n).toLocaleString("en-IE", { maximumFractionDigits: 0 })}`;
}

// Standard IRPF progressive effective rate approximation (national rates + average regional)
function standardIrpfEffective(income: number): number {
  if (income <= 12450) return 0.19;
  if (income <= 20200) return 0.22;
  if (income <= 35200) return 0.27;
  if (income <= 60000) return 0.32;
  if (income <= 120000) return 0.37;
  if (income <= 200000) return 0.40;
  if (income <= 300000) return 0.43;
  return 0.45;
}

function calcBeckham(answers: AnswerMap): BeckhamResult {
  const moveReason        = String(answers.move_reason        || "employment_spain");
  const priorResidency    = String(answers.prior_residency    || "no_never");
  const ssCoverage         = String(answers.ss_coverage         || "registering_spain");
  const directorOwnership   = String(answers.director_ownership   || "not_applicable");
  const dnvStatus            = String(answers.dnv_status            || "not_applicable");
  const applicationTiming    = String(answers.application_timing    || "within_6_months");
  const annualIncome         = String(answers.annual_income         || "120k_to_300k");

  const incomeMidpoint = INCOME_MIDPOINT[annualIncome] ?? 200000;

  // Beckham tax: 24% up to €600,000; 47% above
  const beckhamTax = Math.round((Math.min(incomeMidpoint, 600000) * 0.24) + (Math.max(0, incomeMidpoint - 600000) * 0.47));

  // Standard IRPF progressive estimate
  const standardRate = standardIrpfEffective(incomeMidpoint);
  const standardIrpfTax = Math.round(incomeMidpoint * standardRate);

  const annualSaving = Math.max(0, standardIrpfTax - beckhamTax);
  const sixYearSaving = annualSaving * 6;

  const reasoningChain: BeckhamResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";

  // GATE 1 — passive income / retired
  if (moveReason === "retired_passive") {
    reasoningChain.push({ layer: "Gate 1 — Move reason", outcome: "Retired or investment income only — Beckham regime applies to earned income from qualifying work arrangements. Passive income is outside the regime's scope.", resolved: true });
    status = "NOT_APPLICABLE_PASSIVE";
    statusLabel = "NOT APPLICABLE — PASSIVE INCOME ONLY";
  } else {
    reasoningChain.push({ layer: "Gate 1 — Move reason", outcome: `Reason: ${moveReason.replace(/_/g, " ")} — qualifying category review needed`, resolved: false });
  }

  // GATE 2 — prior 5-year Spanish residency (hard disqualification)
  if (status === null && priorResidency === "yes_within_5yr") {
    reasoningChain.push({ layer: "Gate 2 — Prior residency (Art. 93)", outcome: "Spanish tax resident within last 5 years — automatic disqualification from the Beckham regime regardless of current structure.", resolved: true });
    status = "DISQUALIFIED_PRIOR_RESIDENCY";
    statusLabel = "DISQUALIFIED — PRIOR 5-YEAR SPANISH RESIDENCY";
  } else if (status === null && priorResidency === "unsure") {
    reasoningChain.push({ layer: "Gate 2 — Prior residency", outcome: "Prior residency status uncertain — specialist review of past Spanish periods required before application", resolved: false });
  } else if (status === null) {
    reasoningChain.push({ layer: "Gate 2 — Prior residency", outcome: priorResidency === "no_never" ? "No prior Spanish residency — gate passed" : "Prior residency over 5 years ago — gate passed", resolved: false });
  }

  // GATE 3 — application timing (absolute deadline)
  if (status === null && applicationTiming === "over_6_months") {
    reasoningChain.push({ layer: "Gate 3 — Modelo 149 timing", outcome: "Arrived more than 6 months ago and not yet applied — Modelo 149 application window has likely closed. Confirm exact Spanish Social Security registration date with a gestor before accepting this outcome.", resolved: true });
    status = "DISQUALIFIED_TIMING_CLOSED";
    statusLabel = "DISQUALIFIED — MODELO 149 WINDOW CLOSED";
  } else if (status === null && applicationTiming === "already_applied") {
    reasoningChain.push({ layer: "Gate 3 — Modelo 149 timing", outcome: "Already applied via Modelo 149 — awaiting AEAT acknowledgment. Monitor for confirmation and respond to any AEAT queries within deadlines.", resolved: false });
  } else if (status === null) {
    reasoningChain.push({ layer: "Gate 3 — Modelo 149 timing", outcome: applicationTiming === "not_arrived" ? "Not yet arrived — maximum planning window available" : "Within 6-month application window — Modelo 149 can still be filed", resolved: false });
  }

  // GATE 4 — director 25%+ non-startup
  if (status === null && moveReason === "director_spain" && directorOwnership === "over_25") {
    reasoningChain.push({ layer: "Gate 4 — Director ownership", outcome: "Director holding 25%+ of company capital — excluded from Beckham regime unless the company is a certified startup under Ley 28/2022. Startup certification (Enisa) or ownership restructure may unlock the pathway.", resolved: true });
    status = "AT_RISK_DIRECTOR_OWNERSHIP";
    statusLabel = "AT RISK — DIRECTOR WITH SIGNIFICANT OWNERSHIP";
  } else if (status === null && moveReason === "director_spain" && directorOwnership === "startup_director") {
    reasoningChain.push({ layer: "Gate 4 — Director ownership", outcome: "Founding director of certified startup — Startup Law exception applies; regime pathway potentially available", resolved: false });
  }

  // GATE 5 — qualifying category checks
  if (status === null) {
    if (moveReason === "autonomo") {
      reasoningChain.push({ layer: "Gate 5 — Qualifying category", outcome: "Standard autónomo without DNV — does NOT automatically qualify under Beckham. Restructure pathways: (a) DNV route, (b) employment conversion, (c) highly qualified professional pathway if activity meets innovation criteria.", resolved: true });
      status = "CONDITIONAL_STRUCTURE_REVIEW";
      statusLabel = "CONDITIONAL — STRUCTURE REVIEW NEEDED (AUTÓNOMO)";
    } else if (moveReason === "digital_nomad" && (dnvStatus === "no_dnv" || dnvStatus === "not_applicable")) {
      reasoningChain.push({ layer: "Gate 5 — Qualifying category", outcome: "Digital nomad without Spanish Digital Nomad Visa — does NOT qualify under the Startup Law DNV route. DNV application is the primary fix path.", resolved: true });
      status = "CONDITIONAL_STRUCTURE_REVIEW";
      statusLabel = "CONDITIONAL — DNV REQUIRED FOR DIGITAL NOMAD ROUTE";
    } else if (moveReason === "digital_nomad" && dnvStatus === "applying_dnv") {
      reasoningChain.push({ layer: "Gate 5 — Qualifying category", outcome: "DNV application in progress — Beckham eligibility conditional on DNV issuance. Modelo 149 clock starts from DNV issuance date or Spanish SS registration, whichever is earlier.", resolved: false });
    } else if (moveReason === "digital_nomad" && dnvStatus === "has_dnv") {
      reasoningChain.push({ layer: "Gate 5 — Qualifying category", outcome: "Digital nomad with valid DNV — qualifying category under Startup Law. Social security via RETA registration required.", resolved: false });
    } else if (moveReason === "startup_founder") {
      reasoningChain.push({ layer: "Gate 5 — Qualifying category", outcome: "Startup founder — qualifying category under Startup Law for certified startup activity. Enisa certification + activity criteria review needed.", resolved: false });
    } else {
      reasoningChain.push({ layer: "Gate 5 — Qualifying category", outcome: `Qualifying category: ${moveReason === "employment_spain" ? "Spanish employment contract" : moveReason === "posted_foreign" ? "cross-border posting" : moveReason === "director_spain" ? "qualifying directorship" : "inbound work"} — aligns with Beckham requirements`, resolved: false });
    }
  }

  // GATE 6 — SS coverage
  if (status === null) {
    if (ssCoverage === "unsure_ss") {
      reasoningChain.push({ layer: "Gate 6 — Social security", outcome: "SS coverage unclear — valid coverage (Spanish SS / EU A1 / bilateral agreement) is mandatory. Review with Spanish gestor + home country SS authority before application.", resolved: true });
      status = "CONDITIONAL_STRUCTURE_REVIEW";
      statusLabel = "CONDITIONAL — SOCIAL SECURITY COVERAGE REVIEW";
    } else if (ssCoverage === "not_applicable" && moveReason !== "retired_passive") {
      reasoningChain.push({ layer: "Gate 6 — Social security", outcome: "SS coverage marked 'not applicable' but move reason requires coverage — clarification needed on SS position", resolved: true });
      status = "CONDITIONAL_STRUCTURE_REVIEW";
      statusLabel = "CONDITIONAL — SS COVERAGE CLARIFICATION";
    } else {
      reasoningChain.push({ layer: "Gate 6 — Social security", outcome: `SS coverage: ${ssCoverage === "registering_spain" ? "Spanish SS registration via employer" : ssCoverage === "a1_eu" ? "EU/EEA A1 certificate" : "bilateral SS agreement"} — coverage condition addressed`, resolved: false });
    }
  }

  // ALL GATES PASSED — likely eligible
  if (status === null) {
    reasoningChain.push({ layer: "Final assessment", outcome: "All eligibility gates pass — your structure appears to meet the core Beckham Law conditions. Confirm with a Spanish gestor before submitting Modelo 149.", resolved: true });
    status = "LIKELY_ELIGIBLE";
    statusLabel = "LIKELY ELIGIBLE — CONFIRM STRUCTURE";
  }

  // Fallback
  if (status === null) {
    status = "UNCERTAIN_NEEDS_REVIEW";
    statusLabel = "UNCERTAIN — SPECIALIST REVIEW NEEDED";
  }

  // Tax exposure reasoning
  if (status === "LIKELY_ELIGIBLE" || status === "CONDITIONAL_STRUCTURE_REVIEW") {
    reasoningChain.push({ layer: "Tax saving estimate", outcome: `${eur(incomeMidpoint)} income × 24% (Beckham) = ${eur(beckhamTax)} vs ~${eur(standardIrpfTax)} under standard IRPF. Annual saving: ${eur(annualSaving)}. Over 6-year regime: ${eur(sixYearSaving)}.`, resolved: true });
  }

  const isEligible = status === "LIKELY_ELIGIBLE";
  const isDisqualified = status === "DISQUALIFIED_PRIOR_RESIDENCY" || status === "DISQUALIFIED_TIMING_CLOSED" || status === "NOT_APPLICABLE_PASSIVE";
  const isConditional = status === "CONDITIONAL_STRUCTURE_REVIEW" || status === "AT_RISK_DIRECTOR_OWNERSHIP";

  // Routing
  const routes: Route[] = [];
  if (status === "LIKELY_ELIGIBLE") {
    routes.push({ label: "Tax Treaty Navigator — Spain treaty position", href: "/nomad/check/tax-treaty-navigator", note: "Confirm foreign-source income treatment alongside Beckham" });
    routes.push({ label: "183-Day Rule Reality Check — departure country", href: "/nomad/check/183-day-rule", note: "Establish cessation of residency in your home country" });
  } else if (status === "CONDITIONAL_STRUCTURE_REVIEW" || status === "AT_RISK_DIRECTOR_OWNERSHIP") {
    routes.push({ label: "Tax Treaty Navigator", href: "/nomad/check/tax-treaty-navigator", note: "Alternative treaty-based planning if Beckham route does not unlock" });
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Residency cross-check" });
  } else if (status === "DISQUALIFIED_PRIOR_RESIDENCY" || status === "DISQUALIFIED_TIMING_CLOSED") {
    routes.push({ label: "Tax Treaty Navigator — alternative tax planning", href: "/nomad/check/tax-treaty-navigator", note: "Treaty-based relief since Beckham unavailable" });
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Standard Spanish residency tax planning" });
  } else if (status === "NOT_APPLICABLE_PASSIVE") {
    routes.push({ label: "Tax Treaty Navigator — passive income allocation", href: "/nomad/check/tax-treaty-navigator", note: "Treaty treatment of dividends, rental, interest" });
    routes.push({ label: "Nomad Residency Risk Index — full residency review", href: "/nomad", note: "Broader retirement tax planning" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    moveReason, priorResidency, ssCoverage, directorOwnership, dnvStatus, applicationTiming, annualIncome,
    incomeMidpoint, beckhamTax, standardIrpfTax, annualSaving, sixYearSaving,
    status, statusLabel,
    isEligible, isDisqualified, isConditional,
    reasoningChain, routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcBeckham(answers);

  const headline = (() => {
    if (result.status === "LIKELY_ELIGIBLE") return `Your structure appears to meet the core Beckham Law eligibility conditions. Based on your qualifying work arrangement, no prior Spanish residency in the last 5 years, and valid social security position, your application may succeed. Estimated saving at ${INCOME_LABEL[result.annualIncome]} income: approximately ${eur(result.annualSaving)} per year (${eur(result.sixYearSaving)} over the 6-year regime). Confirm with a Spanish gestor and submit Modelo 149 within 6 months of Spanish Social Security registration.`;
    if (result.status === "CONDITIONAL_STRUCTURE_REVIEW") return `Your situation has elements that may qualify but require structural attention before application. Applying without resolving the specific issue identified creates a high rejection risk. Potential saving if structure fixed: ~${eur(result.annualSaving)} per year (${eur(result.sixYearSaving)} over 6 years). The restructure pathway typically costs €2,000-€5,000 — ROI of getting it right exceeds 10x at this income level.`;
    if (result.status === "AT_RISK_DIRECTOR_OWNERSHIP") return `You are a director holding 25% or more of your company's capital. Under standard conditions this excludes you from the Beckham regime — unless the company is certified as a startup under Ley 28/2022. The startup certification pathway via Enisa or the ownership restructure below 25% may unlock eligibility. Potential saving if resolved: ~${eur(result.annualSaving)} per year.`;
    if (result.status === "DISQUALIFIED_PRIOR_RESIDENCY") return `You were Spanish tax resident within the last 5 years. This is an automatic disqualification from the Beckham regime regardless of your current employment structure. You will be taxed under standard IRPF progressive rates. The regime may be available for a future relocation if 5 years elapse without Spanish residency.`;
    if (result.status === "DISQUALIFIED_TIMING_CLOSED") return `You arrived in Spain more than 6 months ago and have not yet applied. The Modelo 149 application window is exactly 6 months from Spanish Social Security registration — this deadline is absolute. If this window has passed, the regime is no longer available for this relocation. Confirm the exact SS registration date with a gestor before accepting this outcome (some timing exceptions may apply).`;
    if (result.status === "NOT_APPLICABLE_PASSIVE") return `The Beckham regime applies to earned income from employment or qualifying economic activities. Passive income — dividends, rental income, capital gains, interest — is taxed under standard IRPF savings rates (19%-28%+) regardless of the regime. Retirees or individuals with investment income only are not within the target of Article 93. Alternative Spanish tax planning (regional rates, treaty relief, pension optimisation) may be available.`;
    return `Your Beckham eligibility requires specialist review — your inputs do not map cleanly to a single category. Engage a Spanish gestor before relying on any expected Beckham treatment.`;
  })();

  const consequences: string[] = [];

  if (result.status === "LIKELY_ELIGIBLE") {
    consequences.push(`✓ All four core conditions appear to be met — qualifying work arrangement, no prior 5-year residency, valid SS coverage, and application timing within window.`);
    consequences.push(`Estimated tax saving: ${eur(result.annualSaving)}/year (${eur(result.sixYearSaving)} over 6-year regime). 24% Beckham rate vs ~${Math.round(standardIrpfEffective(result.incomeMidpoint) * 100)}% standard IRPF effective rate.`);
    consequences.push(`Next action: engage Spanish gestor to confirm eligibility and prepare Modelo 149. Expected gestor fee: €1,500-€3,000 for Beckham application + first year's IRPF.`);
    consequences.push(`Modelo 149 must be filed within 6 months of Spanish SS registration. Recommended filing at month 3-5 to allow AEAT processing buffer.`);
    consequences.push(`Supporting documents: employment contract / posting letter / DNV; Spanish SS registration (NAF) or A1 certificate; passport + NIE; prior residency evidence (foreign tax certs for 5 years).`);
    consequences.push(`Passive income (dividends, rental, capital gains) — taxed at standard IRPF savings rates even under Beckham. Most foreign-source passive income typically excluded from Spanish scope under the regime.`);
    consequences.push(`Wealth tax benefit: Beckham applicants typically treated as non-residents for wealth tax — Spanish wealth tax only applies to Spanish-situs assets.`);
    consequences.push(`Annual compliance: Spanish IRPF return due 30 June following tax year; reflect Beckham election and income composition correctly.`);
  } else if (result.status === "CONDITIONAL_STRUCTURE_REVIEW") {
    consequences.push(`⚠ Structural issue identified — ${result.moveReason === "autonomo" ? "autónomo without qualifying classification" : result.moveReason === "digital_nomad" ? "digital nomad without DNV" : result.ssCoverage === "unsure_ss" ? "SS coverage unclear" : "structure review needed"}.`);
    consequences.push(`Potential tax saving if resolved: ${eur(result.annualSaving)}/year (${eur(result.sixYearSaving)} over 6-year regime) — substantial justification for restructure investment.`);
    consequences.push(`Fix paths: (a) convert to Spanish employment contract if feasible; (b) obtain Digital Nomad Visa for remote worker route; (c) Enisa startup certification; (d) restructure ownership below 25%.`);
    consequences.push(`DNV application cost: ~€200 fees + ~€1,500-€3,000 adviser fees. Processing 2-3 months. Typically the cleanest fix for remote workers.`);
    consequences.push(`Before any application: engage Spanish gestor with Beckham experience. Generic EU tax advisers often miss the structural detail that causes rejections.`);
    consequences.push(`Timing: restructure BEFORE arrival or within the 6-month SS window. Missing both creates a permanent closure for this relocation.`);
  } else if (result.status === "AT_RISK_DIRECTOR_OWNERSHIP") {
    consequences.push(`🔒 Director ownership blocker — 25%+ of company capital excludes you from the standard Beckham regime.`);
    consequences.push(`Exception path: if the company is certified as a startup under Ley 28/2022 (typically via Enisa), the director exclusion does not apply. Certification requires: (a) scalable / innovative business model; (b) Spanish establishment; (c) under 5 years since incorporation; (d) Enisa or equivalent body certification.`);
    consequences.push(`Alternative path: restructure ownership below 25% via bringing in co-investors or stock option dilution. Operational impact on control needs weighing against tax saving.`);
    consequences.push(`Potential saving if resolved: ${eur(result.annualSaving)}/year (${eur(result.sixYearSaving)} over 6 years). At this income level, Enisa certification or restructure pathway costs are materially outweighed.`);
    consequences.push(`Engage both: Spanish startup law specialist (for Enisa pathway) + Beckham tax gestor (for Modelo 149 preparation post-certification).`);
    consequences.push(`Standalone alternative: accept standard IRPF and optimise via pension contributions, regional rates (Madrid, Andalucía have reduced rates), and treaty relief on foreign-source income.`);
  } else if (result.status === "DISQUALIFIED_PRIOR_RESIDENCY") {
    consequences.push(`🔒 Prior 5-year residency disqualifier — automatic exclusion under Article 93 regardless of current structure.`);
    consequences.push(`Standard IRPF progressive rates apply: up to 47% top marginal. At your income level (~${INCOME_LABEL[result.annualIncome]}), estimated Spanish tax ~${eur(result.standardIrpfTax)}/year.`);
    consequences.push(`Alternative optimisation: pension contributions (up to €1,500/year tax deductible); regional IRPF variations (Madrid and Andalucía have reduced rates vs Catalonia/Valencia); treaty relief on foreign-source income.`);
    consequences.push(`Future eligibility: if you leave Spain and remain non-resident for 5 full tax years, the Beckham regime may be available for a future return. This is a 5+ year planning horizon.`);
    consequences.push(`Confirm the prior residency status with a Spanish gestor — edge cases (brief stays, student periods, temporary postings) may or may not trigger residency depending on facts.`);
    consequences.push(`Wealth tax exposure: as standard resident, Spanish wealth tax applies to worldwide assets (some regions abolished it). Review with Spanish adviser.`);
  } else if (result.status === "DISQUALIFIED_TIMING_CLOSED") {
    consequences.push(`🔒 Modelo 149 window closed — 6-month deadline from Spanish SS registration is absolute.`);
    consequences.push(`Before accepting this outcome: verify the exact Spanish SS registration date. The clock starts from NAF issuance, not from physical arrival in Spain. A gestor can confirm the precise date.`);
    consequences.push(`No late application process exists. No extensions. No retroactive filing. The regime for this relocation is permanently closed.`);
    consequences.push(`Alternative: accept standard IRPF; optimise within standard framework (pensions, regional rates, treaty relief, strategic income timing).`);
    consequences.push(`Future eligibility: if you leave Spain and return after 5 clear years of non-residency, a fresh Beckham application window opens for that new relocation.`);
    consequences.push(`Lessons for others: the 6-month clock starts from SS registration — not arrival, not employment start. Many applicants discover this too late.`);
  } else if (result.status === "NOT_APPLICABLE_PASSIVE") {
    consequences.push(`Beckham regime does not apply to retirement or passive-income-only relocations. Article 93 targets inbound workers.`);
    consequences.push(`Spanish tax treatment: passive income taxed at savings rates — 19% up to €6,000, 21% €6,000-€50,000, 23% €50,000-€200,000, 27% €200,000-€300,000, 28%+ over €300,000.`);
    consequences.push(`Wealth tax: standard resident treatment — worldwide assets within scope (though some regions have reduced or eliminated it).`);
    consequences.push(`Pension income from home country: treaty-dependent. Many Spain treaties (UK, US, AU, CA, DE) have specific pension provisions.`);
    consequences.push(`Alternative tax efficiency: regional IRPF variations, ISP (Investment Savings Plan) equivalent, treaty relief on foreign pensions and investment income.`);
    consequences.push(`Engage Spanish wealth/pensions adviser — not Beckham gestor — for this profile. Different specialty.`);
  } else if (result.status === "UNCERTAIN_NEEDS_REVIEW") {
    consequences.push(`Inputs do not map cleanly to a single Beckham category — specialist review essential.`);
    consequences.push(`Engage Spanish gestor with Beckham experience. Generic EU tax advisers without Spanish specialty often miss structural issues.`);
    consequences.push(`Before specialist engagement: gather employment contract / posting letter / DNV application; Spanish SS registration (when received); prior residency evidence for 5 years; company ownership records if director.`);
    consequences.push(`Consider obtaining an AEAT informal consultation or private ruling for your specific facts if the position is unclear and the saving is material.`);
  }

  const statusClass = result.isEligible ? "text-emerald-700" : (result.isDisqualified ? "text-red-700" : (result.isConditional ? "text-amber-700" : "text-amber-700"));
  const panelClass  = result.isEligible ? "border-emerald-200 bg-emerald-50" : (result.isDisqualified ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50");

  const confidence: ConfidenceLevel = result.status === "UNCERTAIN_NEEDS_REVIEW" ? "LOW" : (result.isConditional ? "MEDIUM" : "HIGH");
  const confidenceNote = result.status === "UNCERTAIN_NEEDS_REVIEW"
    ? "Inputs do not map cleanly — specialist review required before relying on outcome."
    : result.isConditional
      ? "Conditional outcome — structural fix or specialist confirmation needed before application."
      : "Eligibility determined by Article 93 gates; Spanish gestor confirmation is standard practice for Beckham applications.";

  // Tier selection
  const tier2Triggers = [
    result.moveReason === "director_spain" && result.directorOwnership === "over_25",
    result.moveReason === "autonomo",
    result.moveReason === "startup_founder",
    result.moveReason === "digital_nomad" && result.dnvStatus !== "has_dnv",
    result.ssCoverage === "unsure_ss",
    result.annualIncome === "over_600k" || result.annualIncome === "300k_to_600k",
    result.isConditional,
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "Eligibility outcome",            value: result.isEligible ? "Likely eligible" : (result.isConditional ? "Conditional" : result.isDisqualified ? "Disqualified" : "Review needed"), highlight: result.isDisqualified },
      { label: "Estimated annual saving",          value: result.annualSaving > 0 ? eur(result.annualSaving) : "€0",                                                                                    highlight: result.annualSaving >= 10000 },
      { label: "6-year saving if eligible",          value: result.sixYearSaving > 0 ? eur(result.sixYearSaving) : "€0",                                                                                                                                                   },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My Beckham Approval System — €147 →" : "Get My Beckham Eligibility Kit — €67 →",
    altTierLabel: tier === 147 ? "Just want the eligibility kit? — €67 instead" : "Want the full approval system? — €147",
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
    id: "move_reason", step: 1, type: "button_group",
    label: "Why are you moving to Spain?",
    subLabel: "The reason for relocation determines which qualifying category applies. Retiring or moving for family reasons does not qualify.",
    options: [
      { label: "Employment with Spanish company (contract)",       value: "employment_spain",  subLabel: "Standard qualifying category" },
      { label: "Posted by foreign employer (assignment)",             value: "posted_foreign",    subLabel: "A1 certificate path" },
      { label: "Director of Spanish company",                           value: "director_spain",   subLabel: "Ownership stake determines qualification" },
      { label: "Self-employed / freelance (autónomo)",                    value: "autonomo",         subLabel: "Does NOT auto-qualify without DNV" },
      { label: "Digital nomad (remote work for foreign clients)",           value: "digital_nomad",    subLabel: "DNV route (Startup Law)" },
      { label: "Entrepreneur / startup founder",                             value: "startup_founder", subLabel: "Startup Law innovation pathway" },
      { label: "Retired / investment income only",                             value: "retired_passive", subLabel: "Regime does NOT apply" },
    ],
    required: true,
  },
  {
    id: "prior_residency", step: 2, type: "button_group",
    label: "Were you tax resident in Spain in the last 5 years?",
    subLabel: "Any period of Spanish tax residency in the 5 years before arrival is an automatic disqualification — regardless of current structure.",
    options: [
      { label: "No — never lived in Spain",                         value: "no_never",         subLabel: "Cleanest position" },
      { label: "No — lived in Spain but over 5 years ago",            value: "no_over_5yr",     subLabel: "Outside 5-year window — gate passed" },
      { label: "Yes — within the last 5 years",                          value: "yes_within_5yr",  subLabel: "Hard disqualification" },
      { label: "Unsure — may have been resident briefly",                   value: "unsure",           subLabel: "Needs historical review" },
    ],
    required: true,
  },
  {
    id: "ss_coverage", step: 3, type: "button_group",
    label: "Social security situation",
    subLabel: "Valid SS coverage is mandatory — Spanish SS registration, EU/EEA A1 certificate, or bilateral agreement.",
    options: [
      { label: "Will register with Spanish Social Security (new hire)",             value: "registering_spain", subLabel: "Standard employer-led path" },
      { label: "Have A1 certificate from home country (EU/EEA posted)",              value: "a1_eu",             subLabel: "Posted worker standard" },
      { label: "Covered by bilateral SS agreement",                                     value: "bilateral_agreement", subLabel: "US/AU/CA/JP and others" },
      { label: "Not sure about SS coverage",                                              value: "unsure_ss",           subLabel: "Review with gestor" },
      { label: "Not applicable — pension or investment only",                              value: "not_applicable",       subLabel: "Usually outside regime scope" },
    ],
    required: true,
  },
  {
    id: "director_ownership", step: 4, type: "button_group",
    label: "If director — what is your ownership stake in the company?",
    subLabel: "Directors holding 25%+ of company capital are excluded unless the company is a certified startup under Ley 28/2022.",
    options: [
      { label: "Under 25% of company capital",                   value: "under_25",        subLabel: "Within Startup Law limits" },
      { label: "25% or more of company capital",                  value: "over_25",         subLabel: "Excluded unless certified startup" },
      { label: "Founding director of certified startup",           value: "startup_director", subLabel: "Startup Law exception applies" },
      { label: "Not a director",                                    value: "not_applicable",   subLabel: "Not relevant to your profile" },
    ],
    required: true,
  },
  {
    id: "dnv_status", step: 5, type: "button_group",
    label: "If digital nomad — Spanish Digital Nomad Visa status",
    subLabel: "DNV is the pathway for remote workers under the Startup Law expansion.",
    options: [
      { label: "Have valid Spanish Digital Nomad Visa",              value: "has_dnv",         subLabel: "DNV route available" },
      { label: "Applying for Digital Nomad Visa",                     value: "applying_dnv",    subLabel: "Conditional on issuance" },
      { label: "Not planning to use DNV route",                         value: "no_dnv",           subLabel: "Alternative pathway needed if remote" },
      { label: "Not applicable",                                         value: "not_applicable",   subLabel: "Not relevant to your profile" },
    ],
    required: true,
  },
  {
    id: "application_timing", step: 6, type: "button_group",
    label: "Application timing — have you arrived in Spain?",
    subLabel: "Modelo 149 must be submitted within 6 months of Spanish Social Security registration — absolute deadline.",
    options: [
      { label: "Not yet arrived in Spain",                                  value: "not_arrived",       subLabel: "Maximum planning window" },
      { label: "Arrived within last 6 months (can still apply)",              value: "within_6_months",  subLabel: "Window open" },
      { label: "Arrived more than 6 months ago (window may be closed)",          value: "over_6_months",    subLabel: "Window likely closed" },
      { label: "Already applied via Modelo 149",                                   value: "already_applied",  subLabel: "Awaiting AEAT acknowledgment" },
    ],
    required: true,
  },
  {
    id: "annual_income", step: 7, type: "button_group",
    label: "Expected annual Spanish-source income (EUR)?",
    subLabel: "Used to estimate tax saving from the 24% Beckham rate versus progressive IRPF.",
    options: [
      { label: "Under €60,000",             value: "under_60k",       subLabel: "Modest saving at lower rates" },
      { label: "€60,000-€120,000",            value: "60k_to_120k",    subLabel: "Typical saving €7k-€12k/year" },
      { label: "€120,000-€300,000",            value: "120k_to_300k",   subLabel: "Saving €15k-€55k/year — high ROI" },
      { label: "€300,000-€600,000",             value: "300k_to_600k",   subLabel: "Saving €80k+/year" },
      { label: "Over €600,000",                   value: "over_600k",      subLabel: "47% on excess over €600k" },
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

      {/* Eligibility gate chain */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Beckham eligibility gates — Ley 35/2006 Art. 93 + Ley 28/2022</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (result.isDisqualified ? "bg-red-100" : result.isConditional ? "bg-amber-100" : "bg-emerald-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (result.isDisqualified ? "text-red-700" : result.isConditional ? "text-amber-700" : "text-emerald-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (result.isDisqualified ? "text-red-700" : result.isConditional ? "text-amber-700" : "text-emerald-700") : "text-neutral-700"}`}>{r.layer}</p>
                <p className="text-xs text-neutral-700">{r.outcome}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? (result.isDisqualified ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50") : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? (result.isDisqualified ? "text-red-700" : "text-emerald-700") : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tax comparison visual */}
      {(result.isEligible || result.isConditional) && result.annualSaving > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700">Tax saving math — Beckham vs standard IRPF</p>
          <p className="font-bold text-emerald-900">
            {eur(result.incomeMidpoint)} income: Beckham {eur(result.beckhamTax)} vs standard {eur(result.standardIrpfTax)} = {eur(result.annualSaving)}/year saved
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            Over 6-year regime period: {eur(result.sixYearSaving)} total saving. 24% flat vs ~{Math.round((result.standardIrpfTax / result.incomeMidpoint) * 100)}% effective progressive rate.
          </p>
        </div>
      )}

      {/* Disqualified visual */}
      {result.isDisqualified && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Beckham unavailable — alternative tax position</p>
          <p className="font-bold text-red-900">
            Standard IRPF applies: ~{eur(result.standardIrpfTax)}/year on {INCOME_LABEL[result.annualIncome]} income
          </p>
          <p className="mt-1 text-xs text-red-800">
            Saving would have been {eur(result.annualSaving)}/year under Beckham. Explore alternative optimisation (regional rates, pensions, treaty relief).
          </p>
        </div>
      )}

      {/* Language disclaimer */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        <strong>Language note:</strong> Beckham eligibility is fact-specific and depends on AEAT interpretation. This assessment uses the word &quot;may&quot; deliberately — never rely solely on an online calculator. Confirm with a Spanish gestor before Modelo 149 submission.
      </div>

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — Beckham pathway + cross-border residency</p>
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
          <strong className="text-neutral-950">Structure, not income, is the typical failure point.</strong> Most Beckham applications fail because of the qualifying category, prior residency, or timing deadline — not because of income. Resolving structure before application is the single biggest driver of success.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific Beckham eligibility assessment with gate-by-gate reasoning</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Prior residency check + qualifying structure confirmation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Estimated tax saving and 6-year regime horizon</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Modelo 149 application timeline and documentation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Employment restructure plan (tier 2) if structure fix needed</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>A1 certificate + startup certification pathway (tier 2)</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">€{verdict.tier} · One-time · Built around your exact Beckham position</p>
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

export default function SpainBeckhamCalculator() {
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
        product_slug: "spain-beckham",
        source_path: "/nomad/check/spain-beckham-eligibility",
        country_code: "ES", currency_code: "EUR", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          beckham_status: verdict.result.status,
          annual_saving: verdict.result.annualSaving,
          is_eligible: verdict.result.isEligible,
          is_disqualified: verdict.result.isDisqualified,
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
      body: JSON.stringify({ email, source: "spain_beckham", country_code: "ES", site: "taxchecknow" }),
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
    const sid = sessionId || `beckham_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("spain-beckham_move_reason",         String(answers.move_reason        || ""));
    sessionStorage.setItem("spain-beckham_prior_residency",       String(answers.prior_residency    || ""));
    sessionStorage.setItem("spain-beckham_ss_coverage",             String(answers.ss_coverage         || ""));
    sessionStorage.setItem("spain-beckham_director_ownership",       String(answers.director_ownership   || ""));
    sessionStorage.setItem("spain-beckham_dnv_status",                 String(answers.dnv_status            || ""));
    sessionStorage.setItem("spain-beckham_application_timing",          String(answers.application_timing    || ""));
    sessionStorage.setItem("spain-beckham_annual_income",                String(answers.annual_income         || ""));
    sessionStorage.setItem("spain-beckham_beckham_status",                verdict.result.status);
    sessionStorage.setItem("spain-beckham_annual_saving",                  String(verdict.result.annualSaving));
    sessionStorage.setItem("spain-beckham_is_eligible",                     String(verdict.result.isEligible));
    sessionStorage.setItem("spain-beckham_status",                           verdict.status);
    sessionStorage.setItem("spain-beckham_tier",                              String(popupTier));

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
          success_url: `${window.location.origin}/nomad/check/spain-beckham-eligibility/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad/check/spain-beckham-eligibility`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your Beckham decision for your Spanish gestor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your eligibility assessment by email — free.</p>
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
                    {popupTier === 67 ? "Your Beckham Eligibility Fix Kit" : "Your Beckham Approval System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">Ley 35/2006 Art. 93 · Ley 28/2022 · AEAT · April 2026</p>
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
                      {popupTier === 67 ? "Beckham Eligibility Fix Kit™" : "Beckham Approval System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your conditional eligibility assessment, qualifying structure review, prior residency check, Modelo 149 timing pathway, and estimated tax saving."
                        : "Full Beckham application system: employment restructure plan, A1 certificate strategy, Modelo 149 roadmap, startup certification pathway, and full approval timeline."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">€{popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic Spain tax content. Your specific Beckham position + structural fix pathway.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Beckham Kit →" : "Get My Approval System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the eligibility kit? — €67 instead" : "Want the full approval system? — €147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">€{popupTier}</p>
                  </div>
                  {[
                    { label: "Your role", key: "filing_role", options: [["spanish_employment","Moving to Spain for employment"],["posted_worker","Posted from abroad"],["digital_nomad","Digital nomad / DNV route"],["director_founder","Director / startup founder"],["advisor","Spanish gestor / tax adviser"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["arrived_window","Arrived — Modelo 149 clock ticking"],["arriving_3mo","Arriving in next 3 months"],["planning_6mo","Planning within 6 months"],["audit_letter","AEAT letter / compliance enquiry"],["planning","General planning"]] },
                    { label: "Do you have a Spanish gestor?", key: "accountant", options: [["gestor_beckham","Yes — gestor with Beckham experience"],["general_gestor","Yes — general Spanish accountant"],["diy","Self-managed"],["none","No — need one"]] },
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
                    {loading ? "Redirecting to Stripe…" : `Pay €${popupTier} →`}
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · AEAT Beckham Law (Ley 35/2006 Art. 93 + Ley 28/2022)</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && (verdict.result.isEligible || verdict.result.isConditional) && verdict.result.annualSaving >= 10000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Beckham potential saving</p>
              <p className="text-sm font-bold text-neutral-950">
                {eur(verdict.result.annualSaving)}/year · {eur(verdict.result.sixYearSaving)} over 6yr
              </p>
            </div>
            <button onClick={() => openPopup(verdict.tier)}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white whitespace-nowrap">
              From €67 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
