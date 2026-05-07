// ── RE-ENGAGEMENT CRON (Step 5 of save-box β) ────────────────────────────
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
import { getEmailTemplate, type TemplateData } from "@/lib/email-templates/index";
import { LEAD_PRODUCT_META } from "@/lib/lead-product-meta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM_ADDRESS = "TaxCheckNow <hello@taxchecknow.com>";
const RESEND_URL    = "https://api.resend.com/emails";
const BATCH_LIMIT   = 50;

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

// ── HELPERS ──────────────────────────────────────────────────────────────

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
        subject: `[TaxCheckNow cron] Re-engagement send failure`,
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

  // 2. Sweep decision_sessions for eligible rows.
  //    Window: created_at >= now()-30d AND created_at <= now()-7d.
  //    Filters: converted=false, re_engagement_sent=false, email not null.
  const minCreatedAt = isoDaysAgo(MAX_AGE_DAYS);   // older bound (e.g. 30 days ago)
  const maxCreatedAt = isoDaysAgo(MIN_AGE_DAYS);   // newer bound (e.g. 7 days ago)

  const { data: rows, error: fetchErr } = await sb
    .from("decision_sessions")
    .select("id, email, product_key, product_slug, output, converted, re_engagement_sent, created_at")
    .not("email", "is", null)
    .eq("converted", false)
    .eq("re_engagement_sent", false)
    .gte("created_at", minCreatedAt)
    .lte("created_at", maxCreatedAt)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (fetchErr) {
    return NextResponse.json({ error: "decision_sessions fetch failed", detail: fetchErr.message }, { status: 500 });
  }

  const sessionRows: DecisionSessionRow[] = rows ?? [];
  let sent     = 0;
  let failed    = 0;
  let skipped    = 0;
  const failures: string[] = [];

  // 3. Process each row
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

    const product = resolveProduct(row);

    // Personalisation resolution — graceful degrade per bee canonical rule
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

    const data: TemplateData = {
      productName:   product.name,
      productUrl:    product.url,
      verdict,
      fearNumber,
      authority,
    };

    const tpl = getEmailTemplate("re_engagement", data);
    const result = await sendViaResend(row.email, tpl.subject, tpl.html, resendKey);

    // 3b. Atomic-ish UPDATE: flip re_engagement_sent + stamp re_engagement_at
    //     only on send success. On failure: leave both null/false so a
    //     future run can retry.
    if (result.success) {
      try {
        await sb.from("decision_sessions").update({
          re_engagement_at:    new Date().toISOString(),
          re_engagement_sent:    true,
        }).eq("id", row.id);
      } catch (err) {
        console.error("[re-engagement cron] Failed to update decision_sessions row", row.id, err);
      }
    }

    // 3c. Log to email_log
    const personalisationDegraded = !verdict; // re-engagement always JOINs the source row, so missing verdict is degradation
    const errorMessage = result.success
      ? (personalisationDegraded ? "personalisation_degraded:no_verdict_in_decision_session_output" : null)
      : (result.error ?? "send error");
    try {
      await sb.from("email_log").insert({
        recipient_email: row.email,
        email_type:        "re_engagement",
        subject:             tpl.subject,
        status:                result.success ? "sent" : "failed",
        product_key:             row.product_key ?? null,
        resend_id:                  result.resendId ?? null,
        error_message:                 errorMessage,
      });
    } catch (err) {
      console.error("[re-engagement cron] Failed to write email_log", err);
    }

    if (result.success) {
      sent++;
    } else {
      failed++;
      failures.push(`${row.id} | ${row.email} | ${result.error}`);
    }
  }

  // 4. Operator alert if any failures
  if (failed > 0) {
    await alertOperator(
      `Re-engagement cron run at ${new Date().toISOString()}\nSent: ${sent}\nFailed: ${failed}\nSkipped: ${skipped}\n\nFailures:\n${failures.join("\n")}`,
      resendKey,
    );
  }

  return NextResponse.json({ sent, failed, skipped, processed: sessionRows.length });
}
