// cole/scripts/f121-audit.mjs — F121. Which success pages lack the freeze-pack POST?
//
// Read-only. Prints one row per product per tier so the regen set is a measured list rather than
// an assumption, and so the same command can be re-run AFTER the regen to show the delta.
//
//   node cole/scripts/f121-audit.mjs
//
// THE MARKER is the POST itself — `fetch("/api/freeze-pack"` — not renderPack or hasFrozenPack.
// Those are imports, and an import can survive a partial hand-patch while the POST that actually
// freezes the buyer's document does not. The POST is the behaviour F121 is about.
import * as fs from "node:fs";
import * as path from "node:path";

const APP = path.join(process.cwd(), "app");
const MARKER = 'fetch("/api/freeze-pack"';
const EXCLUDE = "nomad/check/tax-treaty-navigator";   // PR C owns this one

const rows = [];
for (const country of fs.readdirSync(APP)) {
  const checkDir = path.join(APP, country, "check");
  if (!fs.existsSync(checkDir) || !fs.statSync(checkDir).isDirectory()) continue;
  for (const slug of fs.readdirSync(checkDir)) {
    const route = `${country}/check/${slug}`;
    for (const tier of ["assess", "plan"]) {
      const page = path.join(checkDir, slug, "success", tier, "page.tsx");
      if (!fs.existsSync(page)) continue;
      const src = fs.readFileSync(page, "utf-8");
      rows.push({
        route, tier,
        freeze: src.includes(MARKER),
        excluded: route === EXCLUDE,
        // F106 — ASSERT THE INVARIANT, NOT THE SYMPTOM.
        //
        // The symptom ("above." immediately followed by a digit) only exists in the RENDERED
        // page: in source the countdown is an expression, so the two are on separate lines and
        // the join happens in the browser. The first version of this check grepped for the
        // symptom and reported 8 hits — all of them inside a generator comment that quoted the
        // example sentence. It was measuring my own prose.
        //
        // What is checkable in source is the FIX: the countdown expression must be immediately
        // preceded by an explicit {" "}. A page with a countdown and no {" "} is the defect.
        hasCountdown: /\{deadlineLive \? `/.test(src),
        spaced: /\{" "\}\{deadlineLive \? `/.test(src),
      });
    }
  }
}

const considered = rows.filter((r) => !r.excluded);
const lacking = considered.filter((r) => !r.freeze);
const products = [...new Set(lacking.map((r) => r.route))].sort();

console.log(`success pages found:        ${rows.length}`);
console.log(`excluded (PR C):            ${rows.filter((r) => r.excluded).length}  (${EXCLUDE})`);
console.log(`WITH freeze-pack POST:      ${considered.filter((r) => r.freeze).length}`);
console.log(`WITHOUT freeze-pack POST:   ${lacking.length}   across ${products.length} product(s)`);
const cd = considered.filter((r) => r.hasCountdown);
console.log(`F106 pages with a countdown:  ${cd.length}  —  unspaced (DEFECT): ${cd.filter((r) => !r.spaced).length}`);
console.log("");
for (const p of products) {
  const tiers = lacking.filter((r) => r.route === p).map((r) => r.tier).join("+");
  console.log(`  LACKS  ${p}  (${tiers})`);
}
const withFreeze = [...new Set(considered.filter((r) => r.freeze).map((r) => r.route))].sort();
if (withFreeze.length) {
  console.log("");
  for (const p of withFreeze) console.log(`  has    ${p}`);
}
