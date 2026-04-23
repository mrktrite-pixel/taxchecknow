import { NextResponse } from "next/server";
import Stripe from "stripe";

// Stripe initialised inside handler — not at module level
// Prevents build failures when env variables not yet set in Vercel
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY — add to Vercel environment variables");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

// ─────────────────────────────────────────────────────────────────────────────
// getPriceId — maps product_key + tier to Stripe price ID env var
//
// RULE FOR ALL FUTURE PRODUCTS:
//   1. AU products: always check key.includes("au_") FIRST
//   2. Legacy supertaxcheck blocks: always guard with !key.includes("au_")
//      so they never accidentally catch au_xxx product keys
//   3. Add new AU products in the AU section below, before the legacy blocks
// ─────────────────────────────────────────────────────────────────────────────
function getPriceId(tier: number, productKey: string): string | undefined {
  const key = productKey.toLowerCase();

  // ─── TAXCHECKNOW UK ────────────────────────────────────────────────────────
  if (key.includes("uk_") && key.includes("mtd")) {
    if (tier === 67)  return process.env.STRIPE_UK_MTD_67;
    if (tier === 147) return process.env.STRIPE_UK_MTD_147;
  }
  if (key.includes("uk_") && key.includes("allowance")) {
    if (tier === 67)  return process.env.STRIPE_UK_ALLOWANCE_67;
    if (tier === 147) return process.env.STRIPE_UK_ALLOWANCE_147;
  }
  if (key.includes("uk_") && key.includes("digital_link")) {
    if (tier === 67)  return process.env.STRIPE_UK_DLA_67;
    if (tier === 147) return process.env.STRIPE_UK_DLA_147;
  }
  if (key.includes("uk_") && key.includes("side_hustle")) {
    if (tier === 67)  return process.env.STRIPE_UK_SH_67;
    if (tier === 147) return process.env.STRIPE_UK_SH_147;
  }
  if (key.includes("uk_") && key.includes("dividend")) {
    if (tier === 67)  return process.env.STRIPE_UK_DIV_67;
    if (tier === 147) return process.env.STRIPE_UK_DIV_147;
  }
  if (key.includes("uk_") && key.includes("pension_iht")) {
    if (tier === 67)  return process.env.STRIPE_UK_PIHT_67;
    if (tier === 147) return process.env.STRIPE_UK_PIHT_147;
  }

  // ─── TAXCHECKNOW US ────────────────────────────────────────────────────────
  if (key.includes("us_") && key.includes("174")) {
    if (tier === 67)  return process.env.STRIPE_US_174_67;
    if (tier === 147) return process.env.STRIPE_US_174_147;
  }
  if (key.includes("us_") && key.includes("feie")) {
    if (tier === 67)  return process.env.STRIPE_US_FEIE_67;
    if (tier === 147) return process.env.STRIPE_US_FEIE_147;
  }
  if (key.includes("us_") && key.includes("qsbs")) {
    if (tier === 67)  return process.env.STRIPE_US_QSBS_67;
    if (tier === 147) return process.env.STRIPE_US_QSBS_147;
  }
  if (key.includes("us_") && key.includes("iso")) {
    if (tier === 67)  return process.env.STRIPE_US_ISO_67;
    if (tier === 147) return process.env.STRIPE_US_ISO_147;
  }
  if (key.includes("us_") && (key.includes("wayfair") || key.includes("nexus"))) {
    if (tier === 67)  return process.env.STRIPE_US_NEXUS_67;
    if (tier === 147) return process.env.STRIPE_US_NEXUS_147;
  }

  // ─── TAXCHECKNOW NZ ────────────────────────────────────────────────────────
  if (key.includes("nz_") && key.includes("bright_line")) {
    if (tier === 67)  return process.env.STRIPE_NZ_BL_67;
    if (tier === 147) return process.env.STRIPE_NZ_BL_147;
  }
  if (key.includes("nz_") && key.includes("gst")) {
    if (tier === 67)  return process.env.STRIPE_NZ_GST_67;
    if (tier === 147) return process.env.STRIPE_NZ_GST_147;
  }
  if (key.includes("nz_") && key.includes("interest")) {
    if (tier === 67)  return process.env.STRIPE_NZ_IR_67;
    if (tier === 147) return process.env.STRIPE_NZ_IR_147;
  }
  if (key.includes("nz_") && key.includes("trust")) {
    if (tier === 67)  return process.env.STRIPE_NZ_TT_67;
    if (tier === 147) return process.env.STRIPE_NZ_TT_147;
  }
  if (key.includes("nz_") && key.includes("investment_boost")) {
    if (tier === 67)  return process.env.STRIPE_NZ_IB_67;
    if (tier === 147) return process.env.STRIPE_NZ_IB_147;
  }

  // ─── TAXCHECKNOW NOMAD (global cross-border residency) ──────────────────────
  if (key.includes("nomad_") && key.includes("residency_risk")) {
    if (tier === 67)  return process.env.STRIPE_NOMAD_RRI_67;
    if (tier === 147) return process.env.STRIPE_NOMAD_RRI_147;
  }
  if (key.includes("nomad_") && key.includes("tax_treaty")) {
    if (tier === 67)  return process.env.STRIPE_NOMAD_TTN_67;
    if (tier === 147) return process.env.STRIPE_NOMAD_TTN_147;
  }
  if (key.includes("nomad_") && key.includes("183_day")) {
    if (tier === 67)  return process.env.STRIPE_NOMAD_183_67;
    if (tier === 147) return process.env.STRIPE_NOMAD_183_147;
  }
  if (key.includes("nomad_") && key.includes("exit_tax")) {
    if (tier === 67)  return process.env.STRIPE_NOMAD_ETT_67;
    if (tier === 147) return process.env.STRIPE_NOMAD_ETT_147;
  }
  if (key.includes("nomad_") && key.includes("uk_residency")) {
    if (tier === 67)  return process.env.STRIPE_NOMAD_UKR_67;
    if (tier === 147) return process.env.STRIPE_NOMAD_UKR_147;
  }
  if (key.includes("nomad_") && key.includes("uk_nrls")) {
    if (tier === 67)  return process.env.STRIPE_NOMAD_NRLS_67;
    if (tier === 147) return process.env.STRIPE_NOMAD_NRLS_147;
  }

  // ─── TAXCHECKNOW AU ────────────────────────────────────────────────────────
  // All AU product keys start with "au_" — always check au_ prefix first.
  // Never let legacy supertaxcheck blocks below catch these.
  if (key.includes("au_") && key.includes("cgt_main_residence")) {
    if (tier === 67)  return process.env.STRIPE_AU_CGT_MR_67;
    if (tier === 147) return process.env.STRIPE_AU_CGT_MR_147;
  }
  if (key.includes("au_") && key.includes("division_7a")) {
    if (tier === 67)  return process.env.STRIPE_AU_DIV7A_67;
    if (tier === 147) return process.env.STRIPE_AU_DIV7A_147;
  }
  if (key.includes("au_") && key.includes("fbt")) {
    if (tier === 67)  return process.env.STRIPE_AU_FBT_67;
    if (tier === 147) return process.env.STRIPE_AU_FBT_147;
  }
  if (key.includes("au_") && key.includes("cgt_discount")) {
    if (tier === 67)  return process.env.STRIPE_AU_CGT_DT_67;
    if (tier === 147) return process.env.STRIPE_AU_CGT_DT_147;
  }
  if (key.includes("au_") && key.includes("negative_gearing")) {
    if (tier === 67)  return process.env.STRIPE_AU_NG_67;
    if (tier === 147) return process.env.STRIPE_AU_NG_147;
  }
  if (key.includes("au_") && key.includes("small_business_cgt")) {
    if (tier === 67)  return process.env.STRIPE_AU_SBCGT_67;
    if (tier === 147) return process.env.STRIPE_AU_SBCGT_147;
  }
  if (key.includes("au_") && key.includes("instant_asset")) {
    if (tier === 67)  return process.env.STRIPE_AU_IAWO_67;
    if (tier === 147) return process.env.STRIPE_AU_IAWO_147;
  }
  if (key.includes("au_") && key.includes("gst_registration")) {
    if (tier === 67)  return process.env.STRIPE_AU_GST_67;
    if (tier === 147) return process.env.STRIPE_AU_GST_147;
  }
  if (key.includes("au_") && key.includes("rental")) {
    if (tier === 67)  return process.env.STRIPE_AU_RENTAL_67;
    if (tier === 147) return process.env.STRIPE_AU_RENTAL_147;
  }
  if (key.includes("au_") && (key.includes("medicare") || key.includes("mls"))) {
    if (tier === 67)  return process.env.STRIPE_AU_MLS_67;
    if (tier === 147) return process.env.STRIPE_AU_MLS_147;
  }
  // AU-11 Bring-Forward Window
  if (key.includes("au_") && key.includes("bring_forward")) {
    if (tier === 67)  return process.env.STRIPE_AU_BFW_67;
    if (tier === 147) return process.env.STRIPE_AU_BFW_147;
  }
  // AU-12 Super Death Tax Trap (death benefit tax + Div 296 double-tax engine)
  if (key.includes("au_") && key.includes("super_death_tax_trap")) {
    if (tier === 67)  return process.env.STRIPE_AU_SDTT_67;
    if (tier === 147) return process.env.STRIPE_AU_SDTT_147;
  }
  // AU-13 Division 296 Wealth Eraser (SMSF cost-base reset election)
  if (key.includes("au_") && key.includes("div296_wealth_eraser")) {
    if (tier === 67)  return process.env.STRIPE_AU_DIV296_67;
    if (tier === 147) return process.env.STRIPE_AU_DIV296_147;
  }
  // AU-14 Super-to-Trust Exit Engine (Div 296 exit break-even decision)
  if (key.includes("au_") && key.includes("super_to_trust")) {
    if (tier === 67)  return process.env.STRIPE_AU_STREXIT_67;
    if (tier === 147) return process.env.STRIPE_AU_STREXIT_147;
  }
  // AU-15 Transfer Balance Cap Optimiser (personal TBC vs general cap)
  if (key.includes("au_") && key.includes("transfer_balance")) {
    if (tier === 67)  return process.env.STRIPE_AU_TBC_67;
    if (tier === 147) return process.env.STRIPE_AU_TBC_147;
  }
  // ADD NEW AU PRODUCTS ABOVE THIS LINE
  // Pattern: if (key.includes("au_") && key.includes("[slug_fragment]")) { ... }

  // ─── SUPERTAXCHECK LEGACY ──────────────────────────────────────────────────
  // These blocks are for the old supertaxcheck.com.au products only.
  // All guards include !key.includes("au_") to prevent catching au_xxx keys.
  // DO NOT remove the !key.includes("au_") guard when adding new products.
  if (!key.includes("au_") && key.includes("div296")) {
    if (tier === 67)  return process.env.STRIPE_DIV296_67;
    if (tier === 147) return process.env.STRIPE_DIV296_147;
  }
  if (!key.includes("au_") && (key.includes("death_benefit") || key.includes("dbtw"))) {
    if (tier === 67)  return process.env.STRIPE_DBTW_67;
    if (tier === 147) return process.env.STRIPE_DBTW_147;
  }
  if (!key.includes("au_") && (key.includes("super_to_trust") || key.includes("exit"))) {
    if (tier === 67)  return process.env.STRIPE_EXIT_67;
    if (tier === 147) return process.env.STRIPE_EXIT_147;
  }
  if (!key.includes("au_") && (key.includes("bring_forward") || key.includes("bfw"))) {
    if (tier === 67)  return process.env.STRIPE_BFW_67;
    if (tier === 147) return process.env.STRIPE_BFW_147;
  }
  if (!key.includes("au_") && (key.includes("transfer_balance") || key.includes("tbc"))) {
    if (tier === 67)  return process.env.STRIPE_TBC_67;
    if (tier === 147) return process.env.STRIPE_TBC_147;
  }

  return undefined;
}

