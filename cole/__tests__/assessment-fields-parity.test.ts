// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY PARITY — webhook keys must equal the keys the success pages render.
//
// THE FAILURE THIS EXISTS TO CATCH, twice measured now.
// The webhook composes a stored assessment from getAssessmentFields(productId, tier)
// (app/api/stripe/webhook/route.ts), which reads PRODUCT_ASSESSMENT_FIELDS and falls
// through to GENERIC_FIELDS for any product that is not registered. The success pages,
// meanwhile, POST their OWN per-product `fields` array on the client fallback and render
// a hardcoded six of those keys. When the two disagree, a real purchase stores a row whose
// keys the page never reads: the body renders EMPTY while First Action, the accountant
// questions and the tier-2 checklist still appear (those come from GENERIC_FIELDS plus
// assess-core's own injections), so the page looks half-built rather than broken and
// nothing errors.
//   · FRCGW hit it first — see the C8 comment in lib/assessment-fields.ts.
//   · spain-beckham-eligibility hit it again, measured 2026-09-21 on a live stored row.
// Both were found by a human reading a delivered PDF. This test is the machine that should
// have found them.
//
// KEYED THE WAY THE WEBHOOK KEYS IT. The lookup identity is DELIVERY_MAP[...].productId,
// NOT config.id — they differ on 183-day-rule ("183-day-rule" vs "day-183-rule") and on
// beckham ("spain-beckham-eligibility" vs "spain-beckham"). A test keyed on config.id would
// pass while the webhook still missed, which is the exact trap this is here to close. The
// map is PARSED from the webhook source rather than imported, so the test reads the real
// production table without importing a route module (and without this file ever being a
// reason to edit it).
//
// SCOPE: engine-native products only. A legacy bespoke product's page posts the same
// per-field keys its calculator writes, and registering those is a separate question.
//
// EXPECTED STATE ON LANDING: RED, and deliberately so. Only some engine-native products are
// registered today. The assertion collects EVERY mismatch and names each one in a single
// message, so the failure output IS the estate census — a list to work through, not a wall
// to silence. Register a product (lists copied verbatim from its emitted pages) and it drops
// off the list.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from "node:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { req, COLE_ROOT, loadConfigs } from "./_surfaces.ts";

const REPO_ROOT = path.join(COLE_ROOT, "..");

const { PRODUCT_ASSESSMENT_FIELDS } = req(
  path.join(REPO_ROOT, "lib", "assessment-fields.ts"),
) as { PRODUCT_ASSESSMENT_FIELDS: Record<string, { tier1: string[]; tier2: string[] }> };

/**
 * price key -> DELIVERY_MAP productId, parsed out of the webhook source.
 * Read-only: this test never imports or mutates the route.
 */
function deliveryProductIds(): Map<string, string> {
  const file = path.join(REPO_ROOT, "app", "api", "stripe", "webhook", "route.ts");
  const src = fs.readFileSync(file, "utf8");
  const out = new Map<string, string>();
  const re = /"([A-Za-z0-9_]+)":\s*\{[^}]*?productId:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.set(m[1], m[2]);
  if (out.size === 0) throw new Error(`[parity] parsed 0 DELIVERY_MAP entries from ${file} — refusing a vacuous pass`);
  return out;
}

const same = (a: string[] | undefined, b: string[] | undefined): boolean =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

test("assessment-fields registry matches every engine-native product's emitted fields", (t) => {
  const delivery = deliveryProductIds();
  const engineNative = loadConfigs().filter(({ config }) => config.engineNative === true);

  // A zero-length corpus would make this vacuously green — the same failure mode the
  // snapshot suite guards against.
  t.assert.ok(engineNative.length >= 5, `expected several engine-native products, found ${engineNative.length}`);

  const problems: string[] = [];

  for (const { file, config } of engineNative) {
    const priceKey: string | undefined = config.tier1?.productKey;
    if (!priceKey) { problems.push(`${file}: config.tier1.productKey missing — cannot resolve the webhook identity`); continue; }

    const productId = delivery.get(priceKey);
    if (!productId) { problems.push(`${file}: price key "${priceKey}" has no DELIVERY_MAP entry in the webhook`); continue; }

    // Both tiers must resolve to the SAME productId, or the registry cannot serve both.
    const priceKey2: string | undefined = config.tier2?.productKey;
    const productId2 = priceKey2 ? delivery.get(priceKey2) : undefined;
    if (priceKey2 && productId2 !== productId) {
      problems.push(`${file}: tier1/tier2 DELIVERY_MAP productIds disagree ("${productId}" vs "${productId2}")`);
    }

    const entry = PRODUCT_ASSESSMENT_FIELDS[productId];
    if (!entry) {
      problems.push(
        `${file}: NOT REGISTERED — PRODUCT_ASSESSMENT_FIELDS["${productId}"] is absent, so the webhook stores ` +
        `GENERIC_FIELDS while the pages render this product's own keys ` +
        `(tier1 wants: ${(config.tier1AssessmentFields ?? []).join(", ")})`,
      );
      continue;
    }
    if (!same(entry.tier1, config.tier1AssessmentFields)) {
      problems.push(`${file}: tier1 mismatch\n      registry: ${JSON.stringify(entry.tier1)}\n      config:   ${JSON.stringify(config.tier1AssessmentFields)}`);
    }
    if (!same(entry.tier2, config.tier2AssessmentFields)) {
      problems.push(`${file}: tier2 mismatch\n      registry: ${JSON.stringify(entry.tier2)}\n      config:   ${JSON.stringify(config.tier2AssessmentFields)}`);
    }
  }

  t.assert.deepStrictEqual(
    problems,
    [],
    `${problems.length} engine-native product(s) out of parity — the webhook would store keys the pages never render:\n  - ` +
      problems.join("\n  - "),
  );
});
