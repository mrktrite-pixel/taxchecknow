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
import type { Engine } from "@/app/_components/EngineCalculator";
import type { EngineFigure } from "@/app/_components/engine-terms";
import type { EngineConfig } from "@/app/_components/engine-config";
import EnginePreviewList, { type PreviewFixture } from "./EnginePreviewList";
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

const AABCA693_CONFIG: EngineConfig = {
  productSlug: "dev-engine-preview-aabca693",
  sourcePath: "/dev/engine-preview",
  country: "AU",
  currency: "AUD",
  site: "taxchecknow",
  defaultTier: 67,
  tierMap: {
    "dasp-tax-whm-visa": 147,
    "dasp-tax-ordinary-visa": 67,
    "dasp-id-requirements-high-balance": 67,
    "dasp-payment-timeline": 67,
    "dasp-unclaimed-super-ato-transfer": 147,
  },
};

const SYNTHETIC_CONFIG: EngineConfig = {
  productSlug: "dev-engine-preview-synthetic",
  sourcePath: "/dev/engine-preview",
  defaultTier: 67,
  tierMap: { "outcome-standard-path": 67, "outcome-review-path": 147 },
};

const FIXTURES: PreviewFixture[] = [
  {
    key: "aabca693",
    title: "aabca693 — real Bee D engine (chained routing)",
    note: "Decisive tax path → HIGH + rate boxes + CTA (whm=tier147, ordinary=tier67); eligibility dish → quasi-escape (no boxes, NO CTA); 'not sure' → neutral escape.",
    engine: aabca693 as Engine,
    figures: aabca693Figures as EngineFigure[],
    config: AABCA693_CONFIG,
  },
  {
    key: "synthetic-flat",
    title: "synthetic — flat/linear engine",
    note: "Decisive → HIGH + box + CTA (standard=tier67); hedged → MEDIUM + CTA; review dish → tier147; q3 'not sure' → neutral escape.",
    engine: syntheticFlat as Engine,
    figures: syntheticFlatFigures as EngineFigure[],
    config: SYNTHETIC_CONFIG,
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
          Stage 3: engine flow → verdict panel → qualification popup → pinned tier/price. Stripe is stubbed.
        </p>
      </div>

      <EnginePreviewList fixtures={FIXTURES} />
    </main>
  );
}
