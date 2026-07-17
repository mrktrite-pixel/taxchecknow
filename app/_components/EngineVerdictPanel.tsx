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
 * PRESENTATION: "the engine look" (operator reel) — sans throughout, canvas-owned by
 * EngineCalculator; tokens navy #0B1F44 / accent #2563EB / ink #0F172A / muted #64748B
 * / hairline #E2E8F0. Severity mapping unchanged (config-supplied; renderer never assigns).
 */

import type { EngineConfidence, EngineFigure } from "@/app/_components/engine-terms";
import { toArrowLines } from "@/app/_components/engine-terms";
import type { Severity } from "@/app/_components/engine-config";

// Operator-approved severity class → traffic-light palette (matches manual getStatusStyle).
// Renderer only maps class → colour; it never assigns severity (config-supplied).
const SEVERITY_STYLE: Record<Severity, { panel: string; label: string }> = {
  blue: { panel: "border-blue-200 bg-blue-50", label: "text-blue-700" },
  green: { panel: "border-emerald-200 bg-emerald-50", label: "text-emerald-700" },
  amber: { panel: "border-amber-200 bg-amber-50", label: "text-amber-700" },
  red: { panel: "border-red-200 bg-red-50", label: "text-red-700" },
};

// shared presentation atoms (engine look)
const GHOST_BACK = "rounded-md text-[11px] font-medium uppercase tracking-widest text-[#64748B] transition-colors hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none";
const PRIMARY_CTA = "w-full rounded-xl bg-[#0B1F44] py-4 text-[16px] font-semibold text-white transition-colors hover:bg-[#132F62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none";
const MICRO_CAPS = "text-[10px] font-semibold uppercase tracking-widest text-[#64748B]";

export interface EngineVerdictPanelProps {
  kind: "menu" | "escape" | "unknown";
  severity?: Severity; // resolved-dish banner colour (config-supplied); escapes ignore it
  whyFacts?: string[]; // B5 — the answered facts (trail labels) shown as a ✓-list above the verdict
  heading: string;
  indicatedResult: string; // verbatim engine text ("" if none)
  statFigures: EngineFigure[];
  confidence: EngineConfidence | null;
  onReset: () => void;

  // banner labels (config-supplied)
  resultLabel: string;   // resolved-dish banner label
  escapeLabel: string;   // escape banner label
  escapeBody: string;    // escape framed body (used when no verbatim referral lines)

