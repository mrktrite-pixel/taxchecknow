// ── EMAIL CRON SENDER ────────────────────────────────────────────────────
// Triggered daily 09:00 UTC by Vercel cron (see vercel.json).
//
// Workflow:
//   1. Verify Authorization: Bearer ${CRON_SECRET}
//   2. Fetch up to 50 rows from email_queue where status='queued' AND
//      trigger_date <= today
//   3. For each row: build template -> Resend send -> update queue + log
//   4. On failure / window-skip / deferral: alert OPERATOR_EMAIL (if configured)
//   5. Return { sent, failed, skipped, windowSkipped, deferred, processed }
//
// TEMPORAL v1 Step 4 — this route no longer runs blind. Every run writes a
// structured console line and a public.email_cron_runs row (even a run that does
// nothing), and every non-send outcome — deferral included — writes an
// email_log event. Requires the Step 4 DDL; see the Step 4 HOLD report.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getNurtureTemplate, getReminderTemplate, isNurtureType, isReminderType,
  type EmailType, type BaseTemplateData,
} from "@/lib/email-templates/index";
import { LEAD_PRODUCT_META } from "@/lib/lead-product-meta";
import {
  newRunId, logRunOutcome, logEmailEvent, recordCronRun, zeroCounts,
} from "@/lib/email-observability";
import { collectEmailHealth, formatHealthForOperator } from "@/lib/email-alerts";
import { collectCronStaleness, cronStalenessAlerts, peerRoutes } from "@/lib/cron-staleness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM_ADDRESS = "TaxCheckNow <hello@taxchecknow.com>";
const RESEND_URL    = "https://api.resend.com/emails";
const BATCH_LIMIT   = 50;
const ROUTE         = "/api/cron/send-emails";

// Detail arrays are echoed in the response body (Step 4.3). Bound them so a
// pathological queue cannot produce an unbounded payload.
const DETAIL_LIMIT = 50;

const VALID_EMAIL_TYPES: ReadonlySet<EmailType> = new Set([
  "nurture_d3", "nurture_d7", "nurture_d14",
  "reminder_d30", "reminder_d7", "reminder_d1",
]);

interface QueueRow {
  id:                     string;
  customer_email:           string;
  customer_name?:             string | null;
  product_key?:                  string | null;
  product_id?:                     string | null;
  email_type?:                       string | null;
  days_before_deadline?:                number | null;
  trigger_date:                            string;
  subject?:                                  string | null;
  status:                                       string;
  // Step 4 — link to decision_sessions row for per-customer personalisation
  decision_session_id?:                            string | null;
  // Step 4.1 — how many times the 24h cap has deferred this row
  deferral_count?:                                    number | null;
}

// Decision session shape we read at send time. Only the fields the cron
// uses for personalisation (output.status). Embedded via PostgREST FK.
interface EmbeddedDecisionSession {
  id:        string;
  output:    Record<string, unknown> | null;
}

// ── HELPERS ──────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

// TEMPORAL v1 Phase 1.2 — sender floor + expiry. A queued row that is past its window must NOT be
// sent; it is set to 'skipped' with a reason (an upstream defect signal, visible in the report),
// never delivered. Two ways a row is "past window":
//   · deadline_passed — a deadline-anchored reminder (days_before_deadline set) whose DEADLINE
//     (trigger_date + days_before_deadline) is already in the past. This is the FRCGW class:
//     d-30/d-7/d-1 all fired AFTER the deadline.
//   · trigger_stale  — more than STALE_GRACE_DAYS past its intended send date (the cron was down,
//     or the row was deferred repeatedly). Sending a stale "N days" reminder days late misleads.
//
// TEMPORAL v1 Step 4.1 — F-OBS-2 FIX. "or the row was deferred repeatedly" was a DEFECT: a row the
// 24h cap kept deferring accumulated staleness and was then killed by the trigger_stale floor, so
// the cap could silently convert a queued email into a dropped one — and the surviving artefact
// ("trigger_stale") is the SAME signal used for "the cron was down", making the two causes
// indistinguishable after the fact.
//
// The fix keeps the two causes structurally separate:
//   · trigger_stale now applies ONLY to rows the cap has never touched (deferral_count = 0), so it
//     means exactly what it says: this row was not processed in time.
//   · A cap-deferred row (deferral_count > 0) can NEVER be skipped as trigger_stale.
//   · It is not immortal either: at MAX_DEFERRALS it terminates as `cap_starved:<n>` — its own
//     distinct reason, which alerts. Anti-limbo: no row sits queued forever, and nothing is
//     unlabeled (the Step 7 terminal-state principle applied to the queue).
//   · deadline_passed stays UNCONDITIONAL. Deferral history is irrelevant to it: a reminder whose
//     deadline has passed must never be sent, full stop. That is correctness, not scheduling.
const STALE_GRACE_DAYS = 2;

