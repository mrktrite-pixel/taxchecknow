// cole/__tests__/success-guard.test.ts — F127/F106. The guard must test the code, both ways.
//
//   RUN: npm run test:snap -- --test-name-pattern "F127|F106"
//        (or: node --import ts-node/esm --test cole/__tests__/success-guard.test.ts
//         with TS_NODE_PROJECT=cole/tsconfig.json)
//
// WHY THIS FILE EXISTS. The guard it covers used to read
// `process.env.COLE_SUCCESS_TEMPLATE_RA2_RA3 === "1"` while its message said R-A2 and R-A3 "are
// not yet landed in generate-success-pages.ts". It never looked at the file. Both HAD landed, so
// the message was false and ~80 products' success pages were blocked by an unset variable.
//
// A rewritten guard needs what any gate here needs: proof it reports MISSING on INJECTED absence,
// not merely PASS on the current tree. The trap is specific — the markers must not be matchable by
// the guard's own prose, or the check passes because the refusal text mentions the function names.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { req, COLE_ROOT } from "./_surfaces.ts";

const GEN = path.join(COLE_ROOT, "generators", "generate-success-pages.ts");
const { missingMarkers } = req(GEN) as { missingMarkers: (src: string) => string[] };
const SRC = fs.readFileSync(GEN, "utf-8");

const RA2 = 'buildComposerInputsFromSession("';
const RA3 = "function annualDate(";

test("F127 the real template satisfies both markers", () => {
  assert.deepEqual(missingMarkers(SRC), []);
});

test("F127 R-A2 absent is REPORTED, with the bare name still in the file", () => {
  const doctored = SRC.split(RA2).join("someOtherCall(");
  const missing = missingMarkers(doctored);
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0], /^R-A2/);
  // THE TRAP: a guard matching the bare function name would pass this.
  assert.ok(doctored.includes("buildComposerInputsFromSession"));
});

test("F127 R-A3 absent is REPORTED", () => {
  const doctored = SRC.split(RA3).join("function somethingElse(");
  const missing = missingMarkers(doctored);
  assert.equal(missing.length, 1, JSON.stringify(missing));
  assert.match(missing[0], /^R-A3/);
});

test("F127 both absent are both reported", () => {
  const doctored = SRC.split(RA2).join("someOtherCall(").split(RA3).join("function somethingElse(");
  assert.equal(missingMarkers(doctored).length, 2);
});

test("F127 an empty source reports both, never none", () => {
  assert.equal(missingMarkers("").length, 2);
});

test("F127 the env-var predicate is gone from the generator", () => {
  // NOT a grep for the variable NAME: the F127 comment quotes the old predicate in prose to
  // explain what it did, so that grep matches the explanation — the same self-reference trap
  // these tests exist to catch, which is how the first version of this assertion failed.
  // The BINDING is the thing that decided anything, and it is what must be absent.
  assert.ok(!/\bRA2_RA3_LANDED\b/.test(SRC), "the RA2_RA3_LANDED binding must no longer exist");
  assert.ok(!/if\s*\(\s*!\s*RA2_RA3_LANDED/.test(SRC), "and nothing may branch on it");
});

test("F106 the countdown is preceded by an explicit JSX space", () => {
  const i = SRC.indexOf("${qualitative ? qualitative.cta : CTA_COUNTDOWN}");
  assert.ok(i > 0, "the CTA emit site should exist");
  assert.ok(SRC.slice(0, i).trimEnd().endsWith('{" "}'));
});
