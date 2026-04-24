// ── LEAD CAPTURE ENDPOINT ────────────────────────────────────────────────
// Free calculator email capture:
//   1. Send T2 email immediately (Resend) with result summary + 3 questions
//   2. Queue S2 nurture sequence (d3, d7, d14) into email_queue table
//
// Called by every Calculator.tsx handleSaveEmail function with:
//   { email, source, country_code, site }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLeadMeta } from "@/lib/lead-product-meta";

const FROM_ADDRESS = "TaxCheckNow <hello@taxchecknow.com>";
const SITE_ORIGIN = "https://www.taxchecknow.com";

interface LeadBody {
  email:        string;
  source?:       string;
  country_code?:  string;
  site?:           string;
  session_id?:      string;
  verdict_status?:   string;   // optional — passed by newer calculators for richer T2 body
}

// ── HTML EMAIL TEMPLATE ──────────────────────────────────────────────────
function buildT2Html(
  productName: string,
  productUrl:  string,
  authority:   string,
  verdict:     string | undefined,
  questions:   readonly [string, string, string],
): string {
  const cta = `${SITE_ORIGIN}${productUrl}`;
  const verdictBlock = verdict
    ? `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:0 0 28px;background:#f9fafb;">
         <p style="margin:0 0 6px;font-family:monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">Your verdict</p>
         <p style="margin:0;font-size:15px;color:#111827;font-weight:600;line-height:1.5;">${verdict}</p>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${productName} — your result saved</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;max-width:600px;">

    <tr><td style="background:#0a0a0a;padding:28px 36px;">
      <p style="margin:0;font-family:monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;">TaxCheckNow · ${authority}</p>
      <h2 style="margin:10px 0 0;font-size:22px;font-weight:700;color:#fff;line-height:1.3;">Your result is saved</h2>
      <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">${productName}</p>
    </td></tr>

    <tr><td style="padding:36px;">

      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">Here is what your check found:</p>

      ${verdictBlock}

      <h3 style="margin:24px 0 14px;font-size:16px;color:#111827;font-weight:700;">3 questions to ask your accountant</h3>
      <ul style="margin:0 0 28px;padding:0 0 0 20px;font-size:14px;color:#374151;line-height:1.7;">
        <li style="margin-bottom:8px;">${questions[0]}</li>
        <li style="margin-bottom:8px;">${questions[1]}</li>
        <li style="margin-bottom:0;">${questions[2]}</li>
      </ul>

      <!-- CTA BUTTON -->
      <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr><td style="background:#0a0a0a;border-radius:12px;">
          <a href="${cta}" style="display:block;padding:14px 28px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;">Get the full plan →</a>
        </td></tr>
      </table>

      <p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">Forward this to your accountant — the 3 questions above are the right ones to raise with them about this issue.</p>

    </td></tr>

    <tr><td style="background:#f9fafb;padding:20px 36px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
        TaxCheckNow · taxchecknow.com<br/>
        General information only — not financial, tax, or legal advice. Always consult a qualified adviser.<br/>
        <a href="${SITE_ORIGIN}/privacy" style="color:#9ca3af;">Privacy</a> ·
        <a href="${SITE_ORIGIN}/terms" style="color:#9ca3af;">Terms</a>
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── SEND T2 EMAIL VIA RESEND ─────────────────────────────────────────────
async function sendT2Email(
  to:          string,
  productName: string,
  productUrl:  string,
  authority:   string,
  verdict:     string | undefined,
  questions:   readonly [string, string, string],
): Promise<{ success: boolean; resendId?: string; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { success: false, error: "Missing RESEND_API_KEY" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from:    FROM_ADDRESS,
        to:      [to],
        subject: `Your ${productName} result — saved`,
        html:    buildT2Html(productName, productUrl, authority, verdict, questions),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[leads] Resend error:", data);
      return { success: false, error: data.message || "Resend error" };
    }
    return { success: true, resendId: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[leads] Fetch error:", msg);
    return { success: false, error: msg };
  }
}

// ── QUEUE S2 NURTURE SEQUENCE ────────────────────────────────────────────
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function queueNurture(
  supabase:      any,
  customerEmail: string,
  productKey:    string,
): Promise<void> {
  const rows = [
    { days: 3,  subject: "What people in your position usually do", email_type: "nurture_d3"  },
    { days: 7,  subject: "One week on — did you act on this?",       email_type: "nurture_d7"  },
    { days: 14, subject: "Did you sort this out?",                    email_type: "nurture_d14" },
  ].map(r => ({
    customer_email: customerEmail,
    product_key:    productKey,
    trigger_date:   addDays(r.days),
    subject:        r.subject,
    email_type:     r.email_type,
    status:         "queued",
    created_at:     new Date().toISOString(),
  }));

  try {
    const { error } = await supabase.from("email_queue").insert(rows);
    if (error) console.error("[leads] Queue error:", error.message);
  } catch (err) {
    console.error("[leads] Queue failed (non-blocking):", err);
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body: LeadBody = await req.json();
    const { email, source, session_id, verdict_status } = body;

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // Resolve product metadata by source (falls back to generic)
    const meta = getLeadMeta(source ?? "");

    // Fire T2 email immediately (non-blocking on Supabase)
    const emailResult = await sendT2Email(
      email,
      meta.name,
      meta.url,
      meta.authority,
      verdict_status,
      meta.questions,
    );

    // Supabase operations — non-fatal if credentials missing
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Update decision session email if session provided
      if (session_id && !session_id.startsWith("fallback_")) {
        try {
          await supabase.from("decision_sessions").update({ email }).eq("id", session_id);
        } catch { /* non-fatal */ }
      }

      // Log the T2 send
      try {
        await supabase.from("email_log").insert({
          recipient_email: email,
          email_type:      "t2_lead_capture",
          subject:         `Your ${meta.name} result — saved`,
          status:          emailResult.success ? "sent" : "failed",
          product_key:     source ?? null,
          resend_id:       emailResult.resendId ?? null,
          error_message:   emailResult.error   ?? null,
        });
      } catch { /* non-fatal */ }

      // Queue the S2 nurture sequence (d3, d7, d14)
      await queueNurture(supabase, email, source ?? "unknown");
    }

    // Always return 200 — never block the user experience
    return NextResponse.json({ success: true, emailed: emailResult.success });
  } catch (err) {
    console.error("[leads] error:", err);
    return NextResponse.json({ success: true });
  }
}
