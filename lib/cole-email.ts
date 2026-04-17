// ── COLE Email Service ───────────────────────────────────────────────────
// Wraps Resend API for all transactional delivery emails
// Used by: app/api/stripe/webhook/route.ts
// taxchecknow.com · April 2026

export interface DeliveryEmailParams {
  to: string;
  productName: string;
  productKey: string;
  tierLabel: string;
  driveUrl: string;
  subject: string;
}

// Days to first MTD deadline — computed at send time
function daysToDeadline(): number {
  return Math.max(0, Math.floor(
    (new Date("2026-08-07").getTime() - Date.now()) / 86_400_000
  ));
}

// ── DISCLAIMER ───────────────────────────────────────────────────────────
const DISCLAIMER = `
<strong style="color:#6b7280;">General information only.</strong>
This document is for general guidance only and does not constitute financial,
tax, or legal advice. TaxCheckNow is not a regulated financial adviser.
Always consult a qualified UK tax adviser or accountant before making
financial decisions. Information is based on HMRC guidance as of April 2026.
HMRC.gov.uk is the authoritative source for all Making Tax Digital obligations.
Software recommendations in your documents may include affiliate links —
we may earn a small commission at no extra cost to you.
This does not influence our recommendations.
`.trim();

// ── EMAIL TEMPLATE ───────────────────────────────────────────────────────
function buildHtml(p: DeliveryEmailParams): string {
  const days = daysToDeadline();
  const isAction = p.productKey.includes("127") || p.productKey.includes("action");

  const bullets = isAction
    ? ["Your MTD scope — confirmed in writing",
       "Your compliance gap analysis",
       "Your software recommendation",
       "Your HMRC registration steps",
       "Your first submission checklist",
       "Digital records template",
       "Digital links audit checklist",
       "Your accountant brief"]
    : ["Your MTD scope — confirmed in writing",
       "Your software recommendation",
       "Your HMRC registration steps",
       "Your deadline calendar",
       "Your accountant brief"];

  const nextStep = isAction
    ? "Start with your compliance gap section — it identifies the single most important thing to fix before 7 August. Fix that first."
    : "Start with your scope assessment — it confirms your exact MTD position. Share the accountant brief with your accountant before your next meeting.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${p.productName}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0"
    style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;max-width:600px;">

    <!-- HEADER -->
    <tr><td style="background:#0a0a0a;padding:32px 40px;">
      <p style="margin:0;font-family:monospace;font-size:11px;letter-spacing:2px;
        text-transform:uppercase;color:#6b7280;">TaxCheckNow · United Kingdom</p>
      <h1 style="margin:10px 0 0;font-size:22px;font-weight:700;color:#fff;line-height:1.3;">
        ${p.productName}</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#9ca3af;">
        Payment confirmed · ${p.tierLabel} · One-time</p>
    </td></tr>

    <!-- DEADLINE BANNER -->
    <tr><td style="background:#dc2626;padding:12px 40px;">
      <p style="margin:0;font-size:13px;color:#fff;font-weight:600;">
        🔴 ${days} days to your first MTD deadline — 7 August 2026</p>
    </td></tr>

    <!-- BODY -->
    <tr><td style="padding:40px;">

      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
        Your ${p.productName.toLowerCase()} has been prepared based on your answers.
        <strong>This is a personal assessment built around your circumstances —
        not a generic guide.</strong>
      </p>

      <!-- CTA BUTTON -->
      <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
        <tr><td style="background:#0a0a0a;border-radius:12px;">
          <a href="${p.driveUrl}"
            style="display:block;padding:16px 32px;color:#fff;font-size:15px;
              font-weight:700;text-decoration:none;">
            Access your ${isAction ? "Action Plan" : "Assessment"} →
          </a>
        </td></tr>
      </table>

      <!-- WHAT IS INCLUDED -->
      <table cellpadding="0" cellspacing="0"
        style="background:#f9fafb;border-radius:12px;padding:24px;
          width:100%;margin:0 0 24px;box-sizing:border-box;">
        <tr><td>
          <p style="margin:0 0 12px;font-family:monospace;font-size:10px;
            letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">
            What is included</p>
          ${bullets.map(b =>
            `<p style="margin:5px 0;font-size:14px;color:#374151;">
              <span style="color:#10b981;">✓</span> ${b}</p>`
          ).join("")}
        </td></tr>
      </table>

      <!-- NEXT STEP -->
      <table cellpadding="0" cellspacing="0"
        style="border:1px solid #e5e7eb;border-radius:12px;padding:24px;
          width:100%;margin:0 0 32px;box-sizing:border-box;">
        <tr><td>
          <p style="margin:0 0 8px;font-family:monospace;font-size:10px;
            letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">
            Your next step</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">
            ${nextStep}</p>
        </td></tr>
      </table>

      <!-- NOT A GUIDE -->
      <table cellpadding="0" cellspacing="0"
        style="border-left:3px solid #0a0a0a;padding:0 0 0 16px;
          margin:0 0 32px;width:100%;">
        <tr><td>
          <p style="margin:0;font-size:13px;color:#374151;
            font-style:italic;line-height:1.6;">
            "Not a guide to MTD. A plan for your MTD."</p>
        </td></tr>
      </table>

      <!-- DISCLAIMER -->
      <table cellpadding="0" cellspacing="0"
        style="background:#f9fafb;border-radius:8px;padding:20px;
          width:100%;box-sizing:border-box;">
        <tr><td>
          <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.7;">
            ${DISCLAIMER}</p>
        </td></tr>
      </table>

    </td></tr>

    <!-- FOOTER -->
    <tr><td style="background:#f9fafb;padding:24px 40px;
      border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        TaxCheckNow · taxchecknow.com · United Kingdom<br/>
        Questions? Reply to this email.<br/>
        <a href="https://taxchecknow.com/privacy"
          style="color:#9ca3af;">Privacy</a> ·
        <a href="https://taxchecknow.com/terms"
          style="color:#9ca3af;">Terms</a>
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── SEND FUNCTION ─────────────────────────────────────────────────────────
export async function sendDeliveryEmail(params: DeliveryEmailParams): Promise<{
  success: boolean;
  resendId?: string;
  error?: string;
}> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[cole-email] Missing RESEND_API_KEY");
    return { success: false, error: "Missing RESEND_API_KEY" };
  }

  if (!params.driveUrl) {
    console.error("[cole-email] Missing Drive URL for:", params.productKey);
    return { success: false, error: "Missing file delivery URL" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "TaxCheckNow <hello@taxchecknow.com>",
        to: [params.to],
        subject: params.subject,
        html: buildHtml(params),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[cole-email] Resend API error:", data);
      return { success: false, error: data.message || "Resend error" };
    }

    console.log("[cole-email] Delivered:", data.id, "→", params.to);
    return { success: true, resendId: data.id };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cole-email] Fetch error:", msg);
    return { success: false, error: msg };
  }
}
