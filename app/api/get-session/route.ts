import { NextResponse } from "next/server";
import Stripe from "stripe";

// DOCTRINE INVARIANT (key layer): Preview authenticates with the TEST key, Production with
// the live key — unconditionally, decided by the environment. This route retrieves the
// checkout session on the success page; a Preview success page must query the SAME (test)
// account create-checkout-session wrote to, or session.retrieve returns "No such session"
// and the name/email personalization silently falls back to defaults.
const isPreview = (): boolean => process.env.VERCEL_ENV === "preview";

function getStripe() {
  const key = isPreview() ? process.env.STRIPE_SECRET_TEST_KEY : process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error(isPreview() ? "Missing STRIPE_SECRET_TEST_KEY (Preview sandbox)" : "Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session id" }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const fullName = session.customer_details?.name || "";
    const firstName = fullName.split(" ")[0] || "there";
    const email = session.customer_details?.email || "";
    const tier = session.metadata?.tier || "";
    const productKey = session.metadata?.product_key || "";

    return NextResponse.json({ firstName, fullName, email, tier, productKey });
  } catch (err) {
    console.error("[get-session] error:", err);
    // Non-fatal — return defaults
    return NextResponse.json({ firstName: "there", fullName: "", email: "", tier: "", productKey: "" });
  }
}
