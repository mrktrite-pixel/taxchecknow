// â”€â”€ EMAIL TEMPLATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Used by app/api/cron/send-emails for nurture + reminder sequences.
// Plain HTML, minimal styling, single CTA per email.
//
// All templates take the same data shape; reminder_* require deadlineDate.

/** Deadline-free lane: anchored to the customer's own action. */
export type NurtureEmailType = "nurture_d3" | "nurture_d7" | "nurture_d14" | "re_engagement";
/** Deadline lane: anchored to a resolved statutory date. */
export type ReminderEmailType = "reminder_d30" | "reminder_d7" | "reminder_d1";

export type EmailType = NurtureEmailType | ReminderEmailType;

/**
 * Step 7.3 â€” the milestones that HAVE COPY. A declared cadence may only use
 * these; anything else is a declaration error surfaced at emit, never a queued
 * row that cannot render. Extending the cadence means writing copy first, which
 * is deliberately separate work.
 */
export const NURTURE_MILESTONES_WITH_COPY: readonly number[] = [3, 7, 14];

export function isNurtureType(t: string): t is NurtureEmailType {
  return t === "nurture_d3" || t === "nurture_d7" || t === "nurture_d14" || t === "re_engagement";
}
export function isReminderType(t: string): t is ReminderEmailType {
  return t === "reminder_d30" || t === "reminder_d7" || t === "reminder_d1";
}

// â”€â”€ TEMPORAL v1 Step 7.2 â€” HARD SEPARATION OF THE TWO LANES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// A NURTURE EMAIL CAN NEVER RENDER A DEADLINE. Not "should not" â€” cannot.
//
// Why this is a type and not a comment: the nurture lane is anchored to the
// customer's own action (they saved a result on day 0), so it has no deadline to
// speak of. But send-emails used to hand EVERY template the same bag, including
// `deadlineDate: formatDeadlineDate(row.trigger_date)` â€” and for a nurture row
// trigger_date is the SEND date (day 0 + 3/7/14), not a deadline at all. Any
// future edit that rendered it would have printed a confident, statutory-looking
// date that is simply the day the email went out. On a tax product that is the
// exact defect this whole programme removed.
//
// So the shapes are split and the nurture one declares `deadlineDate?: never`.
// Passing a date to a nurture template is now a COMPILE ERROR, and the nurture
// call path below never constructs one to pass.

/** Fields both lanes share. Nothing deadline-derived may live here. */
export interface BaseTemplateData {
  customerName?:  string;
  productName:     string;
  productUrl:        string;

  // Step 4 personalisation hooks â€” all optional, render conditionally.
  // Cron resolves these from email_queue.decision_session_id JOIN
  // decision_sessions + lead-product-meta lookup. When absent, templates
  // gracefully degrade to product-level (non-personalised) copy.
  fearNumber?:    string;   // e.g., "$135,000" or "Â£240,000" â€” per-product from LeadProductMeta
  verdict?:       string;   // e.g., "exposed" / "safe" â€” from decision_sessions.output.status
  authority?:     string;   // e.g., "ATO" / "HMRC" / "IRS" â€” per-product from LeadProductMeta
}

/**
 * The nurture lane's data. `deadlineDate?: never` is the enforcement: TypeScript
 * rejects any attempt to pass a date, so a nurture template cannot render one
 * even by accident.
 */
export interface NurtureTemplateData extends BaseTemplateData {
  deadlineDate?: never;
}

/** The deadline lane's data. deadlineDate is REQUIRED â€” a reminder without one is meaningless. */
export interface ReminderTemplateData extends BaseTemplateData {
  deadlineDate: string;
}

/**
 * Retained only for the reminder lane's internal helpers. Do NOT widen this back
 * into a single shared bag â€” the split above is the Step 7.2 guarantee.
 */
export type TemplateData = ReminderTemplateData;

export interface EmailTemplate { subject: string; html: string; }

const SITE  = "https://www.taxchecknow.com";
const FOOTER = "You saved your result at taxchecknow.com";

