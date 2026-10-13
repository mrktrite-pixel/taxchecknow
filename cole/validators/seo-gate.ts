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
//   title/h1 overlap        ADVISORY ONLY — warns, never blocks. The first three
//                           words of metaTitle should appear in the h1, because
//                           a SERP promise the page does not open by keeping is
//                           the cheapest bounce there is. It is not a blocker
//                           because it cannot tell an acronym from a mismatch:
//                           it fired on 32 of 48 configs and failed uk-01 ALONE
//                           on "MTD" vs "Making Tax Digital", which is the same
//                           thing spelled out. See the note at its check.
//
// BYPASS: COLE_SEO_GATE_BYPASS=1 downgrades the blocking rules to a loud log —
// violations still printed in full. It exists because this gate stops a product
// being regenerated for ANY reason until its copy is fixed, and an urgent figure
// correction should not be hostage to a title length.
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
  /** false = advisory only; the gate warns and continues. */
  blocking: boolean;
}

/** The overlap rule is advisory — see the note on its check below. */
export const isBlocking = (i: SeoIssue): boolean => i.blocking;

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
      blocking: true,
    });
  }
  if (desc.length < SEO_LIMITS.metaDescriptionMin || desc.length > SEO_LIMITS.metaDescriptionMax) {
    issues.push({
      field: "metaDescription",
      rule: `${SEO_LIMITS.metaDescriptionMin}-${SEO_LIMITS.metaDescriptionMax} chars`,
      actual: `${desc.length} chars`,
      value: desc,
      blocking: true,
    });
  }
  if (h1.length > SEO_LIMITS.h1Max) {
    issues.push({
      field: "h1",
      rule: `<= ${SEO_LIMITS.h1Max} chars`,
      actual: `${h1.length} chars`,
      value: h1,
      blocking: true,
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
        // ADVISORY, NOT BLOCKING — and the reason is measured. The rule fired on
        // 32 of 48 configs, and uk-01-mtd-scorecard failed on it ALONE with
        // title "MTD for Income Tax…" against h1 "Making Tax Digital for Income
        // Tax…". The acronym and its expansion are the same words and a
        // set-membership test cannot see that. A rule that blocks correct copy
        // is worse than no rule, so this warns until it can tell an acronym from
        // a mismatch.
        blocking: false,
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

/**
 * Throw on BLOCKING issues; warn on advisory ones.
 *
 * COLE_SEO_GATE_BYPASS=1 downgrades the throw to a loud log — the violations are
 * still printed in full, so a bypassed build is noisy rather than silent. It
 * exists because the gate blocks regeneration of a product for ANY reason until
 * its copy is fixed, and an urgent figure correction should not be hostage to a
 * title length.
 */
export function assertSeo(productId: string, config: SeoFields): void {
  const issues   = checkSeo(config);
  const blocking = issues.filter(isBlocking);
  const advisory = issues.filter((i) => !isBlocking(i));

  for (const a of advisory) {
    console.warn(`   ⚠️  SEO WARN ${productId}: ${a.field} — ${a.rule}, ${a.actual}`);
  }
  if (blocking.length === 0) return;

  const err = new SeoGateError(productId, blocking);
  if (process.env.COLE_SEO_GATE_BYPASS === "1") {
    console.warn(`   ⚠️  SEO GATE BYPASSED (COLE_SEO_GATE_BYPASS=1) — emitting anyway.`);
    console.warn(`   ${err.message}`);
    return;
  }
  throw err;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// F95 — CORPUS FRESHNESS. WARNS HERE; BLOCKS IN soverella's ship-check (step 6).
//
// The ruling is "stale = older than 90 days", replacing "=== the current month", which turned every
// product red on the 1st and taught re-stamping instead of re-reading.
//
// ── WHY THIS WARNS AND DOES NOT THROW, measured before deciding ──
//
// Census of all 48 configs on 2026-10-07, at 90 days:
//     FRESH  6      STALE 42
//     40x "April 2026" (189d) · 5x "September 2026" (36d) · 1x "August 2026" (67d)
//     1x "2026-06-05" (wrong format, unparseable) · 1x "" (absent)
//
// A throw here runs on EVERY generate, so it would refuse 42 of 48 products — including refusing
// the regenerations that fix unrelated defects. A gate nobody can satisfy is a gate that gets
// bypassed, and the 42 need an authority re-read each, which is legal work and not a code change.
//
// So the per-product SHIP gate blocks (soverella/scripts/ship-check.ts step 6, which is where a
// product's copy is signed off) and this prints a warning loud enough to read. Flipping this to a
// throw is one line, once the 42 are re-verified.
//
// The parsing rules are deliberately identical to soverella/lib/ship/last-verified.ts — the first
// of the named month (never understate age), a future label is NOT fresh, and an unparseable or
// absent label is NOT fresh rather than silently passing.
// ═════════════════════════════════════════════════════════════════════════════════════════════

export const MAX_VERIFIED_AGE_DAYS = 90;

const VERIFIED_MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Days since the first of the named month, or null when the label cannot be read. */
export function verifiedAgeDays(label: string | null | undefined, now: Date = new Date()): number | null {
  if (!label) return null;
  const m = /^\s*([A-Za-z]+)\s+(\d{4})\s*$/.exec(label);
  if (!m) return null;
  const idx = VERIFIED_MONTHS.indexOf(m[1].toLowerCase());
  if (idx < 0) return null;
  const year = Number(m[2]);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;
  return Math.floor((now.getTime() - Date.UTC(year, idx, 1)) / 86_400_000);
}

/** Print the freshness verdict. Returns true when fresh, so a caller can choose to escalate. */
export function warnIfCorpusStale(productId: string, lastVerified: string | null | undefined, now: Date = new Date()): boolean {
  const age = verifiedAgeDays(lastVerified, now);
  if (age !== null && age >= 0 && age <= MAX_VERIFIED_AGE_DAYS) {
    console.log(`   ✅ corpus freshness: lastVerified ${lastVerified} · ${age} days old`);
    return true;
  }
  const why = age === null
    ? `lastVerified ${lastVerified ? `"${lastVerified}" is not a "<Month> <Year>" label` : "is absent"}`
    : age < 0
      ? `lastVerified "${lastVerified}" is ${-age} days IN THE FUTURE`
      : `lastVerified "${lastVerified}" is ${age} days old`;
  console.log(`   ⚠  F95 corpus freshness: ${why} (stale after ${MAX_VERIFIED_AGE_DAYS} days)`);
  console.log(`      "${productId}" will NOT pass step 6 until the authority is re-read and the field re-stamped.`);
  console.log(`      This is a warning, not a refusal: 42 of 48 configs are stale today, and refusing`);
  console.log(`      here would block regenerating them for reasons unrelated to what is being fixed.`);
  return false;
}
