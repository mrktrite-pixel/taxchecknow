import { NextResponse } from "next/server";
import Stripe from "stripe";

// Stripe initialised inside handler — not at module level
// Prevents build failures when env variables not yet set
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY — add to Vercel environment variables");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

// ── PRICE ID MAP ─────────────────────────────────────────────────────────────
// Maps product_key → Stripe price ID environment variable
// Pattern: [country]_[tier]_[product_slug]
// All products standardised to £67 (tier 1) / £147 (tier 2)

function getPriceId(productKey: string): string | undefined {
  const key = productKey.toLowerCase();

  // ── UK-01 MTD Mandate Auditor ─────────────────────────────────────────────
  if (key === "uk_67_mtd_scorecard")  return process.env.STRIPE_UK_MTD_67;
  if (key === "uk_147_mtd_scorecard") return process.env.STRIPE_UK_MTD_147;

  // ── UK-02 Allowance Sniper ────────────────────────────────────────────────
  if (key === "uk_67_allowance_sniper")  return process.env.STRIPE_UK_ALLOWANCE_67;
  if (key === "uk_147_allowance_sniper") return process.env.STRIPE_UK_ALLOWANCE_147;

  // ── UK-03 Digital Link Forensic Auditor ───────────────────────────────────
  if (key === "uk_67_digital_link_auditor")  return process.env.STRIPE_UK_DLA_67;
  if (key === "uk_147_digital_link_auditor") return process.env.STRIPE_UK_DLA_147;

  // ── UK-04 Side-Hustle MTD Scope Engine ────────────────────────────────────
  if (key === "uk_67_side_hustle_checker")  return process.env.STRIPE_UK_SH_67;
  if (key === "uk_147_side_hustle_checker") return process.env.STRIPE_UK_SH_147;

  // ── UK-05 Dividend Trap Engine ────────────────────────────────────────────
  if (key === "uk_67_dividend_trap")  return process.env.STRIPE_UK_DIV_67;
  if (key === "uk_147_dividend_trap") return process.env.STRIPE_UK_DIV_147;

  // ── UK BUNDLES ────────────────────────────────────────────────────────────
  if (key === "uk_197_mtd_complete")  return process.env.STRIPE_UK_BUNDLE_MTD;
  if (key === "uk_197_income_check")  return process.env.STRIPE_UK_BUNDLE_INCOME;
  if (key === "uk_347_full_stack")    return process.env.STRIPE_UK_BUNDLE_FULL;

  // ── AU GATES (add when built) ─────────────────────────────────────────────
  // if (key === "au_67_...") return process.env.STRIPE_AU_...;

  // ── NZ GATES (add when built) ─────────────────────────────────────────────
  // if (key === "nz_67_...") return process.env.STRIPE_NZ_...;

  // ── CA GATES (add when built) ─────────────────────────────────────────────
  // if (key === "ca_67_...") return process.env.STRIPE_CA_...;

  // ── VISA GATES (add when built) ───────────────────────────────────────────
  // if (key === "vi_uk_67_...") return process.env.STRIPE_VI_UK_...;

  return undefined;
}

// ── VALID TIERS ───────────────────────────────────────────────────────────────
const VALID_TIERS = [67, 147, 197, 347] as const;
type ValidTier = typeof VALID_TIERS[number];

function isValidTier(tier: number): tier is ValidTier {
  return (VALID_TIERS as readonly number[]).includes(tier);
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const body   = await req.json();

    const {
      decision_session_id,
      tier,
      product_key,
      success_url,
      cancel_url,
    } = body;

    console.log("[checkout] incoming:", { decision_session_id, tier, product_key });

    // ── VALIDATION ────────────────────────────────────────────────────────────
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

    // ── PRICE ID LOOKUP ───────────────────────────────────────────────────────
    const priceId = getPriceId(product_key);
    if (!priceId) {
      console.error("[checkout] missing price ID:", { product_key, tier: normalizedTier });
      return NextResponse.json(
        {
          error: `No Stripe price configured for: ${product_key}`,
          hint:  `Add the matching STRIPE_... environment variable to Vercel for this product and tier`,
        },
        { status: 500 }
      );
    }

    // ── BUILD URLS ────────────────────────────────────────────────────────────
    const baseUrl            = process.env.NEXT_PUBLIC_SITE_URL || "https://taxchecknow.com";
    const resolvedSuccessUrl = success_url
      ? `${success_url}?payment=success&tier=${normalizedTier}&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}?payment=success&tier=${normalizedTier}&session_id={CHECKOUT_SESSION_ID}`;
    const resolvedCancelUrl  = cancel_url || `${baseUrl}/uk`;

    console.log("[checkout] creating session:", { priceId, product_key, resolvedSuccessUrl });

    // ── CREATE STRIPE SESSION ─────────────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      mode:                 "payment",
      payment_method_types: ["card"],
      line_items:           [{ price: priceId, quantity: 1 }],
      success_url:          resolvedSuccessUrl,
      cancel_url:           resolvedCancelUrl,
      metadata: {
        decision_session_id: String(decision_session_id),
        tier:                String(normalizedTier),
        product_key:         String(product_key),
        site:                "taxchecknow",
        verification_source: "stripe_checkout",
      },
      payment_intent_data: {
        metadata: {
          decision_session_id: String(decision_session_id),
          tier:                String(normalizedTier),
          product_key:         String(product_key),
          site:                "taxchecknow",
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
        error:   "Failed to create checkout session.",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