  // primary CTA (both classes; escape = $67 only). Optional so monetize-off blue
  // (informational) terminals render CTA-less.
  ctaLabel?: string;
  ctaNote?: string;
  onCta?: () => void;
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
    <div className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <p className="mb-1 text-sm font-semibold text-[#0F172A]">{heading}</p>
      <p className="mb-3 text-xs text-[#64748B]">{subcopy}</p>
      {!emailSent ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="min-h-[44px] flex-1 rounded-lg border border-[#E2E8F0] bg-[#F4F6FB] px-3 py-2 text-sm text-[#0F172A] outline-none transition-colors focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB] motion-reduce:transition-none"
          />
          <button
            onClick={onSaveEmail}
            className="min-h-[44px] rounded-lg bg-[#0B1F44] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#132F62] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none"
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
    kind, severity, whyFacts, heading, indicatedResult, statFigures, confidence, onReset,
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
  // Distinct escape identity kept (diamond-OUTLINE ◇ glyph, escape label, $67-only, no why-facts/secondary),
  // now SEVERITY-TINTED per the operator walk verdict (2026-07-17): escapes carry their mapped severity
  // colour (was a neutral slate card — the "never traffic-light" escape doctrine is superseded).
  if (isEscape) {
    const esc = SEVERITY_STYLE[severity ?? "blue"];
    return (
      <div className="space-y-4">
        <button onClick={onReset} className={GHOST_BACK}>← Change my answers</button>
        <div className={`rounded-3xl border p-5 sm:p-7 ${esc.panel}`}>
          <div className="mb-2 flex items-center gap-2" aria-live="polite">
            <span aria-hidden className={esc.label}>◇</span>
            <p className={`text-[10px] font-semibold uppercase tracking-widest ${esc.label}`}>{escapeLabel}</p>
          </div>
          <h3 className="mb-3 text-[23px] font-bold leading-snug text-[#0F172A]">{heading}</h3>
          {/* quasi-escape shows its own verbatim referral text; a bare escape shows the framed body */}
          {lines.length > 0 ? (
            <ul className="mb-4 space-y-1 text-[15px] leading-relaxed text-[#334155]">
              {lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          ) : (
            <p className="mb-4 text-[15px] leading-relaxed text-[#334155]">{escapeBody}</p>
          )}

          {emailBlock}

          {onCta && ctaLabel && (
            <>
              <button onClick={onCta} className={PRIMARY_CTA}>{ctaLabel}</button>
              {ctaNote && <p className={`mt-2 text-center ${MICRO_CAPS}`}>{ctaNote}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  // ── RESOLVED DISH: severity-tinted banner + boxes + meaning + confidence + email + bridge + plan + CTA + secondary ──
  return (
    <div className="space-y-4">
      <button onClick={onReset} className={GHOST_BACK}>← Change my answers</button>

      <div className={`rounded-3xl border p-5 sm:p-7 ${SEVERITY_STYLE[severity ?? "green"].panel}`}>
        {/* BANNER — colour driven by operator-approved severity class */}
        <div className="mb-1 flex items-center gap-2" aria-live="polite">
          <span aria-hidden className={SEVERITY_STYLE[severity ?? "green"].label}>◆</span>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${SEVERITY_STYLE[severity ?? "green"].label}`}>{resultLabel}</p>
        </div>
        <h3 className="mb-4 text-[23px] font-bold leading-snug text-[#0F172A]">{heading}</h3>

        {/* B5 — WHY WE REACHED THIS RESULT: the answered facts as a ✓-list, above the verdict detail */}
        {whyFacts && whyFacts.length > 0 && (
          <div className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
            <p className={`mb-2 ${MICRO_CAPS}`}>Why we reached this result</p>
            <ul className="grid gap-x-6 gap-y-1 text-[13px] text-[#334155] sm:grid-cols-2">
              {whyFacts.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 shrink-0 text-emerald-600">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {statFigures.length > 0 && (
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {statFigures.map((f) => (
              <div key={f.id ?? f.label} className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
                <p className={`mb-1 ${MICRO_CAPS}`}>{f.label}</p>
                <p className="text-lg font-bold text-[#0F172A]">{figureText(f)}</p>
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && (
          <div className="mb-4 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
            <strong className="text-sm text-[#0F172A]">What this means:</strong>
            <ul className="mt-1.5 space-y-1.5 text-[15px] leading-relaxed text-[#334155]">
              {lines.map((l, i) => <li key={i}>→ {l}</li>)}
            </ul>
          </div>
        )}

        {confidence && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-[#BFDBFE] bg-[#EFF5FF] px-4 py-3 text-xs">
            <span aria-hidden className="mt-px shrink-0 text-[#2563EB]">ⓘ</span>
            <p className="font-semibold text-[#0F172A]">
              Confidence: {confidence.level}
              {confidence.level === "MEDIUM" && (
                <span className="font-normal text-[#64748B]"> — one or more answers were unsure</span>
              )}
            </p>
          </div>
        )}

        {emailBlock}

        {/* BRIDGE COPY */}
        {bridgeCopy && (
          <div className="mb-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
            <p className="text-sm leading-relaxed text-[#334155]">{bridgeCopy}</p>
          </div>
        )}

        {/* PLAN CHECKLIST */}
        {planChecklist && planChecklist.length > 0 && (
          <div className="mb-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
            <p className={`mb-2 ${MICRO_CAPS}`}>What&apos;s in your personalised plan</p>
            <ul className="space-y-1 text-[13px] text-[#334155]">
              {planChecklist.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 shrink-0 text-emerald-600">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PRIMARY CTA (pinned tier) — omitted when monetize-off (informational) */}
        {onCta && ctaLabel && (
          <>
            <button onClick={onCta} className={PRIMARY_CTA}>{ctaLabel}</button>
            {ctaNote && <p className={`mt-2 text-center ${MICRO_CAPS}`}>{ctaNote}</p>}
          </>
        )}

        {/* SECONDARY ALT-TIER LINK */}
        {onCta && secondaryLabel && onSecondary && (
          <p className="mt-2 text-center">
            <button onClick={onSecondary} className="rounded-md text-xs text-[#64748B] underline transition-colors hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 motion-reduce:transition-none">
              {secondaryLabel}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
