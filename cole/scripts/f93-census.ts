// cole/scripts/f93-census.ts — does the F93 gate fire on anything already shipped?
//
// Run: npx ts-node --project cole/tsconfig.json cole/scripts/f93-census.ts
//
// A NEW REFUSAL IS ONLY SAFE ONCE YOU KNOW WHAT IT REFUSES. The doubled-word gate was added the
// same way and reported 973 hits on the emitted .tsx, of which 966 were code — so it was moved to
// the composed prose. This asks the same question of the raw-field-key gate BEFORE it can block a
// regeneration: every config, both tiers, the same four strings generate-success-pages composes.
//
// Reads configs only. Writes nothing, generates nothing.

import * as fs from "fs";
import * as path from "path";
import { rawIdentifiers, positionPhrase } from "../generators/generate-success-pages";
import { findDoubledWords } from "../validators/doubled-word";

const CONFIG_DIR = path.join(__dirname, "..", "config");

interface AnyConfig {
  id?: string;
  tier1?: { name?: string; tagline?: string };
  tier2?: { name?: string; tagline?: string };
  [k: string]: unknown;
}

const files = fs.readdirSync(CONFIG_DIR).filter((f) => f.endsWith(".ts")).sort();
let products = 0;
let hits = 0;
const unreadable: string[] = [];

for (const file of files) {
  let config: AnyConfig | null = null;
  try {
    const mod = require(path.join(CONFIG_DIR, file)) as Record<string, unknown>;
    // The configs export under varying names; take the first object that has a tier1.name.
    for (const v of Object.values(mod)) {
      const c = v as AnyConfig;
      if (c && typeof c === "object" && c.tier1 && typeof c.tier1.name === "string") { config = c; break; }
    }
  } catch (e) {
    unreadable.push(`${file}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    continue;
  }
  if (!config) { unreadable.push(`${file}: no export with tier1.name`); continue; }
  products++;

  for (const tier of ["tier1", "tier2"] as const) {
    const tc = config[tier] as { name?: string; tagline?: string } | undefined;
    if (!tc?.name) continue;
    const packName = tc.name;
    const packNounPhrase = packName.replace(/^Your\s+/i, "");
    let position = "";
    try { position = `Your ${positionPhrase(config as never)} position`; } catch { position = ""; }

    const composed: Array<[string, string]> = [
      ["position heading", position],
      ["hero h1", `here is your ${packNounPhrase}`],
      ["pack name", packName],
      ["tier tagline", tc.tagline ?? ""],
    ];
    for (const [where, text] of composed) {
      if (!text) continue;
      const keys = rawIdentifiers(text);
      const doubled = findDoubledWords(text);
      if (keys.length > 0) {
        hits++;
        console.log(`F93  ${file} ${tier} ${where}: ${keys.join(", ")}`);
        console.log(`       ${text}`);
      }
      if (doubled.length > 0) {
        console.log(`F75  ${file} ${tier} ${where}: ${doubled.map((d) => d.pair).join(", ")}`);
        console.log(`       ${text}`);
      }
    }
  }
}

console.log(`\nproducts read: ${products} of ${files.length} config files`);
if (unreadable.length) {
  console.log(`not read (${unreadable.length}):`);
  for (const u of unreadable) console.log(`  ${u}`);
}
console.log(hits === 0
  ? "F93: 0 hits across every config, both tiers — the gate blocks nothing that already ships."
  : `F93: ${hits} hits — fix these before the gate can be turned on.`);
