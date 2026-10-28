// cole/__tests__/geo-bake-guard.test.mts
//
// A generator that silently drops a product's published facts is worse than one that stops.
// Run: node --test cole/__tests__/geo-bake-guard.test.mts
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// MEASURED on allowance-sniper, 2026-10-28. A `--pages-only` run with no Supabase env in the shell
// regenerated the gate page and removed its VideoObject JSON-LD:
//
//     app/uk/check/allowance-sniper/page.tsx   videoSchema 2 -> 0 · VideoObject 1 -> 0
//
// I first reported that as "the blocks live outside the generator, so any regeneration erases
// them". THAT WAS WRONG. generate-gate-page.ts emits the VideoObject itself, from facts
// fetchGeoBake reads out of content_performance and content_jobs. Re-running WITH the env restored
// the block BYTE-EQUAL — the facts were never missing, the generator simply could not see them.
//
// fetchGeoBake's contract said "any miss returns nulls → the page generates unchanged". True for a
// page that never had a video. False for one that HAS: there, nulls strip crawler-visible
// structured data and the diff reads as a deliberate removal.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { geoBakeRefusal } from "../generators/geo-bake-guard.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "geo-guard-"));
function page(name: string, body: string): string {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "page.tsx");
  fs.writeFileSync(p, body, "utf8");
  return p;
}

const WITH_VIDEO = page("has-video", `
  const videoSchema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: "What is the UK 60% tax trap?",
  };
  <Script id="jsonld-video" type="application/ld+json" />
`);
const WITH_TRANSCRIPT = page("has-transcript", `<section id="transcript">words</section>`);
const PLAIN = page("plain", `export default function Page() { return <div/>; }`);

test("WITH the db env, nothing is ever refused", () => {
  for (const p of [WITH_VIDEO, WITH_TRANSCRIPT, PLAIN]) {
    assert.equal(geoBakeRefusal(p, true), null);
  }
});

test("WITHOUT the env, a page carrying a VideoObject is refused", () => {
  const r = geoBakeRefusal(WITH_VIDEO, false);
  assert.ok(r, "it must refuse");
  assert.match(r!, /already carries a VideoObject/);
  assert.match(r!, /would DELETE crawler-visible structured data/, "it says what the cost is");
  assert.match(r!, /NEXT_PUBLIC_SUPABASE_URL \/ SUPABASE_SERVICE_ROLE_KEY/, "and names the env by NAME");
  assert.match(r!, /--allow-geo-loss/, "and names the escape hatch, so the operator is not trapped");
});

test("a page carrying only a transcript is refused too", () => {
  const r = geoBakeRefusal(WITH_TRANSCRIPT, false);
  assert.ok(r);
  assert.match(r!, /transcript block/);
});

test("a page with NEITHER is not refused — there is nothing to lose", () => {
  assert.equal(geoBakeRefusal(PLAIN, false), null);
});

test("a product with no page yet is not refused — first emit must work offline", () => {
  assert.equal(geoBakeRefusal(path.join(tmp, "no-such", "page.tsx"), false), null);
});

test("the refusal names the product, so a --pages-only sweep says WHICH one stopped it", () => {
  const r = geoBakeRefusal(WITH_VIDEO, false);
  assert.match(r!, /has-video\/page\.tsx/);
});

test("the guard reads the file, not a flag — it cannot be fooled by a config that forgot to say so", () => {
  // The point of reading the page on disk: the facts live in the DB and the markup lives in the
  // page, so the only honest question is "does the page I am about to overwrite have one".
  const moved = page("renamed", fs.readFileSync(WITH_VIDEO, "utf8"));
  assert.ok(geoBakeRefusal(moved, false));
});
