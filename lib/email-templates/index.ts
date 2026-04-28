// ── EMAIL TEMPLATES ──────────────────────────────────────────────────────
// Used by app/api/cron/send-emails for nurture + reminder sequences.
// Plain HTML, minimal styling, single CTA per email.
//
// All templates take the same data shape; reminder_* require deadlineDate.

export type EmailType =
  | "nurture_d3"
  | "nurture_d7"
  | "nurture_d14"
  | "reminder_d30"
  | "reminder_d7"
  | "reminder_d1";

export interface TemplateData {
  customerName?:  string;
  productName:     string;
  productUrl:        string;
  deadlineDate?:      string;   // Required for reminder_* types
}

export interface EmailTemplate { subject: string; html: string; }

const SITE  = "https://www.taxchecknow.com";
const FOOTER = "You saved your result at taxchecknow.com";

// ── HTML WRAPPER ─────────────────────────────────────────────────────────
function wrap(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;border:1px solid #e5e7eb;max-width:560px;">
        <tr><td style="padding:32px;">
          ${bodyHtml}
          <p style="margin:32px 0 0;padding-top:18px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
            ${FOOTER}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  const fullUrl = url.startsWith("http") ? url : `${SITE}${url.startsWith("/") ? "" : "/"}${url}`;
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:#0a0a0a;border-radius:10px;">
      <a href="${fullUrl}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">${label}</a>
    </td></tr>
  </table>`;
}

function greeting(name?: string): string {
  return name && name.trim() ? `<p style="margin:0 0 16px;font-size:15px;color:#111;">${escapeHtml(name.split(" ")[0])},</p>` : "";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escName(s: string): string { return escapeHtml(s); }

// ── TEMPLATE BUILDERS ────────────────────────────────────────────────────

function nurtureD3(d: TemplateData): EmailTemplate {
  return {
    subject: "What people in your situation usually do",
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        Three days ago you ran the <strong>${escName(d.productName)}</strong> check on TaxCheckNow.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Most people who get a result like yours do one of two things in the first week: forward it to their accountant for a decision, or run the personalised plan to see the exact next step. Both work. Doing nothing usually doesn't.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Your result is still saved. If you want the full plan with the specific actions for your position:
      </p>
      ${ctaButton("View my full plan →", d.productUrl)}
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
        Free to view your saved result. The personalised plan is the paid step — only run it if it's useful.
      </p>
    `),
  };
}

function nurtureD7(d: TemplateData): EmailTemplate {
  return {
    subject: "One week on — did you act on this?",
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        A week ago you ran the <strong>${escName(d.productName)}</strong> check.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Tax positions don't fix themselves — they harden. The longer you leave a flagged issue, the harder it gets to unwind cleanly. Most people who deal with this in the first month spend less than those who deal with it a year later.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        If your situation has changed since the check, re-run it. If you've spoken to your accountant, the personalised plan gives them the structured starting point.
      </p>
      ${ctaButton("Open my saved result →", d.productUrl)}
    `),
  };
}

function nurtureD14(d: TemplateData): EmailTemplate {
  return {
    subject: "Did you sort this out?",
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        Two weeks since the <strong>${escName(d.productName)}</strong> check. Last note from us on this one.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        If you've sorted it — good. Stop reading.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        If not — here is what you need: the personalised plan with the specific actions for your position. It takes about ten minutes to read. Forward it to your accountant when you're done.
      </p>
      ${ctaButton("Get the full plan →", d.productUrl)}
    `),
  };
}

function reminderD30(d: TemplateData): EmailTemplate {
  const date = d.deadlineDate ?? "your deadline";
  return {
    subject: `30 days to ${date}`,
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        Thirty days until <strong>${escName(date)}</strong> — the deadline tied to your <strong>${escName(d.productName)}</strong> position.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Missing the date typically means the option you have today is not the option you have on day 31. The window doesn't usually reopen.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Your saved plan and the action sequence are here:
      </p>
      ${ctaButton("Open my plan →", d.productUrl)}
    `),
  };
}

function reminderD7(d: TemplateData): EmailTemplate {
  const date = d.deadlineDate ?? "your deadline";
  return {
    subject: `One week left — ${date} coming`,
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        Seven days to <strong>${escName(date)}</strong>.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        If your action requires sign-off from a third party — accountant, lawyer, broker, super fund — start now. A week is enough if you start today.
      </p>
      ${ctaButton("Open my plan →", d.productUrl)}
    `),
  };
}

function reminderD1(d: TemplateData): EmailTemplate {
  return {
    subject: "Tomorrow is the deadline",
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        ${d.deadlineDate ? `Tomorrow — ${escName(d.deadlineDate)} — is the deadline for the action in your <strong>${escName(d.productName)}</strong> plan.` : `Tomorrow is the deadline tied to your <strong>${escName(d.productName)}</strong> plan.`}
      </p>
      ${ctaButton("Open my plan →", d.productUrl)}
    `),
  };
}

// ── PUBLIC API ───────────────────────────────────────────────────────────
export function getEmailTemplate(type: EmailType, data: TemplateData): EmailTemplate {
  switch (type) {
    case "nurture_d3":  return nurtureD3(data);
    case "nurture_d7":  return nurtureD7(data);
    case "nurture_d14": return nurtureD14(data);
    case "reminder_d30":return reminderD30(data);
    case "reminder_d7": return reminderD7(data);
    case "reminder_d1": return reminderD1(data);
    default: {
      // Exhaustiveness check at compile time; runtime fallback if a new type slips in
      const _exhaustive: never = type;
      void _exhaustive;
      throw new Error(`Unknown email type: ${String(type)}`);
    }
  }
}
