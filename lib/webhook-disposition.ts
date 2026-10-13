// lib/webhook-disposition.ts — F99. What a repeat checkout.session.completed should do.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// WHY THE OLD PRE-CHECK WAS THE WRONG SHAPE
//
// The webhook treated "a purchases row exists" as "this session is fully processed" and returned
// before the assessment step. That guard was written for a real problem — a live FRCGW session fired
// repeatedly and landed 5 purchase rows over ~4 hours — and it is correct about purchases, emails
// and reminders, which must never double-fire.
//
// It is wrong about the PACK, and four paid sessions prove it:
//
//   cs_test_a1o6qf…  147  28 Sep   purchase ✓  email delivered ✓  assessment ABSENT
//   cs_test_a10D8a…   67  28 Sep   purchase ✓  email delivered ✓  assessment ABSENT
//   cs_test_a10AiK…  147   7 Oct   purchase ✓  email delivered ✓  assessment ABSENT
//   cs_test_a1sFPa…   67   7 Oct   purchase ✓  email delivered ✓  assessment ABSENT
//
// All four failed closed because the deployment could not read its own corpus. All four are
// therefore PERMANENTLY un-redeliverable through Stripe: a resend hits the pre-check, logs
// "duplicate — session already processed, skipping", and stores nothing. The guard against double
// delivery had become a guard against ever delivering at all, which is the worse failure.
//
// ── THE RULE (F99) ──
//   purchase AND assessment   -> DUPLICATE. Do nothing, exactly as before.
//   purchase, NO assessment   -> REPAIR. Re-run the assessment step ONLY. No second purchase row,
//                                no second delivery email, no second reminder or nurture enqueue.
//   no purchase               -> FULL. The normal first-time path.
//
// ── AND A FAILED QUERY IS NOT AN ABSENT ROW ──
// If the assessments lookup ERRORS we must not read that as "no pack" and re-run: that would spend
// a model call on a guess, and on a repeated Stripe retry it would do so every time. An unreadable
// state is treated as DUPLICATE — do nothing — and logged loudly. Same rule the reconcile route and
// the heal script follow.
// ═════════════════════════════════════════════════════════════════════════════════════════════

export type Disposition =
  /** Fully processed already. Return immediately. */
  | "duplicate"
  /** Paid, recorded, delivered — but no pack. Re-run the assessment step and nothing else. */
  | "repair"
  /** Never seen. Run the whole path. */
  | "full"
  /** A pack is missing but the inputs to regenerate it are not available. */
  | "cannot_repair";

export interface DispositionInput {
  /** A purchases row exists for this stripe_session_id. */
  purchaseExists: boolean;
  /** An assessments row exists for it. Meaningless when assessmentQueryFailed. */
  assessmentExists: boolean;
  /** The assessments lookup itself failed — NOT the same as "no row". */
  assessmentQueryFailed?: boolean;
  /**
   * Everything generateAndStoreAssessment needs is present on this event: a DELIVERY_MAP entry,
   * a decision_session_id and a customer email. Without them a repair cannot even be attempted.
   */
  canRegenerate: boolean;
}

export function dispositionFor(input: DispositionInput): Disposition {
  if (!input.purchaseExists) return "full";
  // An unreadable assessments state is treated as already-processed. Doing nothing is recoverable;
  // a model call on a guess is not.
  if (input.assessmentQueryFailed) return "duplicate";
  if (input.assessmentExists) return "duplicate";
  return input.canRegenerate ? "repair" : "cannot_repair";
}

/** The log line for a disposition, so the decision is visible in the function logs. */
export function dispositionLine(d: Disposition, sessionId: string): string {
  switch (d) {
    case "duplicate":
      return `[webhook] duplicate — session already processed, skipping: ${sessionId}`;
    case "repair":
      return `[webhook] F99 REPAIR — purchase exists but NO assessment for ${sessionId}: re-running the ` +
             `assessment step only (no second purchase, no second email, no second reminder)`;
    case "cannot_repair":
      return `[webhook] F99 cannot repair ${sessionId} — a pack is missing but this event carries no ` +
             `delivery config / decision_session_id / customer email to regenerate it from`;
    case "full":
      return `[webhook] new session ${sessionId}`;
  }
}
