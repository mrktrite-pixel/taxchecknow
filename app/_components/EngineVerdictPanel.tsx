"use client";

/**
 * EngineVerdictPanel — stage-2 result surface for EngineCalculator.
 *
 * Mirrors the manual-product result UX (banner, stat boxes, "What this means",
 * confidence line) — BUT with the machine-product doctrine (#25 indicated-language):
 *
 *   NEUTRAL-INFORMATIONAL banner for ALL outcomes. No red/green traffic-light verdict
 *   colours — those are a manual-page affordance. Differentiation is STRUCTURAL
 *   (icon + weight), never traffic-light semantics.
 *
 * All copy is verbatim engine text; nothing is generated at render time.
 */

import type { EngineConfidence, EngineFigure } from "@/app/_components/engine-terms";
import { toArrowLines } from "@/app/_components/engine-terms";

export interface EngineVerdictPanelProps {
  kind: "menu" | "escape" | "unknown";
  heading: string;
  indicatedResult: string; // verbatim engine text ("" if none)
  statFigures: EngineFigure[];
  confidence: EngineConfidence | null;
  onReset: () => void;
}

function figureText(f: EngineFigure): string {
  return `${f.value}${f.unit ? ` ${f.unit}` : ""}`;
}

export default function EngineVerdictPanel({
  kind,
  heading,
  indicatedResult,
  statFigures,
  confidence,
  onReset,
}: EngineVerdictPanelProps) {
  const isEscape = kind !== "menu";
  const lines = indicatedResult ? toArrowLines(indicatedResult) : [];

  // ── ESCAPE: distinct neutral, boxless, no confidence ──
  if (isEscape) {
    return (
      <div className="space-y-4">
        <button
          onClick={onReset}
          className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700"
        >
          ← Change my answers
        </button>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
          <div className="mb-2 flex items-center gap-2">
            <span aria-hidden className="text-neutral-400">◇</span>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">No match</p>
          </div>
          <h3 className="mb-2 font-serif text-xl font-bold text-neutral-950">{heading}</h3>
          <p className="text-sm leading-relaxed text-neutral-600">
            This check can&apos;t resolve your situation from the answers given. A closer review of
            your circumstances is indicated.
          </p>
        </div>
      </div>
    );
  }

  // ── DISH: neutral banner + stat boxes + meaning + confidence ──
  return (
    <div className="space-y-4">
      <button
        onClick={onReset}
        className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700"
      >
        ← Change my answers
      </button>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
        {/* BANNER — neutral-informational, structural emphasis only */}
        <div className="mb-1 flex items-center gap-2">
          <span aria-hidden className="text-neutral-950">◆</span>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">
            Indicated result
          </p>
        </div>
        <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{heading}</h3>

        {/* STAT BOXES — up to 3, only for resolved figures (never a placeholder) */}
        {statFigures.length > 0 && (
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {statFigures.map((f) => (
              <div
                key={f.id ?? f.label}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
              >
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                  {f.label}
                </p>
                <p className="font-serif text-lg font-bold text-neutral-950">{figureText(f)}</p>
              </div>
            ))}
          </div>
        )}

        {/* WHAT THIS MEANS — verbatim engine text as arrow lines */}
        {lines.length > 0 && (
          <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
            <strong className="text-neutral-950">What this means:</strong>
            <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
              {lines.map((l, i) => (
                <li key={i}>→ {l}</li>
              ))}
            </ul>
          </div>
        )}

        {/* CONFIDENCE — calibrated language, never a percentage */}
        {confidence && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
            <p className="font-semibold text-neutral-800">
              Confidence: {confidence.level}
              {confidence.level === "MEDIUM" && (
                <span className="font-normal text-neutral-500"> — one or more answers were unsure</span>
              )}
            </p>
            {confidence.checklist.length > 0 && (
              <ul className="mt-1.5 space-y-1 text-neutral-600">
                {confidence.checklist.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span aria-hidden className="mt-0.5 shrink-0 text-neutral-400">✓</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
