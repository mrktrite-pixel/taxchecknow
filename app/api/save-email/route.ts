// ── DEPRECATED — DO NOT USE FOR NEW CALCULATORS ──────────────────────────
// Step 6.2 (May 7 2026): the canonical T2-and-nurture entrypoint is
// /api/leads. This route is kept as a graceful fallback for any cached
// browser session still POSTing here from a deployed-in-the-wild
// calculator. All 47 cole/calculators/*.tsx files now call /api/leads,
// and cole/generators/generate-calculator.ts emits /api/leads for any
// future product.
//
// Day 9 verification gate: confirm ZERO traffic to this route in the
// preceding 7 days BEFORE deletion. If non-zero traffic surfaces, trace
// to the source calculator (cached browser bundle? un-migrated file?)
// and fix that source — DO NOT just delete this route while it's still
// receiving live POSTs.
// ────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, source, country_code, site, session_id } = body;

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      // Silently succeed if Supabase not configured
      return NextResponse.json({ success: true });
    }

    const supabase = createClient(url, key);

    // Update decision session email if session_id provided
    if (session_id && !session_id.startsWith("fallback_")) {
      try {
        await supabase
          .from("decision_sessions")
          .update({ email })
          .eq("id", session_id);
      } catch { /* non-fatal */ }
    }

    // Also insert into a simple email captures log
    try {
      await supabase
        .from("email_log")
        .insert({
          recipient_email: email,
          email_type: "capture",
          subject: `Email capture — ${source}`,
          status: "captured",
        });
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[save-email] error:", err);
    // Always return 200 — never block the user
    return NextResponse.json({ success: true });
  }
}
