// ── EMAIL HEALTH CHECKS (TEMPORAL v1 · Step 4.6) ─────────────────────────
// Standing conditions the operator must be told about, computed from the DB
// rather than from a single run's in-memory counters — so a condition caused by
// a PREVIOUS run (or by the webhook path, which is not a cron at all) is still
// surfaced.
//
// The four conditions, per dispatch:
//   1. more than one email per recipient per 24h   — the containment invariant
//   2. any past-date skip                          — an upstream scheduling defect
//   3. any send failure                            — a customer got nothing
//   4. any purchase with no confirmed delivery within N minutes
//
// Output is a list of human-readable alert lines. The caller feeds them to the
// route's EXISTING alertOperator helper (per dispatch — no new mail path).
// The same report is served read-only by /api/health/email.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Sb } from "@/lib/email-observability";

// ── N ─────────────────────────────────────────────────────────────────────
// A purchase with no confirmed delivery after this long is an alert.
//
// N = 15 MINUTES. Reasoning:
//   · The healthy path is SECONDS. The delivery email is sent inline in the
//     Stripe webhook and AWAITED before the response returns, then
//     purchases.delivery_status is stamped in the same request. A purchase that
//     has no delivery after 15 minutes is not slow — it is broken.
//   · 15 min is ~60x the healthy path, which absorbs every benign delay we have
//     actually observed: a Stripe webhook retry, the `after()` assessment tail,
//     a Resend queue delay, and a delivered-event arriving out of order.
//   · Under ~5 min would alert on ordinary jitter and train the operator to
//     ignore the alert — the failure mode that let the FRCGW silent
//     non-delivery run for hours.
//   · Over ~30 min stops being an alert and becomes a daily report: the whole
//     point is that a paying customer who received nothing is surfaced while
//     the operator can still act within the same hour.
export const UNDELIVERED_PURCHASE_MINUTES = 15;

// Standing conditions are evaluated over a rolling 24h window so a given fault
// alerts for a day and then stops, rather than re-alerting forever.
const LOOKBACK_HOURS = 24;

export interface MultiSendRecipient { recipient: string; count: number; emailTypes: string[] }
export interface SkipEvent    { recipient: string; emailType: string; reason: string; occurredAt: string | null; queueRowId: string | null }
export interface FailureEvent { recipient: string; emailType: string; error: string; occurredAt: string | null }
export interface UndeliveredPurchase {
  id:             string;
  customerEmail:  string | null;
  productKey:     string | null;
  createdAt:      string;
  deliveryStatus: string | null;
  reason:         "no_delivery_asserted" | "asserted_but_not_evidenced";
}

export interface EmailHealthReport {
  checkedAt:            string;
  lookbackHours:        number;
  undeliveredAfterMins: number;
  multiSendRecipients:  MultiSendRecipient[];
  pastDateSkips:        SkipEvent[];
  sendFailures:         FailureEvent[];
  undeliveredPurchases: UndeliveredPurchase[];
  deliveryEvidenceLive: boolean;   // true once the Resend webhook has written any delivery_state
  alerts:               string[];  // empty = healthy
  errors:               string[];  // checks that could not be evaluated (e.g. DDL not yet applied)
}

