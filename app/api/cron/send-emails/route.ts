// ── EMAIL CRON SENDER ────────────────────────────────────────────────────
// Triggered hourly by Vercel cron (see vercel.json).
//
// Workflow:
//   1. Verify Authorization: Bearer ${CRON_SECRET}
//   2. Fetch up to 50 rows from email_queue where status='queued' AND
//      trigger_date <= today
//   3. For each row: build template -> Resend send -> update queue + log
//   4. On send failure: alert OPERATOR_EMAIL (if configured)
//   5. Return { sent, failed, skipped }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEmailTemplate, type EmailType, type TemplateData } from "@/lib/email-templates/index";
import { LEAD_PRODUCT_META } from "@/lib/lead-product-meta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM_ADDRESS = "TaxCheckNow <hello@taxchecknow.com>";
const RESEND_URL    = "https://api.resend.com/emails";
const BATCH_LIMIT   = 50;

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
  if (!operator) return;
  try {
    await fetch(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from:    FROM_ADDRESS,
        to:      [operator],
        subject: `[TaxCheckNow cron] Email send failure`,
        html:    `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">${failureSummary.replace(/</g, "&lt;")}</pre>`,
      }),
    });
  } catch { /* non-fatal */ }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────

export async function GET(request: Request) {
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
  const { data: rows, error: fetchErr } = await sb
    .from("email_queue")
    .select(
      "id, customer_email, customer_name, product_key, product_id, email_type, days_before_deadline, trigger_date, subject, status, decision_session_id, " +
      "decision_sessions:decision_session_id(id, output)",
    )
    .eq("status", "queued")
    .lte("trigger_date", todayIso())
    .order("trigger_date", { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchErr) {
    return NextResponse.json({ error: "Queue fetch failed", detail: fetchErr.message }, { status: 500 });
  }

  const queueRows: QueueRow[] = rows ?? [];
  let sent     = 0;
  let failed    = 0;
  let skipped    = 0;
  const failures: string[] = [];

  // 3. Process each row
  for (const row of queueRows) {
    const emailType = resolveEmailType(row);
    if (!emailType) {
      skipped++;
      // Mark unprocessable so we don't keep retrying
      try {
        await sb.from("email_queue").update({ status: "skipped", error_message: "Could not resolve email_type" }).eq("id", row.id);
      } catch { /* ignore */ }
      continue;
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

    const data: TemplateData = {
      customerName:  row.customer_name ?? undefined,
      productName:   product.name,
      productUrl:    product.url,
      deadlineDate:  formatDeadlineDate(row.trigger_date),
      verdict,
      fearNumber,
      authority,
    };

    // Track personalisation fallback for Doctor Bee analytics. When verdict
    // is null but decision_session_id was present, the embed returned no
    // output — log it via error_message field on email_log (failure-mode
    // string, not an actual send failure).
    const personalisationDegraded = row.decision_session_id && !verdict;

    const tpl = getEmailTemplate(emailType, data);
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
    try {
      await sb.from("email_log").insert({
        recipient_email: row.customer_email,
        email_type:        emailType,
        subject:             tpl.subject,
        status:                result.success ? "sent" : "failed",
        product_key:             row.product_key ?? null,
        resend_id:                  result.resendId ?? null,
        error_message:                 errorMessage,
      });
    } catch (err) {
      console.error("[cron] Failed to write email_log", err);
    }

    if (result.success) {
      sent++;
    } else {
      failed++;
      failures.push(`${row.id} | ${emailType} | ${row.customer_email} | ${result.error}`);
    }
  }

  // 4. Operator alert if any failures
  if (failed > 0) {
    await alertOperator(
      `Cron run at ${new Date().toISOString()}\nSent: ${sent}\nFailed: ${failed}\nSkipped: ${skipped}\n\nFailures:\n${failures.join("\n")}`,
      resendKey,
    );
  }

  return NextResponse.json({ sent, failed, skipped, processed: queueRows.length });
}
