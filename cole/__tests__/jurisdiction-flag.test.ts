// cole/__tests__/jurisdiction-flag.test.ts — F149.
//
//   RUN: npx cross-env TS_NODE_PROJECT=cole/tsconfig.json node --import ts-node/esm --test \
//          cole/__tests__/jurisdiction-flag.test.ts
//
// The assertion that matters runs over ALL 48 REAL CONFIGS, not fixtures: no product may fly a
// Union Jack unless its own market or authority is British. That is the defect in one line —
// au-expat-cgt is an ATO product that rendered 🇬🇧 on its gate page and in its paid file pages,
// because both flag rules keyed on `country`, which for that product is "global".

import { test } from "node:test";
import { req, COLE_ROOT, loadConfigs } from "./_surfaces.ts";
import * as path from "node:path";

const { jurisdictionFlag, MULTI_FLAG } = req(path.join(COLE_ROOT, "generators", "jurisdiction-flag.ts"));

const AU = "🇦🇺", UK = "🇬🇧", US = "🇺🇸", NZ = "🇳🇿", CA = "🇨🇦", ES = "🇪🇸";

test("F149 · market decides, even when country says otherwise", (t) => {
  // The two products this was reported on: AU/ATO filed under the "global" route segment.
  t.assert.strictEqual(jurisdictionFlag({ country: "global", market: "Australia", authority: "Australian Taxation Office (ATO)" }), AU);
  t.assert.strictEqual(jurisdictionFlag({ country: "global", market: "Australia", authority: "ATO" }), AU);
  // "can" is a route segment the old map did not have; market says Canada.
  t.assert.strictEqual(jurisdictionFlag({ country: "can", market: "Canada", authority: "Canada Revenue Agency (CRA)" }), CA);
  // A market with a parenthetical still resolves.
  t.assert.strictEqual(jurisdictionFlag({ country: "global", market: "United States (IRS Substantial Presence Test)", authority: "IRS" }), US);
  t.assert.strictEqual(jurisdictionFlag({ country: "nz", market: "New Zealand", authority: "Inland Revenue Department (IRD)" }), NZ);
  t.assert.strictEqual(jurisdictionFlag({ country: "uk", market: "United Kingdom", authority: "HMRC" }), UK);
  t.assert.strictEqual(jurisdictionFlag({ country: "global", market: "Spain", authority: "Agencia Estatal de Administración Tributaria (AEAT)" }), ES);
});

test("F149 · a cross-border product gets the globe, never a nation and never 🏳️", (t) => {
  t.assert.strictEqual(jurisdictionFlag({ country: "global", market: "Global (cross-border)", authority: "OECD Model Tax Convention" }), MULTI_FLAG);
  // THE ORDERING TEST. nomad-04's authority lists five revenue bodies, CRA first. Reading the
  // authority before the market would stamp a maple leaf on a product about five countries.
  t.assert.strictEqual(
    jurisdictionFlag({
      country: "global",
      market: "Global (cross-border departure)",
      authority: "National tax authorities (CRA / ATO / HMRC / IRD NZ / IRS)",
    }),
    MULTI_FLAG,
  );
  t.assert.strictEqual(jurisdictionFlag({}), MULTI_FLAG);
  t.assert.strictEqual(jurisdictionFlag({ country: "zz", market: "", authority: "" }), MULTI_FLAG);
  t.assert.notStrictEqual(jurisdictionFlag({}), "🏳️");
});

test("F149 · authority carries it when market is absent", (t) => {
  t.assert.strictEqual(jurisdictionFlag({ authority: "ATO" }), AU);
  t.assert.strictEqual(jurisdictionFlag({ authority: "HM Revenue & Customs (HMRC)" }), UK);
  t.assert.strictEqual(jurisdictionFlag({ authority: "Canada Revenue Agency (CRA)" }), CA);
  // And country last, including the two spellings in use.
  t.assert.strictEqual(jurisdictionFlag({ country: "can" }), CA);
  t.assert.strictEqual(jurisdictionFlag({ country: "ca" }), CA);
  t.assert.strictEqual(jurisdictionFlag({ country: "AU" }), AU);
});

test("F149 · over ALL real configs: no Union Jack on a product that is not British", (t) => {
  const configs = loadConfigs();
  t.assert.ok(configs.length >= 40, `expected ~48 configs, loaded ${configs.length}`);

  const wrong: string[] = [];
  const white: string[] = [];
  for (const { id, config } of configs) {
    const flag = jurisdictionFlag(config);
    const british = /united kingdom/i.test(config.market ?? "") || /\bHMRC\b|hm revenue/i.test(config.authority ?? "");
    if (flag === UK && !british) wrong.push(`${id} (market="${config.market}", authority="${config.authority}")`);
    if (flag === "🏳️") white.push(id);
  }
  t.assert.deepStrictEqual(wrong, [], `products flying a Union Jack without a British market or authority:\n  ${wrong.join("\n  ")}`);
  t.assert.deepStrictEqual(white, [], `products flying a white flag:\n  ${white.join("\n  ")}`);
});

test("F149 · every real config resolves to a flag, and AU/ATO products resolve to AU", (t) => {
  for (const { id, config } of loadConfigs()) {
    const flag = jurisdictionFlag(config);
    t.assert.ok(flag.length > 0, `${id} resolved to an empty flag`);
    const isAustralian = /^australia/i.test(config.market ?? "");
    if (isAustralian) t.assert.strictEqual(flag, AU, `${id} is an Australian product but resolved ${flag}`);
  }
});

test("F149 · both generators use the shared rule, and neither keys on country any more", (t) => {
  const fs = req("node:fs");
  for (const f of ["generate-product-files.ts", "generate-gate-page.ts"]) {
    const src = fs.readFileSync(path.join(COLE_ROOT, "generators", f), "utf-8") as string;
    t.assert.match(src, /jurisdictionFlag\(config\)/, `${f} does not call the shared rule`);
    // The old shapes, by structure rather than by any phrase this fix introduces: a flag literal
    // sitting in a ternary or a country-keyed map is what produced the wrong flag twice.
    t.assert.doesNotMatch(src, /config\.country === "au" \? "🇦🇺"/, `${f} still has the country ternary`);
    t.assert.doesNotMatch(src, /\{ au: "🇦🇺", uk: "🇬🇧"/, `${f} still has the country-keyed map`);
  }
});
