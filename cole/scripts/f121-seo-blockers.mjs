// cole/scripts/f121-seo-blockers.mjs — why 34 products cannot have their success pages regenerated.
//
// Read-only. cole-generate runs the SEO gate BEFORE any mode dispatch, so --success-only refuses
// on a config whose metaTitle/metaDescription/h1 are outside the limits. This reports which field
// and by how much, per product, so the step-6 work is a list rather than a surprise.
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
req("ts-node/register");

const { checkSeo } = req(path.join(process.cwd(), "cole", "validators", "seo-gate.ts"));
const CFG = path.join(process.cwd(), "cole", "config");

const field = (src, k) => {
  const m = new RegExp(`["']?${k}["']?\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(src);
  return m ? m[1] : "";
};

const rows = [];
for (const f of fs.readdirSync(CFG).filter((x) => x.endsWith(".ts"))) {
  const src = fs.readFileSync(path.join(CFG, f), "utf-8");
  const slug = field(src, "slug");
  if (!slug) continue;
  const issues = checkSeo({
    metaTitle: field(src, "metaTitle"),
    metaDescription: field(src, "metaDescription"),
    h1: field(src, "h1"),
  }).filter((i) => i.blocking);
  if (issues.length) rows.push({ slug, file: f, issues });
}

rows.sort((a, b) => a.slug.localeCompare(b.slug));
console.log(`configs failing the SEO gate: ${rows.length}\n`);
const byField = new Map();
for (const r of rows) {
  console.log(`  ${r.slug}`);
  for (const i of r.issues) {
    console.log(`      ${i.field}: ${i.rule}, got ${i.actual}`);
    byField.set(i.field, (byField.get(i.field) ?? 0) + 1);
  }
}
console.log("\n  by field:");
for (const [k, n] of [...byField.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}  ${k}`);
