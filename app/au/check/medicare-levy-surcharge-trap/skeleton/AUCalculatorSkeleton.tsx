"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * AU CALCULATOR SKELETON — TaxCheckNow
 * Version: 1.0 — April 2026
 *
 * MODULES:
 *   A. ProgressiveReveal   — step-by-step reveal, back/forward, step counter
 *   B. VerdictBlock        — status badge, headline, 3-stat grid, consequence, CTA
 *   C. GateTest            — sequential pass/fail (AU-02, AU-06)
 *   D. TimelineCapture     — event sequence capture (AU-01, AU-04)
 *   E. MultiSelect         — multiple simultaneous selections (AU-03, AU-09)
 *   F. BandedInputs        — button-band numerics, no sliders (AU-05)
 *   G. ThresholdTest       — over/under threshold verdict (AU-07, AU-08, AU-10)
 *   H. ConfidenceScore     — HIGH/MEDIUM/LOW from record quality answers
 *
 * HOW TO USE THIS SKELETON:
 *   1. Copy this file, rename to [ProductName]Calculator.tsx
 *   2. Fill in PRODUCT_CONFIG at the top
 *   3. Fill in QUESTIONS array — use the question types below
 *   4. Fill in calcVerdict() — the logic that produces a VerdictResult
 *   5. Delete unused modules
 *   6. Export as default
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Single answer option for button-group or two-button questions */
export interface AnswerOption {
  label: string;
  value: string | number | boolean;
  subLabel?: string;           // optional secondary text under the label
  conditional?: string;        // only show this option if stateKey X equals value Y
}

/** A single calculator question */
export interface CalcQuestion {
  id: string;                  // unique key — used as state key
  step: number;                // which step this belongs to (1-based)
  type:
    | "button_group"           // Module A/G — single select from 2-5 options
    | "two_button"             // Module A/G — yes/no binary
    | "multi_select"           // Module E   — multiple simultaneous selections
    | "band_input"             // Module F   — banded numeric (button group of ranges)
    | "date_band"              // Module D   — approximate date band (year ranges)
    | "gate_test"              // Module C   — pass/fail single test
    | "intent"                 // routing question — "why are you here"
    | "confidence";            // Module H   — record quality signal
  label: string;
  subLabel?: string;
  options: AnswerOption[];
  showIf?: (answers: AnswerMap) => boolean; // conditional display
  required?: boolean;
}

/** All current answers keyed by question id */
export type AnswerMap = Record<string, string | number | boolean | string[]>;

/** Confidence level derived from record quality answers */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

/** The verdict result — product of calcVerdict() */
export interface VerdictResult {
  // Status
  status: string;              // e.g. "SURCHARGE APPLIES — 1.5% RATE"
  statusClass: string;         // Tailwind text color class
  panelClass: string;          // Tailwind border+bg class for the panel
  headline: string;            // One sentence plain English

  // 3-stat grid (always 3 items)
  stats: Array<{
    label: string;
    value: string;
    highlight?: boolean;       // red highlight for danger stat
  }>;

  // Consequence bullets — what this means in practice
  consequences: string[];

  // Confidence
  confidence: ConfidenceLevel;
  confidenceNote: string;      // e.g. "Based on your answers — medium confidence. Records may change this."

  // CTA
  tier: 67 | 147;              // which tier to recommend (67 default, 147 for complex)
  ctaLabel67: string;          // e.g. "Get My MLS Avoidance Plan — $67 →"
  ctaLabel147: string;         // e.g. "Get My Income & Insurance Optimisation System — $147 →"
  productKey67: string;        // Stripe product key
  productKey147: string;       // Stripe product key

