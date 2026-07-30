// ─────────────────────────────────────────────────────────────────────────────
// COLE snapshot suite — HYGIENE (the orphan check).
//
// node:test has NO obsolete-snapshot detection. Verified by experiment: dropping
// a stray .snap into __snapshots__/ and running the suite reports pass, fail 0,
// and never mentions it. Jest says "1 snapshot obsolete"; node:test says nothing.
// At 600+ files a retired product's snapshot would sit there forever, and the
// suite would keep looking green while locking output for a product that no
// longer exists.
//
// So this file is the missing check. It compares the DIRECTORY LISTING against
// the expectations derived from the configs, in three directions:
//
//   1. ORPHAN   — a .snap on disk that no enabled surface expects. Fails, named.
//   2. MISSING  — an enabled, non-excluded surface with no .snap. Fails, named.
//   3. FORBIDDEN— a .snap for a DELIBERATELY EXCLUDED surface (an engineNative
//                 product's calculator, a hand-authored corpus). Fails, named,
//                 because its existence means someone snapshotted output the
//                 generator refuses to emit.
//
// Direction 3 is why the exclusions live in _surfaces.ts as data. An excluded
// surface's ABSENCE must not read as missing, and its PRESENCE must not pass.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import * as fs from "node:fs";
import { SNAP_DIR, SURFACES, expectations, loadConfigs } from "./_surfaces.ts";

const configs = loadConfigs();
const expected = expectations(configs);

// node:test runs test FILES CONCURRENTLY. During `npm run test:snap:update` the
// success-pages file is still writing into __snapshots__/ while this file reads
// it, so the directory checks would report snapshots as missing that are being
// created a millisecond later. Mid-write is not a state worth asserting on. The
// runner sets COLE_SNAP_UPDATE for update runs only; the next plain run asserts
// the finished directory.
const UPDATING = process.env.COLE_SNAP_UPDATE === "1";
const dirChecks = { skip: UPDATING ? "snapshot update in progress — directory is mid-write" : false };

function onDisk(): string[] {
  if (!fs.existsSync(SNAP_DIR)) return [];
  return fs.readdirSync(SNAP_DIR).filter(f => f.endsWith(".snap")).sort();
}

test("the manifest itself is non-vacuous", (t) => {
  const enabled = SURFACES.filter(s => s.enabled).map(s => s.key);
  t.assert.ok(configs.length >= 40, `expected ~48 configs, loaded ${configs.length}`);
  t.assert.ok(enabled.length > 0, "no surface is enabled — every hygiene check below would pass vacuously");
  t.assert.ok(expected.length > 0, "expectations() produced nothing");
  console.log(`   enabled surfaces: ${enabled.join(", ")}`);
  console.log(`   products: ${configs.length}   expectations: ${expected.length}` +
    `  (expected=${expected.filter(e => e.state === "expected").length}` +
    ` forbidden=${expected.filter(e => e.state === "forbidden").length})`);
});

test("no ORPHAN snapshots — every .snap on disk is accounted for", dirChecks, (t) => {
  const known = new Set(expected.map(e => e.file));
  const orphans = onDisk().filter(f => !known.has(f));
  if (orphans.length) {
    console.error("   ORPHANED SNAPSHOT FILES (no enabled surface expects these):");
    for (const o of orphans) console.error(`     ${o}`);
    console.error("   If the product was retired, delete its snapshots. If a surface was renamed,");
    console.error("   update cole/__tests__/_surfaces.ts. Do NOT leave them: they lock output for");
    console.error("   something that no longer exists and the suite will keep reporting green.");
  }
  t.assert.deepStrictEqual(orphans, [], `${orphans.length} orphaned snapshot file(s): ${orphans.join(", ")}`);
});

test("no MISSING snapshots for enabled, non-excluded surfaces", dirChecks, (t) => {
  const present = new Set(onDisk());
  const missing = expected.filter(e => e.state === "expected" && !present.has(e.file)).map(e => e.file);
  if (missing.length) {
    console.error(`   MISSING ${missing.length} snapshot(s) — run: npm run test:snap:update`);
    for (const m of missing.slice(0, 12)) console.error(`     ${m}`);
  }
  t.assert.deepStrictEqual(missing, [], `${missing.length} missing snapshot(s)`);
});

test("no snapshots for DELIBERATELY EXCLUDED surfaces", dirChecks, (t) => {
  const present = new Set(onDisk());
  const forbidden = expected.filter(e => e.state === "forbidden" && present.has(e.file));
  if (forbidden.length) {
    console.error("   SNAPSHOT EXISTS FOR A SURFACE THE GENERATOR REFUSES TO EMIT:");
    for (const f of forbidden) console.error(`     ${f.file}\n       reason it is excluded: ${f.reason}`);
  }
  t.assert.deepStrictEqual(forbidden.map(f => f.file), [], "snapshot present for an excluded surface");

  // Report the exclusions positively too, so the suite states what it is NOT
  // covering rather than leaving it to be inferred from an absence.
  for (const s of SURFACES) {
    const ex = configs.filter(c => s.excluded(c.config)).map(c => c.id);
    if (ex.length) console.log(`   ${s.key}: ${ex.length} product(s) excluded by design — ${ex.join(", ")}` + (s.enabled ? "" : "  [surface not yet enabled]"));
  }
});
