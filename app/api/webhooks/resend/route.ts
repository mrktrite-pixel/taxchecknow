// ── RESEND WEBHOOK → OBSERVED DELIVERY (TEMPORAL v1 · Step 4.5) ──────────
// Endpoint:  POST /api/webhooks/resend
// Configure: Resend dashboard → Webhooks → add endpoint
//              https://taxchecknow.com/api/webhooks/resend
//            subscribe to: email.delivered, email.bounced, email.complained,
//                          email.delivery_delayed
//            then set RESEND_WEBHOOK_SECRET (the whsec_… signing secret) in Vercel.
//
// WHY
// Until now a "send" was an ASSERTION: we recorded status='sent' the moment the
// Resend API accepted the payload. Acceptance is not delivery. A hard bounce, a
// spam complaint, or a silently dropped message all looked identical to success,
// so `delivery_status='sent'` on a paid purchase proved nothing.
//
// This route records what Resend OBSERVED, in columns kept deliberately separate
// from `status`:
//   status         — did WE hand it to Resend        (asserted, drives the 24h cap)
//   delivery_state — what Resend saw happen next     (evidenced)
// Keeping them apart matters: a bounce arriving hours later must not retro-edit
// `status` and thereby perturb the per-recipient cap or any existing query.
//
// Requires the Step 4 DDL (email_log.delivery_state/delivered_at/bounced_at/
// complained_at/bounce_type/last_event_at + the resend_id index).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM_ADDRESS  = "TaxCheckNow <hello@taxchecknow.com>";
const RESEND_URL    = "https://api.resend.com/emails";
// Svix replay window. 5 minutes is Svix's own documented tolerance.
const TOLERANCE_SEC = 300;

type DeliveryState = "delivered" | "bounced" | "complained" | "delayed";

// Terminality ranking. A late-arriving weaker event must never overwrite a
// stronger one (a `delivery_delayed` retry notice arriving after `delivered`
// would otherwise make a delivered email look stuck).
const RANK: Record<DeliveryState, number> = {
  delayed: 1, delivered: 2, bounced: 3, complained: 4,
};

const EVENT_MAP: Record<string, DeliveryState> = {
  "email.delivered":       "delivered",
  "email.bounced":         "bounced",
  "email.complained":      "complained",
  "email.delivery_delayed": "delayed",
};

// ── SVIX SIGNATURE VERIFICATION ──────────────────────────────────────────
// Implemented directly against node:crypto rather than pulling in the `svix`
// package — the scheme is a single HMAC and the project has no other need for
// the dependency.
function verifySvix(secret: string, headers: Headers, rawBody: string): { ok: true } | { ok: false; reason: string } {
  const svixId        = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return { ok: false, reason: "missing svix headers" };

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad svix-timestamp" };
  const driftSec = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (driftSec > TOLERANCE_SEC) return { ok: false, reason: `timestamp outside tolerance (${driftSec}s)` };

  // whsec_<base64>. The base64 payload is the raw HMAC key.
  const keyB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: Buffer;
  try { key = Buffer.from(keyB64, "base64"); }
  catch { return { ok: false, reason: "malformed signing secret" }; }

  const expected = createHmac("sha256", key)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest();

  // Header is a space-delimited list of "v1,<base64sig>" — a secret rotation
  // sends more than one, and any match is valid.
  for (const part of svixSignature.split(" ")) {
    const comma = part.indexOf(",");
    if (comma < 0) continue;
    if (part.slice(0, comma) !== "v1") continue;
    let given: Buffer;
    try { given = Buffer.from(part.slice(comma + 1), "base64"); } catch { continue; }
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "no matching v1 signature" };
}

