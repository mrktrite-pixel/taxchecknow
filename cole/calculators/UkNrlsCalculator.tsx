"use client";

/**
 * NOMAD-06 — UK Non-Resident Landlord Scheme Auditor
 * Pattern: 6-step determination -> NRLS status + withholding estimate
 *
 * Legal anchor: Income Tax Act 2007 Part 15 Chapter 2 + SI 1995/2902
 *
 * DETERMINATION ORDER:
 *   1. Is usual abode outside UK? (NRLS scope)
 *      - inside UK -> NRLS does not apply (UK resident landlord)
 *      - unclear   -> specialist advice needed
 *   2. Has HMRC approved gross payment via NRL1/2/3?
 *      - yes -> GROSS_PAYMENT_APPROVED (no withholding; SA still required)
 *   3. Letting agent used?
 *      - yes + no NRL1 -> WITHHOLDING_APPLIES_NOT_REGISTERED (20% deducted)
 *      - no agent -> check weekly rent
 *   4. No agent + weekly rent over £100/week + no NRL1
 *      -> TENANT_WITHHOLDING_RISK
 *   5. No agent + weekly rent under £100/week
 *      -> BELOW_THRESHOLD_NO_WITHHOLDING
 *   6. Filing history not current -> COMPLIANCE_RISK_NOT_FILING overlay
 */

import { useState, useRef, useEffect, useMemo } from "react";

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type Status =
  | "UK_RESIDENT_NOT_NRLS"
  | "UNCLEAR_USUAL_ABODE"
  | "GROSS_PAYMENT_APPROVED"
  | "WITHHOLDING_APPLIES_NOT_REGISTERED"
  | "TENANT_WITHHOLDING_RISK"
  | "BELOW_THRESHOLD_NO_WITHHOLDING"
  | "COMPLIANCE_RISK_NOT_FILING";

interface Route {
  label: string;
  href: string;
  note: string;
}

interface NRLSResult {
  usualAbode:      string;
  hasAgent:         string;
  weeklyRent:       string;
  grossApproved:    string;
  filingCurrent:    string;
  annualIncome:     string;

  incomeMidpoint:   number;
  withheldAnnual:   number;
  netAnnual:        number;

  status:           Status;
  statusLabel:      string;
  isWithholdingApplied: boolean;
  isNonResident:    boolean;
  complianceRisk:   boolean;

  reasoningChain:   Array<{ layer: string; outcome: string; resolved: boolean }>;
  routes:           Route[];
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
  result: NRLSResult;
}

interface PopupAnswers {
  filing_role: string;
  urgency: string;
  accountant: string;
}

const PRODUCT_KEYS = {
  p67:  "nomad_67_uk_nrls",
  p147: "nomad_147_uk_nrls",
};

const INCOME_MIDPOINT: Record<string, number> = {
  under_12570:      8000,
  "12570_to_25000": 18785,
  "25000_to_50000": 37500,
  over_50000:       75000,
};

const INCOME_LABEL: Record<string, string> = {
  under_12570:      "Under £12,570",
  "12570_to_25000": "£12,570–£25,000",
  "25000_to_50000": "£25,000–£50,000",
  over_50000:       "Over £50,000",
};

const WEEKLY_RENT_LABEL: Record<string, string> = {
  under_100:   "Under £100/week",
  "100_to_500": "£100-£500/week",
  over_500:    "Over £500/week",
  varies:      "Multiple properties — varies",
};

