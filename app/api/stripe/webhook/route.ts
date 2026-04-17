import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { sendDeliveryEmail } from "@/lib/cole-email";

// ── PRODUCT DELIVERY MAP ─────────────────────────────────────────────────
// Add each new product here as gates go live.
// driveUrl pulls from env var set in Vercel.
const DELIVERY_MAP: Record<string, {
  subject: string;
  productName: string;
  driveUrl: string;
  tierLabel: string;
}> = {
  // UK-01 MTD Scorecard
  "uk_67_mtd_scorecard": {
    subject: "Your MTD Compliance Assessment — TaxCheckNow",
    productName: "Your MTD Compliance Assessment",
    driveUrl: process.env.DRIVE_UK_MTD_67 || "",
    tierLabel: "£67",
  },
  "uk_127_mtd_scorecard": {
    subject: "Your MTD Action Plan — TaxCheckNow",
    productName: "Your MTD Action Plan",
    driveUrl: process.env.DRIVE_UK_MTD_127 || "",
    tierLabel: "£127",
  },

  // UK-02 Allowance Sniper (add when built)
  // "uk_97_allowance_sniper": {
  //   subject: "Your 60% Tax Trap Assessment — TaxCheckNow",
  //   productName: "Your Allowance Sniper Assessment",
  //   driveUrl: process.env.DRIVE_UK_ALLOWANCE_97 || "",
  //   tierLabel: "£97",
  // },

  // UK-03 Digital Link Auditor (add when built)
  // UK-04 Side-Hustle Checker (add when built)
  // UK-05 Dividend Trap (add when built)
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // ── VERIFY STRIPE SIGNATURE ───────────────────────────────────────────
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook] Signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[webhook] Received:", event.type);

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const productKey    = session.metadata?.product_key     || "";
  const tier          = Number(session.metadata?.tier     || 0);
  const decisionSid   = session.metadata?.decision_session_id || "";
  const customerEmail = session.customer_details?.email   || "";
  const amountGbp     = (session.amount_total || 0) / 100;

  console.log("[webhook] Purchase:", { productKey, tier, customerEmail, amountGbp });

  // ── 1. RECORD PURCHASE IN SUPABASE ───────────────────────────────────
  let purchaseId: string | null = null;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("purchases")
      .insert({
        stripe_session_id:     session.id,
        stripe_payment_intent: String(session.payment_intent || ""),
        decision_session_id:   decisionSid,
        product_key:           productKey,
        tier,
        amount_gbp:            amountGbp,
        currency:              session.currency || "gbp",
        customer_email:        customerEmail,
        site:                  "taxchecknow",
        country_code:          "UK",
        delivery_status:       "pending",
        metadata:              session.metadata,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[webhook] Supabase insert error:", error.message);
    } else {
      purchaseId = data?.id || null;
      console.log("[webhook] Purchase recorded:", purchaseId);
    }
  } catch (err) {
    console.error("[webhook] Supabase error — continuing to email:", err);
  }

  // ── 2. DELIVER FILES VIA RESEND ───────────────────────────────────────
  const delivery = DELIVERY_MAP[productKey];

  if (!delivery) {
    console.error("[webhook] No delivery config for product:", productKey);
    return NextResponse.json({ received: true });
  }

  if (!customerEmail) {
    console.error("[webhook] No customer email for session:", session.id);
    return NextResponse.json({ received: true });
  }

  const emailResult = await sendDeliveryEmail({
    to:          customerEmail,
    productName: delivery.productName,
    productKey,
    tierLabel:   delivery.tierLabel,
    driveUrl:    delivery.driveUrl,
    subject:     delivery.subject,
  });

  // ── 3. LOG EMAIL + UPDATE PURCHASE STATUS ─────────────────────────────
  if (purchaseId) {
    try {
      const supabase = getSupabase();

      // Log email
      await supabase.from("email_log").insert({
        purchase_id:     purchaseId,
        recipient_email: customerEmail,
        email_type:      "delivery",
        subject:         delivery.subject,
        resend_id:       emailResult.resendId || null,
        status:          emailResult.success ? "sent" : "failed",
      });

      // Update delivery status on purchase
      await supabase
        .from("purchases")
        .update({
          delivery_status:  emailResult.success ? "sent" : "failed",
          delivery_sent_at: emailResult.success ? new Date().toISOString() : null,
        })
        .eq("id", purchaseId);

    } catch (err) {
      console.error("[webhook] Logging error:", err);
    }
  }

  console.log("[webhook] Complete. Email success:", emailResult.success);
  // Always return 200 — Stripe retries on non-200
  return NextResponse.json({ received: true });
}
