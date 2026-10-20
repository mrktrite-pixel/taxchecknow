// cole/__tests__/delivery-gate.test.ts — F146 + F147.
//
//   RUN: npx cross-env TS_NODE_PROJECT=cole/tsconfig.json node --import ts-node/esm --test \
//          cole/__tests__/delivery-gate.test.ts
//
// The truth table is asserted, not inferred from where the code sits in the handler — which is
// precisely how both defects got in: "email before assessment" and "already processed means a
// purchase row exists" were consequences of line order, never decisions anyone wrote down.
//
// The last two tests read the route's source. They are deliberately NOT greps for a phrase the
// fix introduces (a test that matches its own fix passes forever): they assert that
// sendDeliveryEmail has exactly one call site and that it is inside deliverAndLog, which is a
// structural fact about the file that a future edit moving the send back into the request path
// would break.

import { test } from "node:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { req, COLE_ROOT } from "./_surfaces.ts";

const { sessionAction, deliveryDecision } = req(path.join(COLE_ROOT, "..", "lib", "delivery-gate.ts"));

const ROUTE = path.join(COLE_ROOT, "..", "app", "api", "stripe", "webhook", "route.ts");

test("F147 · what to do with an incoming session", (t) => {
  t.assert.strictEqual(sessionAction({ purchaseExists: false, assessmentExists: false }), "process");
  // A first-time session with an assessment already present cannot really happen, but if it does
  // the purchase still has to be recorded — the money is the thing that must never be lost.
  t.assert.strictEqual(sessionAction({ purchaseExists: false, assessmentExists: true }), "process");
  t.assert.strictEqual(sessionAction({ purchaseExists: true,  assessmentExists: true }), "skip");
  // THE DEFECT. This returned "skip" in every form before F147, so a resent event did nothing.
  t.assert.strictEqual(sessionAction({ purchaseExists: true,  assessmentExists: false }), "repair");
});

test("F146 · a missing assessment withholds the email, always", (t) => {
  t.assert.deepStrictEqual(
    deliveryDecision({ assessmentStored: false, deliveryAlreadySent: false }),
    { send: false, reason: "no-assessment" },
  );
  // No-assessment OUTRANKS already-sent: the reason reported must be the one that matters, because
  // it is the one the operator alert is written about.
  t.assert.deepStrictEqual(
    deliveryDecision({ assessmentStored: false, deliveryAlreadySent: true }),
    { send: false, reason: "no-assessment" },
  );
});

test("F146 · a stored assessment sends exactly one email", (t) => {
  t.assert.deepStrictEqual(deliveryDecision({ assessmentStored: true, deliveryAlreadySent: false }), { send: true });
  // The repair path: the row is now there, but the buyer already has the email.
  t.assert.deepStrictEqual(
    deliveryDecision({ assessmentStored: true, deliveryAlreadySent: true }),
    { send: false, reason: "already-sent" },
  );
});

test("F146 · across the whole table, an email is sent only with a stored assessment", (t) => {
  for (const assessmentStored of [true, false]) {
    for (const deliveryAlreadySent of [true, false]) {
      const d = deliveryDecision({ assessmentStored, deliveryAlreadySent });
      if (d.send) {
        t.assert.strictEqual(assessmentStored, true, "sent an email with no stored assessment");
        t.assert.strictEqual(deliveryAlreadySent, false, "sent a second email for one purchase");
      }
    }
  }
});

test("F146 · the delivery email has ONE call site, and it is not in the request path", (t) => {
  const src = fs.readFileSync(ROUTE, "utf-8");

  const calls = src.match(/await sendDeliveryEmail\(/g) ?? [];
  t.assert.strictEqual(calls.length, 1, `expected exactly one sendDeliveryEmail call, found ${calls.length}`);

  // It must live inside deliverAndLog, which is only ever called from inside after().
  const fnStart = src.indexOf("async function deliverAndLog(");
  const fnEnd = src.indexOf("\n// ── MAIN HANDLER", fnStart);
  t.assert.ok(fnStart > 0, "deliverAndLog is gone — did the send move back into the handler?");
  t.assert.ok(fnEnd > fnStart, "could not find the end of deliverAndLog");
  const sendAt = src.indexOf("await sendDeliveryEmail(");
  t.assert.ok(sendAt > fnStart && sendAt < fnEnd, "sendDeliveryEmail is not inside deliverAndLog");

  // And the handler reaches it only through an after() callback.
  const handler = src.slice(src.indexOf("export async function POST("));
  const deliverCalls = handler.match(/deliverAndLog\(/g) ?? [];
  t.assert.strictEqual(deliverCalls.length, 1, "deliverAndLog should be called once from the handler");
  t.assert.ok(
    handler.indexOf("after(async () => {") < handler.indexOf("deliverAndLog("),
    "deliverAndLog is called before the after() block opens — that is the request path again",
  );
});

test("F146 · the assessment store reports whether the row landed", (t) => {
  const src = fs.readFileSync(ROUTE, "utf-8");
  // A void return cannot gate anything. This is the signature the gate depends on.
  t.assert.match(src, /async function generateAndStoreAssessment\([\s\S]*?\): Promise<boolean> \{/);
  // And its upsert error is checked — an unchecked write would make the claim meaningless, since
  // supabase-js resolves with { error } instead of throwing.
  t.assert.match(src, /const \{ error: upsertErr \} = await \(supabase as any\)\.from\("assessments"\)\.upsert\(/);
  t.assert.match(src, /if \(upsertErr\) \{/);
});
