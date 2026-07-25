import { NextResponse } from "next/server";
import { generateAssessment, type AssessInput } from "@/lib/assess-core";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/assess — thin HTTP wrapper over lib/assess-core.generateAssessment().
// Used by the client success-page fallback. The Stripe webhook calls generateAssessment()
// IN-PROCESS (no HTTP self-call) — see lib/assess-core.ts for why.
//
// Request body: { inputs, product_id, market, authority, tier: 1|2, name, fields }
// Response (success): { assessment, grounded: true, corpus_source, corpus_verified }
// Response (failure): { error, ... } with a matching status (424 = fail-closed, corpus unreachable).
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<AssessInput>;
    const result = await generateAssessment({
      inputs: body.inputs as Record<string, unknown>,
      product_id: body.product_id as string,
      market: body.market as string,
      authority: body.authority as string,
      tier: body.tier as number,
      name: body.name as string,
      fields: body.fields as string[],
    });

    if (!result.ok) {
      const { status, error, detail, product_id } = result;
      return NextResponse.json({ error, detail, product_id, grounded: false }, { status });
    }
    const { assessment, grounded, corpus_source, corpus_verified } = result;
    return NextResponse.json({ assessment, grounded, corpus_source, corpus_verified });
  } catch (err: unknown) {
    console.error("Assess API error:", err);
    return NextResponse.json(
      { error: "Assessment generation failed", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
