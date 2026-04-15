import { NextResponse } from "next/server";
import Stripe from "stripe";

// Stripe initialised inside handler — not at module level
// Prevents build failures when env variables not yet set in Vercel

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY — add to Vercel environment variables");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

// COLE routing — maps product_key to Stripe price ID
// Format: [country]_[tier]_[product_slug]
// Add new products here as gates are built per country
function getPriceId(tier: number, productKey: string): string | undefined {
  const key = productKey.toLowerCase();

  // ── UK ──────────────────────────────────────────────
  // UK-01 — HMRC Nudge Letter Defender
  if (key.includes("hmrc_nudge") || key.includes("uk_nudge")) {
    if (tier === 67) return process.env.STRIPE_UK_NUDGE_67;
    if (tier === 147) return process.env.STRIPE_UK_NUDGE_147;
  }

  // ── NZ ──────────────────────────────────────────────
  // NZ-01 — QROPS Tax Shield
  if (key.includes("qrops") || key.includes("nz_qrops")) {
    if (tier === 67) return process.env.STRIPE_NZ_QROPS_67;
    if (tier === 147) return process.env.STRIPE_NZ_QROPS_147;
  }

  // NZ-02 — Crypto Income Audit
  if (key.includes("nz_crypto") || key.includes("crypto_income")) {
    if (tier === 67) return process.env.STRIPE_NZ_CRYPTO_67;
    if (tier === 147) return process.env.STRIPE_NZ_CRYPTO_147;
  }

  // ── CA ──────────────────────────────────────────────
  // CA-01 — Capital Gains Truth-Table
  if (key.includes("ca_capital") || key.includes("capital_gains_truth")) {
    if (tier === 67) return process.env.STRIPE_CA_CGT_67;
    if (tier === 147) return process.env.STRIPE_CA_CGT_147;
  }

  return undefined;
}

function getSuccessPath(productKey: string, tier: number): string {
  const key = productKey.toLowerCase();
  const variant = tier === 147 ? "execute" : "prepare";

  // UK
  if (key.includes("hmrc_nudge") || key.includes("uk_nudge")) {
    return `/uk/check/hmrc-nudge-letter/success/${variant}`;
  }

  // NZ
  if (key.includes("qrops") || key.includes("nz_qrops")) {
    return `/nz/check/qrops-tax-shield/success/${variant}`;
  }
  if (key.includes("nz_crypto") || key.includes("crypto_income")) {
    return `/nz/check/crypto-income-audit/success/${variant}`;
  }

  // CA
  if (key.includes("ca_capital") || key.includes("capital_gains_truth")) {
    return `/ca/check/capital-gains-truth/success/${variant}`;
  }

  // Default — UK homepage
  return `/uk`;
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const body = await req.json();

    const { decision_session_id, tier, product_key, success_url, cancel_url } = body;

    console.log("COLE — incoming checkout request:", { decision_session_id, tier, product_key });

    if (!decision_session_id || !tier) {
      return NextResponse.json(
        { error: "Missing required fields: decision_session_id and tier are required." },
        { status: 400 }
      );
    }

    const normalizedTier = Number(tier);

    if (![67, 147].includes(normalizedTier)) {
      return NextResponse.json(
        { error: "Invalid tier. Expected 67 or 147." },
        { status: 400 }
      );
    }

    const productKey = product_key || `uk_${normalizedTier}_hmrc_nudge_letter`;
    const priceId = getPriceId(normalizedTier, productKey);

    if (!priceId) {
      console.error("COLE — missing Stripe price ID for:", { productKey, tier: normalizedTier });
      return NextResponse.json(
        { error: `Missing Stripe price configuration for product: ${productKey} tier: ${normalizedTier}. Add to Vercel environment variables.` },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://taxchecknow.com";
    const successPath = getSuccessPath(productKey, normalizedTier);

    const resolvedSuccessUrl = success_url
      ? `${success_url}?payment=success&tier=${normalizedTier}&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}${successPath}?payment=success&tier=${normalizedTier}&session_id={CHECKOUT_SESSION_ID}`;

    const resolvedCancelUrl = cancel_url || `${baseUrl}/uk`;

    console.log("COLE — creating Stripe session:", { priceId, productKey, successPath });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      metadata: {
        decision_session_id: String(decision_session_id),
        tier: String(normalizedTier),
        product_key: productKey,
        site: "taxchecknow",
        verification_source: "stripe_checkout",
      },
      payment_intent_data: {
        metadata: {
          decision_session_id: String(decision_session_id),
          tier: String(normalizedTier),
          product_key: productKey,
          site: "taxchecknow",
        },
      },
    });

    console.log("COLE — Stripe session created:", session.id);

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe session created but no checkout URL returned." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("COLE — Stripe checkout error:", err);
    return NextResponse.json(
      {
        error: "Failed to create checkout session.",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
