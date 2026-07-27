// ── EMAIL OBSERVABILITY (TEMPORAL v1 · Step 4) ───────────────────────────
// Shared run-identity, event-ledger and run-recording helpers for the email
// crons.
//
// WHY THIS EXISTS
// Before Step 4 a cron invocation was a black box: the route emitted no console
// line at all, and the only carrier of its outcome was the HTTP response body —
// which Vercel discards for scheduled invocations. Worse, a DEFERRED row (over
// the per-recipient 24h cap) wrote NOTHING anywhere: `continue` with no DB
// write, no email_log row, no log line. It was the only outcome in the system
// with zero durable trace, and it could silently mature into a DROPPED email via
// the trigger_stale floor.
//
// Everything here is additive and non-fatal: a failed observability write is
// logged loudly but never breaks a send.
//
// Requires the Step 4 DDL (email_log.run_id/queue_row_id/occurred_at,
// public.email_cron_runs). See the Step 4 HOLD report for the paste block.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomUUID } from "node:crypto";

// The email crons all hold a service-role client cast to `any` (the codebase's
// existing convention — see send-emails route: `const sb = supabase as any`).
export type Sb = any;

export type EmailEventStatus = "sent" | "failed" | "deferred" | "skipped";

export interface EmailRunCounts {
  processed:     number;
  sent:          number;
  failed:        number;
  skipped:       number;
  windowSkipped: number;
  deferred:      number;
}

export function zeroCounts(): EmailRunCounts {
  return { processed: 0, sent: 0, failed: 0, skipped: 0, windowSkipped: 0, deferred: 0 };
}

// One id per invocation. Stamped onto every email_log event the run writes and
// onto the email_cron_runs row, so "what did run X do" is a single SELECT.
export function newRunId(): string {
  return randomUUID();
}

// ── 4.4 — STRUCTURED RUN LINE ────────────────────────────────────────────
// One JSON line per run, ALWAYS — including a run that did nothing at all.
// A zero-activity run is a meaningful observation ("the cron fired and found
// nothing"), and its absence is what made the 2026-07-27 discrepancy take a DB
// diff to explain. Single-line JSON so Vercel log search can filter on
// `email_cron_run` and the fields stay greppable.
export function logRunOutcome(
  route:       string,
  runId:       string,
  startedAtMs: number,
  counts:      EmailRunCounts,
  extra?:      Record<string, unknown>,
): void {
  const finishedAtMs = Date.now();
  console.log(
    JSON.stringify({
      tag:         "email_cron_run",
      route,
      run_id:      runId,
      started_at:  new Date(startedAtMs).toISOString(),
      finished_at: new Date(finishedAtMs).toISOString(),
      duration_ms: finishedAtMs - startedAtMs,
      ...counts,
      ok:          counts.failed === 0,
      ...(extra ?? {}),
    }),
  );
}

