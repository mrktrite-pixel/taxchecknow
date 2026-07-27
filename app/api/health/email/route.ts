// ── EMAIL HEALTH ENDPOINT (TEMPORAL v1 · Step 4.7) ───────────────────────
// GET /api/health/email    Authorization: Bearer ${CRON_SECRET}
//
// Read-only. No writes, no UI. Answers the three questions that previously
// required a DB diff:
//   · when did each email cron last run, and what did it do
//   · how deep is the queue, by status
//   · how old is the oldest queued row
// plus the Step 4.6 standing conditions, so an external monitor can poll this
// every few minutes without waiting for the daily cron to notice.
//
// AUTH: the same CRON_SECRET bearer the crons use. This exposes recipient
// addresses and queue contents, so it is not public — and reusing CRON_SECRET
// avoids introducing another secret to rotate.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { collectEmailHealth } from "@/lib/email-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CRON_ROUTES = ["/api/cron/send-emails", "/api/cron/re-engagement"];

export async function GET(request: Request) {
  const expectedAuth = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expectedAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createClient(supabaseUrl, supabaseKey) as any;

  const now    = Date.now();
  const errors: string[] = [];

  // ── LAST RUN PER ROUTE ──────────────────────────────────────────────────
  const lastRuns: Record<string, unknown> = {};
  for (const route of CRON_ROUTES) {
    try {
      const { data, error } = await sb
        .from("email_cron_runs")
        .select("run_id, route, started_at, finished_at, duration_ms, processed, sent, failed, skipped, window_skipped, deferred, ok")
        .eq("route", route)
        .order("started_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      const row = ((data ?? []) as Record<string, unknown>[])[0];
      lastRuns[route] = row
        ? { ...row, ageMinutes: Math.round((now - Date.parse(row.started_at as string)) / 60_000) }
        : null;   // null = this route has not run since Step 4 shipped
    } catch (err) {
      lastRuns[route] = null;
      errors.push(`last_run(${route}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── QUEUE DEPTH BY STATUS ───────────────────────────────────────────────
  const queueByStatus: Record<string, number> = {};
  for (const status of ["queued", "sent", "failed", "skipped"]) {
    try {
      const { count, error } = await sb
        .from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (error) throw new Error(error.message);
      queueByStatus[status] = count ?? 0;
    } catch (err) {
      errors.push(`queue_depth(${status}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── OLDEST QUEUED ROW ───────────────────────────────────────────────────
  // Reported two ways, because they answer different questions:
  //   · oldestByCreatedAt  — how long has anything been sitting in the queue
  //   · oldestDueByTrigger — the oldest row that is ALREADY DUE and still queued,
  //     which is the one that actually indicates a stall (a row dated next month
  //     is not late, it is early).
  let oldestQueued: Record<string, unknown> | null = null;
  let oldestDue:    Record<string, unknown> | null = null;
  const todayIso = new Date().toISOString().split("T")[0];
  try {
    const { data, error } = await sb
      .from("email_queue")
      .select("id, customer_email, email_type, product_key, trigger_date, created_at, deferral_count, last_deferred_at, last_deferred_reason")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = ((data ?? []) as Record<string, unknown>[])[0];
    if (row) {
      oldestQueued = { ...row, ageHours: Math.round((now - Date.parse(row.created_at as string)) / 3_600_000) };
    }
  } catch (err) {
    errors.push(`oldest_queued: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const { data, error } = await sb
      .from("email_queue")
      .select("id, customer_email, email_type, product_key, trigger_date, created_at, deferral_count, last_deferred_at, last_deferred_reason")
      .eq("status", "queued")
      .lte("trigger_date", todayIso)
      .order("trigger_date", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = ((data ?? []) as Record<string, unknown>[])[0];
    if (row) {
      const daysLate = Math.round(
        (Date.parse(todayIso + "T00:00:00Z") - Date.parse((row.trigger_date as string) + "T00:00:00Z")) / 86_400_000,
      );
      oldestDue = { ...row, daysPastTrigger: daysLate };
    }
  } catch (err) {
    errors.push(`oldest_due: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── STANDING CONDITIONS (4.6) ───────────────────────────────────────────
  const health = await collectEmailHealth(sb);

  const ok = health.alerts.length === 0 && errors.length === 0;

  return NextResponse.json({
    ok,
    checkedAt: new Date(now).toISOString(),
    lastRuns,
    queue: {
      byStatus:            queueByStatus,
      oldestQueued,
      oldestDueStillQueued: oldestDue,
    },
    health,
    errors,
  });
}
