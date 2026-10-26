// cole/__tests__/doubled-word-thousands.test.ts — a thousands separator is not a word boundary.
//
//   RUN: npx cross-env TS_NODE_PROJECT=cole/tsconfig.json node --import ts-node/esm --test \
//          cole/__tests__/doubled-word-thousands.test.ts
//
// The split in findDoubledWords lists "," as a word separator, so "$3,000,000" became the three
// tokens 3 / 000 / 000 and the adjacent-equal test did exactly what it should with two identical
// neighbours. Measured against this very function, 2026-10-22:
//
//   "below $3,000,000 at the end"   -> ["000 000"]
//   "above $10,000,000 of balance"  -> ["000 000"]
//
// In soverella's copy of this rule (PR #215, F-S215) the same bug held div296-wealth-eraser's
// step 5 at NEEDS_YOU on two DELIVERED packs whose copy was correct. HERE IT IS WORSE, because
// generate-success-pages.ts:265 BLOCKS generation on these hits rather than reporting them.
//
// The last test sweeps the REAL configs rather than fixtures, in the style of jurisdiction-flag:
// no comma-separated figure anywhere in the estate's buyer copy may produce a digit-group hit.

import { test } from "node:test";
import { req, COLE_ROOT, loadConfigs } from "./_surfaces.ts";
import * as path from "node:path";

const { findDoubledWords } = req(path.join(COLE_ROOT, "validators", "doubled-word.ts"));
const pairs = (s: string): string[] => findDoubledWords(s).map((d: { pair: string }) => d.pair);

test("the measured false positives are gone", (t) => {
  // Verbatim from div296-wealth-eraser's two delivered packs.
  t.assert.deepStrictEqual(pairs("below $3,000,000 at the end of the 2026-27 income year"), []);
  t.assert.deepStrictEqual(pairs("based on the indicated total super balance sitting below $3,000,000, Division 296 tax does not currently apply"), []);
  t.assert.deepStrictEqual(pairs("above $10,000,000 of balance"), []);
});

test("the figure in every shape it occurs in", (t) => {
  for (const s of [
    "The threshold is $3,000,000 for this year",
    "a fund holding 1,000,000,000 in assets",
    "income plus contributions pass $250,000",
    "the 3,000,000 cap",
    "above $3,000,000, the extra tax applies",
    "the cap is $3,000,000.",
    "between $3,000,000 and $10,000,000 of balance",
    "(TSB of $3,000,000) at year end",
  ]) {
    t.assert.deepStrictEqual(pairs(s), [], s);
  }
});

test("it still catches what it is for", (t) => {
  t.assert.deepStrictEqual(pairs("you you should review"), ["you you"]);
  t.assert.strictEqual(findDoubledWords("Your Australia Australian Taxation Office position")[0].kind, "stem");
  t.assert.strictEqual(findDoubledWords("Your Canada Canada Revenue Agency position")[0].kind, "exact");
  // A repeat sharing a clause with a figure, on both sides of it.
  t.assert.deepStrictEqual(pairs("the the balance is $3,000,000"), ["the the"]);
  t.assert.deepStrictEqual(pairs("a balance of $3,000,000 means you you must act"), ["you you"]);
});

test("the comma/full-stop distinction this validator exists to make is untouched", (t) => {
  // Its own doc comment: "Australia, Australian" is caught, "Australia. Australian" is not.
  t.assert.deepStrictEqual(pairs("Australia, Australian rules"), ["Australia Australian"]);
  t.assert.deepStrictEqual(pairs("Australia. Australian rules"), []);
  t.assert.deepStrictEqual(pairs("you, you should review"), ["you you"]);
});

test("a repeated NUMBER is a real defect and survives the fix", (t) => {
  // This is why the fix is in the split and not a filter on all-digit hits.
  t.assert.deepStrictEqual(pairs("payable in 2026 2026 under the new rule"), ["2026 2026"]);
  t.assert.deepStrictEqual(pairs("the rate is 15 15 per cent"), ["15 15"]);
  t.assert.deepStrictEqual(pairs("the cap is $3,000,000 $3,000,000"), ["3,000,000 3,000,000"]);
});