// â”€â”€ HTML WRAPPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ PERSONALISATION HELPERS (Step 4) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Both helpers degrade gracefully when fields are absent â€” no broken layout
// and no missing-data placeholders ("$undefined" etc.). Cron supplies the
// fields when email_queue.decision_session_id resolves to a row + lead-
// product-meta lookup; otherwise renders product-only copy.

/** Lead sentence for nurture templates. Personalised when verdict + fearNumber
 *  available; partially personalised when only fearNumber; product-only fallback
 *  otherwise. timeAgo is a short phrase like "Three days ago" or "A week ago". */
function leadSentence(d: BaseTemplateData, timeAgo: string): string {
  if (d.verdict && d.fearNumber) {
    return `${timeAgo} your <strong>${escName(d.productName)}</strong> check found <strong>${escName(d.verdict)}</strong> status with <strong style="color:#dc2626;">${escName(d.fearNumber)}</strong> at stake.`;
  }
  if (d.fearNumber) {
    return `${timeAgo} you ran the <strong>${escName(d.productName)}</strong> check â€” <strong style="color:#dc2626;">${escName(d.fearNumber)}</strong> exposure for situations like yours.`;
  }
  return `${timeAgo} you ran the <strong>${escName(d.productName)}</strong> check on TaxCheckNow.`;
}

/** Per-customer result block â€” boxed callout with verdict + fearNumber +
 *  authority. Renders only when at least one personalisation field is set;
 *  otherwise empty string (template flows around the absence). */
function personalisationBlock(d: BaseTemplateData): string {
  if (!d.verdict && !d.fearNumber) return "";
  return `
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:0 0 18px;background:#f9fafb;">
        <p style="margin:0 0 6px;font-family:monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">Your result</p>
        ${d.verdict ? `<p style="margin:0 0 4px;font-size:15px;color:#111827;font-weight:600;line-height:1.5;">Status: ${escName(d.verdict)}</p>` : ""}
        ${d.fearNumber ? `<p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">Personalised exposure: <strong style="color:#dc2626;">${escName(d.fearNumber)}</strong>${d.authority ? ` under <strong>${escName(d.authority)}</strong>` : ""}</p>` : ""}
      </div>`;
}

// â”€â”€ TEMPLATE BUILDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function nurtureD3(d: BaseTemplateData): EmailTemplate {
  return {
    subject: "What people in your situation usually do",
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        ${leadSentence(d, "Three days ago")}
      </p>
      ${personalisationBlock(d)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Most people who get a result like yours do one of two things in the first week: forward it to their tax adviser for a decision, or run the personalised plan to see the exact next step. Both work. Doing nothing usually doesn't.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Your result is still saved. If you want the full plan with the specific actions for your position:
      </p>
      ${ctaButton("View my full plan â†’", d.productUrl)}
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
        Free to view your saved result. The personalised plan is the paid step â€” only run it if it's useful.
      </p>
    `),
  };
}

function nurtureD7(d: BaseTemplateData): EmailTemplate {
  return {
    subject: "One week on â€” did you act on this?",
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        ${leadSentence(d, "A week ago")}
      </p>
      ${personalisationBlock(d)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Tax positions don't fix themselves â€” they harden. The longer you leave a flagged issue, the harder it gets to unwind cleanly. Most people who deal with this in the first month spend less than those who deal with it a year later.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        If your situation has changed since the check, re-run it. If you've spoken to your tax adviser, the personalised plan gives them the structured starting point.
      </p>
      ${ctaButton("Open my saved result â†’", d.productUrl)}
    `),
  };
}

function nurtureD14(d: BaseTemplateData): EmailTemplate {
  return {
    subject: "Did you sort this out?",
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        ${leadSentence(d, "Two weeks since")}. Last note from us on this one.
      </p>
      ${personalisationBlock(d)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        If you've sorted it â€” good. Stop reading.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        If not â€” here is what you need: the personalised plan with the specific actions for your position. It takes about ten minutes to read. Forward it to your tax adviser when you're done.
      </p>
      ${ctaButton("Get the full plan â†’", d.productUrl)}
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
        Thirty days until <strong>${escName(date)}</strong> â€” the deadline tied to your <strong>${escName(d.productName)}</strong> position.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Missing the date typically means the option you have today is not the option you have on day 31. The window doesn't usually reopen.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Your saved plan and the action sequence are here:
      </p>
      ${ctaButton("Open my plan â†’", d.productUrl)}
    `),
  };
}

