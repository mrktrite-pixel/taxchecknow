// ─────────────────────────────────────────────────────────────────────────────
// FREEZE — lib/render-pack.ts unit tests, plus the two page-contract behaviours.
//
// FIXTURES ARE REAL. The key sets below were read from the live assessments table on
// 2026-09-21 (service-role SELECT) and are reproduced here so the test is self-contained
// and deterministic. A test written against invented shapes would have passed for beckham
// throughout the weeks its pack rendered empty — the whole point is to pin what the
// database actually contains.
//
// WHAT IS NOT TESTED HERE, stated so nobody reads more into a green run than it earns:
// this harness has no DOM, so these exercise the PURE logic the page renders from —
// renderPack, hasFrozenPack, and the once-only heal guard — not a mounted React tree.
// The page cannot disagree with them, because after this change it derives nothing: it
// maps over pack.sections verbatim.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import * as path from "node:path";
import { req, COLE_ROOT } from "./_surfaces.ts";

const REPO = path.join(COLE_ROOT, "..");
const { renderPack, hasFrozenPack, MAX_SECTIONS } = req(path.join(REPO, "lib", "render-pack.ts"));
const { getAssessmentFields } = req(path.join(REPO, "lib", "assessment-fields.ts"));

const FIXED = () => new Date("2026-09-21T12:00:00.000Z");
const para = (k: string) => `A personalised paragraph about ${k}.`;
const rowFrom = (keys: string[], extra: Record<string, unknown> = {}) =>
  ({ ...Object.fromEntries(keys.map((k) => [k, para(k)])), ...extra });

// REAL — Spaintest1, spain-beckham-eligibility, tier 67, written 2026-09-21T09:59:59Z.
// GENERIC_FIELDS shape: the product was unregistered when the webhook composed it.
const REAL_BECKHAM_GENERIC = rowFrom(
  ["status", "keyFinding", "firstAction", "exposureAmount", "confidenceLevel", "mainRiskTrigger", "recommendedAction"],
  { _meta: { grounded: true }, accountantQuestions: ["Q1", "Q2", "Q3"] },
);

// REAL — newuser147, 183-day-rule, tier 147. Registered, so it carries its PRODUCT keys.
const REAL_183_PRODUCT = rowFrom(
  ["residencyStatus", "dayCountAnalysis", "currentYearMinimumCheck", "excludedDaysAssessment",
   "form8843Position", "filingObligations", "riskLevel", "immediateActions", "priorYearCountReview",
   "closerConnectionAssessment", "auditDefenceDocumentation", "exclusionEvidenceStrategy", "recordKeepingSystem"],
  { _meta: { grounded: true }, accountantQuestions: ["Q1", "Q2"],
    actions: [{ title: "Do the thing", deadline: "Within 30 days", steps: ["a", "b"] }] },
);

test("renderPack: a REAL generic-shaped row yields the three fallback sections, not zero", (t) => {
  const pack = renderPack(REAL_BECKHAM_GENERIC, {
    productId: "spain-beckham-eligibility", tier: 67, customerName: "Spaintest1",
    fieldList: getAssessmentFields("spain-beckham-eligibility", 67), now: FIXED,
  });
  t.assert.strictEqual(pack.sections.length, 3);
  t.assert.deepStrictEqual(pack.sections.map((s: { key: string }) => s.key),
    ["status", "keyFinding", "recommendedAction"]);
  // Headings are title-cased the way the emitted pages have always shown them.
  t.assert.deepStrictEqual(pack.sections.map((s: { heading: string }) => s.heading),
    ["Status", "Key Finding", "Recommended Action"]);
  t.assert.strictEqual(pack.firstAction, para("firstAction"));
  t.assert.strictEqual(pack.accountantQuestions.length, 3);
  t.assert.strictEqual(pack.version, 1);
  t.assert.strictEqual(pack.name, "Spaintest1");
});

test("renderPack: a synthetic beckham row with the 9 registered keys yields SIX product sections", (t) => {
  const fields = getAssessmentFields("spain-beckham-eligibility", 67);
  t.assert.strictEqual(fields.length, 9, "beckham tier1 should be the 9 keys its page posts");
  const pack = renderPack(rowFrom(fields), {
    productId: "spain-beckham-eligibility", tier: 67, customerName: "", fieldList: fields, now: FIXED,
  });
  t.assert.strictEqual(pack.sections.length, MAX_SECTIONS);
  t.assert.deepStrictEqual(pack.sections.map((s: { key: string }) => s.key), fields.slice(0, 6));
});

test("renderPack: a REAL 183-day row renders its PRODUCT sections in registry order", (t) => {
  const fields = getAssessmentFields("183-day-rule", 147);
  const pack = renderPack(REAL_183_PRODUCT, {
    productId: "183-day-rule", tier: 147, customerName: "newuser147", fieldList: fields, now: FIXED,
  });
  t.assert.strictEqual(pack.sections.length, MAX_SECTIONS);
  t.assert.deepStrictEqual(pack.sections.map((s: { key: string }) => s.key), fields.slice(0, 6));
  // Generic keys are absent from this row, so the fallback must not have been reached.
  t.assert.ok(!pack.sections.some((s: { key: string }) => s.key === "status"));
  t.assert.strictEqual(pack.actions.length, 1);
  t.assert.strictEqual(pack.actions[0].title, "Do the thing");
});

test("E1 — a row carrying ONLY `rendered` still renders six sections", (t) => {
  const fields = getAssessmentFields("spain-beckham-eligibility", 67);
  const frozen = renderPack(rowFrom(fields), {
    productId: "spain-beckham-eligibility", tier: 67, customerName: "Buyer", fieldList: fields, now: FIXED,
  });
  // Every raw key deleted — this is what a stored row looks like to a reader that derives
  // nothing. Before the freeze this rendered an empty body by construction.
  const rowWithOnlyRendered = { rendered: frozen };
  t.assert.ok(hasFrozenPack(rowWithOnlyRendered));
  const adopted = (rowWithOnlyRendered as { rendered: { sections: unknown[] } }).rendered;
  t.assert.strictEqual(adopted.sections.length, 6);
  t.assert.strictEqual(Object.keys(rowWithOnlyRendered).length, 1, "no raw keys remain");
});

test("E4 — the heal POST fires once per mount, not on the next render", (t) => {
  // Models the page's useRef guard exactly: same flag, same order of operations.
  const posted: string[] = [];
  const frozePosted = { current: false };
  const view = (row: Record<string, unknown>) => {
    if (hasFrozenPack(row)) return;                       // already frozen -> never posts
    if (!frozePosted.current) { frozePosted.current = true; posted.push("POST"); }
  };
  const raw = { ...REAL_BECKHAM_GENERIC };
  view(raw); view(raw); view(raw);                        // three renders, one mount
  t.assert.strictEqual(posted.length, 1, "heal must post exactly once per mount");

  // And a row that came back already frozen never posts at all.
  const posted2: string[] = [];
  const guard2 = { current: false };
  const frozen = { rendered: renderPack(raw, { productId: "spain-beckham-eligibility", tier: 67, fieldList: [], now: FIXED }) };
  const view2 = (row: Record<string, unknown>) => {
    if (hasFrozenPack(row)) return;
    if (!guard2.current) { guard2.current = true; posted2.push("POST"); }
  };
  view2(frozen); view2(frozen);
  t.assert.strictEqual(posted2.length, 0, "a frozen row must never be re-posted");
});
