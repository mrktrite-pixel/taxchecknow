// lib/delivery-gate.ts — F146 + F147. The two decisions the Stripe webhook makes about a session,
// as rules with names.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// WHY THESE ARE NOT INLINE CONDITIONALS
//
// Both were, and both were wrong in the same way: each was a side effect of WHERE code sat in the
// handler rather than a decision anybody had written down.
//
//   F146  The delivery email was awaited in the request; the assessment was deferred to after().
//         So "email before assessment" was not a policy, it was a consequence of line order — and
//         on 2026-10-20 it produced, for both tiers of build 7995b89f: purchases
//         delivery_status=sent, email_log delivery_state=delivered, assessments 0 rows. An
//         immaculate delivery record for a pack that did not exist, and a buyer holding an email
//         that said their assessment was ready, pointing at a page reading "Assessment generation
//         issue" with every field "being prepared".
//
//   F147  "Already processed" was `a purchase row exists`, checked before the assessment step. So
//         a session whose assessment had failed could never be repaired: resending the Stripe
//         event — the one tool available — hit that guard and returned. Measured the same day,
//         after F145 had fixed the underlying cause:
//
//             [webhook] duplicate — session already processed, skipping: cs_test_a18Ocdo…
//             [webhook] duplicate — session already processed, skipping: cs_test_a1dOOZp…
//
//         Nothing was retried. The two are coupled: gating the email on a row that cannot be
//         repaired would turn one bad page into permanent silence, so F146 is only safe with F147.
//
// PURE, so the truth table is asserted rather than inferred from the shape of the handler.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** What to do with an incoming checkout.session.completed for a session we may have seen. */
export type SessionAction =
  /** Never seen: insert the purchase, generate, deliver. */
  | "process"
  /** Purchase exists but no assessment: generate and store it, deliver only if nothing was sent. */
  | "repair"
  /** Purchase and assessment both exist: do nothing at all. */
  | "skip";

export function sessionAction(facts: { purchaseExists: boolean; assessmentExists: boolean }): SessionAction {
  if (!facts.purchaseExists) return "process";
  return facts.assessmentExists ? "skip" : "repair";
}

export type DeliveryDecision =
  | { send: true }
  | { send: false; reason: "no-assessment" | "already-sent" };

/**
 * May the "your pack is ready" email go out?
 *
 * NO ASSESSMENT WINS OVER EVERYTHING. A missing row is the condition that must never be
 * accompanied by a delivery email, so it is checked first and is not overridable by anything
 * below it.
 *
 * `deliveryAlreadySent` is the repair path: the email went out before the assessment failed, and a
 * second one would be a duplicate delivery for a single purchase.
 */
export function deliveryDecision(facts: {
  assessmentStored: boolean;
  deliveryAlreadySent: boolean;
}): DeliveryDecision {
  if (!facts.assessmentStored) return { send: false, reason: "no-assessment" };
  if (facts.deliveryAlreadySent) return { send: false, reason: "already-sent" };
  return { send: true };
}
