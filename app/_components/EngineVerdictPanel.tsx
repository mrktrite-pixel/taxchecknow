"use client";

/**
 * EngineVerdictPanel — result surface for EngineCalculator.
 *
 * Manual-panel PARITY (banner, stat boxes, "what this means", confidence, EMAIL
 * CAPTURE, bridge copy, plan checklist, primary CTA, secondary alt-tier link) — with
 * the machine doctrine: banner is NEUTRAL-INFORMATIONAL (no traffic-light colours,
 * #25); differentiation is structural.
 *
 * Two outcome classes:
 *  - RESOLVED dish: full parity, pinned-tier CTA + secondary alt-tier link.
 *  - ESCAPE / quasi-escape: email capture + a single $67 "closer look" CTA, escape-
 *    framed copy — never $147, never "confirmed position", no secondary link.
 *
 * STRUCTURE lives here; all DOMAIN WORDS arrive via props (config-supplied).
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

  // banner labels (config-supplied)
  resultLabel: string;   // resolved-dish banner label
  escapeLabel: string;   // escape banner label
  escapeBody: string;    // escape framed body (used when no verbatim referral lines)

  // primary CTA (both classes; escape = $67 only)
  ctaLabel: string;
  ctaNote: string;
  onCta: () => void;
  // secondary alt-tier link (resolved only)
  secondaryLabel?: string;
  onSecondary?: () => void;
  // conversion copy (resolved only)
  bridgeCopy?: string;
  planChecklist?: string[];

  // email capture (both classes)
  saveHeading: string;
  saveSubcopy: string;
  email: string;
  emailSent: boolean;
  onEmailChange: (v: string) => void;
  onSaveEmail: () => void;
}

function figureText(f: EngineFigure): string {
  return `${f.value}${f.unit ? ` ${f.unit}` : ""}`;
}

function EmailCapture({
  heading,
  subcopy,
  email,
  emailSent,
  onEmailChange,
  onSaveEmail,
}: {
  heading: string;
  subcopy: string;
  email: string;
  emailSent: boolean;
  onEmailChange: (v: string) => void;
  onSaveEmail: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-3">
      <p className="mb-1 text-sm font-semibold text-neutral-800">{heading}</p>
      <p className="mb-2 text-xs text-neutral-500">{subcopy}</p>
      {!emailSent ? (
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
          <button
            onClick={onSaveEmail}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Save
          </button>
        </div>
      ) : (
        <p className="text-sm font-semibold text-emerald-700">✓ Saved — check your inbox.</p>
      )}
    </div>
  );
}

export default function EngineVerdictPanel(props: EngineVerdictPanelProps) {
  const {
    kind, heading, indicatedResult, statFigures, confidence, onReset,
    resultLabel, escapeLabel, escapeBody,
    ctaLabel, ctaNote, onCta, secondaryLabel, onSecondary,
    bridgeCopy, planChecklist,
    saveHeading, saveSubcopy, email, emailSent, onEmailChange, onSaveEmail,
  } = props;
  const isEscape = kind !== "menu";
  const lines = indicatedResult ? toArrowLines(indicatedResult) : [];

  const emailBlock = (
    <EmailCapture
      heading={saveHeading}
      subcopy={saveSubcopy}
      email={email}
      emailSent={emailSent}
      onEmailChange={onEmailChange}
      onSaveEmail={onSaveEmail}
    />
  );

  // ── ESCAPE / QUASI-ESCAPE: escape-framed, email + single $67 CTA, no secondary ──
  if (isEscape) {
    return (
      <div className="space-y-4">
        <button onClick={onReset} className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700">
          ← Change my answers
        </button>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
          <div className="mb-2 flex items-center gap-2">
            <span aria-hidden className="text-neutral-400">◇</span>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">{escapeLabel}</p>
          </div>
          <h3 className="mb-3 font-serif text-xl font-bold text-neutral-950">{heading}</h3>
          {/* quasi-escape shows its own verbatim referral text; a bare escape shows the framed body */}
          {lines.length > 0 ? (
            <ul className="mb-4 space-y-1 text-sm leading-relaxed text-neutral-600">
              {lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          ) : (
            <p className="mb-4 text-sm leading-relaxed text-neutral-600">{escapeBody}</p>
          )}

          {emailBlock}

          <button
            onClick={onCta}
            className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800"
          >
            {ctaLabel}
          </button>
          <p className="mt-2 text-center text-xs text-neutral-400">{ctaNote}</p>
        </div>
      </div>
    );
  }

  // ── RESOLVED DISH: neutral banner + boxes + meaning + confidence + email + bridge + plan + CTA + secondary ──
  return (
    <div className="space-y-4">
      <button onClick={onReset} className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700">
        ← Change my answers
      </button>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
        {/* BANNER — neutral, structural only */}
        <div className="mb-1 flex items-center gap-2">
          <span aria-hidden className="text-neutral-950">◆</span>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">{resultLabel}</p>
        </div>
        <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{heading}</h3>

        {statFigures.length > 0 && (
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {statFigures.map((f) => (
              <div key={f.id ?? f.label} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{f.label}</p>
                <p className="font-serif text-lg font-bold text-neutral-950">{figureText(f)}</p>
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && (
          <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
            <strong className="text-neutral-950">What this means:</strong>
            <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
              {lines.map((l, i) => <li key={i}>→ {l}</li>)}
            </ul>
          </div>
        )}

        {confidence && (
          <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
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

        {emailBlock}

        {/* BRIDGE COPY */}
        {bridgeCopy && (
          <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-sm leading-relaxed text-neutral-700">{bridgeCopy}</p>
          </div>
        )}

        {/* PLAN CHECKLIST */}
        {planChecklist && planChecklist.length > 0 && (
          <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
              What&apos;s in your personalised plan
            </p>
            <ul className="space-y-1 text-xs text-neutral-700">
              {planChecklist.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-emerald-600">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PRIMARY CTA (pinned tier) */}
        <button
          onClick={onCta}
          className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800"
        >
          {ctaLabel}
        </button>
        <p className="mt-2 text-center text-xs text-neutral-400">{ctaNote}</p>

        {/* SECONDARY ALT-TIER LINK */}
        {secondaryLabel && onSecondary && (
          <p className="mt-2 text-center">
            <button onClick={onSecondary} className="text-xs text-neutral-400 underline transition hover:text-neutral-600">
              {secondaryLabel}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
