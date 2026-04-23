"use client";

/**
 * UK-03 — MTD Digital Link Compliance Engine (formerly Digital Link Auditor)
 * Pattern: D (GateTest — process validation at every step of record-keeping chain)
 *
 * Core question: Does this taxpayer's record-keeping process break MTD's digital link
 * requirement — and at which specific step?
 *
 * Key facts (HMRC confirmed April 2026):
 *   Legal anchor: Income Tax (Digital Requirements) Regulations 2021, SI 2021/1076
 *   Digital link = automated electronic transfer of data with NO manual intervention
 *   Any manual copy/paste, retyping, or figure adjustment BREAKS the digital link
 *   Spreadsheets are permitted but require HMRC-approved bridging software
 *   Paper records do not qualify at all
 *   Submission via approved software is necessary but NOT sufficient — the whole chain must be digital
 *   Penalty regime: £200 initial + £10/day up to 90 days per missed quarter (same as MTD late-filing)
 *   Max annual exposure: £4,400 if all 4 quarters rejected as non-compliant
 *
 * MTD mandation dates:
 *   April 2026: gross income over £50,000
 *   April 2027: gross income over £30,000
 *   April 2028: gross income over £20,000
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;
type ComplianceStatus = "COMPLIANT" | "AT_RISK" | "NON_COMPLIANT";

interface DigitalLinkResult {
  recordKeeping: string;
  dataFlow: string;
  bridging: string;
  manualAdjustments: string;
  complianceStatus: ComplianceStatus;
  breakStep: number | null;            // which step breaks the chain (1-4), null if compliant
  breakPoint: string;                  // description of the break
  requiredFix: string;                 // what needs to change
  hmrcRequirement: string;             // what HMRC requires at that step
  perQuarterPenaltyMax: number;
  annualPenaltyMax: number;
  spreadsheetGap: boolean;
}

interface VerdictResult {
  status: string;
  statusClass: string;
  panelClass: string;
  headline: string;
  stats: Array<{ label: string; value: string; highlight?: boolean }>;
  consequences: string[];
  chainDiagram?: {
    nodes: Array<{ step: number; label: string; status: "ok" | "risk" | "break" }>;
  };
  confidence: ConfidenceLevel;
  confidenceNote: string;
  tier: Tier;
  ctaLabel: string;
  altTierLabel: string;
  productKey67: string;
  productKey147: string;
  result: DigitalLinkResult;
}

interface PopupAnswers {
  entity_type: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — HMRC confirmed April 2026
// ─────────────────────────────────────────────────────────────────────────────

const PENALTY_INITIAL = 200;
const PENALTY_DAILY = 10;
const PENALTY_MAX_DAYS = 90;
const PER_QUARTER_PENALTY_MAX = PENALTY_INITIAL + PENALTY_DAILY * PENALTY_MAX_DAYS;  // £1,100
const ANNUAL_PENALTY_MAX = PER_QUARTER_PENALTY_MAX * 4;                              // £4,400

const PRODUCT_KEYS = {
  p67:  "uk_67_digital_link_auditor",
  p147: "uk_147_digital_link_auditor",
};

function formatGBP(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

// ─────────────────────────────────────────────────────────────────────────────
// CALC ENGINE — digital link chain validation
// ─────────────────────────────────────────────────────────────────────────────

function calcDigitalLink(answers: AnswerMap): DigitalLinkResult {
  const recordKeeping     = String(answers.record_keeping || "spreadsheets");
  const dataFlow          = String(answers.data_flow || "manual_copy_paste");
  const bridging          = String(answers.bridging || "no_submit_direct");
  const manualAdjustments = String(answers.manual_adjustments || "sometimes");

  const spreadsheetGap = recordKeeping === "spreadsheets" && bridging !== "yes";

  let complianceStatus: ComplianceStatus = "COMPLIANT";
  let breakStep: number | null = null;
  let breakPoint = "";
  let requiredFix = "";
  let hmrcRequirement = "";

  // Hard-break conditions (NON-COMPLIANT)
  if (recordKeeping === "paper") {
    complianceStatus = "NON_COMPLIANT";
    breakStep = 1;
    breakPoint = "Step 1 — paper records do not meet MTD digital record requirements at all.";
    hmrcRequirement = "Records must be kept in digital form from the moment a transaction occurs. Paper-only records cannot be reconstructed into a compliant digital chain after the fact.";
    requiredFix = "Migrate to HMRC-approved software (QuickBooks, Xero, FreeAgent, Sage) OR to spreadsheets with bridging software. Cannot continue with paper.";
  } else if (dataFlow === "manual_copy_paste") {
    complianceStatus = "NON_COMPLIANT";
    breakStep = 2;
    breakPoint = "Step 2 — manual copy/paste between systems breaks the digital link requirement.";
    hmrcRequirement = "Data transfer between systems must be automated — via direct integration, API, or approved bridging software. Any manual copy/paste step fails the digital link test.";
    requiredFix = "Replace manual copy/paste with either (a) integrated software where records and submission are the same system, or (b) HMRC-approved bridging software that connects your spreadsheet directly to submission.";
  } else if (manualAdjustments === "regularly") {
    complianceStatus = "NON_COMPLIANT";
    breakStep = 4;
    breakPoint = "Step 4 — regular manual adjustment of figures between systems breaks the digital link.";
    hmrcRequirement = "Figures recorded at source must flow through to submission without manual alteration. Any change must happen AT SOURCE and flow through, not be adjusted in transit.";
    requiredFix = "Make all corrections at the source record level, not between systems. If you currently adjust after export, update your source records instead so the automated chain carries the correct numbers.";
  } else if (recordKeeping === "spreadsheets" && bridging === "no_submit_direct") {
    complianceStatus = "NON_COMPLIANT";
    breakStep = 3;
    breakPoint = "Step 3 — submitting directly from spreadsheet without bridging software fails MTD.";
    hmrcRequirement = "Spreadsheets are permitted for record-keeping, but submission to HMRC must go through either HMRC-approved software or HMRC-approved bridging software. Direct copy-to-submission does not qualify.";
    requiredFix = "Add HMRC-approved bridging software between your spreadsheet and the HMRC portal. Bridging tools cost £5-15/month and connect your spreadsheet to HMRC automatically.";
  }
  // AT-RISK conditions (ambiguous or partial breaks)
  else if (dataFlow === "accountant_unknown" || manualAdjustments === "accountant_unknown") {
    complianceStatus = "AT_RISK";
    breakStep = dataFlow === "accountant_unknown" ? 2 : 4;
    breakPoint = `Step ${breakStep} — your accountant handles this step but you do not know how. The digital link obligation is yours, not theirs — you need to verify.`;
    hmrcRequirement = "Under SI 2021/1076, the digital link obligation sits with the taxpayer, not the agent. If your accountant breaks the chain (manual entry into their software), you are the one exposed to penalties.";
    requiredFix = "Ask your accountant directly: 'How does data move from my records to the submission?' If the answer includes any manual step, the chain is broken and you need to discuss fix options.";
  } else if (recordKeeping === "spreadsheets" && bridging === "not_sure") {
    complianceStatus = "AT_RISK";
    breakStep = 3;
    breakPoint = "Step 3 — you are uncertain whether your submission path uses bridging software. This usually means it does not.";
    hmrcRequirement = "Bridging software is a specific category of HMRC-approved software. If you do not know what you are using, you are likely submitting manually from your spreadsheet — which is non-compliant.";
    requiredFix = "Check your submission workflow: if you open HMRC's website and type figures in manually, you have no bridging. Evaluate HMRC-approved bridging tools or migrate to approved software.";
  } else if (manualAdjustments === "sometimes") {
    complianceStatus = "AT_RISK";
    breakStep = 4;
    breakPoint = "Step 4 — occasional manual adjustments create a partial break. HMRC does not accept 'occasional' under MTD.";
    hmrcRequirement = "The digital link requirement is absolute — there is no threshold for 'acceptable' manual intervention. Even occasional adjustments break the chain for that submission.";
    requiredFix = "Eliminate manual adjustments entirely. If you need to correct figures, correct them at source in your records, not between systems. Establish a discipline of 'source-only corrections'.";
  } else if (recordKeeping === "mix" && manualAdjustments !== "never") {
    complianceStatus = "AT_RISK";
    breakStep = 1;
    breakPoint = "Step 1 — mixed record-keeping systems with any manual intervention creates break risk at handoff points.";
    hmrcRequirement = "Where records are split across multiple systems (e.g. Xero for business + spreadsheet for rental), the handoff between those systems must also be a digital link.";
    requiredFix = "Consolidate onto a single approved software platform, OR ensure each system feeds into the submission path via its own digital link (software + bridging for spreadsheet).";
  }
  // COMPLIANT paths (explicit)
  else if (recordKeeping === "digital_software" && dataFlow === "integrated" && manualAdjustments === "never") {
    complianceStatus = "COMPLIANT";
    breakPoint = "None detected — your process appears digitally linked end-to-end.";
    hmrcRequirement = "HMRC-approved software handling records and submission with no manual intervention satisfies the digital link requirement under SI 2021/1076.";
    requiredFix = "No fix required. Verify annually — software updates or workflow changes can introduce breaks.";
  } else if (recordKeeping === "spreadsheets" && bridging === "yes" && manualAdjustments === "never") {
    complianceStatus = "COMPLIANT";
    breakPoint = "None detected — your spreadsheet + bridging software chain is digitally linked.";
    hmrcRequirement = "Spreadsheets with HMRC-approved bridging software and no manual data transfer satisfy the digital link requirement. Most common compliant setup for small businesses.";
    requiredFix = "No fix required. Keep bridging software current and check for HMRC-approved status at each tax year.";
  } else if (dataFlow === "automated_export_import" && manualAdjustments === "never") {
    complianceStatus = "COMPLIANT";
    breakPoint = "None detected — automated export/import between systems with no manual intervention is a valid digital link.";
    hmrcRequirement = "Automated file-based transfer (e.g. CSV export auto-imported by receiving system) qualifies as a digital link provided there is no manual re-entry or adjustment.";
    requiredFix = "No fix required. Verify the import process runs automatically and without human adjustment each quarter.";
  } else {
    // Default to AT_RISK for uncovered combinations
    complianceStatus = "AT_RISK";
    breakStep = 2;
    breakPoint = "Your combination of answers suggests partial compliance — the specific break point needs a direct process review.";
    hmrcRequirement = "Each step of the chain must be a digital link. Without knowing exactly how data moves between your systems, HMRC compliance cannot be confirmed.";
    requiredFix = "Document every data transfer in your quarterly cycle. If any step requires a human to type, copy, or adjust a figure, that step is the break.";
  }

  return {
    recordKeeping,
    dataFlow,
    bridging,
    manualAdjustments,
    complianceStatus,
    breakStep,
    breakPoint,
    requiredFix,
    hmrcRequirement,
    perQuarterPenaltyMax: PER_QUARTER_PENALTY_MAX,
    annualPenaltyMax: ANNUAL_PENALTY_MAX,
    spreadsheetGap,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT LOGIC
// ─────────────────────────────────────────────────────────────────────────────

function calcVerdict(answers: AnswerMap): VerdictResult {
  const result = calcDigitalLink(answers);

  const nodes: VerdictResult["chainDiagram"] = {
    nodes: [
      { step: 1, label: "Records", status: result.breakStep === 1 ? "break" : (result.complianceStatus === "AT_RISK" && result.breakStep === 1) ? "risk" : "ok" },
      { step: 2, label: "Data flow", status: result.breakStep === 2 ? (result.complianceStatus === "AT_RISK" ? "risk" : "break") : "ok" },
      { step: 3, label: "Bridging", status: result.breakStep === 3 ? (result.complianceStatus === "AT_RISK" ? "risk" : "break") : "ok" },
      { step: 4, label: "Submission", status: result.breakStep === 4 ? (result.complianceStatus === "AT_RISK" ? "risk" : "break") : "ok" },
    ],
  };

  // ── NON-COMPLIANT ─────────────────────────────────────────────────────────
  if (result.complianceStatus === "NON_COMPLIANT") {
    return {
      status: `NON-COMPLIANT — DIGITAL LINK BROKEN AT STEP ${result.breakStep}`,
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Your record-keeping process breaks MTD digital link rules at ${result.breakPoint.split("—")[0].trim()} HMRC can reject submissions made through this process as non-compliant and apply the same penalty regime as late filing — up to ${formatGBP(result.perQuarterPenaltyMax)} per quarter, ${formatGBP(result.annualPenaltyMax)}/year.`,
      stats: [
        { label: "Compliance status", value: "NON-COMPLIANT", highlight: true },
        { label: "Break step", value: `Step ${result.breakStep} of 4`, highlight: true },
        { label: "Max annual penalty", value: formatGBP(result.annualPenaltyMax), highlight: true },
      ],
      consequences: [
        `🔒 ${result.breakPoint}`,
        `🔒 HMRC requirement at this step: ${result.hmrcRequirement}`,
        `🔒 Penalty exposure: rejected quarterly submissions treated as unsubmitted — £${PENALTY_INITIAL} initial + £${PENALTY_DAILY}/day up to ${PENALTY_MAX_DAYS} days = up to ${formatGBP(result.perQuarterPenaltyMax)} per missed/rejected quarter. Four quarters = up to ${formatGBP(result.annualPenaltyMax)}/year.`,
        `🔓 Fix required: ${result.requiredFix}`,
        `Under SI 2021/1076 the digital link obligation is absolute — there is no "mostly compliant" or "minor break" treatment. A submission made through a broken chain can be treated as not made for penalty purposes.`,
        `Enforcement has been phased and lenient during rollout, but follows the VAT MTD precedent — where digital link failures became the primary audit trigger once mandation landed. Fix the process before mandation, not after a compliance notice.`,
      ],
      chainDiagram: nodes,
      confidence: "HIGH",
      confidenceNote: "Digital link requirement is statutory under Income Tax (Digital Requirements) Regulations 2021 (SI 2021/1076). Enforcement follows VAT MTD precedent.",
      tier: 147,
      ctaLabel: "Get My Compliance Fix Plan — £147 →",
      altTierLabel: "Just want the audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── AT RISK ──────────────────────────────────────────────────────────────
  if (result.complianceStatus === "AT_RISK") {
    return {
      status: `AT RISK — POTENTIAL BREAK AT STEP ${result.breakStep}`,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `Your process has a potential digital link break at ${result.breakPoint.split("—")[0].trim()} — review needed before MTD mandation hits your income band. Unclear or occasional breaks create audit exposure that turns into penalty exposure once enforcement kicks in.`,
      stats: [
        { label: "Compliance status", value: "AT RISK", highlight: true },
        { label: "Issue at", value: `Step ${result.breakStep} of 4`, highlight: true },
        { label: "Max annual penalty", value: formatGBP(result.annualPenaltyMax) },
      ],
      consequences: [
        `⚠ ${result.breakPoint}`,
        `HMRC requirement: ${result.hmrcRequirement}`,
        `Required action: ${result.requiredFix}`,
        `"At risk" means HMRC could find a break on audit. The digital link requirement is absolute — there is no tolerance for "occasional" manual intervention. Fix it before your mandate date, not after.`,
        `Penalty exposure if HMRC rejects submissions: up to ${formatGBP(result.perQuarterPenaltyMax)} per quarter, ${formatGBP(result.annualPenaltyMax)}/year.`,
        `If your accountant is involved: confirm exactly how data flows. Your obligation as the taxpayer is not discharged by an agent using manual processes — the break is still your break.`,
      ],
      chainDiagram: nodes,
      confidence: "MEDIUM",
      confidenceNote: "Ambiguity in the process chain means full audit would need to verify each step directly. Resolve the uncertain step for compliance confidence.",
      tier: 147,
      ctaLabel: "Get My Compliance Review — £147 →",
      altTierLabel: "Just want the audit? — £67 instead",
      productKey67: PRODUCT_KEYS.p67, productKey147: PRODUCT_KEYS.p147,
      result,
    };
  }

  // ── COMPLIANT ────────────────────────────────────────────────────────────
  return {
    status: "COMPLIANT — NO DIGITAL LINK BREAK DETECTED",
    statusClass: "text-emerald-700",
    panelClass: "border-emerald-200 bg-emerald-50",
    headline: `Your record-keeping process appears digitally linked end-to-end — no break detected in the four-step chain. Under MTD you are on the compliant path. Annual verification is recommended as software updates and workflow changes can introduce breaks over time.`,
    stats: [
      { label: "Compliance status", value: "COMPLIANT ✓" },
      { label: "Break points", value: "0 / 4" },
      { label: "Penalty exposure", value: formatGBP(0) },
    ],
    consequences: [
      "Your process passes the digital link test at all four steps: records are digital, data flows without manual intervention, bridging (if needed) is in place, and figures are not manually adjusted between systems.",
      "Under SI 2021/1076 this chain satisfies the digital link requirement. Submissions made through this process are not at risk of rejection for non-compliance.",
      "Annual verification recommended: software updates, new apps, accountant changes, or workflow additions can introduce breaks. Most breaks appear when someone adds a new system (rental app, time-tracker, invoicing tool) that requires manual re-entry into the main records.",
      "When MTD mandation reaches your income band (April 2026 for £50k+, 2027 for £30k+, 2028 for £20k+), your current process should carry through without change — the requirement is the same.",
      "What to watch: if your accountant changes, or you migrate software providers, re-verify the chain. Breaks during transitions are the most common cause of first-year failures.",
    ],
    chainDiagram: nodes,
    confidence: "HIGH",
    confidenceNote: "Compliance confirmed based on stated process. Annual review recommended — digital link chains can break silently during software migrations or process changes.",
    tier: 67,
    ctaLabel: "Get My Compliance Confirmation — £67 →",
    altTierLabel: "Want the full process audit too? — £147",
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
    id: "record_keeping", step: 1, type: "button_group",
    label: "How do you currently keep your income and expense records?",
    subLabel: "MTD requires records to be kept in digital form from the point of transaction.",
    options: [
      { label: "Digital software only (Xero, QuickBooks, FreeAgent, Sage)", value: "digital_software", subLabel: "Approved software — compliance starts here" },
      { label: "Spreadsheets (Excel, Google Sheets)",                        value: "spreadsheets",    subLabel: "Permitted if bridged to submission" },
      { label: "Mix of software and spreadsheets",                           value: "mix",             subLabel: "Handoff between systems must also be digital" },
      { label: "Paper / manual records",                                      value: "paper",           subLabel: "Does not meet MTD requirements" },
    ],
    required: true,
  },
  {
    id: "data_flow", step: 2, type: "button_group",
    label: "How does data move from your records to your MTD submission?",
    subLabel: "The data transfer step is the most common digital link break point.",
    options: [
      { label: "Directly through integrated software (no manual step)", value: "integrated",              subLabel: "Records and submission are the same system" },
      { label: "I export from one system and import to another (automated)", value: "automated_export_import", subLabel: "Automated file-based transfer qualifies" },
      { label: "I copy figures manually between systems",               value: "manual_copy_paste",       subLabel: "Breaks the digital link — non-compliant" },
      { label: "My accountant handles it — I am not sure",              value: "accountant_unknown",      subLabel: "Your obligation to verify, not theirs" },
    ],
    required: true,
  },
  {
    id: "bridging", step: 3, type: "button_group",
    label: "Do you use bridging software to connect spreadsheets to HMRC?",
    subLabel: "HMRC-approved bridging software is required for any spreadsheet-to-submission path.",
    options: [
      { label: "Yes — HMRC-approved bridging software",                value: "yes",                subLabel: "Compliant path for spreadsheet users" },
      { label: "No — I submit directly from my spreadsheet",            value: "no_submit_direct",   subLabel: "Non-compliant if using spreadsheets" },
      { label: "No — I do not use spreadsheets",                        value: "no_no_spreadsheets", subLabel: "Fine if you use approved software" },
      { label: "Not sure what bridging software is",                    value: "not_sure",           subLabel: "Usually means you are not using it" },
    ],
    required: true,
  },
  {
    id: "manual_adjustments", step: 4, type: "button_group",
    label: "Do you manually adjust any figures between your records and your submission?",
    subLabel: "Manual adjustment anywhere in the chain breaks the digital link — even occasional ones.",
    options: [
      { label: "Never — data flows automatically",         value: "never",                subLabel: "Compliant — figures flow unchanged" },
      { label: "Sometimes — minor adjustments",             value: "sometimes",            subLabel: "Breaks the chain for that submission" },
      { label: "Yes — I regularly adjust figures manually", value: "regularly",            subLabel: "Non-compliant — breaks every submission" },
      { label: "My accountant does this — unknown to me",   value: "accountant_unknown",   subLabel: "Your compliance risk, not theirs" },
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

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map(s => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chain diagram — visual of the 4-step digital chain */}
      {verdict.chainDiagram && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-4">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your digital link chain</p>
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {verdict.chainDiagram.nodes.map((n, i) => (
              <div key={n.step} className="flex flex-1 items-center">
                <div className={`flex w-full flex-col items-center rounded-xl border-2 px-2 py-3 text-center ${
                  n.status === "ok" ? "border-emerald-200 bg-emerald-50"
                  : n.status === "risk" ? "border-amber-300 bg-amber-50"
                  : "border-red-300 bg-red-50"
                }`}>
                  <span className={`font-mono text-xs font-bold ${
                    n.status === "ok" ? "text-emerald-700"
                    : n.status === "risk" ? "text-amber-700"
                    : "text-red-700"
                  }`}>
                    {n.status === "ok" ? "✓" : n.status === "risk" ? "⚠" : "✗"}
                  </span>
                  <p className="mt-1 text-[10px] font-semibold text-neutral-700">{n.label}</p>
                  <p className="text-[9px] text-neutral-400">Step {n.step}</p>
                </div>
                {i < verdict.chainDiagram!.nodes.length - 1 && (
                  <div className={`mx-1 h-0.5 flex-shrink-0 w-2 sm:w-4 ${
                    verdict.chainDiagram!.nodes[i].status === "ok" && verdict.chainDiagram!.nodes[i + 1].status === "ok"
                      ? "bg-emerald-300" : "bg-red-300"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Break point detail */}
      {verdict.result.breakStep !== null && (
        <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1.5">⚠ Where your chain breaks</p>
          <p className="text-base font-bold text-red-900 leading-tight mb-2">
            {verdict.result.breakPoint}
          </p>
          <div className="space-y-2 text-xs">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-0.5">HMRC requires</p>
              <p className="text-red-800 leading-relaxed">{verdict.result.hmrcRequirement}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-0.5">Fix required</p>
              <p className="text-red-800 leading-relaxed">{verdict.result.requiredFix}</p>
            </div>
          </div>
        </div>
      )}

      {/* Penalty exposure */}
      {verdict.result.complianceStatus !== "COMPLIANT" && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Penalty exposure if HMRC rejects submissions</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Initial penalty per rejected quarter</span>
              <span className="font-mono text-red-700">£{PENALTY_INITIAL}</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Daily penalty thereafter</span>
              <span className="font-mono text-red-700">£{PENALTY_DAILY} / day (up to {PENALTY_MAX_DAYS} days)</span>
            </div>
            <div className="flex justify-between border-b border-neutral-100 pb-1">
              <span className="text-neutral-600">Max per quarter</span>
              <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.perQuarterPenaltyMax)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="font-semibold text-neutral-800">Max annual (all 4 quarters rejected)</span>
              <span className="font-mono font-bold text-red-700">{formatGBP(verdict.result.annualPenaltyMax)}</span>
            </div>
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
          <strong className="text-neutral-950">Digital link is absolute.</strong> There is no "mostly compliant" under SI 2021/1076. A single manual copy/paste step anywhere in the chain makes the whole submission non-compliant. Most people don&apos;t know this — and most accountants assume you know.
        </p>
      </div>

      <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What&apos;s in your personalised plan</p>
        <ul className="space-y-1 text-xs text-neutral-700">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact chain break point (if any) with HMRC citation</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Bridging software comparison for your current record-keeping system</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Step-by-step fix plan with timeline and cost estimate</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Penalty exposure calculation for your income band</span></li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>5 accountant questions specific to your break point</span></li>
        </ul>
      </div>

      <button onClick={() => onCheckout(verdict.tier)} disabled={loading}
        className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
        {loading ? "Loading…" : verdict.ctaLabel}
      </button>
      <p className="mt-2 text-center text-xs text-neutral-400">£{verdict.tier} · One-time · Built around your exact process break</p>
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

export default function DigitalLinkAuditorCalculator() {
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
        product_slug: "digital-link-auditor",
        source_path: "/uk/check/digital-link-auditor",
        country_code: "UK", currency_code: "GBP", site: "taxchecknow",
        inputs: answers,
        output: {
          status: verdict.status,
          compliance_status: verdict.result.complianceStatus,
          break_step: verdict.result.breakStep,
          break_point: verdict.result.breakPoint,
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
      body: JSON.stringify({ email, source: "digital_link_auditor", country_code: "UK", site: "taxchecknow" }),
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
    const sid = sessionId || `dla_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    sessionStorage.setItem("digital-link-auditor_record_keeping", String(answers.record_keeping || ""));
    sessionStorage.setItem("digital-link-auditor_data_flow", String(answers.data_flow || ""));
    sessionStorage.setItem("digital-link-auditor_bridging", String(answers.bridging || ""));
    sessionStorage.setItem("digital-link-auditor_manual_adjustments", String(answers.manual_adjustments || ""));
    sessionStorage.setItem("digital-link-auditor_compliance_status", verdict.result.complianceStatus);
    sessionStorage.setItem("digital-link-auditor_break_step", String(verdict.result.breakStep ?? 0));
    sessionStorage.setItem("digital-link-auditor_break_point", verdict.result.breakPoint);
    sessionStorage.setItem("digital-link-auditor_status", verdict.status);
    sessionStorage.setItem("digital-link-auditor_tier", String(popupTier));

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
          success_url: `${window.location.origin}/uk/check/digital-link-auditor/success/${successPath}`,
          cancel_url: `${window.location.origin}/uk/check/digital-link-auditor`,
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
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your digital link audit for your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your compliance status and break points by email — free.</p>
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
                    {popupTier === 67 ? "Your Digital Link Audit Pack" : "Your Digital Link Fix Plan"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">HMRC-referenced · SI 2021/1076 · April 2026</p>
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
                      {popupTier === 67 ? "Digital Link Audit Pack™" : "Digital Link Fix Plan™"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "Your exact chain break point, HMRC citation, penalty exposure calculation, and 5 accountant questions — built for your current record-keeping setup."
                        : "Full fix plan: bridging software selection, migration sequencing, process documentation, accountant coordination brief, and post-fix verification checklist."}
                    </p>
                  </div>
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">£{popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a generic MTD checklist. Your specific break point and exact fix.</p>
                  </div>
                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Show My Audit →" : "Get My Fix Plan →"}
                  </button>
                  <p className="text-center mt-2">
                    <button onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the audit? — £67 instead" : "Want the full fix plan? — £147 instead"}
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
                    { label: "Business structure", key: "entity_type", options: [["sole_trader","Sole trader / self-employed"],["landlord","Landlord (property only)"],["director","Company director with rental"],["both","Self-employed + landlord"]] },
                    { label: "How urgent is this?", key: "urgency", options: [["acting_now","Acting before 6 April 2026"],["planning","Planning 12 months out"],["just_checking","Just checking my position"]] },
                    { label: "Do you have an accountant?", key: "accountant", options: [["accountant","Yes — accountant"],["adviser","Yes — financial adviser"],["both","Both"],["no","No — managing myself"]] },
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
      {showVerdict && verdict && verdict.result.complianceStatus !== "COMPLIANT" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Break at step {verdict.result.breakStep}</p>
              <p className="text-sm font-bold text-neutral-950">
                Up to {formatGBP(verdict.result.annualPenaltyMax)}/yr penalty exposure
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
