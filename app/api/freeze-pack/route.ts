import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/freeze-pack — write a rendered pack onto a stored row that has none.
//
// TWO CALLERS, ONE ROUTE:
//   1. HEAL ON VIEW. Rows written before the freeze landed carry raw keys only. The page
//      renders them through renderPack() client-side and posts the result here, so the
//      SECOND view reads a frozen copy. No bulk migration, no backfill job: a row is frozen
//      the first time someone actually looks at it, and a row nobody opens costs nothing.
//   2. THE CLIENT FALLBACK. /api/assess is a pure wrapper — it has never written to the
//      database (44 lines, zero supabase references), so a fallback-generated pack had no
//      persistence path at all. It posts here too, which is why this route takes the
//      rendered pack rather than regenerating one: the same document the buyer is looking
//      at is the one that gets stored.
//
// WRITE-ONCE, BY DESIGN. The row must exist and must NOT already carry a rendered pack. A
// frozen pack is never overwritten from the client — that is the whole point of freezing,
// and it is what stops a later template or field-list change from rewriting a bought
// document. Both refusals return 200 with a reason: the caller has already shown the
// buyer their pack, and a red console error on a page that rendered correctly would be
// noise, not signal.
//
// NOT AN ASSESSMENT GENERATOR. This route never calls a model and never invents content.
// It stores what it is handed, against a row that already exists.
// ─────────────────────────────────────────────────────────────────────────────

// Same construction the sibling routes use (get-assessment/route.ts:10-15); this repo has
// no shared lib/supabase module.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials");
  return createClient(url, key);
}

interface Body {
  session_id?: string;
  rendered?: unknown;
}

/** Shape gate — a rendered pack this server recognises. Rejects anything else. */
function isRenderedPack(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return r.version === 1 && Array.isArray(r.sections);
}

export async function POST(req: Request) {
  try {
    const { session_id, rendered } = (await req.json()) as Body;

    if (!session_id) return NextResponse.json({ ok: false, error: "session_id required" }, { status: 400 });
    if (!isRenderedPack(rendered)) {
      return NextResponse.json({ ok: false, error: "rendered pack missing or unrecognised" }, { status: 400 });
    }

    const sb = getSupabase();

    // Re-validate SERVER-SIDE: the row must exist, and we read its CURRENT json rather than
    // trusting the client's view of it.
    const { data: row, error: readErr } = await sb
      .from("assessments")
      .select("id, assessment_json")
      .eq("stripe_session_id", session_id)
      .maybeSingle();

    if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ ok: false, note: "no stored row for that session" });

    const current = ((row as { assessment_json?: Record<string, unknown> }).assessment_json ?? {}) as Record<string, unknown>;
    if (current.rendered) {
      return NextResponse.json({ ok: false, note: "already frozen" });
    }

    const { error: writeErr } = await sb
      .from("assessments")
      .update({ assessment_json: { ...current, rendered } })
      .eq("stripe_session_id", session_id)
      .is("assessment_json->rendered", null); // concurrent-safe: a racing freeze wins, we no-op

    if (writeErr) return NextResponse.json({ ok: false, error: writeErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, frozen: true });
  } catch (err) {
    console.error("[freeze-pack] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