// Five consecutive deferrals is not queue contention — it is an anomaly. The cron is DAILY and the
// cap is 24h, so an ordinary same-day collision (two rows for one recipient come due together)
// resolves in exactly ONE deferral: row A sends today, row B sends tomorrow. Reaching 5 means the
// recipient received some other email on five separate days, which is a different problem and
// deserves a terminal + an alert rather than an indefinitely queued row.
const MAX_DEFERRALS = 5;

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}

// Unconditional — see above. Deferral history does not exempt a passed deadline.
function deadlineSkipReason(row: QueueRow, todayStr: string): string | null {
  if (!row.trigger_date) return null;
  if (row.days_before_deadline == null) return null;
  const deadlineStr = addDaysIso(row.trigger_date, row.days_before_deadline);
  return todayStr > deadlineStr ? `deadline_passed:${deadlineStr}` : null;
}

// Caller MUST gate this on deferral_count === 0 (Step 4.1). Evaluating it before the cap check is
// deliberate: a row that is genuinely stale from an outage is still caught on the run where it is
// first seen, instead of being deferred once and thereby made permanently exempt.
function staleSkipReason(row: QueueRow, todayStr: string): string | null {
  if (!row.trigger_date) return null;
  const floorStr = addDaysIso(todayStr, -STALE_GRACE_DAYS);
  return row.trigger_date < floorStr ? `trigger_stale:${row.trigger_date}<${floorStr}` : null;
}

// Resolve the email_type for a row.
//   - Nurture rows from /api/leads carry `email_type` already.
//   - Reminder rows from /api/stripe/webhook carry `days_before_deadline` (number).
function resolveEmailType(row: QueueRow): EmailType | null {
  if (row.email_type && VALID_EMAIL_TYPES.has(row.email_type as EmailType)) {
    return row.email_type as EmailType;
  }
  if (row.days_before_deadline === 30) return "reminder_d30";
  if (row.days_before_deadline === 7)  return "reminder_d7";
  if (row.days_before_deadline === 1)  return "reminder_d1";
  return null;
}

// Resolve product display name + URL from a queue row.
//   - product_key like "uk_residency" matches LEAD_PRODUCT_META directly.
//   - product_key like "nomad_67_uk_residency" -> strip the "<country>_<tier>_" prefix.
//   - product_id like "uk-residency" maps from kebab to snake.
function resolveProduct(row: QueueRow): { name: string; url: string } {
  const trySource = (key: string | null | undefined) => {
    if (!key) return null;
    const meta = LEAD_PRODUCT_META[key];
    if (meta) return { name: meta.name, url: meta.url };
    return null;
  };

  // 1. Direct lookup on product_key
  const direct = trySource(row.product_key);
  if (direct) return direct;

  // 2. Strip Stripe-style prefix (e.g. "nomad_67_uk_residency" -> "uk_residency",
  //                              "au_147_div296_wealth_eraser" -> "div296_wealth_eraser")
  if (row.product_key) {
    const stripped = row.product_key.replace(/^(au|uk|us|nz|can|nomad|supertax)_(67|147)_/, "");
    const viaStrip = trySource(stripped);
    if (viaStrip) return viaStrip;
  }

  // 3. product_id is kebab-case (e.g. "uk-residency"); convert to snake and try
  if (row.product_id) {
    const snake = row.product_id.replace(/-/g, "_");
    const viaPid = trySource(snake);
    if (viaPid) return viaPid;
  }

  // 4. Last-ditch: best-effort display name + homepage
  const fallbackName = (row.product_key ?? row.product_id ?? "your check")
    .replace(/^(au|uk|us|nz|can|nomad|supertax)_(67|147)_/, "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
  return { name: fallbackName, url: "/" };
}

// Format trigger_date or deadlineDate to "31 January 2027" style.
function formatDeadlineDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// ── SEND VIA RESEND ──────────────────────────────────────────────────────

async function sendViaResend(to: string, subject: string, html: string, resendKey: string): Promise<{ success: boolean; resendId?: string; error?: string }> {
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.message || `Resend ${res.status}` };
    return { success: true, resendId: data.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown send error" };
  }
}

