import { NextResponse } from "next/server";
import Stripe from "stripe";

// Stripe initialised inside handler — not at module level
// Prevents build failures when env variables not yet set
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY — add to Vercel environment variables");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

// ── PRICE ID MAP ────────────────────────────────────────────────────────────
// Maps product_key → Stripe price ID environment variable
// Add each new gate here as it is built
function getPriceId(productKey: string): string | undefined {
  const key = productKey.toLowerCase();

  // ── UK GATES ──────────────────────────────────────────────────────────────

  // UK-01 MTD-50 Scorecard
  if (key === "uk_67_mtd_scorecard") return process.env.STRIPE_UK_MTD_67;
  if (key === "uk_127_mtd_scorecard") return process.env.STRIPE_UK_MTD_127;

  // UK-02 60% Allowance Sniper (add when built)
  if (key === "uk_47_allowance_sniper") return process.env.STRIPE_UK_ALLOWANCE_47;
  if (key === "uk_97_allowance_sniper") return process.env.STRIPE_UK_ALLOWANCE_97;

  // UK-03 Dividend Trap (add when built)
  if (key === "uk_47_dividend_trap") return process.env.STRIPE_UK_DIVIDEND_47;
  if (key === "uk_97_dividend_trap") return process.env.STRIPE_UK_DIVIDEND_97;

  // UK-04 Crypto Predictor (add when built)
  if (key === "uk_47_crypto_predictor") return process.env.STRIPE_UK_CRYPTO_47;
  if (key === "uk_97_crypto_predictor") return process.env.STRIPE_UK_CRYPTO_97;

  // UK-05 FHL Recovery (add when built)
  if (key === "uk_47_fhl_recovery") return process.env.STRIPE_UK_FHL_47;
  if (key === "uk_97_fhl_recovery") return process.env.STRIPE_UK_FHL_97;

  // UK-06 IHT Buster (add when built)
  if (key === "uk_197_iht_buster") return process.env.STRIPE_UK_IHT_197;
  if (key === "uk_397_iht_buster") return process.env.STRIPE_UK_IHT_397;

  // ── NZ GATES (add when built) ─────────────────────────────────────────────
  // if (key === "nz_47_...") return process.env.STRIPE_NZ_...;

  // ── CA GATES (add when built) ─────────────────────────────────────────────
  // if (key === "ca_47_...") return process.env.STRIPE_CA_...;

  return undefined;
}

// ── VALID TIERS ─────────────────────────────────────────────────────────────
const VALID_TIERS = [47, 67, 97, 127, 147, 197, 397] as const;
type ValidTier = typeof VALID_TIERS[number];

function isValidTier(tier: number): tier is ValidTier {
  return (VALID_TIERS as readonly number[]).includes(tier);
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const body = await req.json();

    const {
      decision_session_id,
      tier,
      product_key,
      success_url,
      cancel_url,
    } = body;

    console.log("[checkout] incoming:", { decision_session_id, tier, product_key });

    // ── VALIDATION ─────────────────────────────────────────────────────────
    if (!decision_session_id || !tier || !product_key) {
      return NextResponse.json(
        { error: "Missing required fields: decision_session_id, tier and product_key are required." },
        { status: 400 }
      );
    }

    const normalizedTier = Number(tier);

    if (!isValidTier(normalizedTier)) {
      return NextResponse.json(
        { error: `Invalid tier: ${normalizedTier}. Expected one of: ${VALID_TIERS.join(", ")}` },
        { status: 400 }
      );
    }

    // ── PRICE ID LOOKUP ─────────────────────────────────────────────────────
    const priceId = getPriceId(product_key);

    if (!priceId) {
      console.error("[checkout] missing price ID:", { product_key, tier: normalizedTier });
      return NextResponse.json(
        {
          error: `No Stripe price configured for: ${product_key}`,
          hint: `Add STRIPE_UK_MTD_${normalizedTier} (or relevant variable) to Vercel environment variables`,
        },
        { status: 500 }
      );
    }

    // ── BUILD URLS ──────────────────────────────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://taxchecknow.com";

    const resolvedSuccessUrl = success_url
      ? `${success_url}?payment=success&tier=${normalizedTier}&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}?payment=success&tier=${normalizedTier}&session_id={CHECKOUT_SESSION_ID}`;

    const resolvedCancelUrl = cancel_url || `${baseUrl}/uk/check/mtd-scorecard`;

    console.log("[checkout] creating session:", { priceId, product_key, resolvedSuccessUrl });

    // ── CREATE STRIPE SESSION ───────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      // Currency is set by the Stripe price — GBP for UK products
      metadata: {
        decision_session_id: String(decision_session_id),
        tier: String(normalizedTier),
        product_key: String(product_key),
        site: "taxchecknow",
        verification_source: "stripe_checkout",
      },
      payment_intent_data: {
        metadata: {
          decision_session_id: String(decision_session_id),
          tier: String(normalizedTier),
          product_key: String(product_key),
          site: "taxchecknow",
        },
      },
    });

    console.log("[checkout] session created:", session.id);

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe session created but no URL returned." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url, session_id: session.id });

  } catch (err: unknown) {
    console.error("[checkout] error:", err);
    return NextResponse.json(
      {
        error: "Failed to create checkout session.",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