test("no U+0000 sentinel reaches a hit", (t) => {
  const NUL = String.fromCharCode(0);
  const all = [
    "below $3,000,000 at the end",
    "the the balance is $3,000,000",
    "the cap is $3,000,000 $3,000,000",
    "between $3,000,000 and $10,000,000 you you must act",
  ].flatMap((s) => findDoubledWords(s));
  for (const h of all as Array<{ pair: string; line?: string }>) {
    t.assert.ok(!h.pair.includes(NUL), `pair carries NUL: ${JSON.stringify(h.pair)}`);
  }
});

test("degenerate input", (t) => {
  for (const s of ["", ",", ",,,", "3", "3,", ",3", "$", "$,"]) {
    t.assert.deepStrictEqual(pairs(s), [], JSON.stringify(s));
  }
});

/** Every string leaf in a config, so each is linted as its own text. */
function stringLeaves(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) stringLeaves(x, out);
  else if (v && typeof v === "object") for (const x of Object.values(v)) stringLeaves(x, out);
  return out;
}

test("every thousands-separated figure in the REAL configs is clean", (t) => {
  // The assertion that matters, over every real config rather than fixtures — and scoped to
  // EXACTLY the class this change fixes.
  //
  // TWO MEASUREMENT MISTAKES THIS TEST MADE FIRST, both recorded because each would have made it
  // assert something it could not support:
  //
  // 1. It linted `JSON.stringify(config)` and reported 34 offenders — `1 1`, `20 20`, `50 50`,
  //    `120 120`, `3520 3520` across 14 configs. None was this bug: they were JSON punctuation
  //    creating adjacencies that do not exist in buyer copy (an options array serialising to
  //    `[20,20]`). A prose rule measured over a serialised object measures the serialiser.
  //
  // 2. Linting whole string LEAVES still reported 8, and those ARE real buyer strings — but a
  //    DIFFERENT false-positive class, from `-`, `/` and `(` between digits:
  //      au-10  "1 1"        in "adds 1-1.5% on income over $105,000"   (a numeric range)
  //      can-03 "12 12"      in "sections 12(12) and 12(13)"            (a subsection reference)
  //      can-05 "50 50"      in an HTML table                          (a "50/50" split)
  //      nomad-08 "3520 3520" in "Form 1..."                            (Form 3520 / 3520-A)
  //    Those are not fixed here and asserting them away would claim a fix this change does not
  //    make. They are reported for a ruling; see the PR.
  //
  // So the sweep extracts the FIGURES and lints each on its own. That isolates the comma class.
  const configs = loadConfigs();
  t.assert.ok(configs.length > 0, "no configs loaded");
  const FIGURE = /\d{1,3}(?:,\d{3})+/g;
  const offenders: string[] = [];
  let figures = 0;
  for (const { file, config } of configs as Array<{ file: string; config: unknown }>) {
    for (const s of stringLeaves(config)) {
      for (const fig of s.match(FIGURE) ?? []) {
        figures++;
        const hits = findDoubledWords(fig) as Array<{ pair: string }>;
        if (hits.length > 0) offenders.push(`${file}: ${fig} -> ${hits.map((h) => `"${h.pair}"`).join(", ")}`);
      }
    }
  }
  // A vacuous pass would be the real failure here: if no figure were found, the sweep proves
  // nothing. The estate's copy is full of them.
  t.assert.ok(figures > 100, `only ${figures} thousands-separated figures found — sweep looks vacuous`);
  t.assert.deepStrictEqual(offenders, [], `thousands-separator false positives:\n  ${offenders.join("\n  ")}`);
  console.log(`      (swept ${figures} thousands-separated figures across ${configs.length} configs)`);
});
