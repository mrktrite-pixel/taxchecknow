import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// GET /api/get-assessment?session_id=cs_xxx
// Fetches pre-generated assessment from Supabase (stored by Stripe webhook).
// Success pages call this first — instant load if webhook already ran.
// If not found (404), success page falls back to calling /api/assess directly.

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await (supabase as any)
      .from("assessments")
      .select("assessment_json, customer_name, product_id, tier, created_at")
      .eq("stripe_session_id", sessionId)
      .single() as { data: { assessment_json: Record<string,unknown>; customer_name: string; product_id: string; tier: number; created_at: string } | null; error: unknown };

    if (error || !data) {
      // Not ready yet — webhook may still be processing
      return NextResponse.json({ found: false }, { status: 404 });
    }

    return NextResponse.json({
      found:        true,
      assessment:   data.assessment_json,
      customerName: data.customer_name,
      productId:    data.product_id,
      tier:         data.tier,
      generatedAt:  data.created_at,
    });

  } catch (err: unknown) {
    console.error("[get-assessment] Error:", err);
    return NextResponse.json({ error: "Failed", found: false }, { status: 500 });
  }
}
