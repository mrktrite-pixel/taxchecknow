// cole/validators/seo-gate.ts
// ─────────────────────────────────────────────────────────────────────────────
// THE SEO GATE — four rules, checked before any surface is emitted.
//
// WHY A GATE AND NOT A LINT. Four products were probed in September 2026 and
// every one shipped an over-length title and description: au-09 at 93/312,
// uk-01 at 88/319, au-16 at 90/207, au-10 at 88/... Each was found by a human
// reading a page, fixed by hand, and the next product repeated it. A warning
// would have been ignored the same way. This refuses to emit.
//
// THE RULES, and why each is drawn where it is:
//   metaTitle       <= 65   Google truncates around 600px; 65 characters is the
//                           conventional proxy. Longer titles still index, they
//                           just get cut mid-phrase in the SERP.
//   metaDescription 120-155 Under 120 wastes the snippet; over 155 is truncated.
//                           This is the only TWO-SIDED rule — a short
//                           description is a real defect, not a safe default.
//   h1              <= 70   Not a ranking limit; a readability one. au-16's h1
//                           is 106 characters and reads as two sentences.
//   title/h1 overlap        The first three words of metaTitle must all appear
//                           in the h1. A SERP promise the page does not open by
//                           keeping is the cheapest bounce there is. Compared
//                           case-insensitively, ignoring punctuation, so
//                           "MTD for Income Tax:" matches "MTD for Income Tax".
//
// DELIBERATELY NOT ENFORCED: keyword presence, density, or anything needing a
// SERP corpus. Nothing in this estate researches keywords (see the Phase-4
// probe), so a rule about them would be invented, not measured.
// ─────────────────────────────────────────────────────────────────────────────

export const SEO_LIMITS = {
  metaTitleMax:       65,
  metaDescriptionMin: 120,
  metaDescriptionMax: 155,
  h1Max:              70,
  titleWordsChecked:  3,
} as const;

export interface SeoIssue {
  field: "metaTitle" | "metaDescription" | "h1" | "titleH1Overlap";
  rule:  string;
  actual: string;
  value: string;
}

/** Words for the overlap test: lowercase, punctuation stripped, empties dropped. */
function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export interface SeoFields {
  metaTitle?: string;
  metaDescription?: string;
  h1?: string;
}

/** Every rule this config breaks. Empty array = clean. Pure; no I/O. */
export function checkSeo(config: SeoFields): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const title = config.metaTitle ?? "";
  const desc  = config.metaDescription ?? "";
  const h1    = config.h1 ?? "";

  if (title.length > SEO_LIMITS.metaTitleMax) {
    issues.push({
      field: "metaTitle",
      rule: `<= ${SEO_LIMITS.metaTitleMax} chars`,
      actual: `${title.length} chars`,
      value: title,
    });
  }
  if (desc.length < SEO_LIMITS.metaDescriptionMin || desc.length > SEO_LIMITS.metaDescriptionMax) {
    issues.push({
      field: "metaDescription",
      rule: `${SEO_LIMITS.metaDescriptionMin}-${SEO_LIMITS.metaDescriptionMax} chars`,
      actual: `${desc.length} chars`,
      value: desc,
    });
  }
  if (h1.length > SEO_LIMITS.h1Max) {
    issues.push({
      field: "h1",
      rule: `<= ${SEO_LIMITS.h1Max} chars`,
      actual: `${h1.length} chars`,
      value: h1,
    });
  }

  // Overlap is only meaningful when both strings exist; a missing field is
  // already reported by its own rule above, and reporting it twice is noise.
  if (title && h1) {
    const first = words(title).slice(0, SEO_LIMITS.titleWordsChecked);
    const inH1  = new Set(words(h1));
    const missing = first.filter((w) => !inH1.has(w));
    if (missing.length > 0) {
      issues.push({
        field: "titleH1Overlap",
        rule: `first ${SEO_LIMITS.titleWordsChecked} words of metaTitle must appear in h1`,
        actual: `missing from h1: ${missing.join(", ")}`,
        value: `title="${title}" h1="${h1}"`,
      });
    }
  }
  return issues;
}

/** The named error the generator surfaces. */
export class SeoGateError extends Error {
  readonly issues: SeoIssue[];
  constructor(productId: string, issues: SeoIssue[]) {
    super(
      `SEO_GATE: "${productId}" breaks ${issues.length} rule(s) — refusing to emit.\n` +
      issues.map((i) =>
        `  · ${i.field}: ${i.rule}, got ${i.actual}\n      ${i.value.slice(0, 160)}${i.value.length > 160 ? "…" : ""}`,
      ).join("\n") +
      `\n  Fix the CONFIG and re-run. These are config fields, so the fix is one edit away —` +
      `\n  the gate refuses the emit, it does not trap you.`,
    );
    this.name = "SeoGateError";
    this.issues = issues;
  }
}

/** Throw unless the config passes every rule. */
export function assertSeo(productId: string, config: SeoFields): void {
  const issues = checkSeo(config);
  if (issues.length > 0) throw new SeoGateError(productId, issues);
}
