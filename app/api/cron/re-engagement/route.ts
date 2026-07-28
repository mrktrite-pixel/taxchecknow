// â”€â”€ RE-ENGAGEMENT CRON (Step 5 of save-box Î²) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Triggered daily 8am UTC by Vercel cron (see vercel.json).
//
// Workflow:
//   1. Verify Authorization: Bearer ${CRON_SECRET}
//   2. Sweep decision_sessions where:
//        - email IS NOT NULL
//        - converted = false
//        - re_engagement_sent = false
//        - created_at between (now - 30d) and (now - 7d)
//   3. For each row: build re_engagement template -> Resend send -> UPDATE
//      decision_sessions (re_engagement_at = now(), re_engagement_sent = true)
//      -> log to email_log
//   4. Skip-if-sent guard re-checks re_engagement_sent before send (defensive
//      against race with manual re-trigger)
//   5. On send failure: alert OPERATOR_EMAIL (if configured); leave
//      re_engagement_sent = false so a future run can retry
//   6. Return { sent, failed, skipped, processed }
//
// This is the LAST automated touchpoint in the lifecycle. After it fires,
// the customer is silent in our system unless they act.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// TEMPORAL v1 Step 7.2 â€” re-engagement is a NURTURE-lane email (anchored to the
// customer's own save, not to any statutory date), so it goes through the
// nurture door. The data type makes a deadline unpassable.
import { getNurtureTemplate, type NurtureTemplateData } from "@/lib/email-templates/index";
import { LEAD_PRODUCT_META } from "@/lib/lead-product-meta";
import {
  newRunId, logRunOutcome, logEmailEvent, recordCronRun, zeroCounts,
} from "@/lib/email-observability";
import { collectCronStaleness, cronStalenessAlerts, peerRoutes } from "@/lib/cron-staleness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM_ADDRESS = "TaxCheckNow <hello@taxchecknow.com>";
const RESEND_URL    = "https://api.resend.com/emails";
const BATCH_LIMIT   = 50;
const ROUTE         = "/api/cron/re-engagement";

// Detail arrays are echoed in the response body (Step 4.3) â€” keep them bounded.
const DETAIL_LIMIT  = 50;

// Window: re-engage between days 7 and 30 after save.
//   - < 7 days: still in nurture_d3 + nurture_d7 window (don't double-email)
//   - > 30 days: stale; don't bother
const MIN_AGE_DAYS = 7;
const MAX_AGE_DAYS = 30;

interface DecisionSessionRow {
  id:             string;
  email:           string | null;
  product_key:      string | null;
  product_slug:      string | null;
  output:             Record<string, unknown> | null;
  converted:           boolean | null;
  re_engagement_sent:    boolean | null;
  created_at:              string;
}

// â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

// Resolve LEAD_PRODUCT_META key from snake_case product_key with Stripe-prefix
// strip fallback. Mirrors send-emails resolution exactly.
function resolveLeadKey(productKey: string | null, productSlug: string | null): string | null {
  if (productKey && productKey in LEAD_PRODUCT_META) return productKey;
  if (productKey) {
    const stripped = productKey.replace(/^(au|uk|us|nz|can|nomad|supertax)_(67|147)_/, "");
    if (stripped in LEAD_PRODUCT_META) return stripped;
  }
  if (productSlug) {
    const snake = productSlug.replace(/-/g, "_");
    if (snake in LEAD_PRODUCT_META) return snake;
  }
  return null;
}