// ── OPERATOR ALERT (fire-and-forget) ─────────────────────────────────────
async function alertOperator(failureSummary: string, resendKey: string): Promise<void> {
  const operator = process.env.OPERATOR_EMAIL;
  if (!operator) {
    console.error("[cron] OPERATOR ALERT (no OPERATOR_EMAIL configured):", failureSummary);
    return;
  }
  try {
    await fetch(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from:    FROM_ADDRESS,
        to:      [operator],
        subject: `[TaxCheckNow cron] Email run needs attention`,
        html:    `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">${failureSummary.replace(/</g, "&lt;")}</pre>`,
      }),
    });
  } catch { /* non-fatal */ }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const startedAtMs = Date.now();
  const runId       = newRunId();

  // 1. Auth — Vercel sends Authorization: Bearer ${CRON_SECRET}
  const expectedAuth = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expectedAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!resendKey)   return NextResponse.json({ error: "Missing RESEND_API_KEY"   }, { status: 500 });
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });

  const supabase = createClient(supabaseUrl, supabaseKey) as ReturnType<typeof createClient>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // 2. Fetch due rows. Embed decision_sessions data via the FK we added in
  //    Step 4 so personalisation context (output.status) is available at
  //    send time without an extra query per row.
  //
  //    Step 4 — the column list is now `*`. The explicit list meant that adding a
  //    column to the SELECT before the DDL had run would 400 the whole PostgREST
  //    query and take the entire cron down. With `*` the route is insensitive to
  //    migration ORDER: pre-DDL, deferral_count simply comes back undefined and
  //    the code falls back to 0.
  const { data: rows, error: fetchErr } = await sb
    .from("email_queue")
    .select("*, decision_sessions:decision_session_id(id, output)")
    .eq("status", "queued")
    .lte("trigger_date", todayIso())
    .order("trigger_date", { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchErr) {
    // Even a failed run is no longer invisible.
    logRunOutcome(ROUTE, runId, startedAtMs, zeroCounts(), { fetch_error: fetchErr.message });
    await recordCronRun(sb, {
      runId, route: ROUTE, startedAtMs,
      counts: { ...zeroCounts(), failed: 1 },
      detail: { fetch_error: fetchErr.message },
    });
    return NextResponse.json({ error: "Queue fetch failed", detail: fetchErr.message, runId }, { status: 500 });
  }

  const queueRows: QueueRow[] = rows ?? [];
  let sent     = 0;
  let failed    = 0;
  let skipped    = 0;      // unresolvable email_type
  let windowSkipped = 0;   // Phase 1.2 — past-window rows set to 'skipped'
  let deferred = 0;        // Phase 1.3 — over the per-recipient 24h cap, left queued
  const failures: string[]   = [];
  const windowSkips: string[] = [];
  const deferrals: string[]   = [];
  const today = todayIso();

  // Phase 1.3 — per-recipient cap: max ONE email per recipient per 24h across ALL types.
  // Recipients already emailed in the last 24h (any email_log 'sent' row — includes the webhook
  // delivery email, since 1.4a now stamps email_log.sent_at) are deferred, not dropped. Combined
  // with the run-local set below, a recipient can receive at most one email per run.
  //
  // Step 4 note: the Step 4 event ledger writes deferred/skipped rows to email_log with
  // status != 'sent' and sent_at = null, so they can never enter this set.
  const dayAgoIso = new Date(Date.now() - 86_400_000).toISOString();
  const recent24h = new Set<string>();
  try {
    const { data: recent } = await sb.from("email_log")
      .select("recipient_email").eq("status", "sent").gte("sent_at", dayAgoIso);
    (recent ?? []).forEach((r: { recipient_email?: string | null }) => {
      if (r.recipient_email) recent24h.add(r.recipient_email.toLowerCase());
    });
  } catch { /* non-fatal: the run-local cap below still bounds this run to 1/recipient */ }
  const emailedThisRun = new Set<string>();

  // Mark a row terminally skipped: queue row + a durable email_log event (Step 4.2), so a
  // past-date skip has a timestamp and is sweepable by the 4.6 health check.
  const markWindowSkipped = async (row: QueueRow, emailType: string, reason: string) => {
    windowSkipped++;
    if (windowSkips.length < DETAIL_LIMIT) {
      windowSkips.push(`${row.id} | ${emailType} | ${row.customer_email} | ${reason}`);
    }
    try {
      const { error } = await sb.from("email_queue")
        .update({ status: "skipped", error_message: `window:${reason}` }).eq("id", row.id);
      if (error) console.error("[cron] window-skip queue update failed", row.id, error.message);
    } catch (err) { console.error("[cron] window-skip queue update threw", row.id, err); }
    await logEmailEvent(sb, {
      runId, recipientEmail: row.customer_email, emailType, status: "skipped",
      subject: row.subject ?? null, productKey: row.product_key ?? null,
      queueRowId: row.id, errorMessage: `window:${reason}`,
    });
  };

  // 3. Process each row
  for (const row of queueRows) {
    const emailType = resolveEmailType(row);
    if (!emailType) {
      skipped++;
      // Mark unprocessable so we don't keep retrying
      try {
        await sb.from("email_queue").update({ status: "skipped", error_message: "Could not resolve email_type" }).eq("id", row.id);
      } catch { /* ignore */ }
      await logEmailEvent(sb, {
        runId, recipientEmail: row.customer_email, emailType: row.email_type ?? "unresolved",
        status: "skipped", productKey: row.product_key ?? null, queueRowId: row.id,
        errorMessage: "unresolvable_email_type",
      });
      continue;
    }

    const deferralCount = row.deferral_count ?? 0;

    // Phase 1.2 — (a) deadline expiry. UNCONDITIONAL: a passed deadline is never sendable,
    // regardless of how the row got here.
    const deadlineReason = deadlineSkipReason(row, today);
    if (deadlineReason) {
      await markWindowSkipped(row, emailType, deadlineReason);
      continue;
    }

    // Phase 1.2 — (b) sender floor. Step 4.1: ONLY for rows the cap has never deferred, so
    // `trigger_stale` continues to mean "not processed in time" and nothing else.
    if (deferralCount === 0) {
      const staleReason = staleSkipReason(row, today);
      if (staleReason) {
        await markWindowSkipped(row, emailType, staleReason);
        continue;
      }
    }

    // Phase 1.3 — per-recipient 24h cap. Defer (leave 'queued'), never drop; next run retries once
    // the 24h window has elapsed. Bounds each recipient to at most one email per run.
    const rcpt = row.customer_email.toLowerCase();
    const capHit = recent24h.has(rcpt) || emailedThisRun.has(rcpt);
    if (capHit) {
      // Step 4.1 anti-limbo terminal — a row the cap has starved for MAX_DEFERRALS runs stops
      // being deferred and terminates under its OWN reason, never `trigger_stale`.
      if (deferralCount >= MAX_DEFERRALS) {
        await markWindowSkipped(row, emailType, `cap_starved:${deferralCount}`);
        continue;
      }

      const reason = emailedThisRun.has(rcpt) ? "already_sent_this_run" : "sent_within_24h";
      deferred++;
      if (deferrals.length < DETAIL_LIMIT) {
        deferrals.push(`${row.id} | ${emailType} | ${row.customer_email} | ${reason} | deferral ${deferralCount + 1}/${MAX_DEFERRALS}`);
      }

      // Step 4.1/4.2 — the deferral is now DURABLE, on both surfaces:
      //   · email_queue counters — drives the trigger_stale exemption and the cap_starved
      //     terminal, and makes "is this row being starved?" a single SELECT.
      //   · email_log event      — the full audit line (recipient, row id, reason, run, timestamp).
      // trigger_date is deliberately NOT bumped: it is rendered into the customer-visible date
      // (see formatDeadlineDate below) and it is the record of when the email was MEANT to go.
      try {
        const { error } = await sb.from("email_queue").update({
          deferral_count:       deferralCount + 1,
          last_deferred_at:     new Date().toISOString(),
          last_deferred_reason: reason,
        }).eq("id", row.id);
        if (error) console.error("[cron] deferral counter update failed", row.id, error.message);
      } catch (err) { console.error("[cron] deferral counter update threw", row.id, err); }

      await logEmailEvent(sb, {
        runId, recipientEmail: row.customer_email, emailType, status: "deferred",
        subject: row.subject ?? null, productKey: row.product_key ?? null,
        queueRowId: row.id,
        errorMessage: `deferred:${reason}:${deferralCount + 1}/${MAX_DEFERRALS}`,
      });
      continue; // status stays 'queued'
    }

    const product = resolveProduct(row);

    // Step 4 personalisation resolution — graceful degrade per bee canonical
    // rule 8b (never crash; fall back to product-level when row data missing).
    //
    // Sources, in priority order:
    //   - verdict        ← decision_sessions.output.status (embedded JOIN)
    //   - fearNumber     ← LEAD_PRODUCT_META[source].fearNumber (lookup)
    //   - authority      ← LEAD_PRODUCT_META[source].authority (lookup)
    //
    // When decision_session_id is null OR the embed didn't return a row,
    // verdict stays undefined; templates render product-only fallback copy.
    const embedded = (row as unknown as { decision_sessions?: EmbeddedDecisionSession | null }).decision_sessions ?? null;
    const verdictRaw = embedded?.output && typeof embedded.output === "object"
      ? (embedded.output as Record<string, unknown>).status
      : undefined;
    const verdict = typeof verdictRaw === "string" && verdictRaw.length > 0 ? verdictRaw : undefined;

    // Look up LeadProductMeta by source-key. Same resolution logic as
    // resolveProduct above — match the snake_case key after stripping any
    // Stripe-style "<country>_<tier>_" prefix from product_key.
    const leadKey = (() => {
      const direct = row.product_key && row.product_key in LEAD_PRODUCT_META ? row.product_key : null;
      if (direct) return direct;
      if (row.product_key) {
        const stripped = row.product_key.replace(/^(au|uk|us|nz|can|nomad|supertax)_(67|147)_/, "");
        if (stripped in LEAD_PRODUCT_META) return stripped;
      }
      if (row.product_id) {
        const snake = row.product_id.replace(/-/g, "_");
        if (snake in LEAD_PRODUCT_META) return snake;
      }
      return null;
    })();
    const leadMeta = leadKey ? LEAD_PRODUCT_META[leadKey] : null;
    const fearNumber = leadMeta?.fearNumber || undefined;
    const authority  = leadMeta?.authority  || undefined;

    // TEMPORAL v1 Step 7.2 — the shared fields ONLY. Note what is absent:
    // deadlineDate is NOT built here any more. It used to be
    // `formatDeadlineDate(row.trigger_date)` for EVERY type, and for a nurture
    // row trigger_date is the SEND date (anchor + 3/7/14), not a deadline — so
    // the old code was one template edit away from printing the send date as a
    // statutory deadline. The reminder branch below derives its date explicitly;
    // the nurture branch never has one to render.
    const base: BaseTemplateData = {
      customerName:  row.customer_name ?? undefined,
      productName:   product.name,
      productUrl:    product.url,
      verdict,
      fearNumber,
      authority,
    };

    // Track personalisation fallback for Doctor Bee analytics. When verdict
    // is null but decision_session_id was present, the embed returned no
    // output — log it via error_message field on email_log (failure-mode
    // string, not an actual send failure).
    const personalisationDegraded = row.decision_session_id && !verdict;

    // Step 7.2 — the branch IS the separation. Two doors, and only the reminder
    // door is handed a date. A reminder row's date comes from its own
    // trigger_date + days_before_deadline (the deadline it was queued against),
    // which is a real deadline; a nurture row simply has none.
    let tpl;
    if (isNurtureType(emailType)) {
      tpl = getNurtureTemplate(emailType, base);
    } else if (isReminderType(emailType)) {
      const deadlineIso = row.days_before_deadline != null
        ? addDaysIso(row.trigger_date, row.days_before_deadline)
        : row.trigger_date;
      tpl = getReminderTemplate(emailType, {
        ...base,
        deadlineDate: formatDeadlineDate(deadlineIso) ?? deadlineIso,
      });
    } else {
      // Unreachable: resolveEmailType only returns VALID_EMAIL_TYPES. Skip rather
      // than send something unclassified — an email we cannot categorise into a
      // lane is exactly what should never go out.
      skipped++;
      await logEmailEvent(sb, {
        runId, recipientEmail: row.customer_email, emailType: String(emailType),
        status: "skipped", productKey: row.product_key ?? null, queueRowId: row.id,
        errorMessage: "unclassified_email_type",
      });
      continue;
    }
    const result = await sendViaResend(row.customer_email, tpl.subject, tpl.html, resendKey);

    // 3c. Update queue row
    try {
      await sb.from("email_queue").update({
        status:        result.success ? "sent" : "failed",
        sent_at:        result.success ? new Date().toISOString() : null,
        error_message:    result.success ? null : (result.error ?? "send error"),
      }).eq("id", row.id);
    } catch (err) {
      console.error("[cron] Failed to update queue row", row.id, err);
    }

    // 3d. Log to email_log. Include a personalisation_degraded note in
    // error_message when the row had a decision_session_id but the embed
    // returned no verdict — that signals a stale or broken FK linkage that
    // Doctor Bee can pick up later (without breaking the actual send).
    const errorMessage = result.success
      ? (personalisationDegraded ? "personalisation_degraded:no_verdict_from_decision_session" : null)
      : (result.error ?? "send error");
    await logEmailEvent(sb, {
      runId,
      recipientEmail: row.customer_email,
      emailType,
      status:         result.success ? "sent" : "failed",
      subject:        tpl.subject,
      productKey:     row.product_key ?? null,
      queueRowId:     row.id,
      resendId:       result.resendId ?? null,
      errorMessage,
      // Phase 1.3 — stamp sent_at so the per-recipient 24h cap can see this send next run.
      sentAt:         result.success ? new Date().toISOString() : null,
    });

    if (result.success) {
      sent++;
      emailedThisRun.add(rcpt); // Phase 1.3 — enforce one-per-recipient for the rest of this run
    } else {
      failed++;
      if (failures.length < DETAIL_LIMIT) {
        failures.push(`${row.id} | ${emailType} | ${row.customer_email} | ${result.error}`);
      }
    }
  }

  const counts = { processed: queueRows.length, sent, failed, skipped, windowSkipped, deferred };

  // 4. Step 4.6 — standing health conditions, computed from the DB rather than this run's
  //    counters, so a condition caused by a previous run or by the webhook path still surfaces.
  const health = await collectEmailHealth(sb);

  // 4b. Step 4.8c — MUTUAL WATCH. This run checks the OTHER scheduled cron, never itself:
  //     a cron cannot observe its own death (it only executes when it is alive, so its own age
  //     is always ~0 at check time). re-engagement (08:00) and send-emails (09:00) each watch
  //     the other, so either one dying is reported by the survivor within a day — no new
  //     scheduled job required. See §4.8d for what this deliberately does NOT cover.
  const cronStaleness = await collectCronStaleness(sb, peerRoutes(ROUTE));
  const cronAlerts    = cronStalenessAlerts(cronStaleness);

  // 5. Operator alert. Step 4.3 — `deferred > 0` is now IN THE GATE. Previously a run whose only
  //    outcome was deferrals sent no alert at all: the deferrals[] detail was built and rendered
  //    into the alert body, but the body was never dispatched unless some OTHER condition fired.
  //    Step 4.8c adds the peer-staleness alerts to the same gate.
  if (failed > 0 || windowSkipped > 0 || deferred > 0 || health.alerts.length > 0 || cronAlerts.length > 0) {
    await alertOperator(
      `Cron run ${runId} at ${new Date().toISOString()} (${ROUTE})\n` +
      `Processed: ${queueRows.length}  Sent: ${sent}  Failed: ${failed}  Skipped(unresolvable): ${skipped}  ` +
      `WindowSkipped: ${windowSkipped}  Deferred(24h cap): ${deferred}\n\n` +
      (failures.length     ? `Failures:\n${failures.join("\n")}\n\n`         : "") +
      (windowSkips.length  ? `Window-skips:\n${windowSkips.join("\n")}\n\n`  : "") +
      (deferrals.length    ? `Deferred:\n${deferrals.join("\n")}\n\n`        : "") +
      (cronAlerts.length   ? `PEER CRON:\n${cronAlerts.join("\n")}\n\n`      : "") +
      formatHealthForOperator(health),
      resendKey,
    );
  }

  // 6. Step 4.4 — the run is on the record whatever it did, zero-activity included.
  logRunOutcome(ROUTE, runId, startedAtMs, counts, {
    health_alerts: health.alerts.length,
    cron_alerts:   cronAlerts.length,
  });
  await recordCronRun(sb, {
    runId, route: ROUTE, startedAtMs, counts,
    detail: { failures, windowSkips, deferrals, healthAlerts: health.alerts, cronAlerts },
  });

  // Step 4.3 — the deferrals[] detail is returned, not only mailed.
  return NextResponse.json({
    runId,
    ...counts,
    failures,
    windowSkips,
    deferrals,
    healthAlerts: health.alerts,
    cronAlerts,
  });
}