function gbp(n: number): string {
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function calcNRLS(answers: AnswerMap): NRLSResult {
  const usualAbode     = String(answers.usual_abode     || "outside");
  const hasAgent       = String(answers.has_agent        || "yes");
  const weeklyRent     = String(answers.weekly_rent      || "100_to_500");
  const grossApproved  = String(answers.gross_approved   || "no");
  const filingCurrent  = String(answers.filing_current   || "no");
  const annualIncome   = String(answers.annual_income    || "25000_to_50000");

  const incomeMidpoint = INCOME_MIDPOINT[annualIncome] ?? 37500;

  const reasoningChain: NRLSResult["reasoningChain"] = [];

  let status: Status | null = null;
  let statusLabel = "";
  let isWithholdingApplied = false;
  let isNonResident = true;

  // LAYER 1 — usual abode / NRLS scope
  if (usualAbode === "inside") {
    reasoningChain.push({ layer: "Layer 1 — NRLS scope", outcome: "Usual place of abode inside UK — NRLS does not apply to UK-resident landlords", resolved: true });
    status = "UK_RESIDENT_NOT_NRLS";
    statusLabel = "NRLS DOES NOT APPLY — UK-RESIDENT LANDLORD";
    isNonResident = false;
  } else if (usualAbode === "unclear") {
    reasoningChain.push({ layer: "Layer 1 — NRLS scope", outcome: "Usual place of abode unclear — specialist determination needed before NRLS applies", resolved: true });
    status = "UNCLEAR_USUAL_ABODE";
    statusLabel = "UNCLEAR — USUAL PLACE OF ABODE NEEDS DETERMINATION";
  } else {
    reasoningChain.push({ layer: "Layer 1 — NRLS scope", outcome: "Usual place of abode outside UK — NRLS applies", resolved: false });
  }

  // LAYER 2 — NRL1/2/3 gross payment approval
  if (status === null) {
    if (grossApproved === "yes_approved") {
      reasoningChain.push({ layer: "Layer 2 — NRL1 approval", outcome: "HMRC has approved gross payment under NRL1/NRL2/NRL3 — no withholding applies", resolved: true });
      status = "GROSS_PAYMENT_APPROVED";
      statusLabel = "GROSS PAYMENT APPROVED — NO WITHHOLDING";
      isWithholdingApplied = false;
    } else if (grossApproved === "applied_awaiting") {
      reasoningChain.push({ layer: "Layer 2 — NRL1 approval", outcome: "Application submitted but approval not yet confirmed — withholding continues until approval", resolved: false });
    } else {
      reasoningChain.push({ layer: "Layer 2 — NRL1 approval", outcome: "No NRL1 approval in place — withholding default applies", resolved: false });
    }
  }

  // LAYER 3 — letting agent / tenant withholding
  if (status === null) {
    if (hasAgent === "yes" || hasAgent === "mixed") {
      reasoningChain.push({ layer: "Layer 3 — Agent withholding", outcome: "Letting agent used without NRL1 approval — agent legally required to withhold 20% basic rate from gross rent", resolved: true });
      status = "WITHHOLDING_APPLIES_NOT_REGISTERED";
      statusLabel = "WITHHOLDING APPLIES — NOT REGISTERED FOR NRL1";
      isWithholdingApplied = true;
    } else {
      reasoningChain.push({ layer: "Layer 3 — Agent withholding", outcome: "No letting agent — agent withholding does not apply; check tenant threshold", resolved: false });

      if (weeklyRent === "100_to_500" || weeklyRent === "over_500" || weeklyRent === "varies") {
        reasoningChain.push({ layer: "Layer 4 — Tenant threshold", outcome: "No agent + weekly rent exceeds £100 — tenant has legal obligation to withhold 20% and remit to HMRC", resolved: true });
        status = "TENANT_WITHHOLDING_RISK";
        statusLabel = "TENANT WITHHOLDING RISK — THRESHOLD EXCEEDED";
        isWithholdingApplied = true;
      } else if (weeklyRent === "under_100") {
        reasoningChain.push({ layer: "Layer 4 — Tenant threshold", outcome: "No agent + weekly rent under £100 threshold — no withholding obligation; SA filing still required", resolved: true });
        status = "BELOW_THRESHOLD_NO_WITHHOLDING";
        statusLabel = "BELOW £100/WEEK THRESHOLD — NO WITHHOLDING";
        isWithholdingApplied = false;
      }
    }
  }

  // LAYER 5 — compliance overlay (filing history)
  const complianceRisk = (filingCurrent === "no" || filingCurrent === "partial");
  if (complianceRisk && status !== "UK_RESIDENT_NOT_NRLS" && status !== "UNCLEAR_USUAL_ABODE") {
    reasoningChain.push({ layer: "Layer 5 — Compliance overlay", outcome: "SA filing history not current — NRL1 approval blocked until HMRC compliance remediated; prior years may need Let Property Campaign disclosure", resolved: true });
    // Overlay compliance risk on top of existing status — flag via complianceRisk boolean, not by overriding status
  }

  // Fallback
  if (status === null) {
    status = "WITHHOLDING_APPLIES_NOT_REGISTERED";
    statusLabel = "WITHHOLDING APPLIES — NOT REGISTERED FOR NRL1";
    isWithholdingApplied = true;
  }

  const withheldAnnual = isWithholdingApplied ? Math.round(incomeMidpoint * 0.20) : 0;
  const netAnnual = incomeMidpoint - withheldAnnual;

  // Routing
  const routes: Route[] = [];
  if (status === "UK_RESIDENT_NOT_NRLS") {
    routes.push({ label: "UK Allowance Sniper — UK resident analysis", href: "/uk/check/allowance-sniper", note: "UK-resident landlord — standard rental tax rules apply" });
    routes.push({ label: "UK Statutory Residence Test Auditor", href: "/nomad/check/uk-residency", note: "Confirm SRT status if residency is uncertain" });
  } else if (status === "UNCLEAR_USUAL_ABODE") {
    routes.push({ label: "UK Statutory Residence Test Auditor — start here", href: "/nomad/check/uk-residency", note: "Confirm SRT non-residence — usual abode almost always aligns" });
    routes.push({ label: "183-Day Rule Reality Check", href: "/nomad/check/183-day-rule", note: "Cross-country residency test to anchor usual abode" });
  } else {
    routes.push({ label: "UK Statutory Residence Test Auditor", href: "/nomad/check/uk-residency", note: "Confirm SRT non-residence underpins your NRLS position" });
    routes.push({ label: "Tax Treaty Navigator — personal allowance claim", href: "/nomad/check/tax-treaty-navigator", note: "Check treaty personal allowance (£12,570) eligibility" });
    routes.push({ label: "UK Allowance Sniper — expense strategy", href: "/uk/check/allowance-sniper", note: "Mortgage interest restriction + allowable expenses" });
  }
  routes.push({ label: "← Back to Nomad Residency Risk Index", href: "/nomad", note: "Reclassify with updated answers" });

  return {
    usualAbode, hasAgent, weeklyRent, grossApproved, filingCurrent, annualIncome,
    incomeMidpoint, withheldAnnual, netAnnual,
    status,
    statusLabel,
    isWithholdingApplied,
    isNonResident,
    complianceRisk,
    reasoningChain,
    routes,
  };
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcNRLS(answers);

  const headline = (() => {
    if (result.status === "UK_RESIDENT_NOT_NRLS") return `Your usual place of abode is inside the UK — the Non-Resident Landlord Scheme does not apply. Your UK rental income is taxed under standard UK resident landlord rules (SA105, no source withholding). If your residency position changes, NRLS would be triggered from the date your usual abode moves outside the UK.`;
    if (result.status === "UNCLEAR_USUAL_ABODE") return `Your usual place of abode is unclear — the NRLS turns on this exact test (ITA 2007 Part 15 Ch 2). Before the scheme can be applied correctly, your residency position needs to be confirmed. Start with the UK Statutory Residence Test Auditor — SRT non-residence almost always aligns with NRLS scope.`;
    if (result.status === "GROSS_PAYMENT_APPROVED") return `HMRC has approved gross payment under NRL1/NRL2/NRL3 — your letting agent (or tenant) pays the full rent without deduction. You receive ${gbp(result.incomeMidpoint)} gross annually. Self Assessment is still required: file SA100 + SA105 + SA109, claim allowable expenses, and pay tax on profit at marginal rate.`;
    if (result.status === "WITHHOLDING_APPLIES_NOT_REGISTERED") return `Your letting agent is legally required to withhold 20% basic rate tax from your rent (ITA 2007 Part 15 Ch 2). On ${gbp(result.incomeMidpoint)} annual rent, ${gbp(result.withheldAnnual)} will be deducted before you receive it — leaving you ${gbp(result.netAnnual)} net. The fix is NRL1 gross payment approval: once HMRC approves, full rent resumes and you self-assess annually on profit.`;
    if (result.status === "TENANT_WITHHOLDING_RISK") return `You let directly to a tenant without a letting agent at ${WEEKLY_RENT_LABEL[result.weeklyRent]} — over the £100/week threshold. Your tenant is legally required to withhold 20% from rent (SI 1995/2902) and remit it to HMRC. On ${gbp(result.incomeMidpoint)} annual rent, ${gbp(result.withheldAnnual)} should be withheld — about ${gbp(Math.round(result.withheldAnnual/12))}/month. Most tenants are unaware of this rule. If they do not withhold, HMRC can assess the tenant directly plus penalties. The fix: NRL1 approval (removes obligation) or appoint a letting agent.`;
    if (result.status === "BELOW_THRESHOLD_NO_WITHHOLDING") return `You let directly without a letting agent at ${WEEKLY_RENT_LABEL[result.weeklyRent]} — under the £100/week tenant withholding threshold. No withholding obligation applies under SI 1995/2902. But Self Assessment remains mandatory: file SA100 + SA105 + SA109 annually, declare ${gbp(result.incomeMidpoint)} rent, claim allowable expenses, and pay tax on the resulting profit at your marginal rate.`;
    return `Your UK rental position needs NRLS review. Use the full assessment for status + withholding + NRL1 pathway.`;
  })();

  const consequences: string[] = [];

  if (result.status === "UK_RESIDENT_NOT_NRLS") {
    consequences.push("NRLS does not apply: your UK rental income is taxed under ordinary UK resident landlord rules. SA100 + SA105 annual return; allowable expenses deductible; mortgage interest subject to finance cost restriction.");
    consequences.push("If you subsequently move abroad — the day your usual abode moves outside the UK, NRLS is triggered. Notify your letting agent and apply for NRL1 approval ahead of time to avoid withholding from the first post-move rental cycle.");
    consequences.push("Tenant threshold does not apply to UK-resident landlords — SI 1995/2902 rules only bite once landlord is outside UK.");
    consequences.push("Confirm ongoing residency status annually via the Statutory Residence Test — NRLS alignment is usually (but not always) the same.");
  } else if (result.status === "UNCLEAR_USUAL_ABODE") {
    consequences.push("NRLS application hinges on 'usual place of abode' test — similar but not identical to SRT. Starting point: determine SRT position first.");
    consequences.push("Default position if uncertain: agents typically withhold to protect their own compliance position. If you want gross rent, you need clarity + NRL1 approval.");
    consequences.push("Letting agent liability: if agent withholds from a UK-resident landlord in error, agent may face landlord claim. If agent does NOT withhold from a genuinely non-resident landlord, agent is HMRC-liable. Clarity matters on both sides.");
    consequences.push("SRT test criteria: UK days + automatic tests + sufficient ties — see /nomad/check/uk-residency for full determination.");
  } else if (result.status === "GROSS_PAYMENT_APPROVED") {
    consequences.push(`✓ Gross payment approved — full rent ${gbp(result.incomeMidpoint)} received annually; no tax deducted at source.`);
    consequences.push("Self Assessment still mandatory: file SA100 + SA105 (UK property income) + SA109 (residence pages) annually. Online deadline 31 January following tax year end.");
    consequences.push("Pay tax on rental profit at marginal rate (20%/40%/45%) — profit = gross rent minus allowable expenses (agent fees, insurance, repairs, management, accountancy, ground rent).");
    consequences.push("Mortgage interest finance cost restriction (since 6 April 2020): interest on residential letting NOT deductible as expense for individuals; basic rate (20%) tax reducer instead. Can materially reduce the benefit at higher marginal rates.");
    consequences.push("Treaty personal allowance (£12,570) may be available if you are resident in a UK treaty country with the relevant provision — claim on SA109 with supplementary pages.");
    consequences.push("Annual NRLY statement from letting agent required if agent continues managing — shows zero tax withheld under NRL1 approval; keep for 7-year retention window.");
  } else if (result.status === "WITHHOLDING_APPLIES_NOT_REGISTERED") {
    consequences.push(`🔒 20% of your gross rent deducted at source: ${gbp(result.withheldAnnual)}/year on ${gbp(result.incomeMidpoint)} rent. Net received: ${gbp(result.netAnnual)}/year (${gbp(Math.round(result.netAnnual/12))}/month).`);
    consequences.push("Agent legal obligation: letting agent MUST withhold under ITA 2007 Part 15 Ch 2 unless NRL1 approved. Agent is liable to HMRC for failure — they cannot choose not to withhold.");
    consequences.push("Quarterly HMRC payment: agent pays withheld tax to HMRC each quarter (July, October, January, April). Landlord receives annual NRLY statement showing tax deducted.");
    consequences.push("Self Assessment still required to reconcile: file SA100 + SA105 + SA109, declare full gross rent, claim allowable expenses (likely reducing tax due below withheld amount), credit the NRLY withholding figure — typical outcome is a refund.");
    consequences.push("NRL1 fix: download NRL1 (individual) / NRL2 (company) / NRL3 (trustee) from HMRC; submit to Centre for Non-Residents. Requires UK tax affairs current. Approval typically 4-8 weeks. Once approved, agent pays gross from next rent cycle.");
    if (result.complianceRisk) {
      consequences.push("⚠ Compliance gap — filing history: NRL1 approval requires up-to-date UK tax affairs. Prior unfiled years need remediation first. Let Property Campaign (HMRC's dedicated non-resident rental disclosure) gives reduced penalties vs standard rates. Disclose BEFORE HMRC contact for best terms.");
    }
    consequences.push("Cashflow impact: ~20% of monthly rent held by HMRC for up to 12 months before annual SA reconciliation returns the excess. NRL1 approval eliminates this drag entirely.");
  } else if (result.status === "TENANT_WITHHOLDING_RISK") {
    consequences.push(`🔒 Tenant withholding obligation: at ${WEEKLY_RENT_LABEL[result.weeklyRent]} (over £100/week threshold), your tenant is legally required to withhold 20% basic rate tax and remit to HMRC. Annual withholding: ${gbp(result.withheldAnnual)} on ${gbp(result.incomeMidpoint)} rent.`);
    consequences.push("Tenant awareness gap: most tenants have no knowledge of SI 1995/2902. They will pay full rent to you — and if HMRC later assesses, HMRC pursues the tenant for unpaid tax plus penalties. Creates a two-sided compliance risk you cannot fully control.");
    consequences.push("Your own risk: if the tenant refuses to withhold once informed, your position is complex — landlord is not directly liable for tenant non-withholding, but HMRC may assess the rental income via your SA in any case and seek arrears.");
    consequences.push("Practical fix #1 — NRL1 approval: once HMRC approves gross payment, tenant obligation is removed. Clean solution. Requires UK tax affairs current.");
    consequences.push("Practical fix #2 — appoint a letting agent: moves the withholding obligation to the agent (who is legally bound to comply); tenant is no longer exposed. Agent will still withhold 20% unless/until NRL1 approval in place.");
    consequences.push("Self Assessment required regardless: declare full gross rent, claim allowable expenses, credit any withholding that occurred. Even if no tax withheld by tenant, SA filing is mandatory for UK rental income by non-residents.");
    if (result.complianceRisk) {
      consequences.push("⚠ Compliance gap — filing history: prior unfiled years create NRL1 approval blocker. Let Property Campaign voluntary disclosure route recommended before HMRC contact.");
    }
  } else if (result.status === "BELOW_THRESHOLD_NO_WITHHOLDING") {
    consequences.push(`✓ Below £100/week threshold — no withholding obligation on tenant. Annual rent ${gbp(result.incomeMidpoint)} received in full.`);
    consequences.push("Self Assessment mandatory regardless: file SA100 + SA105 + SA109 annually. Declare gross rent, claim allowable expenses, pay tax on profit at marginal rate.");
    consequences.push("If rent increases over £100/week: threshold crosses — tenant withholding obligation begins. Re-check annually; consider NRL1 in advance if increase is likely.");
    consequences.push("Treaty personal allowance (£12,570): may eliminate tax entirely if you are from a UK treaty country and annual profit under allowance. Claim on SA109.");
    consequences.push("Mortgage interest finance cost restriction applies to any mortgage interest on the property — 20% tax reducer rather than full deduction.");
    if (result.complianceRisk) {
      consequences.push("⚠ Compliance gap — filing history: even below threshold, SA filing is required. Prior unfiled years need Let Property Campaign disclosure.");
    }
  }

  const isNegative = result.status === "WITHHOLDING_APPLIES_NOT_REGISTERED" || result.status === "TENANT_WITHHOLDING_RISK" || result.complianceRisk;
  const statusClass = isNegative ? "text-red-700" : (result.status === "UNCLEAR_USUAL_ABODE" ? "text-amber-700" : "text-emerald-700");
  const panelClass  = isNegative ? "border-red-200 bg-red-50" : (result.status === "UNCLEAR_USUAL_ABODE" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50");

  const confidence: ConfidenceLevel = result.status === "UNCLEAR_USUAL_ABODE" ? "LOW" : "HIGH";
  const confidenceNote = result.status === "UNCLEAR_USUAL_ABODE"
    ? "Usual abode unclear — determine SRT position first; NRLS outcome follows that determination in most cases."
    : "NRLS outcome determined by ITA 2007 Part 15 Ch 2 + SI 1995/2902 deterministic rules applied to your inputs.";

  // Tier selection
  const tier2Triggers = [
    result.status === "WITHHOLDING_APPLIES_NOT_REGISTERED",
    result.status === "TENANT_WITHHOLDING_RISK",
    result.complianceRisk,
    result.annualIncome === "over_50000",
    result.status === "UNCLEAR_USUAL_ABODE",
  ];
  const tier: Tier = tier2Triggers.some(Boolean) ? 147 : 67;

  return {
    status: result.statusLabel,
    statusClass,
    panelClass,
    headline,
    stats: [
      { label: "NRLS position",                value: result.isWithholdingApplied ? "Withholding applies" : "No withholding", highlight: result.isWithholdingApplied },
      { label: "Annual rental income",           value: INCOME_LABEL[result.annualIncome]                                                                         },
      { label: "Annual withholding (est.)",       value: result.isWithholdingApplied ? gbp(result.withheldAnnual) : "£0",         highlight: result.isWithholdingApplied },
    ],
    consequences,
    confidence,
    confidenceNote,
    tier,
    ctaLabel: tier === 147 ? "Get My UK Rental Tax System — £147 →" : "Get My NRLS Fix Plan — £67 →",
    altTierLabel: tier === 147 ? "Just want the fix plan? — £67 instead" : "Want the full system + NRL1 + strategy? — £147",
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
    id: "usual_abode", step: 1, type: "button_group",
    label: "Is your usual place of abode outside the UK?",
    subLabel: "'Usual place of abode' is the NRLS test (ITA 2007 Part 15 Ch 2) — similar to but not identical to the SRT. Someone SRT non-resident is almost always NRLS non-resident.",
    options: [
      { label: "Yes — I live outside the UK",     value: "outside", subLabel: "NRLS applies" },
      { label: "No — I live in the UK",            value: "inside",  subLabel: "NRLS does not apply" },
      { label: "Unclear — split time",              value: "unclear", subLabel: "Determine SRT first" },
    ],
    required: true,
  },
  {
    id: "has_agent", step: 2, type: "button_group",
    label: "Do you use a letting agent to manage your UK property?",
    subLabel: "Letting agent has a statutory withholding obligation (unless NRL1 approved). Direct-to-tenant shifts obligation to tenant if rent over £100/week.",
    options: [
      { label: "Yes — letting agent manages",        value: "yes",   subLabel: "Agent withholds 20% unless NRL1 approved" },
      { label: "No — direct with tenant",              value: "no",    subLabel: "Tenant threshold test applies" },
      { label: "Mixed — some agent some direct",       value: "mixed", subLabel: "Agent-managed portion: agent withholds" },
    ],
    required: true,
  },
  {
    id: "weekly_rent", step: 3, type: "button_group",
    label: "What is the weekly rent?",
    subLabel: "Tenant withholding threshold is £100/week (approx £5,200/year). Above this, tenant must withhold 20% when no letting agent is used.",
    options: [
      { label: "Under £100/week",                        value: "under_100",   subLabel: "Below threshold — no tenant withholding" },
      { label: "£100-£500/week",                          value: "100_to_500",  subLabel: "Over threshold — tenant withholding triggers" },
      { label: "Over £500/week",                           value: "over_500",    subLabel: "Over threshold — tenant withholding triggers" },
      { label: "Multiple properties — varies",              value: "varies",      subLabel: "Any property over £100/week triggers the rule" },
    ],
    showIf: (a) => a.has_agent !== "yes",
    required: true,
  },
  {
    id: "gross_approved", step: 4, type: "button_group",
    label: "Have you applied to HMRC for approval to receive rent gross? (NRL1/NRL2/NRL3)",
    subLabel: "NRL1 = individual; NRL2 = company; NRL3 = trustee. Approval requires UK tax affairs to be up to date.",
    options: [
      { label: "Yes — approved",                       value: "yes_approved",    subLabel: "No withholding applies" },
      { label: "Applied — awaiting",                    value: "applied_awaiting", subLabel: "Withholding continues until approved" },
      { label: "No — never applied",                     value: "no",               subLabel: "Withholding default applies" },
      { label: "Not sure what this is",                   value: "not_sure",          subLabel: "Treated as not applied" },
    ],
    required: true,
  },
  {
    id: "filing_current", step: 5, type: "button_group",
    label: "Is your UK tax compliance up to date?",
    subLabel: "HMRC requires clean filing history before approving NRL1. Prior-year gaps need remediation via Let Property Campaign first.",
    options: [
      { label: "Yes — Self Assessment filed every year",  value: "yes",      subLabel: "NRL1 route unblocked" },
      { label: "Partially — some years filed",              value: "partial", subLabel: "Compliance remediation needed" },
      { label: "No — not been filing",                       value: "no",      subLabel: "Let Property Campaign disclosure required" },
      { label: "Not sure",                                    value: "not_sure", subLabel: "Compliance review needed" },
    ],
    required: true,
  },
  {
    id: "annual_income", step: 6, type: "button_group",
    label: "Annual UK rental income (gross)?",
    subLabel: "Used to estimate annual withholding and evaluate profit-after-expenses tax liability.",
    options: [
      { label: "Under £12,570",            value: "under_12570",     subLabel: "May be covered by personal allowance if treaty applies" },
      { label: "£12,570–£25,000",           value: "12570_to_25000",  subLabel: "Basic rate band" },
      { label: "£25,000–£50,000",           value: "25000_to_50000",  subLabel: "Basic rate approaching higher rate" },
      { label: "Over £50,000",               value: "over_50000",      subLabel: "Higher rate exposure + stronger optimisation need" },
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
  const result = verdict.result;

  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>{verdict.status}</p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      {/* NRLS logic chain — always visible */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">NRLS applied in sequence — ITA 2007 Part 15 Ch 2 + SI 1995/2902</p>
        <div className="space-y-1.5">
          {result.reasoningChain.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 rounded px-2 py-1 ${r.resolved ? (result.isWithholdingApplied ? "bg-red-100" : "bg-emerald-100") : "bg-white"}`}>
              <span className={`shrink-0 mt-0.5 text-[10px] font-mono font-bold ${r.resolved ? (result.isWithholdingApplied ? "text-red-700" : "text-emerald-700") : "text-neutral-500"}`}>{r.resolved ? "✓" : "→"}</span>
              <div className="flex-1">
                <p className={`text-[11px] font-bold ${r.resolved ? (result.isWithholdingApplied ? "text-red-700" : "text-emerald-700") : "text-neutral-700"}`}>{r.layer}</p>
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

      {/* Withholding math visual */}
      {result.isWithholdingApplied && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">NRLS withholding math</p>
          <p className="font-bold text-red-900">
            {gbp(result.incomeMidpoint)} × 20% = {gbp(result.withheldAnnual)} withheld annually
          </p>
          <p className="mt-1 text-xs text-red-800">
            Net received: {gbp(result.netAnnual)}/year ({gbp(Math.round(result.netAnnual/12))}/month). NRL1 approval eliminates this — you receive gross and self-assess annually.
          </p>
        </div>
      )}

      {/* Compliance overlay */}
      {result.complianceRisk && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">⚠ Compliance overlay</p>
          <p className="font-bold text-amber-900">
            SA filing history not current — NRL1 approval blocked until remediated
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Let Property Campaign (HMRC's dedicated non-resident rental disclosure) gives reduced penalties vs standard rates. Disclose BEFORE HMRC contact for best terms.
          </p>
        </div>
      )}

      {/* Routing destinations */}
      {result.routes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">→ Routing — UK rental + NRL1 + cross-check</p>
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
          <strong className="text-neutral-950">NRLS is a statutory default.</strong> Withholding at 20% applies automatically unless HMRC has approved NRL1 gross payment. Self Assessment filing is required regardless of withholding status — for reconciliation and expense claims.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your specific NRLS status with reasoning chain</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Annual withholding estimate with month-by-month cashflow impact</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>NRL1 application pathway with approval criteria</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Allowable expenses checklist with finance cost restriction logic</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Treaty personal allowance eligibility (tier 2)</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Cross-border cashflow + residence country interaction (tier 2)</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">£{verdict.tier} · One-time · Built around your specific NRLS position</p>
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

export default function UkNrlsCalculator() {
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
    // If current step has no visible questions (e.g. step 3 hidden because has_agent=yes), skip forward automatically
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
        product_slug: "uk-nrls",
        source_path: "/nomad/check/uk-nrls",
        country_code: "UK", currency_code: "GBP", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          nrls_status: verdict.result.status,
          is_withholding_applied: verdict.result.isWithholdingApplied,
          withheld_annual: verdict.result.withheldAnnual,
          compliance_risk: verdict.result.complianceRisk,
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
      // Skip back over hidden steps
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
      body: JSON.stringify({ email, source: "uk_nrls", country_code: "UK", site: "taxchecknow" }),
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
    const sid = sessionId || `uknrls_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("uk-nrls_usual_abode",     String(answers.usual_abode     || ""));
    sessionStorage.setItem("uk-nrls_has_agent",        String(answers.has_agent        || ""));
    sessionStorage.setItem("uk-nrls_weekly_rent",       String(answers.weekly_rent      || ""));
    sessionStorage.setItem("uk-nrls_gross_approved",     String(answers.gross_approved   || ""));
    sessionStorage.setItem("uk-nrls_filing_current",      String(answers.filing_current   || ""));
    sessionStorage.setItem("uk-nrls_annual_income",        String(answers.annual_income    || ""));
    sessionStorage.setItem("uk-nrls_withheld_amount",       String(verdict.result.withheldAnnual));
    sessionStorage.setItem("uk-nrls_nrls_status",            verdict.result.status);
    sessionStorage.setItem("uk-nrls_is_withholding_applied",  String(verdict.result.isWithholdingApplied));
    sessionStorage.setItem("uk-nrls_compliance_risk",          String(verdict.result.complianceRisk));
    sessionStorage.setItem("uk-nrls_status",                     verdict.status);
    sessionStorage.setItem("uk-nrls_tier",                        String(popupTier));

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
          success_url: `${window.location.origin}/nomad/check/uk-nrls/success/${successPath}`,
          cancel_url: `${window.location.origin}/nomad/check/uk-nrls`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your NRLS decision for your UK tax advisor.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your rental compliance outcome by email — free.</p>
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
                    {popupTier === 67 ? "Your NRLS Compliance Fix Plan" : "Your UK Rental Tax System"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">ITA 2007 Part 15 Ch 2 · SI 1995/2902 · HMRC · April 2026</p>
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
                      {popupTier === 67 ? "NRLS Compliance Fix Plan™" : "UK Rental Tax System™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your specific NRLS status, annual withholding estimate, NRL1 application pathway, and Self Assessment obligation summary."
                        : "Full UK rental tax strategy: NRL1 approval + expenses optimisation + treaty personal allowance analysis + cross-border cashflow + audit-ready documentation."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">£{popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not generic UK rental content. Your specific NRLS position + NRL1 pathway.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My NRLS Fix →" : "Get My Rental System →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the fix plan? — £67 instead" : "Want the full system? — £147 instead"}
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
                    { label: "Your role", key: "filing_role", options: [["landlord_overseas","Non-resident landlord — letting UK property"],["landlord_returning","Returning UK landlord — reviewing prior years"],["landlord_planning","Planning to move abroad — let property behind"],["advisor","UK tax advisor / accountant"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["hmrc_letter","HMRC letter / compliance enquiry"],["filing_deadline","Self Assessment deadline approaching"],["nrl1_application","Planning NRL1 application"],["planning","General planning"]] },
                    { label: "Do you have a UK tax advisor?", key: "accountant", options: [["icaew_citot","Yes — ICAEW / CIOT / ATT qualified"],["general","Yes — general accountant"],["diy","Self-managed"],["none","No — need one"]] },
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
              <p className="text-center text-[10px] text-neutral-400">Secure checkout via Stripe · TaxCheckNow.com · HMRC NRLS (ITA 2007 Part 15 Ch 2 + SI 1995/2902)</p>
            </div>
          </div>
        </div>
      )}

      {showVerdict && verdict && verdict.result.isWithholdingApplied && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">20% withheld at source</p>
              <p className="text-sm font-bold text-neutral-950">
                {gbp(verdict.result.withheldAnnual)}/year · NRL1 fixes it
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