function resolveProduct(row: DecisionSessionRow): { name: string; url: string } {
  const key = resolveLeadKey(row.product_key, row.product_slug);
  if (key) {
    const meta = LEAD_PRODUCT_META[key];
    return { name: meta.name, url: meta.url };
  }
  // Last-ditch: best-effort display name + homepage
  const fallbackName = (row.product_key ?? row.product_slug ?? "your check")
    .replace(/^(au|uk|us|nz|can|nomad|supertax)_(67|147)_/, "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
  return { name: fallbackName, url: "/" };
}

// â”€â”€ SEND VIA RESEND â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ OPERATOR ALERT (fire-and-forget) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function alertOperator(failureSummary: string, resendKey: string): Promise<void> {
  const operator = process.env.OPERATOR_EMAIL;
  if (!operator) return;
  try {
    await fetch(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from:    FROM_ADDRESS,
        to:      [operator],
        subject: `[TaxCheckNow cron] Re-engagement send failure`,
        html:    `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">${failureSummary.replace(/</g, "&lt;")}</pre>`,
      }),
    });
  } catch { /* non-fatal */ }
}

// â”€â”€ MAIN HANDLER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function GET(request: Request) {
  // TEMPORAL v1 Step 4.4 â€” this route was as blind as send-emails: no console line, no durable
  // run record, and its deferrals (Phase 1 addendum A) left no trace at all.
  const startedAtMs = Date.now();
  const runId       = newRunId();

  // 1. Auth â€” Vercel sends Authorization: Bearer ${CRON_SECRET}
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

  // 2. Sweep decision_sessions for eligible rows.
  //    Window: created_at >= now()-30d AND created_at <= now()-7d.
  //    Filters: converted=false, re_engagement_sent=false, email not null.
  //
  //    Step 6 dedupe (Discovery #30): a customer can have multiple eligible
  //    sessions in the same window (saved 5 calculators -> 5 rows). The
  //    pre-Step-6 sweep would fire 5 emails on day 8 â€” spammy.
  //
  //    PostgREST does not support CTEs / DISTINCT ON in client queries, so
  //    dedupe runs in JS:
  //      a) Fetch BATCH_LIMIT * 4 candidates ORDER BY created_at DESC
  //      b) Walk the array, keep first occurrence per email (= most recent
  //         save â€” what they saw last is freshest in their mind)
  //      c) Cap at BATCH_LIMIT customers per run
  //      d) After successful send: UPDATE re_engagement_sent=true on ALL
  //         eligible rows for that email + window (not just the picked id),
  //         so the customer is not re-engaged again on a different row
  //         tomorrow.
  const minCreatedAt = isoDaysAgo(MAX_AGE_DAYS);   // older bound (e.g. 30 days ago)
  const maxCreatedAt = isoDaysAgo(MIN_AGE_DAYS);   // newer bound (e.g. 7 days ago)
  const candidateLimit = BATCH_LIMIT * 4;          // 200 â€” dedupe headroom

  const { data: rows, error: fetchErr } = await sb
    .from("decision_sessions")
    .select("id, email, product_key, product_slug, output, converted, re_engagement_sent, created_at")
    .not("email", "is", null)
    .eq("converted", false)
    .eq("re_engagement_sent", false)
    .gte("created_at", minCreatedAt)
    .lte("created_at", maxCreatedAt)
    .order("created_at", { ascending: false })   // most recent FIRST so dedupe keeps the freshest save
    .limit(candidateLimit);

  if (fetchErr) {
    // Step 4.4 â€” even a failed run is on the record.
    logRunOutcome(ROUTE, runId, startedAtMs, zeroCounts(), { fetch_error: fetchErr.message });
    await recordCronRun(sb, {
      runId, route: ROUTE, startedAtMs,
      counts: { ...zeroCounts(), failed: 1 },
      detail: { fetch_error: fetchErr.message },
    });
    return NextResponse.json({ error: "decision_sessions fetch failed", detail: fetchErr.message, runId }, { status: 500 });
  }

  const candidateRows: DecisionSessionRow[] = rows ?? [];

  // Dedupe by email â€” keep first occurrence (= most recent save given DESC).
  // Cap at BATCH_LIMIT customers per run.
  const seenEmails = new Set<string>();
  const sessionRows: DecisionSessionRow[] = [];
  for (const row of candidateRows) {
    if (!row.email) continue;
    if (seenEmails.has(row.email)) continue;
    seenEmails.add(row.email);
    sessionRows.push(row);
    if (sessionRows.length >= BATCH_LIMIT) break;
  }

  let sent     = 0;
  let failed    = 0;
  let skipped    = 0;
  let deferred = 0;   // Phase 1 addendum A â€” over the per-recipient 24h cap
  const failures: string[]  = [];
  const deferrals: string[] = [];

  // Phase 1 addendum A â€” the 24h per-recipient cap now gates re-engagement (marketing). Build the
  // set of recipients who received ANY email in the last 24h (email_log 'sent' with sent_at set â€”
  // includes the transactional delivery + t2_lead_capture emails, which count toward the cap but are
  // themselves exempt). A capped customer is DEFERRED: re_engagement_sent stays false so a future run
  // retries once 24h has elapsed. Never marked sent, never dropped.
  const dayAgoIso = new Date(Date.now() - 86_400_000).toISOString();
  const recent24h = new Set<string>();
  try {
    const { data: recent } = await sb.from("email_log")
      .select("recipient_email").eq("status", "sent").gte("sent_at", dayAgoIso);
    (recent ?? []).forEach((r: { recipient_email?: string | null }) => {
      if (r.recipient_email) recent24h.add(r.recipient_email.toLowerCase());
    });
  } catch { /* non-fatal: fall through; the send still respects re_engagement_sent gating */ }

  // 3. Process each deduped customer
  for (const row of sessionRows) {
    if (!row.email) {
      skipped++;
      continue;
    }

    // Defensive re-check: skip if re_engagement_sent flipped true between
    // SELECT and now (race with manual re-trigger or parallel cron run).
    if (row.re_engagement_sent === true) {
      skipped++;
      continue;
    }

    // Phase 1 addendum A â€” 24h per-recipient cap. Defer (leave re_engagement_sent false) if this
    // recipient already got an email in the last 24h. Retried on a future run once the window clears.
    if (recent24h.has(row.email.toLowerCase())) {
      deferred++;
      if (deferrals.length < DETAIL_LIMIT) {
        deferrals.push(`${row.id} | ${row.email} | re_engagement | sent_within_24h`);
      }
      // Step 4.2 â€” the deferral is now durable. Unlike the send-emails queue there is no
      // trigger_stale floor here (decision_sessions has no send-window), so no counter is needed
      // to protect the row; what was missing was purely the audit trail. The session id goes in
      // error_message because a re-engagement deferral has no email_queue row to point at.
      await logEmailEvent(sb, {
        runId, recipientEmail: row.email, emailType: "re_engagement", status: "deferred",
        productKey: row.product_key ?? null,
        errorMessage: `deferred:sent_within_24h:decision_session=${row.id}`,
      });
      continue;
    }

    const product = resolveProduct(row);

    // Personalisation resolution â€” graceful degrade per bee canonical rule
    // 8b. Verdict from output.status; fearNumber + authority from
    // LEAD_PRODUCT_META. When verdict is missing, template falls back to
    // product-only copy.
    const verdictRaw = row.output && typeof row.output === "object"
      ? (row.output as Record<string, unknown>).status
      : undefined;
    const verdict = typeof verdictRaw === "string" && verdictRaw.length > 0 ? verdictRaw : undefined;

    const leadKey  = resolveLeadKey(row.product_key, row.product_slug);
    const leadMeta = leadKey ? LEAD_PRODUCT_META[leadKey] : null;
    const fearNumber = leadMeta?.fearNumber || undefined;
    const authority  = leadMeta?.authority  || undefined;

    const data: NurtureTemplateData = {
      productName:   product.name,
      productUrl:    product.url,
      verdict,
      fearNumber,
      authority,
    };

    const tpl = getNurtureTemplate("re_engagement", data);
    const result = await sendViaResend(row.email, tpl.subject, tpl.html, resendKey);

    // 3b. UPDATE: flip re_engagement_sent on ALL eligible rows for this
    //     customer (Step 6 dedupe). The filter mirrors the SELECT filter
    //     exactly â€” only flips rows that were eligible for THIS run, never
    //     a future-eligible row. On failure: leave rows untouched so a
    //     future run can retry the entire customer cleanly.
    if (result.success) {
      try {
        await sb.from("decision_sessions").update({
          re_engagement_at:    new Date().toISOString(),
          re_engagement_sent:    true,
        })
        .eq("email", row.email)
        .eq("converted", false)
        .eq("re_engagement_sent", false)
        .gte("created_at", minCreatedAt)
        .lte("created_at", maxCreatedAt);
      } catch (err) {
        console.error("[re-engagement cron] Failed to update decision_sessions rows for", row.email, err);
      }
    }

    // 3c. Log to email_log
    const personalisationDegraded = !verdict; // re-engagement always JOINs the source row, so missing verdict is degradation
    const errorMessage = result.success
      ? (personalisationDegraded ? "personalisation_degraded:no_verdict_in_decision_session_output" : null)
      : (result.error ?? "send error");
    await logEmailEvent(sb, {
      runId,
      recipientEmail: row.email,
      emailType:      "re_engagement",
      subject:        tpl.subject,
      status:         result.success ? "sent" : "failed",
      productKey:     row.product_key ?? null,
      resendId:       result.resendId ?? null,
      errorMessage,
      // Phase 1.3 â€” stamp sent_at so this send counts toward the cron's per-recipient 24h cap.
      sentAt:         result.success ? new Date().toISOString() : null,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
      if (failures.length < DETAIL_LIMIT) {
        failures.push(`${row.id} | ${row.email} | ${result.error}`);
      }
    }
  }

  const counts = {
    processed: sessionRows.length, sent, failed, skipped, windowSkipped: 0, deferred,
  };

  // 3b. Step 4.8c â€” MUTUAL WATCH. This run checks the OTHER scheduled cron, never itself (a cron
  //     cannot observe its own death). This is the arm that matters most: send-emails is where the
  //     4.6 health alerts are dispatched from, so if send-emails dies it silences its own alarm â€”
  //     re-engagement is the only thing left that can report it.
  const cronStaleness = await collectCronStaleness(sb, peerRoutes(ROUTE));
  const cronAlerts    = cronStalenessAlerts(cronStaleness);

  // 4. Operator alert. Step 4.3 â€” `deferred > 0` is now in the gate here too: a run whose only
  //    outcome was deferrals previously built the deferrals[] detail and then dispatched nothing.
  //    Step 4.8c adds peer-cron staleness to the same gate.
  if (failed > 0 || deferred > 0 || cronAlerts.length > 0) {
    await alertOperator(
      `Re-engagement cron run ${runId} at ${new Date().toISOString()}\n` +
      `Processed: ${sessionRows.length}\nSent: ${sent}\nFailed: ${failed}\nSkipped: ${skipped}\nDeferred(24h cap): ${deferred}\n\n` +
      (failures.length  ? `Failures:\n${failures.join("\n")}\n\n`  : "") +
      (deferrals.length ? `Deferred:\n${deferrals.join("\n")}\n\n` : "") +
      (cronAlerts.length ? `PEER CRON:\n${cronAlerts.join("\n")}`  : ""),
      resendKey,
    );
  }

  // 5. Step 4.4 â€” structured line + durable run row, zero-activity runs included.
  logRunOutcome(ROUTE, runId, startedAtMs, counts, { cron_alerts: cronAlerts.length });
  await recordCronRun(sb, { runId, route: ROUTE, startedAtMs, counts, detail: { failures, deferrals, cronAlerts } });

  // Step 4.3 â€” deferral detail is returned, not only mailed.
  return NextResponse.json({ runId, ...counts, failures, deferrals, cronAlerts });
}