function getSuccessPath(productKey: string, tier: number): string {
  const key = productKey.toLowerCase();
  const variant = tier === 147 ? "execute" : "prepare";

  // Supertaxcheck legacy paths
  if (!key.includes("au_") && (key.includes("death_benefit") || key.includes("dbtw"))) {
    return `/check/death-benefit-tax-wall/success/${variant}`;
  }
  if (!key.includes("au_") && (key.includes("super_to_trust") || key.includes("exit"))) {
    return `/check/super-to-trust-exit/success/${variant}`;
  }
  if (!key.includes("au_") && (key.includes("bring_forward") || key.includes("bfw"))) {
    return `/check/bring-forward-window/success/${variant}`;
  }
  if (!key.includes("au_") && (key.includes("transfer_balance") || key.includes("tbc"))) {
    return `/check/transfer-balance-cap/success/${variant}`;
  }

  // TaxCheckNow — success_url is passed directly from the calculator component
  // This fallback is only used if success_url is not passed
  return `/check/div296-wealth-eraser/success/${variant}`;
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const body = await req.json();
    const { decision_session_id, tier, product_key, success_url, cancel_url } = body;

    console.log("Incoming checkout request:", { decision_session_id, tier, product_key });

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

    const productKey = product_key || `supertax_${normalizedTier}_div296_wealth_eraser`;
    const priceId = getPriceId(normalizedTier, productKey);

    if (!priceId) {
      console.error("Missing Stripe price ID for:", { productKey, tier: normalizedTier });
      return NextResponse.json(
        { error: `No Stripe price configured for: ${productKey}. Add ${productKey} to Vercel environment variables.` },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://taxchecknow.com";
    const successPath = getSuccessPath(productKey, normalizedTier);

    const resolvedSuccessUrl = success_url
      ? `${success_url}?payment=success&tier=${normalizedTier}&session_id={CHECKOUT_SESSION_ID}`
      : `${baseUrl}${successPath}?payment=success&tier=${normalizedTier}&session_id={CHECKOUT_SESSION_ID}`;

    const resolvedCancelUrl = cancel_url || `${baseUrl}/check/div296-wealth-eraser`;

    console.log("Creating Stripe session:", { priceId, productKey, successPath });

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
        verification_source: "stripe_checkout",
      },
      payment_intent_data: {
        metadata: {
          decision_session_id: String(decision_session_id),
          tier: String(normalizedTier),
          product_key: productKey,
        },
      },
    });

    console.log("Stripe session created:", session.id);

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe session created but no checkout URL returned." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });

  } catch (err: unknown) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      {
        error: "Failed to create checkout session.",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
