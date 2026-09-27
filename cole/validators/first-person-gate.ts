// cole/validators/first-person-gate.ts — F45. The pack is a report, not a chat reply.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// WHAT WENT WRONG
//
// Three sold us-expat-tax packs contain sentences like:
//
//   "Without knowing your income level or the foreign tax rate where you reside, I cannot
//    calculate a specific savings figure for you."
//
// Measured in the live `assessments` rows on 2026-09-27: `annualTaxSaving` in both healed rows,
// `ftcCalculation` in the tier-67 row, `exposureAmount` in a third. Every one of them is TRUE — the
// inputs really were missing when those rows were written — and every one of them is the wrong
// voice. The buyer paid for a document about their situation and got a first-person apology from an
// assistant, inside a PDF-printable pack with their name at the top.
//
// The prompt caused it. It says, correctly, "say plainly that you do not have the figure" — and
// says nothing about WHOSE voice the document is in, so the model answered as itself.
//
// ── WHY A LINT AND NOT JUST A PROMPT LINE ────────────────────────────────────────────────────
//
// The prompt line is the fix; this is the thing that notices when the fix is edited away, or when
// first-person phrasing arrives through the other door — a corpus route. The corpus is injected into
// the prompt verbatim and the model imitates its register, so one "I would need to know your…" in a
// hand-authored corpus teaches the voice back in. 49 corpus routes, all editable by hand.
//
// It does NOT lint model OUTPUT. Output is not ours to gate at generate time (it does not exist
// yet), and a row already written is a content decision — see the heal path.
//
// ── THE SELF-REFERENCE PROBLEM, AND HOW IT WAS AVOIDED ───────────────────────────────────────
//
// The first version of the prompt rule quoted the constructions it forbade, and this gate failed
// the build on the rule itself — correctly. Rather than exempt it, the rule was rephrased to ban
// the first person without spelling any of it out, which is better prompt writing anyway: naming
// the bad phrasing hands the model the exact words to reach for.
//
// `COPY-LINT-ALLOW` stays for the case that genuinely needs it. The marker is deliberately ugly and
// greppable: every exemption is visible in one search, which a silent allow-list never is.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Corpus fields whose whole PURPOSE is to quote somebody else, where first person is correct.
 *
 * Measured, not guessed: the census over all 49 corpus routes flagged exactly three lines, and all
 * three are quotations the product exists to refute —
 *
 *   "question": "What if I cannot afford to repay the loan?"            (the customer's own words)
 *   "ai_says":  "ChatGPT says: I live abroad so I cannot be UK resident" (the wrong answer, quoted)
 *
 * An `ai_says` that did NOT speak in the first person would be the suspicious one. Exempting these
 * keys structurally is honest; making three authors add a marker to correct text is not, and would
 * have failed their next build for a rule about a different product's defect.
 */
export const QUOTING_KEYS: readonly string[] = ["question", "ai_says", "quote", "customer_says", "myth"];

/** Is this line the value of a key that exists to quote someone? */
function isQuotedField(line: string): boolean {
  return QUOTING_KEYS.some((k) => new RegExp(`["']${k}["']\\s*\\s*:`).test(line));
}

/** A line carrying this marker is exempt. Ugly on purpose — `grep COPY-LINT-ALLOW` lists them all. */
export const ALLOW_MARKER = "COPY-LINT-ALLOW";

/**
 * First-person phrasing that must never reach the model as an example to imitate.
 *
 * Only INABILITY and OPINION constructions, which are the ones that turn a report into a chat
 * reply. Deliberately NOT a blanket ban on the word "I": corpus text quoting legislation or a
 * taxpayer declaration ("I declare that…") is legitimate and common.
 */
export const FIRST_PERSON_PATTERNS: ReadonlyArray<{ rule: string; re: RegExp }> = [
  { rule: "first-person-inability", re: /\bI\s+(?:cannot|can't|can not|am unable to|don't have|do not have|would need|need to know)\b/i },
  { rule: "first-person-opinion", re: /\bI\s+(?:think|believe|recommend|suggest|assume|would say)\b/i },
  { rule: "assistant-voice", re: /\b(?:as an AI|I'm an AI|I am an AI|as a language model)\b/i },
];

export interface FirstPersonFinding {
  file: string;
  line: number;
  rule: string;
  text: string;
}

/** Scan one file's text. Pure — takes the content, so it is testable without a filesystem. */
export function scanText(file: string, content: string): FirstPersonFinding[] {
  const out: FirstPersonFinding[] = [];
  const lines = content.split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    if (line.includes(ALLOW_MARKER)) continue;
    if (isQuotedField(line)) continue;
    for (const { rule, re } of FIRST_PERSON_PATTERNS) {
      if (re.test(line)) {
        out.push({ file, line: i + 1, rule, text: line.trim().slice(0, 160) });
        break;
      }
    }
  }
  return out;
}

/**
 * The surfaces that reach the model: the prompt builder, and the product's own corpus route.
 *
 * `productId` narrows the corpus to the one product being generated — a build must not fail on some
 * other product's corpus, which its author has not been asked to fix.
 */
export function surfacesFor(repoRoot: string, productId?: string): string[] {
  const files: string[] = [];
  const prompt = path.join(repoRoot, "lib", "assess-core.ts");
  if (fs.existsSync(prompt)) files.push(prompt);
  if (productId) {
    const corpus = path.join(repoRoot, "app", "api", "rules", productId, "route.ts");
    if (fs.existsSync(corpus)) files.push(corpus);
  }
  return files;
}

export class FirstPersonGateError extends Error {
  constructor(public readonly findings: FirstPersonFinding[]) {
    super(
      `first-person voice in ${findings.length} place(s) — the pack is a report, not a chat reply:\n` +
      findings.map((f) => `   ${path.basename(f.file)}:${f.line}  [${f.rule}]  ${f.text}`).join("\n") +
      `\n   Rewrite in the document's voice ("the figure is not available here" / "work it out as follows"),` +
      `\n   or mark a genuinely-quoted line with ${ALLOW_MARKER}.`,
    );
    this.name = "FirstPersonGateError";
  }
}

/** THROWS on any finding. Called by cole-generate alongside the SEO gate. */
export function assertNoFirstPerson(repoRoot: string, productId?: string): void {
  const findings: FirstPersonFinding[] = [];
  for (const f of surfacesFor(repoRoot, productId)) {
    findings.push(...scanText(f, fs.readFileSync(f, "utf8")));
  }
  if (findings.length) throw new FirstPersonGateError(findings);
}
