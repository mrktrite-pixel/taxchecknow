// cole/scripts/f121-regen.mjs — F121. Regenerate the success pages that lack the freeze POST.
//
//   node cole/scripts/f121-regen.mjs            # dry run: says what it would do
//   node cole/scripts/f121-regen.mjs --write    # runs cole-generate --success-only per product
//
// ONE PRODUCT AT A TIME, VIA THE REAL GENERATOR. No bulk file rewriting: --success-only is the
// path the estate already uses, it runs the SEO and first-person gates first, and a product whose
// config refuses is reported rather than forced. That matters here because cole-generate runs the
// SEO gate BEFORE any mode dispatch, so a product with over-length copy cannot have its success
// pages regenerated until step 6 is fixed — a coupling worth measuring rather than discovering.
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const APP = path.join(process.cwd(), "app");
const MARKER = 'fetch("/api/freeze-pack"';
const EXCLUDE = "nomad/check/tax-treaty-navigator";
const WRITE = process.argv.includes("--write");

function successPages(route) {
  const [country, , slug] = route.split("/");
  return ["assess", "plan"].map((t) => path.join(APP, country, "check", slug, "success", t, "page.tsx"))
    .filter((p) => fs.existsSync(p));
}
function hasFreeze(route) {
  const pages = successPages(route);
  return pages.length > 0 && pages.every((p) => fs.readFileSync(p, "utf-8").includes(MARKER));
}

// The regen set, measured not assumed.
const targets = [];
for (const country of fs.readdirSync(APP)) {
  const checkDir = path.join(APP, country, "check");
  if (!fs.existsSync(checkDir) || !fs.statSync(checkDir).isDirectory()) continue;
  for (const slug of fs.readdirSync(checkDir)) {
    const route = `${country}/check/${slug}`;
    if (route === EXCLUDE) continue;
    if (successPages(route).length === 0) continue;
    if (!hasFreeze(route)) targets.push({ route, slug });
  }
}

console.log(`${targets.length} product(s) to regenerate${WRITE ? "" : "  (dry run — pass --write)"}\n`);
if (!WRITE) {
  for (const t of targets) console.log(`  would regen  ${t.route}`);
  process.exit(0);
}

const results = [];
for (const { route, slug } of targets) {
  const before = hasFreeze(route);
  const r = spawnSync(process.execPath, [
    path.join("node_modules", "ts-node", "dist", "bin.js"),
    "--project", "cole/tsconfig.json",
    path.join("cole", "scripts", "cole-generate.ts"),
    slug, "--success-only",
  ], { encoding: "utf-8", env: process.env });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const after = hasFreeze(route);
  const seoRefused = /SEO_GATE:/.test(out);
  const fpRefused = /FIRST_PERSON|first-person gate/i.test(out) && /refus/i.test(out);
  results.push({
    route, before, after,
    status: after && !before ? "REGENERATED"
      : after && before ? "already had it"
      : seoRefused ? "REFUSED — SEO gate (fix step 6 copy first)"
      : fpRefused ? "REFUSED — first-person gate"
      : `FAILED (exit ${r.status})`,
    tail: out.split(/\r?\n/).filter(Boolean).slice(-4).join(" | "),
  });
  console.log(`  ${after && !before ? "✅" : "❌"} ${route.padEnd(52)} ${results.at(-1).status}`);
}

console.log("\n──────── SUMMARY ────────");
const ok = results.filter((r) => r.status === "REGENERATED");
const seo = results.filter((r) => r.status.startsWith("REFUSED — SEO"));
const other = results.filter((r) => !ok.includes(r) && !seo.includes(r));
console.log(`regenerated:            ${ok.length}`);
console.log(`refused by the SEO gate: ${seo.length}`);
console.log(`other outcomes:          ${other.length}`);
for (const r of other) console.log(`   ${r.route}: ${r.status}\n     ${r.tail}`);
fs.writeFileSync("cole/scripts/.f121-results.json", JSON.stringify(results, null, 2));
console.log("\nfull results -> cole/scripts/.f121-results.json");
