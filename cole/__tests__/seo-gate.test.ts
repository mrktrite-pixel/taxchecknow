// ─────────────────────────────────────────────────────────────────────────────
// SEO GATE — the rules, and the estate census.
//
// TWO JOBS IN ONE FILE, deliberately:
//   1. UNIT-TEST THE RULES against hand-built fields, so a change to
//      checkSeo() has to be intentional. These must always pass.
//   2. CENSUS EVERY CONFIG, so the failure output IS the work list — the same
//      pattern the assessment-fields parity test established. It lands RED and
//      that is correct: the gate in cole-generate already refuses to emit these
//      products, so the red here and the refusal there are the same fact.
//
// WHY THE CENSUS IS A SEPARATE TEST FROM THE RULES. If they shared one test,
// fixing the last config would be indistinguishable from breaking the rules —
// and a green suite would stop meaning "the gate works".
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import * as path from "node:path";
import { req, COLE_ROOT, loadConfigs } from "./_surfaces.ts";

const { checkSeo, SEO_LIMITS } = req(
  path.join(COLE_ROOT, "validators", "seo-gate.ts"),
) as typeof import("../validators/seo-gate");

test("seo-gate: the rules themselves", (t) => {
  const okTitle = "MTD for Income Tax: Which Part Applies? | TaxCheckNow";   // 53
  const okDesc  = "x".repeat(140);
  const okH1    = "MTD for Income Tax: Which Part Applies to You?";

  t.assert.deepStrictEqual(
    checkSeo({ metaTitle: okTitle, metaDescription: okDesc, h1: okH1 }), [],
    "a clean config must produce no issues",
  );

  // Each rule fires on its own.
  const long = checkSeo({ metaTitle: "x".repeat(66), metaDescription: okDesc, h1: okH1 });
  t.assert.ok(long.some((i) => i.field === "metaTitle"), "66-char title must fail");

  t.assert.ok(
    checkSeo({ metaTitle: okTitle, metaDescription: "x".repeat(119), h1: okH1 })
      .some((i) => i.field === "metaDescription"),
    "119-char description must fail (too short is a defect, not a safe default)",
  );
  t.assert.ok(
    checkSeo({ metaTitle: okTitle, metaDescription: "x".repeat(156), h1: okH1 })
      .some((i) => i.field === "metaDescription"),
    "156-char description must fail",
  );
  t.assert.strictEqual(
    checkSeo({ metaTitle: okTitle, metaDescription: "x".repeat(120), h1: okH1 }).length, 0,
    "120 is inclusive",
  );
  t.assert.strictEqual(
    checkSeo({ metaTitle: okTitle, metaDescription: "x".repeat(155), h1: okH1 }).length, 0,
    "155 is inclusive",
  );

  t.assert.ok(
    checkSeo({ metaTitle: okTitle, metaDescription: okDesc, h1: "y".repeat(71) })
      .some((i) => i.field === "h1"),
    "71-char h1 must fail",
  );

  // Overlap: punctuation and case must not defeat it.
  t.assert.strictEqual(
    checkSeo({
      metaTitle: "MTD for Income Tax: Which Part Applies? | TaxCheckNow",
      metaDescription: okDesc,
      h1: "mtd, for — income tax and what it means",
    }).length, 0,
    "overlap compares case-insensitively and ignores punctuation",
  );
  t.assert.ok(
    checkSeo({
      metaTitle: "Rental Property Deductions 2026 | TaxCheckNow",
      metaDescription: okDesc,
      h1: "Something Entirely Different",
    }).some((i) => i.field === "titleH1Overlap"),
    "a title whose first words are absent from the h1 must fail",
  );

  t.assert.strictEqual(SEO_LIMITS.metaTitleMax, 65);
});

test("seo-gate CENSUS: every config passes the gate", (t) => {
  const configs = loadConfigs();
  // Guard against a vacuous pass, the same way the parity test does.
  t.assert.ok(configs.length >= 20, `expected the estate, found ${configs.length} configs`);

  const problems: string[] = [];
  for (const { file, config } of configs) {
    const issues = checkSeo(config as { metaTitle?: string; metaDescription?: string; h1?: string });
    if (issues.length === 0) continue;
    problems.push(
      `${file}\n` +
      issues.map((i) => `      ${i.field}: ${i.rule}, got ${i.actual}`).join("\n"),
    );
  }

  t.assert.deepStrictEqual(
    problems, [],
    `${problems.length} config(s) fail the SEO gate and therefore CANNOT BE EMITTED ` +
    `until their config is fixed:\n  - ` + problems.join("\n  - "),
  );
});