export async function collectEmailHealth(sb: Sb): Promise<EmailHealthReport> {
  const now       = Date.now();
  const since     = new Date(now - LOOKBACK_HOURS * 3_600_000).toISOString();
  const undelCut  = new Date(now - UNDELIVERED_PURCHASE_MINUTES * 60_000).toISOString();

  const report: EmailHealthReport = {
    checkedAt:            new Date(now).toISOString(),
    lookbackHours:        LOOKBACK_HOURS,
    undeliveredAfterMins: UNDELIVERED_PURCHASE_MINUTES,
    multiSendRecipients:  [],
    pastDateSkips:        [],
    sendFailures:         [],
    undeliveredPurchases: [],
    deliveryEvidenceLive: false,
    alerts:               [],
    errors:               [],
  };

  // ── 1. MORE THAN ONE EMAIL PER RECIPIENT PER 24h ────────────────────────
  // This is the Phase 1.3 containment invariant. If it is ever violated the cap
  // has a hole, so this check is the invariant's audit — never the cap itself.
  try {
    const { data, error } = await sb
      .from("email_log")
      .select("recipient_email, email_type, sent_at")
      .eq("status", "sent")
      .gte("sent_at", since);
    if (error) throw new Error(error.message);
    const byRecipient = new Map<string, string[]>();
    for (const r of (data ?? []) as { recipient_email?: string | null; email_type?: string | null }[]) {
      if (!r.recipient_email) continue;
      const k = r.recipient_email.toLowerCase();
      const list = byRecipient.get(k) ?? [];
      list.push(r.email_type ?? "unknown");
      byRecipient.set(k, list);
    }
    for (const [recipient, types] of byRecipient) {
      if (types.length > 1) {
        report.multiSendRecipients.push({ recipient, count: types.length, emailTypes: types });
      }
    }
    report.multiSendRecipients.sort((a, b) => b.count - a.count);
  } catch (err) {
    report.errors.push(`multi_send_check: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2. ANY PAST-DATE SKIP ───────────────────────────────────────────────
  // Window-skips (deadline_passed / trigger_stale / cap_starved) mean an email
  // reached its send date already outside its own window — always an upstream
  // defect signal, never routine.
  try {
    const { data, error } = await sb
      .from("email_log")
      .select("recipient_email, email_type, error_message, occurred_at, queue_row_id")
      .eq("status", "skipped")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as any[]) {
      report.pastDateSkips.push({
        recipient:  r.recipient_email ?? "?",
        emailType:  r.email_type ?? "?",
        reason:     r.error_message ?? "?",
        occurredAt: r.occurred_at ?? null,
        queueRowId: r.queue_row_id ?? null,
      });
    }
  } catch (err) {
    report.errors.push(`past_date_skip_check: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 3. ANY SEND FAILURE ─────────────────────────────────────────────────
  try {
    const { data, error } = await sb
      .from("email_log")
      .select("recipient_email, email_type, error_message, occurred_at")
      .eq("status", "failed")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as any[]) {
      report.sendFailures.push({
        recipient:  r.recipient_email ?? "?",
        emailType:  r.email_type ?? "?",
        error:      r.error_message ?? "?",
        occurredAt: r.occurred_at ?? null,
      });
    }
  } catch (err) {
    report.errors.push(`send_failure_check: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 4. PURCHASE WITH NO CONFIRMED DELIVERY WITHIN N MINUTES ─────────────
  // Two distinct faults, deliberately reported separately:
  //   a) no_delivery_asserted       — we never even recorded sending it.
  //      This is the FRCGW live failure mode (paid, delivery_status stuck).
  //   b) asserted_but_not_evidenced — we say we sent it, but Resend never
  //      confirmed delivery. Only meaningful once the Step 4.5 webhook is live,
  //      so this arm SELF-ENABLES: it stays silent until some row carries a
  //      delivery_state, then starts holding sends to evidence rather than
  //      assertion.
  try {
    const { data: evidence } = await sb
      .from("email_log").select("id").not("delivery_state", "is", null).limit(1);
    report.deliveryEvidenceLive = ((evidence ?? []) as unknown[]).length > 0;
  } catch { /* treat as not-live; the a) arm still runs */ }

  try {
    const { data, error } = await sb
      .from("purchases")
      .select("id, customer_email, product_key, created_at, delivery_status, site")
      .eq("site", "taxchecknow")
      .gte("created_at", since)
      .lte("created_at", undelCut)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as any[];
    const assertedIds: string[] = [];
    for (const p of rows) {
      if (p.delivery_status !== "sent") {
        report.undeliveredPurchases.push({
          id: p.id, customerEmail: p.customer_email ?? null, productKey: p.product_key ?? null,
          createdAt: p.created_at, deliveryStatus: p.delivery_status ?? null,
          reason: "no_delivery_asserted",
        });
      } else {
        assertedIds.push(p.id);
      }
    }

    if (report.deliveryEvidenceLive && assertedIds.length > 0) {
      const { data: logs } = await sb
        .from("email_log")
        .select("purchase_id, delivery_state")
        .in("purchase_id", assertedIds)
        .eq("email_type", "delivery");
      const evidenced = new Set<string>();
      for (const l of ((logs ?? []) as any[])) {
        if (l.purchase_id && l.delivery_state === "delivered") evidenced.add(l.purchase_id);
      }
      for (const p of rows) {
        if (p.delivery_status === "sent" && !evidenced.has(p.id)) {
          report.undeliveredPurchases.push({
            id: p.id, customerEmail: p.customer_email ?? null, productKey: p.product_key ?? null,
            createdAt: p.created_at, deliveryStatus: p.delivery_status ?? null,
            reason: "asserted_but_not_evidenced",
          });
        }
      }
    }
  } catch (err) {
    report.errors.push(`undelivered_purchase_check: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── ALERT LINES ─────────────────────────────────────────────────────────
  for (const m of report.multiSendRecipients) {
    report.alerts.push(
      `CAP BREACH — ${m.recipient} received ${m.count} emails in ${LOOKBACK_HOURS}h ` +
      `(${m.emailTypes.join(", ")}). The per-recipient 24h cap should make this impossible.`,
    );
  }
  for (const s of report.pastDateSkips) {
    report.alerts.push(
      `PAST-DATE SKIP — ${s.recipient} | ${s.emailType} | ${s.reason} | ${s.occurredAt ?? "no timestamp"}` +
      (s.queueRowId ? ` | queue_row ${s.queueRowId}` : ""),
    );
  }
  for (const f of report.sendFailures) {
    report.alerts.push(`SEND FAILURE — ${f.recipient} | ${f.emailType} | ${f.error} | ${f.occurredAt ?? "no timestamp"}`);
  }
  for (const p of report.undeliveredPurchases) {
    report.alerts.push(
      `UNDELIVERED PURCHASE (>${UNDELIVERED_PURCHASE_MINUTES}m) — ${p.reason} | purchase ${p.id} | ` +
      `${p.customerEmail ?? "no email"} | ${p.productKey ?? "no product"} | paid ${p.createdAt} | ` +
      `delivery_status=${p.deliveryStatus ?? "null"}`,
    );
  }
  for (const e of report.errors) {
    report.alerts.push(`HEALTH CHECK COULD NOT RUN — ${e}`);
  }

  return report;
}

// Compact multi-line summary for the operator email body.
export function formatHealthForOperator(report: EmailHealthReport): string {
  if (report.alerts.length === 0) {
    return `Email health: OK (no standing conditions in the last ${report.lookbackHours}h).`;
  }
  return (
    `Email health at ${report.checkedAt} — ${report.alerts.length} condition(s), ` +
    `lookback ${report.lookbackHours}h, undelivered threshold ${report.undeliveredAfterMins}m:\n` +
    report.alerts.map(a => `  · ${a}`).join("\n")
  );
}
