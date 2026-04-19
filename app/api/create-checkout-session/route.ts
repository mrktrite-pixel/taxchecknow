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
// UK: £67 / £147 · US: $67 / $147

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
  // MTD Complete: UK-01 + UK-03 + UK-04 — £197
  // Income Check: UK-02 + UK-05 — £197
  // Full Stack: all 5 — £347
  if (key === "uk_197_mtd_complete")  return process.env.STRIPE_UK_BUNDLE_MTD;
  if (key === "uk_197_income_check")  return process.env.STRIPE_UK_BUNDLE_INCOME;
  if (key === "uk_347_full_stack")    return process.env.STRIPE_UK_BUNDLE_FULL;

  // ── US-01 Section 174 Phantom Tax Auditor ─────────────────────────────────
  // URL: taxchecknow.com/us/check/section-174-auditor
  // Prices: $67 / $147
  if (key === "us_67_section_174_auditor")  return process.env.STRIPE_US_174_67;
  if (key === "us_147_section_174_auditor") return process.env.STRIPE_US_174_147;

  // ── US-02 FEIE Nomad Auditor ──────────────────────────────────────────────
  // URL: taxchecknow.com/us/check/feie-nomad-auditor
  // Prices: $67 / $147
  if (key === "us_67_feie_nomad_auditor")  return process.env.STRIPE_US_FEIE_67;
  if (key === "us_147_feie_nomad_auditor") return process.env.STRIPE_US_FEIE_147;

  // ── US-03 QSBS Exit Auditor ───────────────────────────────────────────────
  // URL: taxchecknow.com/us/check/qsbs-exit-auditor
  // Prices: $67 / $147
  if (key === "us_67_qsbs_exit_auditor")  return process.env.STRIPE_US_QSBS_67;
  if (key === "us_147_qsbs_exit_auditor") return process.env.STRIPE_US_QSBS_147;

  // ── US-04 ISO AMT Exercise Sniper ─────────────────────────────────────────
  // URL: taxchecknow.com/us/check/iso-amt-sniper
  // Prices: $67 / $147
  if (key === "us_67_iso_amt_sniper")  return process.env.STRIPE_US_ISO_67;
  if (key === "us_147_iso_amt_sniper") return process.env.STRIPE_US_ISO_147;

  // ── US-05 Wayfair Nexus Sniper ────────────────────────────────────────────
  // URL: taxchecknow.com/us/check/wayfair-nexus-sniper
  // Prices: $67 / $147
  if (key === "us_67_wayfair_nexus_sniper")  return process.env.STRIPE_US_NEXUS_67;
  if (key === "us_147_wayfair_nexus_sniper") return process.env.STRIPE_US_NEXUS_147;

  // ── US BUNDLES (add when built) ───────────────────────────────────────────
  // if (key === "us_197_...") return process.env.STRIPE_US_BUNDLE_...;

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
// UK: £67 / £147 · US: $67 / $147 · Bundles: 197 / 347
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
