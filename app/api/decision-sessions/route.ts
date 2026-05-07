// ── DECISION SESSIONS API — collection endpoint (POST + PATCH) ───────────
// COLE canonical save-box state-storage pattern. Every site in the
// portfolio uses this exact contract.
//
//   POST   /api/decision-sessions       create a session row, return {id}
//   PATCH  /api/decision-sessions       update a session row by id
//   GET    /api/decision-sessions/[id]  read a session row by id (separate file)
//
// Why an explicit API rather than direct supabase-from-client:
//   - Single point of trust (server-side service-role key, never exposed)
//   - Validation of inputs jsonb shape before write
//   - Future hooks (re_engagement_at scheduling, lead-table mirroring)
//   - Multi-site portability — pattern lives in cole-marketing/lib/ guidance
//
// Dependencies: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.
// Falls through silently when env is missing (common during Vercel
// preview-deploys without DB credentials) — never crashes the calculator's
// non-blocking save flow.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface PostBody {
  product_slug?:          string;
  product_key?:           string;
  source_path?:           string;
  country_code?:          string;
  currency_code?:         string;
  site?:                  string;
  inputs?:                Record<string, unknown>;
  output?:                Record<string, unknown>;
  questionnaire_payload?: Record<string, unknown>;
  recommended_tier?:      number;
  tier_intended?:         number;
  email?:                 string;
}

interface PatchBody extends PostBody {
  id: string;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── POST — create a new decision session row ─────────────────────────────
// Triggered by the calculator's verdict useEffect (template line 200).
// Returns the new row's `id` so the calculator can stash it into state +
// localStorage for cross-navigation hydration via the GET-by-id endpoint.
export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    // Silently succeed — calculator treats this as non-blocking.
    return NextResponse.json({ success: true, id: null });
  }

  const insertRow = {
    product_slug:          body.product_slug          ?? null,
    product_key:           body.product_key           ?? null,
    source_path:           body.source_path           ?? null,
    country_code:          body.country_code          ?? null,
    currency_code:         body.currency_code         ?? null,
    site:                  body.site                  ?? "taxchecknow",
    inputs:                body.inputs                ?? {},
    output:                body.output                ?? {},
    questionnaire_payload: body.questionnaire_payload ?? {},
    recommended_tier:      body.recommended_tier      ?? null,
    tier_intended:         body.tier_intended         ?? null,
    email:                 body.email                 ?? null,
    completed:             false,
    converted:             false,
    re_engagement_sent:    false,
  };

  try {
    const { data, error } = await supabase
      .from("decision_sessions")
      .insert(insertRow)
      .select("id")
      .single();

    if (error || !data) {
      console.error("[decision-sessions/POST] insert failed:", error?.message);
      return NextResponse.json({ success: false, id: null, error: error?.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("[decision-sessions/POST] threw:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, id: null }, { status: 500 });
  }
}

// ── PATCH — update an existing decision session row ─────────────────────
// Triggered by the calculator's checkout-time useEffect (template line 248).
// Also handles save-box email updates (replaces the deprecated
// /api/save-email stub). All non-id fields are optional; only provided
// fields are updated.
export async function PATCH(req: Request) {
  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }
  // Reject fallback ids — they're calculator-side fakes, not real DB rows.
  if (body.id.startsWith("fallback_")) {
    return NextResponse.json({ success: true, ignored: "fallback_id" });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ success: true });
  }

  // Build the update object from only the fields the caller sent.
  const update: Record<string, unknown> = {};
  if (body.product_slug          !== undefined) update.product_slug          = body.product_slug;
  if (body.product_key           !== undefined) update.product_key           = body.product_key;
  if (body.source_path           !== undefined) update.source_path           = body.source_path;
  if (body.country_code          !== undefined) update.country_code          = body.country_code;
  if (body.currency_code         !== undefined) update.currency_code         = body.currency_code;
  if (body.site                  !== undefined) update.site                  = body.site;
  if (body.inputs                !== undefined) update.inputs                = body.inputs;
  if (body.output                !== undefined) update.output                = body.output;
  if (body.questionnaire_payload !== undefined) update.questionnaire_payload = body.questionnaire_payload;
  if (body.recommended_tier      !== undefined) update.recommended_tier      = body.recommended_tier;
  if (body.tier_intended         !== undefined) update.tier_intended         = body.tier_intended;
  if (body.email                 !== undefined) update.email                 = body.email;
  update.updated_at = new Date().toISOString();

  if (Object.keys(update).length === 1) {
    // Only updated_at — caller sent no field updates. No-op.
    return NextResponse.json({ success: true, noop: true });
  }

  try {
    const { error } = await supabase
      .from("decision_sessions")
      .update(update)
      .eq("id", body.id);

    if (error) {
      console.error("[decision-sessions/PATCH] update failed:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[decision-sessions/PATCH] threw:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
