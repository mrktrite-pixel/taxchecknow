import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dateAnswerField } from "@/lib/buyer-context";

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
      .select("assessment_json, customer_name, product_id, tier, created_at, decision_session_id")
      .eq("stripe_session_id", sessionId)
      .single() as { data: { assessment_json: Record<string,unknown>; customer_name: string; product_id: string; tier: number; created_at: string; decision_session_id: string | null } | null; error: unknown };

    if (error || !data) {
      // Not ready yet — webhook may still be processing
      return NextResponse.json({ found: false }, { status: 404 });
    }

    // W4 — THE TERMINAL, RESOLVED SERVER-SIDE.
    //
    // Everything the success page conditions on the buyer's verdict — the strip, the calendar,
    // the file ordering, START HERE, the document {{#if}} sections and the tier-2 checklist
    // heading — hangs off `terminalId`, and the page could only get that from sessionStorage.
    // That is fine in the tab the buyer checked out from and empty everywhere else: the link
    // in their receipt email, a different device, a reopened browser. In those cases every one
    // of those surfaces silently degraded to the neutral default.
    //
    // The terminal is already recorded server-side on the decision_sessions row the webhook
    // linked, so the stored path can simply be told. Measured 2026-08-16: 8/8 FRCGW assessment
    // rows carry a decision_session_id and terminal_id resolves for all 8.
    //
    // Best-effort by design: a missing link degrades to today's behaviour rather than 500ing a
    // page whose assessment we already have in hand.
    let terminalId: string | null = null;
    let settlementDate: string | null = null;
    if (data.decision_session_id) {
      const { data: ds } = await (supabase as any)
        .from("decision_sessions")
        .select("output")
        .eq("id", data.decision_session_id)
        .single() as { data: { output: { terminal_id?: string; raw_answers?: Record<string, unknown> } | null } | null };
      terminalId = ds?.output?.terminal_id ?? null;

      // THE BUYER'S OWN DATE, same journey as the terminal above.
      //
      // Everything dated on the success page — the countdown, the lodge-by date, the
      // settlement-anchored calendar entries — was derived from sessionStorage alone, so it
      // vanished on exactly the visits the terminal used to vanish on. The date is recorded
      // on the same decision_sessions row; it just was not being read.
      //
      // MEASURED (2026-08-16, row d1c7df00-e116-4ffc-b480-d05061c04c21):
      //   output.raw_answers.q6_settlement_date = "2026-08-26"
      // The key is per-product, so it comes from dateAnswerField() rather than a literal.
      //
      // Only a well-formed ISO date is passed on. The same answer slot also holds the skip
      // value ("not_scheduled"), and forwarding that would turn "I have no date" into a
      // parse failure downstream instead of the honest undated render.
      const field = dateAnswerField(data.product_id);
      const raw = field ? ds?.output?.raw_answers?.[field] : undefined;
      if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) settlementDate = raw;
    }

    return NextResponse.json({
      found:        true,
      assessment:   data.assessment_json,
      customerName: data.customer_name,
      productId:    data.product_id,
      tier:         data.tier,
      generatedAt:  data.created_at,
      terminalId,
      settlementDate,
    });

  } catch (err: unknown) {
    console.error("[get-assessment] Error:", err);
    return NextResponse.json({ error: "Failed", found: false }, { status: 500 });
  }
}