async function alertOperator(summary: string): Promise<void> {
  const operator  = process.env.OPERATOR_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;
  if (!operator || !resendKey) {
    console.error("[resend-webhook] OPERATOR ALERT (no OPERATOR_EMAIL/RESEND_API_KEY):", summary);
    return;
  }
  try {
    await fetch(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: FROM_ADDRESS, to: [operator],
        subject: "[TaxCheckNow] Email not delivered",
        html: `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;">${summary.replace(/</g, "&lt;")}</pre>`,
      }),
    });
  } catch { /* non-fatal */ }
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not configured — rejecting");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Raw body BEFORE parsing — the signature covers the exact bytes.
  const rawBody = await request.text();

  const verdict = verifySvix(secret, request.headers, rawBody);
  if (!verdict.ok) {
    console.error("[resend-webhook] signature rejected:", verdict.reason);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; created_at?: string; data?: Record<string, unknown> };
  try { event = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const state = event.type ? EVENT_MAP[event.type] : undefined;
  if (!state) {
    // email.sent / email.opened / email.clicked etc. — acknowledged, not recorded.
    // 200 so Resend does not retry an event we deliberately ignore.
    return NextResponse.json({ received: true, ignored: event.type ?? "unknown" });
  }

  const data    = (event.data ?? {}) as Record<string, unknown>;
  const emailId = typeof data.email_id === "string" ? data.email_id : null;
  if (!emailId) {
    console.error("[resend-webhook] event has no data.email_id:", event.type);
    return NextResponse.json({ received: true, ignored: "no email_id" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createClient(supabaseUrl, supabaseKey) as any;

  const eventAt = typeof event.created_at === "string" && !Number.isNaN(Date.parse(event.created_at))
    ? new Date(event.created_at).toISOString()
    : new Date().toISOString();

  // Locate the send this event refers to. resend_id is stamped by every send
  // path (webhook delivery, send-emails cron, re-engagement cron).
  const { data: existingRows, error: findErr } = await sb
    .from("email_log")
    .select("id, recipient_email, email_type, product_key, purchase_id, delivery_state")
    .eq("resend_id", emailId)
    .limit(1);

  if (findErr) {
    console.error("[resend-webhook] email_log lookup failed:", findErr.message);
    // 500 so Resend retries — losing a delivery event silently is the exact
    // class of blindness Step 4 exists to remove.
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  const existing = ((existingRows ?? []) as Record<string, unknown>[])[0];
  if (!existing) {
    // An event for a send we have no record of. Not retryable — 200 — but it is
    // a real signal: it means something sent mail as us without logging it.
    console.error(
      JSON.stringify({ tag: "resend_event_unmatched", resend_id: emailId, event: event.type, state }),
    );
    return NextResponse.json({ received: true, matched: false });
  }

  const prevState = existing.delivery_state as DeliveryState | null;
  const isUpgrade = !prevState || RANK[state] >= RANK[prevState];

  const patch: Record<string, unknown> = { last_event_at: eventAt };
  if (isUpgrade) patch.delivery_state = state;
  if (state === "delivered")  patch.delivered_at  = eventAt;
  if (state === "bounced") {
    patch.bounced_at = eventAt;
    const bounce = data.bounce as Record<string, unknown> | undefined;
    patch.bounce_type = typeof bounce?.type === "string" ? bounce.type : "unknown";
  }
  if (state === "complained") patch.complained_at = eventAt;

  const { error: updErr } = await sb.from("email_log").update(patch).eq("id", existing.id);
  if (updErr) {
    console.error("[resend-webhook] email_log update failed:", updErr.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // A bounce or complaint means a customer did NOT get their email. That is a
  // send failure discovered after the fact — surface it now, not on the next
  // daily health sweep.
  if (state === "bounced" || state === "complained") {
    await alertOperator(
      `Email ${state.toUpperCase()} — the recipient did not receive this.\n` +
      `recipient: ${existing.recipient_email ?? "?"}\n` +
      `type:      ${existing.email_type ?? "?"}\n` +
      `product:   ${existing.product_key ?? "?"}\n` +
      `purchase:  ${existing.purchase_id ?? "(none — not a paid delivery)"}\n` +
      `resend_id: ${emailId}\n` +
      `bounce:    ${String(patch.bounce_type ?? "n/a")}\n` +
      `at:        ${eventAt}`,
    );
  }

  console.log(
    JSON.stringify({
      tag: "resend_event", event: event.type, state, resend_id: emailId,
      email_log_id: existing.id, applied: isUpgrade, prev_state: prevState ?? null,
    }),
  );

  return NextResponse.json({ received: true, matched: true, state, applied: isUpgrade });
}
