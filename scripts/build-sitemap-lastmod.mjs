// scripts/build-sitemap-lastmod.mjs — GA-3.3. Stamp each product's real last-modified date.
//
// RUN AT BUILD TIME (prebuild), because app/sitemap.ts executes in the Next runtime where there is
// no git and no cole/ directory. The date a product page actually changed is the date its CONFIG
// changed — the page is generated from it — so that is what git is asked for.
//
// FAIL-SOFT BY CONSTRUCTION: a product with no answer is simply absent from the map, and
// sitemap.ts falls back to `now` for it, which is the pre-existing behaviour. This script can fail
// entirely and the sitemap still renders every URL.
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const OUT = path.join("app", "sitemap-lastmod.json");
const CFG = path.join("cole", "config");

function gitDate(file) {
  try {
    const iso = execFileSync("git", ["log", "-1", "--format=%cI", "--", file],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return iso || null;
  } catch { return null; }
}

const map = {};
let mapped = 0, skipped = 0;
for (const f of fs.existsSync(CFG) ? fs.readdirSync(CFG).filter((x) => x.endsWith(".ts")) : []) {
  const full = path.join(CFG, f);
  const src = fs.readFileSync(full, "utf-8");
  const slug = /["']?slug["']?\s*:\s*"([^"]+)"/.exec(src)?.[1];
  if (!slug) { skipped++; continue; }
  const iso = gitDate(full);
  if (!iso) { skipped++; continue; }
  map[`/${slug}`] = iso;
  mapped++;
}
// Written sorted so the file is a stable diff rather than churning on key order every build.
const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`[sitemap-lastmod] ${mapped} product(s) mapped, ${skipped} skipped -> ${OUT}`);
