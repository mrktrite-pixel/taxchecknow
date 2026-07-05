/**
 * /dev/engine-preview — STAGE-1 verification surface for EngineCalculator.
 *
 * noindex dev route. Renders the generic renderer against two checked-in fixtures:
 *   - aabca693.engine.json  — REAL Bee D engine (chained routing, dynamic M)
 *   - synthetic-flat.engine.json — synthetic flat/linear engine (static M)
 *
 * Not linked from anywhere; not a product. The soverella preview mount comes via C1b.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EngineCalculator, { type Engine } from "@/app/_components/EngineCalculator";
import type { EngineFigure } from "@/app/_components/engine-terms";
import aabca693 from "./_fixtures/aabca693.engine.json";
import aabca693Figures from "./_fixtures/aabca693.figures.json";
import syntheticFlat from "./_fixtures/synthetic-flat.engine.json";
import syntheticFlatFigures from "./_fixtures/synthetic-flat.figures.json";

// Checked per-request (not baked at build) so the gate reflects the live env.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Engine preview (dev)",
  robots: { index: false, follow: false },
};

// Dark on the live revenue site: 404 on Vercel production unless explicitly enabled.
// Open in local dev (VERCEL_ENV unset) and Vercel preview deploys (VERCEL_ENV="preview").
function previewEnabled(): boolean {
  return process.env.ENGINE_PREVIEW_ENABLED === "1" || process.env.VERCEL_ENV !== "production";
}

const FIXTURES: { key: string; title: string; note: string; engine: Engine; figures: EngineFigure[] }[] = [
  {
    key: "aabca693",
    title: "aabca693 — real Bee D engine (chained routing)",
    note: "Dynamic STEP N OF M + verdict panel. Decisive tax path → HIGH + rate stat boxes; a 'not sure' answer routes to a neutral escape.",
    engine: aabca693 as Engine,
    figures: aabca693Figures as EngineFigure[],
  },
  {
    key: "synthetic-flat",
    title: "synthetic — flat/linear engine",
    note: "Static STEP N OF M (M=3). Decisive → HIGH + stat box; the 'not sure how long' answer still lands a dish → MEDIUM; q3 'not sure' → neutral escape.",
    engine: syntheticFlat as Engine,
    figures: syntheticFlatFigures as EngineFigure[],
  },
];

export default function EnginePreviewPage() {
  if (!previewEnabled()) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Dev · noindex</p>
        <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">EngineCalculator preview</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Stage 1: engine consumption + step flow. No verdict panel, popup, sessions, or Stripe.
        </p>
      </div>

      <div className="space-y-12">
        {FIXTURES.map((f) => (
          <section key={f.key}>
            <h2 className="mb-1 font-mono text-sm font-bold text-neutral-700">{f.title}</h2>
            <p className="mb-4 text-xs text-neutral-500">{f.note}</p>
            <EngineCalculator engine={f.engine} figures={f.figures} />
          </section>
        ))}
      </div>
    </main>
  );
}