// ── 4.2 — EVENT LEDGER WRITE ─────────────────────────────────────────────
// email_log is no longer a send-only log; it records every terminal thing that
// happened to a queued email, including the non-sends (deferred / skipped).
//
// Safety: every existing consumer — notably the per-recipient 24h cap in both
// crons — filters on `status='sent'` AND `sent_at`. Deferred/skipped events
// carry status != 'sent' and sent_at = null, so they are inert to all existing
// logic. Zero blast radius.
export async function logEmailEvent(
  sb: Sb,
  ev: {
    runId:           string;
    recipientEmail:  string;
    emailType:       string;
    status:          EmailEventStatus;
    subject?:        string | null;
    productKey?:     string | null;
    queueRowId?:     string | null;
    purchaseId?:     string | null;
    resendId?:       string | null;
    errorMessage?:   string | null;
    sentAt?:         string | null;
  },
): Promise<boolean> {
  // Columns that exist on email_log BEFORE the Step 4 DDL.
  const legacy = {
    recipient_email: ev.recipientEmail,
    email_type:      ev.emailType,
    subject:         ev.subject      ?? null,
    status:          ev.status,
    product_key:     ev.productKey   ?? null,
    purchase_id:     ev.purchaseId   ?? null,
    resend_id:       ev.resendId     ?? null,
    error_message:   ev.errorMessage ?? null,
    sent_at:         ev.sentAt       ?? null,
  };

  try {
    const { error } = await sb.from("email_log").insert({
      ...legacy,
      queue_row_id: ev.queueRowId ?? null,
      occurred_at:  new Date().toISOString(),
      run_id:       ev.runId,
    });
    if (error) {
      // supabase-js .insert() RESOLVES with { error } rather than throwing —
      // the exact silent-failure mode Phase 1.4a fixed on the webhook path.
      // Never let an observability write fail quietly; that defeats the point.
      console.error(
        JSON.stringify({
          tag: "email_log_write_failed", run_id: ev.runId, status: ev.status,
          recipient: ev.recipientEmail, email_type: ev.emailType, error: error.message,
        }),
      );

      // DEPLOY-ORDER SAFETY NET. If the code lands before the DDL, PostgREST
      // rejects the whole insert for the unknown columns (PGRST204). Without
      // this fallback that would stop ALL email_log writes — including the
      // 'sent' rows the per-recipient 24h cap reads, which would quietly
      // disable the cap. Retry once with the pre-Step-4 column set so the
      // system degrades to its previous behaviour instead of breaking, and say
      // loudly that the DDL is missing.
      //
      // 'deferred' is deliberately NOT retried: a deferral row written without
      // queue_row_id or occurred_at has no row id and no timestamp, so it does
      // not satisfy 4.2 and would look like a trace while being useless. Pre-DDL
      // a deferral stays loudly unlogged rather than quietly half-logged.
      const code = (error as { code?: string }).code ?? "";
      const missingColumn = code === "PGRST204" || /column/i.test(error.message ?? "");
      if (missingColumn && ev.status !== "deferred") {
        const { error: retryErr } = await sb.from("email_log").insert(legacy);
        if (!retryErr) {
          console.error(
            JSON.stringify({
              tag: "email_log_degraded_step4_ddl_missing", run_id: ev.runId,
              status: ev.status, recipient: ev.recipientEmail,
              note: "wrote legacy columns only — run the Step 4 DDL",
            }),
          );
          return true;
        }
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      JSON.stringify({
        tag: "email_log_write_threw", run_id: ev.runId, status: ev.status,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  }
}

// ── 4.4 / 4.7 — DURABLE RUN ROW ──────────────────────────────────────────
// The console line above is greppable but ephemeral (Vercel log retention).
// email_cron_runs is the queryable record the health endpoint reads for
// "last run time and outcome". Written for every run, zero-activity included.
export async function recordCronRun(
  sb: Sb,
  args: {
    runId:       string;
    route:       string;
    startedAtMs: number;
    counts:      EmailRunCounts;
    detail?:     Record<string, unknown>;
  },
): Promise<void> {
  const finishedAtMs = Date.now();
  try {
    const { error } = await sb.from("email_cron_runs").insert({
      run_id:         args.runId,
      route:          args.route,
      started_at:     new Date(args.startedAtMs).toISOString(),
      finished_at:    new Date(finishedAtMs).toISOString(),
      duration_ms:    finishedAtMs - args.startedAtMs,
      processed:      args.counts.processed,
      sent:           args.counts.sent,
      failed:         args.counts.failed,
      skipped:        args.counts.skipped,
      window_skipped: args.counts.windowSkipped,
      deferred:       args.counts.deferred,
      ok:             args.counts.failed === 0,
      detail:         args.detail ?? null,
    });
    if (error) {
      console.error(
        JSON.stringify({ tag: "email_cron_run_write_failed", run_id: args.runId, error: error.message }),
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        tag: "email_cron_run_write_threw", run_id: args.runId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