function reminderD7(d: TemplateData): EmailTemplate {
  const date = d.deadlineDate ?? "your deadline";
  return {
    subject: `One week left â€” ${date} coming`,
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        Seven days to <strong>${escName(date)}</strong>.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        If your action requires sign-off from a third party â€” accountant, lawyer, broker, super fund â€” start now. A week is enough if you start today.
      </p>
      ${ctaButton("Open my plan â†’", d.productUrl)}
    `),
  };
}

function reminderD1(d: TemplateData): EmailTemplate {
  return {
    subject: "Tomorrow is the deadline",
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        ${d.deadlineDate ? `Tomorrow â€” ${escName(d.deadlineDate)} â€” is the deadline for the action in your <strong>${escName(d.productName)}</strong> plan.` : `Tomorrow is the deadline tied to your <strong>${escName(d.productName)}</strong> plan.`}
      </p>
      ${ctaButton("Open my plan â†’", d.productUrl)}
    `),
  };
}

// â”€â”€ RE-ENGAGEMENT (Step 5) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Last automated touchpoint. Fires once per session, between days 7 and 30
// after save (cron at /api/cron/re-engagement). Single CTA, no chase tone.
// After this, customer goes silent unless they act â€” re_engagement_sent flag
// flips true so the sweep never picks the same row twice.
function reEngagement(d: BaseTemplateData): EmailTemplate {
  return {
    subject: `Your ${d.productName} check is still saved`,
    html: wrap(`
      ${greeting(d.customerName)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#111;">
        ${d.fearNumber
          ? `Your <strong>${escName(d.productName)}</strong> check is still saved â€” <strong style="color:#dc2626;">${escName(d.fearNumber)}</strong> at stake. Quick reminder before we move on.`
          : `Your <strong>${escName(d.productName)}</strong> check is still saved at TaxCheckNow. Quick reminder before we move on.`}
      </p>
      ${personalisationBlock(d)}
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">
        Most people who run this check and don't act within a month either decide it doesn't apply to them, or forget. Both are common. The full plan with the specific actions is here if you want it:
      </p>
      ${ctaButton("View my full plan â†’", d.productUrl)}
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
        If this isn't useful right now, no problem â€” we won't email about it again. Your saved result stays at taxchecknow.com whenever you want it.
      </p>
    `),
  };
}

// â”€â”€ PUBLIC API â€” TWO DOORS, NOT ONE (Step 7.2) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// There is deliberately no single getEmailTemplate(type, data) any more. A
// combined entry point would take a union data shape, and a union containing
// deadlineDate is exactly the hole this step closes: the caller could hand a
// nurture type a bag with a date in it and nothing would object. Two doors means
// the nurture path cannot even name the field.

/** Deadline-free lane. The data type makes deadlineDate unpassable. */
export function getNurtureTemplate(type: NurtureEmailType, data: NurtureTemplateData): EmailTemplate {
  switch (type) {
    case "nurture_d3":    return nurtureD3(data);
    case "nurture_d7":    return nurtureD7(data);
    case "nurture_d14":   return nurtureD14(data);
    case "re_engagement": return reEngagement(data);
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      throw new Error(`Unknown nurture email type: ${String(type)}`);
    }
  }
}

/** Deadline lane. deadlineDate is required by the type. */
export function getReminderTemplate(type: ReminderEmailType, data: ReminderTemplateData): EmailTemplate {
  switch (type) {
    case "reminder_d30": return reminderD30(data);
    case "reminder_d7":  return reminderD7(data);
    case "reminder_d1":  return reminderD1(data);
    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      throw new Error(`Unknown reminder email type: ${String(type)}`);
    }
  }
}