  // Optional gate test result (Module C)
  gateResults?: Array<{
    test: string;
    pass: boolean;
    note: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE A — PROGRESSIVE REVEAL
// ─────────────────────────────────────────────────────────────────────────────

interface ProgressiveFormProps {
  questions: CalcQuestion[];
  answers: AnswerMap;
  onAnswer: (id: string, value: string | number | boolean | string[]) => void;
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
}

function ProgressiveForm({
  questions,
  answers,
  onAnswer,
  currentStep,
  totalSteps,
  onBack,
}: ProgressiveFormProps) {
  const stepQuestions = questions.filter(
    (q) => q.step === currentStep && (!q.showIf || q.showIf(answers))
  );

  if (stepQuestions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
      {/* Step counter */}
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">
          Step {currentStep} of {totalSteps}
        </p>
        {currentStep > 1 && (
          <button
            onClick={onBack}
            className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition"
          >
            ← Back
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full bg-neutral-950 transition-all duration-300"
          style={{ width: `${((currentStep - 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Questions for this step */}
      <div className="space-y-6">
        {stepQuestions.map((q) => (
          <QuestionBlock
            key={q.id}
            question={q}
            value={answers[q.id]}
            onAnswer={onAnswer}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BLOCK — renders the right input type per question
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionBlockProps {
  question: CalcQuestion;
  value: AnswerMap[string];
  onAnswer: (id: string, value: string | number | boolean | string[]) => void;
}

function QuestionBlock({ question, value, onAnswer }: QuestionBlockProps) {
  const { id, type, label, subLabel, options } = question;

  return (
    <div>
      <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{label}</h2>
      {subLabel && <p className="mb-4 text-sm text-neutral-500">{subLabel}</p>}

      {/* ── Module G/A: button_group ── */}
      {(type === "button_group" || type === "band_input" || type === "date_band" || type === "intent") && (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => onAnswer(id, opt.value)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                value === opt.value
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
              }`}
            >
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.subLabel && (
                <span className={`mt-0.5 block text-xs ${value === opt.value ? "text-neutral-300" : "text-neutral-500"}`}>
                  {opt.subLabel}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Module A/G: two_button ── */}
      {type === "two_button" && (
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => onAnswer(id, opt.value)}
              className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${
                value === opt.value
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Module E: multi_select ── */}
      {type === "multi_select" && (
        <div className="space-y-2">
          <p className="mb-2 text-xs text-neutral-500">Select all that apply</p>
          {options.map((opt) => {
            const selected = Array.isArray(value) && value.includes(String(opt.value));
            return (
              <button
                key={String(opt.value)}
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  const next = selected
                    ? current.filter((v) => v !== String(opt.value))
                    : [...current, String(opt.value)];
                  onAnswer(id, next);
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selected
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                }`}
              >
                <span className="mr-2">{selected ? "✓" : "○"}</span>
                {opt.label}
                {opt.subLabel && (
                  <span className={`ml-2 text-xs ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
                    — {opt.subLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Module H: confidence ── */}
      {type === "confidence" && (
        <div className="grid gap-2 sm:grid-cols-3">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => onAnswer(id, opt.value)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                value === opt.value
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
              }`}
            >
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.subLabel && (
                <span className={`mt-0.5 block text-xs ${value === opt.value ? "text-neutral-300" : "text-neutral-500"}`}>
                  {opt.subLabel}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Module C: gate_test — rendered inline with pass/fail ── */}
      {type === "gate_test" && (
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => onAnswer(id, opt.value)}
              className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${
                value === opt.value
                  ? opt.value === true || opt.value === "pass"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-red-600 bg-red-600 text-white"
                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE B — VERDICT BLOCK
// ─────────────────────────────────────────────────────────────────────────────

interface VerdictBlockProps {
  verdict: VerdictResult;
  onCheckout: (tier: 67 | 147) => void;
  checkoutLoading: 67 | 147 | null;
}

function VerdictBlock({ verdict, onCheckout, checkoutLoading }: VerdictBlockProps) {
  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>

      {/* Status badge */}
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>
        {verdict.status}
      </p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">
        {verdict.headline}
      </h3>

      {/* 3-stat grid */}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border px-4 py-3 ${
              stat.highlight
                ? "border-red-200 bg-red-50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
              {stat.label}
            </p>
            <p className={`font-serif text-lg font-bold ${stat.highlight ? "text-red-700" : "text-neutral-950"}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Module C: Gate test results (if present) */}
      {verdict.gateResults && verdict.gateResults.length > 0 && (
        <div className="mb-4 space-y-2">
          {verdict.gateResults.map((gate, i) => (
            <div
              key={i}
              className={`rounded-xl border px-4 py-3 text-sm ${
                gate.pass
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <span className="mr-2">{gate.pass ? "✓" : "✗"}</span>
              <strong className="text-neutral-950">{gate.test}:</strong>{" "}
              <span className="text-neutral-700">{gate.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* Consequence block */}
      {verdict.consequences.length > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
          <strong className="text-neutral-950">What this means:</strong>
          <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
            {verdict.consequences.map((c, i) => (
              <li key={i}>→ {c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Module H: Confidence score */}
      <div className={`mb-4 rounded-xl border px-4 py-3 text-xs ${
        verdict.confidence === "HIGH"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : verdict.confidence === "MEDIUM"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}>
        <strong>Confidence: {verdict.confidence}</strong> — {verdict.confidenceNote}
      </div>

      {/* CTAs — ONLY after verdict */}
      <div className="space-y-3 pt-2">
        <button
          onClick={() => onCheckout(67)}
          disabled={checkoutLoading !== null}
          className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60"
        >
          {checkoutLoading === 67 ? "Loading…" : verdict.ctaLabel67}
        </button>
        <button
          onClick={() => onCheckout(147)}
          disabled={checkoutLoading !== null}
          className="w-full rounded-xl border border-neutral-950 bg-white py-3.5 text-sm font-bold text-neutral-950 transition hover:bg-neutral-50 disabled:opacity-60"
        >
          {checkoutLoading === 147 ? "Loading…" : verdict.ctaLabel147}
        </button>
        <p className="text-center text-xs text-neutral-500">
          Instant download · ATO-referenced · April 2026
        </p>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE H — CONFIDENCE SCORE HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive confidence from record quality answers.
 * Pass in the answers map and the id of the confidence question.
 * Returns HIGH / MEDIUM / LOW and a plain English note.
 */
export function deriveConfidence(
  answers: AnswerMap,
  confidenceQuestionId: string
): { level: ConfidenceLevel; note: string } {
  const val = answers[confidenceQuestionId];
  if (val === "high" || val === "yes_all")
    return {
      level: "HIGH",
      note: "Your records appear complete — this result is reliable for your accountant.",
    };
  if (val === "medium" || val === "some")
    return {
      level: "MEDIUM",
      note: "Some records may be missing — your accountant may need to verify before relying on this.",
    };
  return {
    level: "LOW",
    note: "Records appear incomplete — this is a directional estimate. Get documents in order before your accountant meeting.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE C — GATE TEST HELPER
// ─────────────────────────────────────────────────────────────────────────────

export interface GateTest {
  id: string;           // question id to check
  passValue: string | boolean | number;  // value that = pass
  testLabel: string;    // "Written loan agreement"
  passNote: string;     // shown when pass
  failNote: string;     // shown when fail — becomes the verdict driver
}

/**
 * Run sequential gate tests against answers.
 * Returns array of results and the first failure if any.
 */
export function runGateTests(
  answers: AnswerMap,
  gates: GateTest[]
): { results: VerdictResult["gateResults"]; firstFail: GateTest | null } {
  const results: VerdictResult["gateResults"] = [];
  let firstFail: GateTest | null = null;

  for (const gate of gates) {
    const val = answers[gate.id];
    const pass = val === gate.passValue;
    results.push({
      test: gate.testLabel,
      pass,
      note: pass ? gate.passNote : gate.failNote,
    });
    if (!pass && !firstFail) firstFail = gate;
  }

  return { results, firstFail };
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKOUT HELPER
// ─────────────────────────────────────────────────────────────────────────────

export async function startCheckout(
  productKey: string,
  tier: number,
  sessionSuffix: string
): Promise<void> {
  const res = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision_session_id: `${sessionSuffix}_${Date.now()}`,
      tier,
      product_key: productKey,
    }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else alert(data.error || "Checkout failed — please try again.");
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SKELETON COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HOW TO USE:
 *
 * 1. Copy this entire file
 * 2. Rename the component at the bottom
 * 3. Fill in:
 *    - QUESTIONS array
 *    - TOTAL_STEPS constant
 *    - SESSION_SUFFIX string (e.g. "mls", "cgt_mr")
 *    - calcVerdict() function
 * 4. Delete unused modules/helpers
 *
 * The component handles:
 *    - Step progression (auto-advances when all required questions on a step are answered)
 *    - Verdict display (auto-shows when all steps complete)
 *    - Scroll to verdict
 *    - Checkout loading states
 */

// ── FILL THESE IN FOR EACH PRODUCT ──────────────────────────────────────────

const QUESTIONS: CalcQuestion[] = [
  // EXAMPLE — replace with product-specific questions
  {
    id: "example_threshold",
    step: 1,
    type: "button_group",
    label: "Example question",
    subLabel: "Example sub-label",
    options: [
      { label: "Option A", value: "a" },
      { label: "Option B", value: "b" },
    ],
    required: true,
  },
];

const TOTAL_STEPS = 1; // update per product
const SESSION_SUFFIX = "au_skeleton"; // update per product

function calcVerdict(_answers: AnswerMap): VerdictResult {
  // REPLACE THIS with product-specific logic
  // Use the five verdict types:
  //   A) Binary threshold  → statusClass red/amber/green
  //   B) Timeline/sequence → fraction + exposure estimate
  //   C) Classification    → per-category risk aggregate
  //   D) Gate test         → runGateTests() + first fail drives verdict
  //   E) Cashflow model    → illusion gap + after-tax position

  return {
    status: "EXAMPLE STATUS",
    statusClass: "text-neutral-700",
    panelClass: "border-neutral-200 bg-neutral-50",
    headline: "Example headline — replace with product logic.",
    stats: [
      { label: "Stat 1", value: "—" },
      { label: "Stat 2", value: "—" },
      { label: "Stat 3", value: "—" },
    ],
    consequences: ["Example consequence"],
    confidence: "MEDIUM",
    confidenceNote: "Replace with confidence logic.",
    tier: 67,
    ctaLabel67: "Get My Plan — $67 →",
    ctaLabel147: "Get My System — $147 →",
    productKey67: "au_67_skeleton",
    productKey147: "au_147_skeleton",
  };
}

// ── COMPONENT ────────────────────────────────────────────────────────────────

export default function AUCalculatorSkeleton() {
  const [answers, setAnswers]               = useState<AnswerMap>({});
  const [currentStep, setCurrentStep]       = useState(1);
  const [showVerdict, setShowVerdict]       = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<67 | 147 | null>(null);

  const verdictRef = useRef<HTMLDivElement>(null);

  // Derive verdict once all steps complete
  const verdict = useMemo(() => {
    if (!showVerdict) return null;
    return calcVerdict(answers);
  }, [showVerdict, answers]);

  // Check if all required questions on current step are answered
  const currentStepComplete = useMemo(() => {
    const stepQuestions = QUESTIONS.filter(
      (q) =>
        q.step === currentStep &&
        q.required !== false &&
        (!q.showIf || q.showIf(answers))
    );
    return stepQuestions.every((q) => {
      const val = answers[q.id];
      if (q.type === "multi_select") return Array.isArray(val) && val.length > 0;
      return val !== undefined && val !== null && val !== "";
    });
  }, [answers, currentStep]);

  // Auto-advance to next step when current step complete
  useEffect(() => {
    if (currentStepComplete && currentStep < TOTAL_STEPS) {
      const timer = setTimeout(() => setCurrentStep((s) => s + 1), 300);
      return () => clearTimeout(timer);
    }
    if (currentStepComplete && currentStep === TOTAL_STEPS) {
      const timer = setTimeout(() => setShowVerdict(true), 300);
      return () => clearTimeout(timer);
    }
  }, [currentStepComplete, currentStep]);

  // Scroll to verdict
  useEffect(() => {
    if (showVerdict && verdictRef.current) {
      setTimeout(
        () => verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100
      );
    }
  }, [showVerdict]);

  function handleAnswer(id: string, value: string | number | boolean | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function handleBack() {
    if (showVerdict) {
      setShowVerdict(false);
      return;
    }
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  }

  async function handleCheckout(tier: 67 | 147) {
    if (!verdict) return;
    setCheckoutLoading(tier);
    const key = tier === 67 ? verdict.productKey67 : verdict.productKey147;
    await startCheckout(key, tier, SESSION_SUFFIX);
    setCheckoutLoading(null);
  }

  return (
    <div className="space-y-6">

      {/* Progressive form — hide when verdict shown */}
      {!showVerdict && (
        <ProgressiveForm
          questions={QUESTIONS}
          answers={answers}
          onAnswer={handleAnswer}
          currentStep={currentStep}
          totalSteps={TOTAL_STEPS}
          onBack={handleBack}
        />
      )}

      {/* Verdict block — shown after all steps complete */}
      {showVerdict && verdict && (
        <div ref={verdictRef}>
          {/* Back to questions */}
          <button
            onClick={handleBack}
            className="mb-3 font-mono text-xs text-neutral-400 hover:text-neutral-700 transition"
          >
            ← Change my answers
          </button>
          <VerdictBlock
            verdict={verdict}
            onCheckout={handleCheckout}
            checkoutLoading={checkoutLoading}
          />
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED HELPERS — available to all product calculators
// ─────────────────────────────────────────────────────────────────────────────
export { ProgressiveForm, VerdictBlock, QuestionBlock };
