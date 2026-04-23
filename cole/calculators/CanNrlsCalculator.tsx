"use client";

/**
 * CAN-02 — Canada Non-Resident Landlord Withholding Trap
 * Pattern: CashflowModel + ThresholdTest -> Section 216 refund opportunity + NR6 pathway
 *
 * Legal anchor: Income Tax Act (Canada) Part XIII s212(1)(d) + s216 + NR6 form
 *
 * DETERMINATION ORDER:
 *   1. Canadian resident -> NOT_APPLICABLE (rules don't apply)
 *   2. Uncertain residency -> UNCERTAIN (confirm first)
 *   3. Non-resident + no withholding + no agent -> UNDER_WITHHOLDING_RISK (compliance)
 *   4. Non-resident + 25% gross + no Section 216 -> OVER_WITHHOLDING_NO_216 (big refund)
 *   5. Non-resident + Section 216 filed + no NR6 -> NR6_OPPORTUNITY (cashflow)
 *   6. Non-resident + NR6 + Section 216 -> COMPLIANT_OPTIMISED
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "COMPLIANT_OPTIMISED"
  | "NR6_OPPORTUNITY"
  | "OVER_WITHHOLDING_NO_216"
  | "PARTIAL_216_HISTORY"
  | "UNDER_WITHHOLDING_RISK"
  | "NOT_APPLICABLE_CANADIAN"
  | "UNCERTAIN_RESIDENCY";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface NrlsResult {
  residencyStatus:   string;
  hasAgent:            string;
  grossRent:             string;
  annualExpenses:         string;
  withholdingStatus:        string;
  section216Status:           string;
  nr6Status:                    string;

  grossRentMidpoint:             number;
  expensesMidpoint:               number;
  netRentalIncome:                 number;
  withholding:                       number;   // 25% of gross
  section216Tax:                       number;   // net × ~28% marginal
  annualRefundOpportunity:              number;   // withholding - s216 tax
  recoverableYears:                       number;   // within 2-year window
  totalRecoverable:                         number;
  lostYears:                                  number;   // beyond 2-year window
  totalLost:                                    number;

  status:                                          Status;
  statusLabel:                                      string;
  isOverWithholding:                                 boolean;
  hasRefundOpportunity:                               boolean;
  isComplianceRisk:                                     boolean;

  reasoningChain:                                         Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:                                                   Route[];
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
  result: NrlsResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "can_67_non_resident_landlord",
  p147: "can_147_non_resident_landlord",
};

const GROSS_RENT_MIDPOINT: Record<string, number> = {
  under_12k:    8000,
  "12k_to_30k": 21000,
  "30k_to_60k": 45000,
  over_60k:     90000,
};

const GROSS_RENT_LABEL: Record<string, string> = {
  under_12k:    "Under $12,000",
  "12k_to_30k": "$12,000-$30,000",
  "30k_to_60k": "$30,000-$60,000",
  over_60k:     "Over $60,000",
};

const EXPENSES_MIDPOINT: Record<string, number> = {
  under_5k:     3000,
  "5k_to_15k":  10000,
  "15k_to_30k": 22500,
  over_30k:     40000,
};

function cad(n: number): string {
  return `$${Math.round(n).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;
}

function calcNrls(answers: AnswerMap): NrlsResult {
  const residencyStatus    = String(answers.residency_status     || "non_resident");
  const hasAgent             = String(answers.has_agent              || "yes_agent");
  const grossRent              = String(answers.gross_rent             || "12k_to_30k");
  const annualExpenses          = String(answers.annual_expenses        || "5k_to_15k");
  const withholdingStatus         = String(answers.withholding_status     || "yes_25_percent");
  const section216Status            = String(answers.section_216_status   || "no_never");
  const nr6Status                      = String(answers.nr6_status           || "no_25_gross");

  const grossRentMidpoint = GROSS_RENT_MIDPOINT[grossRent] ?? 21000;
  const expensesMidpoint = EXPENSES_MIDPOINT[annualExpenses] ?? 10000;
  const netRentalIncome = Math.max(0, grossRentMidpoint - expensesMidpoint);
  const withholding = Math.round(grossRentMidpoint * 0.25);
  // Section 216 tax: net × ~22% graduated effective rate (mix of federal + provincial)
  const section216Tax = Math.round(netRentalIncome * 0.22);
  const annualRefundOpportunity = Math.max(0, withholding - section216Tax);

  // Recoverable years: assume 2 years within window if never filed; 0 if already filed every year
  let recoverableYears = 0;
  let lostYears = 0;
  if (section216Status === "no_never") { recoverableYears = 2; lostYears = 3; }
  else if (section216Status === "some_years" || section216Status === "not_sure") { recoverableYears = 1; lostYears = 2; }
  else if (section216Status === "yes_every_year") { recoverableYears = 0; lostYears = 0; }

  const totalRecoverable = annualRefundOpportunity * recoverableYears;
  const totalLost = annualRefundOpportunity * lostYears;

  const reasoningChain: NrlsResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";

  // GATE 1 — Canadian resident
  if (residencyStatus === "canadian_resident") {
    reasoningChain.push({ layer: "Gate 1 — Residency", outcome: "Canadian resident — Part XIII non-resident withholding does not apply. Rental income taxed under normal T1 system (net rental income at graduated rates).", resolved: true });
    status = "NOT_APPLICABLE_CANADIAN";
    statusLabel = "NOT APPLICABLE — CANADIAN RESIDENT";
  }

  // GATE 2 — Uncertain residency
  if (status === null && residencyStatus === "uncertain") {
    reasoningChain.push({ layer: "Gate 1 — Residency", outcome: "Residency status uncertain — must establish first. Canadian tax residency under common law tests (ordinarily resident, secondary ties, 183-day sojourner rule).", resolved: true });
    status = "UNCERTAIN_RESIDENCY";
    statusLabel = "UNCERTAIN — CANADIAN RESIDENCY NEEDS REVIEW";
  }

  // GATE 3 — Non-resident + no withholding applied
  if (status === null && withholdingStatus === "no_full_rent") {
    reasoningChain.push({ layer: "Gate 2 — Withholding compliance", outcome: "Non-resident receiving GROSS rent without Part XIII withholding. If no agent, TENANT is personally liable under s215 for unwithheld tax + penalties. Landlord also exposed for unreported income.", resolved: true });
    reasoningChain.push({ layer: "Cashflow math", outcome: `Gross rent ${cad(grossRentMidpoint)} — no withholding currently. Landlord receives full rent but Canadian tax eventually due on net income via Section 216 (~${cad(section216Tax)} based on estimated expenses ${cad(expensesMidpoint)}).`, resolved: true });
    status = "UNDER_WITHHOLDING_RISK";
    statusLabel = "UNDER-WITHHOLDING — COMPLIANCE RISK (BOTH PARTIES)";
  }

  // GATE 4 — Non-resident + 25% gross + no Section 216
  if (status === null && (withholdingStatus === "yes_25_percent" || withholdingStatus === "yes_treaty_rate") && section216Status === "no_never") {
    reasoningChain.push({ layer: "Gate 2 — Withholding in place", outcome: `25% gross withholding applied: ${cad(withholding)} withheld on ${cad(grossRentMidpoint)} gross rent.`, resolved: true });
    reasoningChain.push({ layer: "Gate 3 — Section 216 refund opportunity", outcome: `Never filed Section 216. Actual tax on net income (~${cad(netRentalIncome)}) would be ~${cad(section216Tax)}. Annual refund opportunity: ${cad(annualRefundOpportunity)}. Recoverable via Section 216 for ${recoverableYears} past years (within 2-year window) = ${cad(totalRecoverable)}. Additional ${lostYears} earlier years (~${cad(totalLost)}) permanently lost — statute expired.`, resolved: true });
    status = "OVER_WITHHOLDING_NO_216";
    statusLabel = "OVER-WITHHOLDING — NO SECTION 216 FILED";
  }

  // GATE 5 — Non-resident + Section 216 filed some years (partial)
  if (status === null && (withholdingStatus === "yes_25_percent" || withholdingStatus === "yes_treaty_rate") && (section216Status === "some_years" || section216Status === "not_sure")) {
    reasoningChain.push({ layer: "Gate 3 — Section 216 partial history", outcome: `Some Section 216 returns filed; others missed. Confirm which years still within 2-year window and file any missed-but-recoverable returns immediately. ~${cad(annualRefundOpportunity)}/year potential refund.`, resolved: true });
    status = "PARTIAL_216_HISTORY";
    statusLabel = "PARTIAL SECTION 216 HISTORY — CONFIRM RECOVERABLE YEARS";
  }

  // GATE 6 — Non-resident + Section 216 filed annually + no NR6
  if (status === null && section216Status === "yes_every_year" && nr6Status === "no_25_gross") {
    reasoningChain.push({ layer: "Gate 3 — Section 216 filed annually", outcome: `Section 216 filed every year — over-withholding recovered at year-end. ~${cad(annualRefundOpportunity)}/year refund received annually.`, resolved: true });
    reasoningChain.push({ layer: "Gate 4 — NR6 opportunity", outcome: `No NR6 pre-approval — withholding applied on 25% gross basis. Monthly cashflow drag: ~${cad(Math.round(withholding / 12))}/month during the year, reconciled at year-end. NR6 approval would shift withholding to estimated net basis — eliminates cashflow drag.`, resolved: true });
    status = "NR6_OPPORTUNITY";
    statusLabel = "NR6 OPPORTUNITY — REDUCE MONTHLY WITHHOLDING";
  }

  // GATE 7 — Fully optimised
  if (status === null && section216Status === "yes_every_year" && nr6Status === "yes_approved") {
    reasoningChain.push({ layer: "Gate 4 — Fully optimised", outcome: "NR6 approved + Section 216 filed annually — cashflow preserved during year + over-withholding reconciled at year-end. Standard optimal structure in place.", resolved: true });
    status = "COMPLIANT_OPTIMISED";
    statusLabel = "COMPLIANT AND OPTIMISED — MAINTAIN ANNUAL CADENCE";
  }

  // Fallback
  if (status === null) {
    status = "OVER_WITHHOLDING_NO_216";
    statusLabel = "OVER-WITHHOLDING — REVIEW STRUCTURE";
    reasoningChain.push({ layer: "Fallback", outcome: "Inputs suggest over-withholding scenario — detailed review recommended.", resolved: true });
  }

  const isOverWithholding = status === "OVER_WITHHOLDING_NO_216" || status === "PARTIAL_216_HISTORY" || status === "NR6_OPPORTUNITY";
  const hasRefundOpportunity = isOverWithholding && annualRefundOpportunity > 500;
  const isComplianceRisk = status === "UNDER_WITHHOLDING_RISK";

  // Routing
  const routes: Route[] = [];
  if (status === "OVER_WITHHOLDING_NO_216" || status === "PARTIAL_216_HISTORY" || status === "NR6_OPPORTUNITY") {
    routes.push({ label: "Canada Departure Tax Trap — s128.1 exposure", href: "/can/check/departure-tax-trap", note: "If you left Canada with non-registered investments" });
    routes.push({ label: "Tax Treaty Navigator — destination country position", href: "/nomad/check/tax-treaty-navigator", note: "How your rental interacts with destination country tax" });
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Confirm current residency position" });
  } else if (status === "UNDER_WITHHOLDING_RISK") {
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "Cross-check any other Canadian tax exposure" });
    routes.push({ label: "Tax Treaty Navigator", href: "/nomad/check/tax-treaty-navigator", note: "Remediation under treaty provisions" });
  } else if (status === "UNCERTAIN_RESIDENCY") {
    routes.push({ label: "183-Day Rule Reality Check — Canadian residency", href: "/nomad/check/183-day-rule", note: "Establish Canadian tax residency position first" });
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "Related departure tax regime" });
  } else {
    routes.push({ label: "Canada Departure Tax Trap", href: "/can/check/departure-tax-trap", note: "Complementary departure tax analysis" });
    routes.push({ label: "Tax Treaty Navigator", href: "/nomad/check/tax-treaty-navigator", note: "Destination country treaty interaction" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    residencyStatus, hasAgent, grossRent, annualExpenses, withholdingStatus, section216Status, nr6Status,
    grossRentMidpoint, expensesMidpoint, netRentalIncome, withholding, section216Tax,
    annualRefundOpportunity, recoverableYears, totalRecoverable, lostYears, totalLost,
    status, statusLabel,
    isOverWithholding, hasRefundOpportunity, isComplianceRisk,
    reasoningChain, routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcNrls(answers);

  const headline = (() => {
    if (result.status === "OVER_WITHHOLDING_NO_216") return `25% of your Canadian gross rent is being withheld by your property manager or tenant — approximately ${cad(result.withholding)}/year on ${GROSS_RENT_LABEL[result.grossRent]} gross rent. Actual tax on your net rental income is only about ${cad(result.section216Tax)}. Annual over-withholding: ${cad(result.annualRefundOpportunity)}. Section 216 return can recover this — but only for the last 2 years (~${cad(result.totalRecoverable)}). ~${cad(result.totalLost)} from earlier years is permanently forfeited.`;
    if (result.status === "PARTIAL_216_HISTORY") return `You have filed Section 216 in some years but not all. Any missed year within the 2-year window can still be filed to recover ~${cad(result.annualRefundOpportunity)}/year. Years beyond 2 years are forfeited. Confirm with CRA which years are still recoverable and file immediately.`;
    if (result.status === "NR6_OPPORTUNITY") return `You are filing Section 216 annually and recovering over-withholding — good baseline compliance. The next optimisation is NR6 pre-approval: CRA authorises your agent to withhold on estimated NET rather than 25% gross, eliminating monthly cashflow drag. Instead of ${cad(Math.round(result.withholding / 12))}/month withheld, it becomes approximately ${cad(Math.round(result.section216Tax / 12))}/month.`;
    if (result.status === "UNDER_WITHHOLDING_RISK") return `You are receiving full Canadian rent without Part XIII withholding applied. If no property manager is involved, your tenant is personally liable under section 215 for 25% of the rent (~${cad(result.withholding)}/year) plus penalties. You are also exposed for unreported Canadian-source income. The fix: engage a property manager (transfers withholding responsibility) or proactively file + pay Canadian tax going forward.`;
    if (result.status === "COMPLIANT_OPTIMISED") return `You have NR6 pre-approval + Section 216 filing in place — the standard optimal structure for non-resident landlords. Withholding is on estimated net basis; Section 216 reconciles annually. Maintain this cadence and update NR6 estimates annually.`;
    if (result.status === "NOT_APPLICABLE_CANADIAN") return `You are a Canadian tax resident — Part XIII withholding and Section 216 do not apply. Your rental income is taxed under the standard T1 system (net rental income at graduated rates on Form T776). Most of this auditor's machinery is not relevant to your position.`;
    if (result.status === "UNCERTAIN_RESIDENCY") return `Your Canadian tax residency status is uncertain — resolving this is the first step. Canadian residency tests: ordinarily resident + secondary ties (home, spouse, dependants, drivers licence, health card); 183-day sojourner rule; continuing ties from prior residency. The outcome determines whether Part XIII applies.`;
    return `Your non-resident rental position requires review — inputs do not map cleanly to a single scenario.`;
  })();

  const consequences: string[] = [];

  if (result.status === "OVER_WITHHOLDING_NO_216") {
    consequences.push(`🔒 Annual over-withholding ~${cad(result.annualRefundOpportunity)} — paid to CRA on gross rent rather than net income. Section 216 refund is the recovery mechanism.`);
    consequences.push(`Recoverable via Section 216 (last 2 years within window): ~${cad(result.totalRecoverable)}. Forfeited (earlier years beyond 2-year window): ~${cad(result.totalLost)}.`);
    consequences.push(`Immediate action: prepare Section 216 return (T1159) for the most recent tax year before the 30 June deadline. If already past 30 June, you have until 2 years from end of tax year — but file ASAP; refund processing 8-16 weeks.`);
    consequences.push(`Apply for NR6 going forward: reduces withholding to estimated net basis, eliminating the cashflow drag. Submit form NR6 with your agent before the next tax year begins.`);
    consequences.push(`Allowable expenses under Section 216: mortgage interest, property tax, insurance, management fees, repairs, advertising, utilities, professional fees, CCA (with recapture consideration).`);
    consequences.push(`CCA optimisation: claiming Capital Cost Allowance reduces annual Section 216 tax but creates recapture on eventual sale. Plan based on hold horizon.`);
    consequences.push(`Engagement recommendation: Canadian tax professional with non-resident rental experience. Typical fee $500-$2,000 per Section 216 return. ROI strong at this income level.`);
  } else if (result.status === "PARTIAL_216_HISTORY") {
    consequences.push(`Partial history — some years filed, others missed. CRA can confirm which years were received.`);
    consequences.push(`For missed years within 2-year window: file Section 216 returns immediately to recover ~${cad(result.annualRefundOpportunity)} per year.`);
    consequences.push(`For missed years beyond 2-year window: refund permanently lost. No remediation path.`);
    consequences.push(`Action: contact CRA International Tax Services or authorise your accountant via Form T1013 to pull filing history. Then file any missed-but-recoverable returns.`);
    consequences.push(`Going forward: commit to annual Section 216 filing by 30 June following year-end. Consider NR6 for cashflow.`);
  } else if (result.status === "NR6_OPPORTUNITY") {
    consequences.push(`✓ Section 216 filing in place — annual reconciliation recovering over-withholding.`);
    consequences.push(`NR6 upgrade opportunity: eliminates monthly cashflow drag of ${cad(Math.round(result.withholding / 12))}/month by shifting withholding to estimated net basis (~${cad(Math.round(result.section216Tax / 12))}/month).`);
    consequences.push(`NR6 application: complete form with agent; submit to CRA before start of tax year. Processing 4-8 weeks; approval typically valid for one tax year (renew annually).`);
    consequences.push(`Section 216 still required at year-end to reconcile actual expenses with estimated amounts.`);
    consequences.push(`Cashflow benefit: retain ~${cad(result.annualRefundOpportunity)} of cashflow during the year instead of awaiting refund. Over 5 years: ~${cad(result.annualRefundOpportunity * 5)} improved working capital position.`);
  } else if (result.status === "UNDER_WITHHOLDING_RISK") {
    consequences.push(`🔒 Compliance risk — Part XIII withholding not being applied. Both landlord and tenant/agent exposed.`);
    consequences.push(`Tenant liability: under section 215, tenant must withhold 25% from rent paid to non-resident landlord where no agent is involved. Failure = tenant personally liable for 25% of rent received + penalties + interest.`);
    consequences.push(`Landlord liability: rental income is Canadian-source; must be reported. Failure to report = unreported income, penalties, potential VDP remediation.`);
    consequences.push(`Fix options: (a) engage property manager (transfers withholding responsibility to agent); (b) proactively file + pay Canadian tax; (c) Voluntary Disclosure Program if multi-year non-compliance.`);
    consequences.push(`If no withholding for prior years: landlord may owe tax without having the 25% already held by CRA. Cashflow impact of catching up can be material.`);
    consequences.push(`Immediate action: Canadian tax specialist within 30 days. Assess exposure + remediation pathway.`);
  } else if (result.status === "COMPLIANT_OPTIMISED") {
    consequences.push(`✓ Optimal structure in place: NR6 + annual Section 216 filing.`);
    consequences.push(`Maintenance items: (a) NR6 renewal each year with updated estimates; (b) Section 216 return by 30 June following year-end; (c) retain all expense documentation 6 years.`);
    consequences.push(`Consider CCA optimisation: reduces annual tax but creates recapture on sale. Strategic choice based on hold horizon.`);
    consequences.push(`Monitor for future sale: Canadian real estate disposal by non-resident requires Section 116 certificate pre-closing to reduce 25% gross withholding. Engage specialist 3-4 months before expected sale.`);
    consequences.push(`Annual review: destination country tax treatment + treaty position may shift; re-assess annually.`);
  } else if (result.status === "NOT_APPLICABLE_CANADIAN") {
    consequences.push(`Standard Canadian T1 system applies: net rental income taxed at graduated federal + provincial rates.`);
    consequences.push(`Form T776 (Statement of Real Estate Rentals) filed with your T1 return annually.`);
    consequences.push(`Allowable expenses: same as under Section 216 for non-residents.`);
    consequences.push(`If you subsequently cease Canadian residency: Part XIII rules immediately apply — this auditor becomes relevant.`);
  } else if (result.status === "UNCERTAIN_RESIDENCY") {
    consequences.push(`Residency determination is the prerequisite — test under common law factors + 183-day rule.`);
    consequences.push(`Common law tests: ordinarily resident test (most weighty), secondary ties (home, spouse, dependants, drivers licence, health card, bank accounts, social connections), 183-day sojourner rule.`);
    consequences.push(`If Canadian resident: standard T1 system; not affected by Part XIII.`);
    consequences.push(`If non-resident: Part XIII 25% gross withholding applies; Section 216 + NR6 are available optimisation tools.`);
    consequences.push(`If part-year resident: proration applies for year of becoming or ceasing residency; special rules in year of change.`);
    consequences.push(`Engage Canadian tax professional with international expertise to document position + file correctly.`);
  }

  const statusClass = result.isComplianceRisk ? "text-red-700" : (result.isOverWithholding ? "text-amber-700" : (result.status === "COMPLIANT_OPTIMISED" ? "text-emerald-700" : result.status === "UNCERTAIN_RESIDENCY" ? "text-amber-700" : "text-emerald-700"));
  const panelClass  = result.isComplianceRisk ? "border-red-200 bg-red-50" : (result.isOverWithholding ? "border-amber-200 bg-amber-50" : (result.status === "COMPLIANT_OPTIMISED" ? "border-emerald-200 bg-emerald-50" : result.status === "UNCERTAIN_RESIDENCY" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"));

  const confidence: ConfidenceLevel = result.status === "UNCERTAIN_RESIDENCY" ? "LOW" : "HIGH";
  const confidenceNote = result.status === "UNCERTAIN_RESIDENCY"
    ? "Residency determination required before rental analysis is reliable."
    : "Part XIII + Section 216 outcome determined deterministically by your rental + withholding profile.";

  // Tier selection
  const tier2Triggers = [
    result.grossRent === "over_60k",
    result.grossRent === "30k_to_60k",
    result.section216Status === "no_never",
    result.section216Status === "some_years",
    result.nr6Status === "no_25_gross",
    result.withholdingStatus === "no_full_rent",
    result.annualExpenses === "over_30k",
    result.isComplianceRisk,
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "Annual withholding (25% gross)",       value: result.withholding > 0 ? cad(result.withholding) : "$0",                                                               highlight: result.isOverWithholding },
      { label: "Actual tax on net (~Section 216)",       value: result.section216Tax > 0 ? cad(result.section216Tax) : "$0"                                                                                                   },
      { label: "Annual refund opportunity",                 value: result.annualRefundOpportunity > 0 ? cad(result.annualRefundOpportunity) : "$0",                                      highlight: result.annualRefundOpportunity >= 1000 },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My Rental System — $147 →" : "Get My Rental Withholding Fix — $67 →",
    altTierLabel: tier === 147 ? "Just want the fix plan? — $67 instead" : "Want the full system + NR6 + disposal pathway? — $147",
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
    id: "residency_status", step: 1, type: "button_group",
    label: "Are you a non-resident of Canada?",
    subLabel: "Part XIII withholding applies to non-residents. Canadian residents pay tax under the normal T1 system.",
    options: [
      { label: "Yes — living outside Canada",                 value: "non_resident",        subLabel: "Part XIII applies" },
      { label: "No — Canadian resident",                       value: "canadian_resident",   subLabel: "Normal T1 system" },
      { label: "Uncertain — split time between countries",      value: "uncertain",            subLabel: "Residency review needed" },
    ],
    required: true,
  },
  {
    id: "has_agent", step: 2, type: "button_group",
    label: "Do you have a property manager or agent?",
    subLabel: "Agent handles withholding + NR4. Tenant-direct puts withholding obligation on the tenant (s215) — most tenants unaware.",
    options: [
      { label: "Yes — agent manages the property",      value: "yes_agent",           subLabel: "Agent handles withholding" },
      { label: "No — tenant pays me directly",            value: "no_tenant_direct",    subLabel: "Tenant legally required to withhold" },
      { label: "Mixed — some properties have agents",       value: "mixed",                subLabel: "Per-property position varies" },
    ],
    required: true,
  },
  {
    id: "gross_rent", step: 3, type: "button_group",
    label: "Annual gross rental income (CAD)",
    subLabel: "Withholding base is gross rent. Section 216 allows deduction of expenses for net-basis tax.",
    options: [
      { label: "Under $12,000",              value: "under_12k",       subLabel: "Small rental — small absolute refund" },
      { label: "$12,000-$30,000",            value: "12k_to_30k",     subLabel: "Typical single property" },
      { label: "$30,000-$60,000",             value: "30k_to_60k",     subLabel: "Larger single or multi-property" },
      { label: "Over $60,000",                  value: "over_60k",        subLabel: "Material withholding + refund position" },
    ],
    required: true,
  },
  {
    id: "annual_expenses", step: 4, type: "button_group",
    label: "Estimated annual allowable expenses",
    subLabel: "Mortgage interest, property tax, insurance, repairs, management fees, utilities. Determines Section 216 net income.",
    options: [
      { label: "Under $5,000",                 value: "under_5k",        subLabel: "Low-expense rental (paid off, no mgmt)" },
      { label: "$5,000-$15,000",                 value: "5k_to_15k",     subLabel: "Typical condo/townhouse" },
      { label: "$15,000-$30,000",                 value: "15k_to_30k",    subLabel: "Property with mortgage interest" },
      { label: "Over $30,000",                     value: "over_30k",       subLabel: "High-expense / high-cost property" },
    ],
    required: true,
  },
  {
    id: "withholding_status", step: 5, type: "button_group",
    label: "Are you currently having tax withheld?",
    subLabel: "Withholding compliance is common gap. Confirm via NR4 slip or bank statements (rent received should equal gross minus withholding).",
    options: [
      { label: "Yes — agent deducts 25% before paying me",            value: "yes_25_percent",    subLabel: "Standard Part XIII compliance" },
      { label: "Yes — but at reduced treaty rate",                       value: "yes_treaty_rate",   subLabel: "Treaty-reduced withholding" },
      { label: "No — receiving full rent (withholding not applied)",     value: "no_full_rent",      subLabel: "Compliance risk for both parties" },
      { label: "Not sure",                                                value: "unsure",             subLabel: "Review NR4 + bank records" },
    ],
    required: true,
  },
  {
    id: "section_216_status", step: 6, type: "button_group",
    label: "Have you filed a Section 216 return?",
    subLabel: "Section 216 recovers over-withholding. 2-year filing window from end of tax year — miss it and refund is permanently lost.",
    options: [
      { label: "Yes — filed every year",                         value: "yes_every_year",   subLabel: "Good baseline compliance" },
      { label: "No — never filed",                                  value: "no_never",         subLabel: "Major refund opportunity + loss" },
      { label: "Filed some years but not all",                       value: "some_years",      subLabel: "Recover missed years within 2-year window" },
      { label: "Not sure what Section 216 is",                        value: "not_sure",         subLabel: "Structural review needed" },
    ],
    required: true,
  },
  {
    id: "nr6_status", step: 7, type: "button_group",
    label: "Have you submitted an NR6 form to reduce withholding?",
    subLabel: "NR6 pre-approval shifts withholding from 25% gross to estimated net basis — eliminates annual cashflow drag.",
    options: [
      { label: "Yes — NR6 approved",                                value: "yes_approved",      subLabel: "Optimal structure in place" },
      { label: "No — receiving withholding at 25% gross",            value: "no_25_gross",       subLabel: "Cashflow drag — NR6 opportunity" },
      { label: "Not sure",                                              value: "unsure",             subLabel: "Confirm via agent" },
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

      {/* Logic chain */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Part XIII + Section 216 logic — Income Tax Act (Canada)</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (result.isComplianceRisk ? "bg-red-100" : result.isOverWithholding ? "bg-amber-100" : "bg-emerald-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (result.isComplianceRisk ? "text-red-700" : result.isOverWithholding ? "text-amber-700" : "text-emerald-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (result.isComplianceRisk ? "text-red-700" : result.isOverWithholding ? "text-amber-700" : "text-emerald-700") : "text-neutral-700"}`}>{r.layer}</p>
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

      {/* Refund recovery math */}
      {result.hasRefundOpportunity && result.totalRecoverable > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700">Section 216 recovery — 2-year window</p>
          <p className="font-bold text-emerald-900">
            Recoverable now: {cad(result.totalRecoverable)} (last {result.recoverableYears} {result.recoverableYears === 1 ? "year" : "years"} within window)
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            Annual refund potential: {cad(result.annualRefundOpportunity)}. {result.lostYears > 0 && `Forfeited (beyond 2-year window): ${cad(result.totalLost)}.`} File Section 216 (T1159) immediately to recover within-window years.
          </p>
        </div>
      )}

      {/* Compliance risk visual */}
      {result.isComplianceRisk && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Compliance risk — withholding not applied</p>
          <p className="font-bold text-red-900">
            Tenant/agent liability: ~{cad(result.withholding)}/year unwithheld tax + penalties under s215
          </p>
          <p className="mt-1 text-xs text-red-800">
            Non-resident landlord also exposed for unreported income. Fix: engage property manager OR proactively file + pay Canadian tax. VDP available for multi-year remediation.
          </p>
        </div>
      )}

      {/* Cashflow impact visual for NR6 opportunity */}
      {result.status === "NR6_OPPORTUNITY" && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">NR6 cashflow opportunity</p>
          <p className="font-bold text-amber-900">
            Current: {cad(Math.round(result.withholding / 12))}/month withheld. With NR6: ~{cad(Math.round(result.section216Tax / 12))}/month.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Retain {cad(result.annualRefundOpportunity)}/year cashflow instead of awaiting annual refund. 5-year cashflow benefit: ~{cad(result.annualRefundOpportunity * 5)}.
          </p>
        </div>
      )}

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — related Canadian non-resident engines</p>
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
          <strong className="text-neutral-950">The 2-year Section 216 deadline is absolute.</strong> Refunds not claimed within 2 years of the end of the tax year are permanently lost. Annual filing by 30 June protects the refund position.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific Part XIII exposure + Section 216 refund opportunity</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Recoverable vs forfeited years breakdown (2-year window)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>NR6 pre-approval pathway for future-year withholding reduction</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Allowable expenses checklist for Section 216 preparation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>CCA + recapture planning (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Future disposal Section 116 pathway (tier 2)</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">${verdict.tier} · One-time · Built around your specific Canadian rental position</p>
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

export default function CanNrlsCalculator() {
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
        product_slug: "can-nrls",
        source_path: "/can/check/non-resident-landlord-withholding",
        country_code: "CA", currency_code: "CAD", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          nrls_status: verdict.result.status,
          annual_refund: verdict.result.annualRefundOpportunity,
          total_recoverable: verdict.result.totalRecoverable,
          is_compliance_risk: verdict.result.isComplianceRisk,
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
      body: JSON.stringify({ email, source: "can_nrls", country_code: "CA", site: "taxchecknow" }),
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
    const sid = sessionId || `cannrls_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("can-nrls_residency_status",        String(answers.residency_status      || ""));
    sessionStorage.setItem("can-nrls_has_agent",                 String(answers.has_agent              || ""));
    sessionStorage.setItem("can-nrls_gross_rent",                  String(answers.gross_rent             || ""));
    sessionStorage.setItem("can-nrls_annual_expenses",              String(answers.annual_expenses        || ""));
    sessionStorage.setItem("can-nrls_withholding_status",              String(answers.withholding_status     || ""));
    sessionStorage.setItem("can-nrls_section_216_status",                String(answers.section_216_status   || ""));
    sessionStorage.setItem("can-nrls_nr6_status",                          String(answers.nr6_status           || ""));
    sessionStorage.setItem("can-nrls_annual_refund",                       String(verdict.result.annualRefundOpportunity));
    sessionStorage.setItem("can-nrls_total_recoverable",                    String(verdict.result.totalRecoverable));
    sessionStorage.setItem("can-nrls_nrls_status",                            verdict.result.status);
    sessionStorage.setItem("can-nrls_status",                                  verdict.status);
    sessionStorage.setItem("can-nrls_tier",                                     String(popupTier));

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
          success_url: `${window.location.origin}/can/check/non-resident-landlord-withholding/success/${successPath}`,
          cancel_url: `${window.location.origin}/can/check/non-resident-landlord-withholding`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your rental withholding decision for your Canadian tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your Part XIII + Section 216 assessment by email — free.</p>
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
                    {popupTier === 67 ? "Your Rental Withholding Fix Plan" : "Your Non-Resident Rental System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">Income Tax Act (Canada) Part XIII + s216 + NR6 · CRA · April 2026</p>
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
                      {popupTier === 67 ? "Rental Withholding Fix Plan™" : "Non-Resident Rental System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your specific Part XIII exposure, Section 216 refund opportunity, NR6 pathway, and annual filing obligations."
                        : "Full non-resident rental system: Section 216 return framework, NR6 approval roadmap, CCA + recapture planning, Section 116 disposal pathway, multi-year cashflow strategy."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic Canadian rental content. Your specific Part XIII position + Section 216 + NR6 pathway.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Rental Fix →" : "Get My Rental System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the fix plan? — $67 instead" : "Want the full rental system? — $147 instead"}
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
                    { label: "Your role", key: "filing_role", options: [["expat_landlord","Canadian expat non-resident landlord"],["immigrant_investor","Non-resident investor with Canadian rental"],["departing_soon","Preparing to leave Canada with rental"],["recovery_years","Multi-year refund recovery"],["advisor","Canadian tax professional"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["deadline_approaching","30 June deadline approaching"],["nr6_prep","Preparing NR6 for next year"],["multi_year_catch_up","Catching up multi-year filings"],["cra_letter","CRA letter / compliance enquiry"],["planning","General planning"]] },
                    { label: "Do you have a Canadian tax advisor?", key: "accountant", options: [["cpa_international","Yes — CPA with non-resident rental expertise"],["general_cpa","Yes — general Canadian CPA"],["property_manager","Property manager handles it"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · CRA non-resident rental (Part XIII + s216)</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.totalRecoverable >= 2000 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Section 216 refund recoverable</p>
              <p className="text-sm font-bold text-neutral-950">
                {cad(verdict.result.totalRecoverable)} · 2-year deadline
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
