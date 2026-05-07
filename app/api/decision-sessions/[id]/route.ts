// ── DECISION SESSIONS API — single-row read endpoint (GET-by-id) ─────────
// COLE canonical save-box state-storage pattern. Hydration consumer:
// calculator components read `?session_id=X` from URL on mount, fetch
// this endpoint, and rebuild their answers state from `inputs` jsonb.
//
//   GET /api/decision-sessions/[id]   read a session row by id
//
// Falls through silently when env is missing. Returns 404 when row is
// absent (calculator treats as "fresh start"). Returns the canonical
// row shape so the calculator can hydrate without further translation.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  // Reject fallback ids — they're calculator-side fakes, not real DB rows.
  if (id.startsWith("fallback_")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from("decision_sessions")
      .select("id, product_slug, product_key, source_path, country_code, currency_code, site, inputs, output, questionnaire_payload, recommended_tier, tier_intended, email, completed, converted, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[decision-sessions/[id]/GET] query failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[decision-sessions/[id]/GET] threw:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
