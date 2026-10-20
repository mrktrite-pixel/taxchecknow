// cole/__tests__/corpus-headers.test.ts — F145.
//
//   RUN: npx cross-env TS_NODE_PROJECT=cole/tsconfig.json node --import ts-node/esm --test \
//          cole/__tests__/corpus-headers.test.ts
//
// WHY THIS TEST IS A BYTE-LEVEL ASSERTION ABOUT ONE HEADER NAME.
//
// The corpus fetch is the last gate before paid content is generated, and the cookie header broke
// it in a way nothing could see: no 4xx, no stack from the rules route, just `TypeError: fetch
// failed` from Node after twenty redirect hops. Both tiers of a test buy failed identically and
// the webhook recorded a delivery email as sent, so the only visible symptom was a success page
// saying "Assessment generation issue".
//
// So the header set is asserted exactly, not loosely: an extra Vercel header here is not a style
// question, it is a redirect loop.

import { test } from "node:test";
import * as path from "node:path";
import { req, COLE_ROOT } from "./_surfaces.ts";

const { corpusFetchHeaders, resolveCorpusOrigin } =
  req(path.join(COLE_ROOT, "..", "lib", "assess-core.ts"));

const selfPreview = { origin: "https://x-abc123.vercel.app", source: "VERCEL_URL (this deployment)", isSelf: true };
const production  = { origin: "https://taxchecknow.com", source: "default (production)", isSelf: false };

test("F145 · a self-origin fetch sends the bypass and NOTHING else", (t) => {
  const h = corpusFetchHeaders(selfPreview, { VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret" });
  t.assert.deepStrictEqual(Object.keys(h).sort(), ["accept", "x-vercel-protection-bypass"]);
  t.assert.strictEqual(h["x-vercel-protection-bypass"], "s3cret");
});

test("F145 · x-vercel-set-bypass-cookie is never sent", (t) => {
  // THE REGRESSION. Measured 2026-10-20: with this header the deployment answered 307 and the
  // fetch ran to 20 redirects ("redirect count exceeded"); with the bypass header alone it
  // answered 200 in zero redirects. A server-side fetch has no cookie jar to set.
  for (const target of [selfPreview, production]) {
    for (const env of [
      { VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret" },
      { VERCEL_AUTOMATION_BYPASS_SECRET: "  s3cret  " },
      {},
    ]) {
      const h = corpusFetchHeaders(target, env);
      t.assert.ok(
        !Object.keys(h).some((k) => k.toLowerCase() === "x-vercel-set-bypass-cookie"),
        `cookie header present for isSelf=${target.isSelf}, env keys=${Object.keys(env).join()}`,
      );
    }
  }
});

test("F145 · the secret is trimmed, and absent means no bypass header", (t) => {
  t.assert.strictEqual(
    corpusFetchHeaders(selfPreview, { VERCEL_AUTOMATION_BYPASS_SECRET: "  s3cret  " })["x-vercel-protection-bypass"],
    "s3cret",
  );
  t.assert.deepStrictEqual(Object.keys(corpusFetchHeaders(selfPreview, {})), ["accept"]);
  // An empty-string secret is as absent as no variable: sending an empty bypass would 401 rather
  // than fall through to the fail-closed message that names the missing variable.
  t.assert.deepStrictEqual(Object.keys(corpusFetchHeaders(selfPreview, { VERCEL_AUTOMATION_BYPASS_SECRET: "   " })), ["accept"]);
});

test("F145 · production is never sent the bypass secret", (t) => {
  // It is not a self-origin, so the secret must not leave the deployment in a header to a host
  // that has no business receiving it — even though in practice both are taxchecknow.
  t.assert.deepStrictEqual(
    Object.keys(corpusFetchHeaders(production, { VERCEL_AUTOMATION_BYPASS_SECRET: "s3cret" })),
    ["accept"],
  );
});

test("F57 · the origin rule this depends on still holds", (t) => {
  // corpusFetchHeaders only sends the bypass when isSelf, so the pairing is part of the contract:
  // a preview reads ITS OWN corpus (F57) and therefore needs the bypass; production does not.
  const preview = resolveCorpusOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "x-abc123.vercel.app" });
  t.assert.strictEqual(preview.isSelf, true);
  t.assert.strictEqual(preview.origin, "https://x-abc123.vercel.app");

  const prod = resolveCorpusOrigin({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://taxchecknow.com" });
  t.assert.strictEqual(prod.isSelf, false);
});
