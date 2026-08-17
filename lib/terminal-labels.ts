// lib/terminal-labels.ts
//
// D12-B — the NAMES on things, conditioned by the terminal the buyer reached.
//
// WHY THIS EXISTS. W6 and D9 made document BODIES terminal-aware. Their names, descriptions
// and the assessment field labels stayed static config strings, so a buyer whose settlement
// had already passed read this, two lines apart, on a page they paid $147 for:
//
//     File 06 of 8 — Your Pre-Settlement Plan
//     What to do, in order, between now and settlement.
//     Your recovery plan — Your settlement has already happened.
//
// The body was right and the label above it contradicted it. Same for the assessment section
// headed "PRE SETTLEMENT EXECUTION PLAN" on a settled sale, and File 03's description still
// promising wording "for handing over the certificate" after D9 replaced that body with a
// recovery variant.
//
// MECHANISM GENERIC, DATA PER-PRODUCT — the same shape as fact-rules and the presentation map.
// Overrides resolve through the SAME merged flag set the bodies branch on (terminalFlags), so
// a label and the body beneath it cannot disagree about which terminal they are on. First
// matching rule wins; no match ⇒ the config's own string, unchanged. A product with no entry
// is byte-identical to before this file existed.

export interface LabelRule {
  /** Flag from terminalFlags() — state:*, section:* or an engine flag. */
  when: string;
  name?: string;
  desc?: string;
}

/** productId → document slug → ordered rules. First match wins. */
export const DOC_LABELS: Record<string, Record<string, LabelRule[]>> = {
  "frcgw-clearance-certificate": {
    "frcgw-06": [
      {
        when: "section:recovery",
        name: "Your Recovery Plan",
        desc: "Claiming back the amount withheld at settlement.",
      },
      {
        when: "state:have_cert",
        name: "Closing This Sale Out",
        desc: "What to keep, and what to check, now the sale has completed.",
      },
    ],
    "frcgw-03": [
      {
        when: "section:recovery",
        desc: "What still needs requesting from the purchaser's side.",
      },
      {
        when: "state:have_cert",
        desc: "Checking the certificate you provided, and what to keep on file.",
      },
    ],
    "frcgw-01": [
      {
        when: "state:settled",
        desc: "How the 15% was worked out, and what it means now settlement has passed.",
      },
    ],
    "frcgw-02": [
      {
        when: "section:recovery",
        desc: "Kept for reference and for your next sale — nothing to lodge on this one.",
      },
    ],
  },
};

/** productId → assessment field key → ordered rules (only `name` is read). */
export const FIELD_LABELS: Record<string, Record<string, LabelRule[]>> = {
  "frcgw-clearance-certificate": {
    preSettlementExecutionPlan: [
      { when: "section:recovery", name: "Your recovery execution plan" },
      { when: "state:have_cert", name: "Closing this sale out" },
    ],
    // The key is `buyerSolicitorInstruction`, but the fact rules require "purchaser"
    // throughout — the label was the one surface still saying "buyer's solicitor".
    buyerSolicitorInstruction: [
      { when: "section:recovery", name: "What to request from the purchaser's side" },
      { when: "terminal:*", name: "What to send the purchaser's side" },
    ],
    daysToSettlementAnalysis: [
      { when: "state:settled", name: "Where this sale stands now" },
    ],
    certificateProcessingTime: [
      { when: "state:settled", name: "Processing time (for your next sale)" },
    ],
    applicationUrgency: [
      { when: "section:recovery", name: "What is urgent now" },
    ],
    withholdingContingencyPlan: [
      { when: "section:recovery", name: "What happens next with the withheld amount" },
    ],
  },
};

/** `terminal:*` matches whenever any terminal is known — a default that still needs a context. */
function matches(rule: LabelRule, flags: readonly string[]): boolean {
  if (rule.when === "terminal:*") return flags.some((f) => f.startsWith("terminal:"));
  return flags.includes(rule.when);
}

/** Terminal-conditioned name/desc for a document. Falls back to the config's own strings. */
export function resolveDocLabel(
  productId: string,
  slug: string,
  flags: readonly string[],
  fallback: { name: string; desc: string },
): { name: string; desc: string } {
  const rules = DOC_LABELS[productId]?.[slug];
  if (!rules) return fallback;
  let { name, desc } = fallback;
  let gotName = false, gotDesc = false;
  for (const r of rules) {
    if (!matches(r, flags)) continue;
    if (r.name && !gotName) { name = r.name; gotName = true; }
    if (r.desc && !gotDesc) { desc = r.desc; gotDesc = true; }
    if (gotName && gotDesc) break;
  }
  return { name, desc };
}

/** Terminal-conditioned label for an assessment field. Falls back to the humanised key. */
export function resolveFieldLabel(
  productId: string,
  key: string,
  flags: readonly string[],
  fallback: string,
): string {
  for (const r of FIELD_LABELS[productId]?.[key] ?? []) {
    if (matches(r, flags) && r.name) return r.name;
  }
  return fallback;
}
