"use client";

/**
 * AU-10 — Medicare Levy Surcharge Trap Calculator
 * Pattern: Module G (ThresholdTest) + Module A (ProgressiveReveal) + Module B (VerdictBlock)
 * Brief: income for MLS purposes / family status / cover type / timing / policy suitability / why here
 */

import { useState, useRef, useEffect, useMemo } from "react";
import type { AnswerMap, VerdictResult, ConfidenceLevel } from "./skeleton/AUCalculatorSkeleton";
import { startCheckout } from "./skeleton/AUCalculatorSkeleton";

// ─────────────────────────────────────────────────────────────────────────────
// MLS LOGIC
// ─────────────────────────────────────────────────────────────────────────────

const INCOME_MIDPOINTS: Record<string, number> = {
  under_93k:    80000,
  band_93_108:  100000,
  band_108_144: 125000,
  over_144k:    170000,
};

function calcMLSRate(incomeBand: string, isFamily: boolean): number {
  const income = INCOME_MIDPOINTS[incomeBand] ?? 0;
  if (isFamily && income < 186000) return 0;
  if (income < 93001) return 0;
  if (income <= 108000) return 0.01;
  if (income <= 144000) return 0.0125;
  return 0.015;
}

function formatAUD(n: number): string {
  return `$${Math.round(n).toLocaleString("en-AU")}`;
}

function prorateMLS(annual: number, timing: string): number {
  if (timing === "full_year") return annual;
  if (timing === "part_year_h2") return annual * (6 / 12);
  if (timing === "part_year_q4") return annual * (3 / 12);
  return annual;
}

function calcVerdict(answers: AnswerMap): VerdictResult {
  const incomeBand   = String(answers.income_band ?? "");
  const familyStatus = String(answers.family_status ?? "single");
  const coverType    = String(answers.cover_type ?? "none");
  const coverTiming  = String(answers.cover_timing ?? "full_year");
  const policyExcess = String(answers.policy_excess ?? "unknown");

  const isFamily         = familyStatus !== "single";
  const income           = INCOME_MIDPOINTS[incomeBand] ?? 0;
  const hasHospitalCover = coverType === "hospital" || coverType === "combined";
  const extrasOnly       = coverType === "extras_only";
  const highExcess       = policyExcess === "high_excess";
  const effectiveCover   = hasHospitalCover && !highExcess;
  const mlsRate          = effectiveCover ? 0 : calcMLSRate(incomeBand, isFamily);
  const annualMLSBase    = income * mlsRate;
  const annualMLS        = effectiveCover
    ? 0
    : prorateMLS(annualMLSBase, coverTiming);

  const coverCostLow  = isFamily ? 3000 : 1200;
  const coverCostHigh = isFamily ? 5000 : 1800;
  const netSavingLow  = Math.round(annualMLS - coverCostHigh);
  const netSavingHigh = Math.round(annualMLS - coverCostLow);

  let confidence: ConfidenceLevel = "HIGH";
  let confidenceNote = "Income band and cover status confirmed — result is reliable.";
  if (policyExcess === "unknown") {
    confidence = "MEDIUM";
    confidenceNote = "Policy excess not confirmed — check your policy document. High excess voids the MLS exemption.";
  }

  // ── Under threshold ──────────────────────────────────────────────────────
  if (income < 93001 || (isFamily && income < 186000)) {
    return {
      status: "NO SURCHARGE — UNDER THRESHOLD",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: income < 93001
        ? "Your income is below the $93,001 singles threshold — the MLS does not apply."
        : "Based on family assessment, your income appears below the $186,000 family threshold.",
      stats: [
        { label: "Singles threshold", value: "$93,001" },
        { label: "Your income band", value: income < 93001 ? "Under $93k" : `~${formatAUD(income)}` },
        { label: "MLS exposure", value: "$0" },
      ],
      consequences: [
        "No Medicare Levy Surcharge applies at your income level",
        "The standard 2% Medicare Levy still applies — MLS is additional to this",
        "If your income rises above $93,001 and you have no hospital cover, the MLS will apply",
      ],
      confidence, confidenceNote, tier: 67,
      ctaLabel67: "Get My MLS Position Confirmed — $67 →",
      ctaLabel147: "Get My Health Cover & Tax Optimisation System — $147 →",
      productKey67: "au_67_medicare_levy_surcharge_trap",
      productKey147: "au_147_medicare_levy_surcharge_trap",
    };
  }

  // ── Full year cover — no surcharge ───────────────────────────────────────
  if (effectiveCover && coverTiming === "full_year") {
    return {
      status: "NO SURCHARGE — COVER CONFIRMED",
      statusClass: "text-emerald-700",
      panelClass: "border-emerald-200 bg-emerald-50",
      headline: "You have appropriate hospital cover for the full year — the MLS does not apply.",
      stats: [
        { label: "Your income band", value: `~${formatAUD(income)}` },
        { label: "Cover status", value: "Hospital cover ✓" },
        { label: "MLS exposure", value: "$0" },
      ],
      consequences: [
        "Confirm your policy is registered hospital cover — not extras only",
        "Confirm your policy excess is under $750 (singles) or $1,500 (families)",
        "If you cancel cover during the year, MLS applies for the uncovered days",
      ],
      confidence, confidenceNote, tier: 67,
      ctaLabel67: "Get My Cover Suitability Check — $67 →",
      ctaLabel147: "Get My Health Cover & Tax Optimisation System — $147 →",
      productKey67: "au_67_medicare_levy_surcharge_trap",
      productKey147: "au_147_medicare_levy_surcharge_trap",
    };
  }

  // ── Extras only — false security ─────────────────────────────────────────
  if (extrasOnly) {
    const mls = Math.round(income * mlsRate);
    return {
      status: "SURCHARGE APPLIES — EXTRAS COVER DOES NOT COUNT",
      statusClass: "text-red-700",
      panelClass: "border-red-200 bg-red-50",
      headline: `Extras-only cover (dental, optical, physio) does NOT avoid the MLS. You likely owe ${formatAUD(mls)} per year.`,
      stats: [
        { label: "Your MLS exposure", value: formatAUD(mls), highlight: true },
        { label: "Extras cover counts?", value: "NO — hospital only ✗", highlight: true },
        { label: "Basic hospital cover est.", value: `${formatAUD(coverCostLow)}–${formatAUD(coverCostHigh)}/yr` },
      ],
      consequences: [
        "The ATO requires HOSPITAL cover — general treatment (extras) does not satisfy the MLS requirement",
        "This is one of the most common MLS mistakes in Australia",
        `Adding hospital cover would likely eliminate ${formatAUD(mls)}/yr in MLS`,
        netSavingLow > 0
          ? `At your income, hospital cover saves approximately ${formatAUD(netSavingLow)}–${formatAUD(netSavingHigh)} per year net`
          : "At your income, cover cost and MLS are similar — worth comparing insurer quotes",
      ],
      confidence, confidenceNote, tier: 147,
      ctaLabel67: "Get My MLS Avoidance Plan — $67 →",
      ctaLabel147: "Get My Income & Insurance Optimisation System — $147 →",
      productKey67: "au_67_medicare_levy_surcharge_trap",
      productKey147: "au_147_medicare_levy_surcharge_trap",
    };
  }

  // ── High excess — policy may not qualify ─────────────────────────────────
  if (highExcess) {
    const mls = Math.round(income * mlsRate);
    return {
      status: "SURCHARGE MAY APPLY — POLICY EXCESS TOO HIGH",
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `A hospital policy with excess over $750 (singles) or $1,500 (families) does NOT avoid the MLS. Estimated exposure: ${formatAUD(mls)}/yr.`,
      stats: [
        { label: "Your MLS exposure", value: formatAUD(mls), highlight: true },
        { label: "Excess limit (singles)", value: "$750" },
        { label: "Excess limit (families)", value: "$1,500" },
      ],
      consequences: [
        "The ATO sets maximum excess limits — policies above these do not satisfy the MLS requirement",
        "Check your current policy: what is the hospital excess per admission?",
        "Switching to a compliant policy eliminates the MLS",
        "Your insurer can confirm whether your policy meets ATO requirements",
      ],
      confidence: "LOW",
      confidenceNote: "Policy excess confirmed as high — check your policy document before lodging your return.",
      tier: 67,
      ctaLabel67: "Get My Policy Suitability Check — $67 →",
      ctaLabel147: "Get My Health Cover & Tax Optimisation System — $147 →",
      productKey67: "au_67_medicare_levy_surcharge_trap",
      productKey147: "au_147_medicare_levy_surcharge_trap",
    };
  }

  // ── Part-year cover ───────────────────────────────────────────────────────
  if (coverTiming !== "full_year" && hasHospitalCover) {
    const mls = Math.round(annualMLS);
    const months = coverTiming === "part_year_h2" ? 6 : 3;
    return {
      status: `PARTIAL SURCHARGE — ${months} MONTHS WITHOUT COVER`,
      statusClass: "text-amber-700",
      panelClass: "border-amber-200 bg-amber-50",
      headline: `The MLS applies for the ${months} months without appropriate cover. Estimated exposure: ${formatAUD(mls)}.`,
      stats: [
        { label: "Estimated MLS (pro-rated)", value: formatAUD(mls), highlight: true },
        { label: "Months without cover", value: `~${months} months` },
        { label: "MLS rate", value: `${mlsRate * 100}%` },
      ],
      consequences: [
        "MLS is calculated on a daily basis — you pay for the exact days without appropriate cover",
        "The pro-rated amount is assessed in your annual tax return",
        "Getting cover from 1 July next year eliminates the exposure entirely",
        "Confirm the exact start date of cover with your insurer",
      ],
      confidence, confidenceNote, tier: 67,
      ctaLabel67: "Get My MLS Timing & Avoidance Plan — $67 →",
      ctaLabel147: "Get My Income & Insurance Optimisation System — $147 →",
      productKey67: "au_67_medicare_levy_surcharge_trap",
      productKey147: "au_147_medicare_levy_surcharge_trap",
    };
  }

  // ── Full surcharge — no cover ─────────────────────────────────────────────
  const mls = Math.round(annualMLS);
  const rateLabel = mlsRate === 0.015 ? "1.5%" : mlsRate === 0.0125 ? "1.25%" : "1%";
  return {
    status: `SURCHARGE APPLIES — ${rateLabel} RATE`,
    statusClass: income > 144000 ? "text-red-700" : "text-amber-700",
    panelClass: income > 144000 ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50",
    headline: `Without appropriate hospital cover, you owe ${formatAUD(mls)} in Medicare Levy Surcharge this year — on top of the standard 2% Medicare Levy.`,
    stats: [
      { label: "Your MLS exposure", value: formatAUD(mls), highlight: true },
      { label: "Hospital cover est.", value: `${formatAUD(coverCostLow)}–${formatAUD(coverCostHigh)}/yr` },
      {
        label: "Net saving from cover",
        value: netSavingLow > 0 ? `${formatAUD(netSavingLow)}–${formatAUD(netSavingHigh)}/yr` : "Breakeven — compare quotes",
        highlight: netSavingLow > 0,
      },
    ],
    consequences: [
      `The ${rateLabel} MLS applies to your entire MLS income — not just the amount above $93,000`,
      "You have been paying this surcharge every year you earned over the threshold without hospital cover",
      income > 108000
        ? "At your income, hospital cover almost certainly costs less than the MLS — get quotes now"
        : "At your income, cover cost and MLS are similar — compare a basic hospital-only policy",
      "Acting before 30 June limits this year's exposure — the MLS is assessed in your annual return",
    ],
    confidence, confidenceNote,
    tier: income > 108000 ? 147 : 67,
    ctaLabel67: "Get My MLS Avoidance Plan — $67 →",
    ctaLabel147: "Get My Income & Insurance Optimisation System — $147 →",
    productKey67: "au_67_medicare_levy_surcharge_trap",
    productKey147: "au_147_medicare_levy_surcharge_trap",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

type Q = {
  id: string;
  step: number;
  type: "button_group" | "two_button" | "band_input" | "intent";
  label: string;
  subLabel?: string;
  options: { label: string; value: string | number | boolean; subLabel?: string }[];
  showIf?: (a: AnswerMap) => boolean;
  required?: boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "intent", step: 1, type: "intent",
    label: "What brings you here today?",
    subLabel: "This helps us show you the most relevant result",
    options: [
      { label: "Avoiding MLS this year", value: "avoid", subLabel: "Want to know if cover is worth it" },
      { label: "Deciding if cover is worth it", value: "decide", subLabel: "Weighing cost vs surcharge" },
      { label: "Checking last year's position", value: "last_year", subLabel: "Think I may have owed MLS" },
      { label: "Just checking my position", value: "unsure", subLabel: "Want to understand where I stand" },
    ],
  },
  {
    id: "family_status", step: 2, type: "button_group",
    label: "What is your family status for tax purposes?",
    subLabel: "Couples and families have a higher combined threshold of $186,000",
    options: [
      { label: "Single", value: "single", subLabel: "$93,001 individual threshold" },
      { label: "Couple — no dependants", value: "couple", subLabel: "$186,000 combined threshold" },
      { label: "Family with dependants", value: "family", subLabel: "$186,000 + $1,500 per child after first" },
    ],
  },
  {
    id: "income_band", step: 3, type: "band_input",
    label: "What is your income for MLS purposes?",
    subLabel: "Taxable income + reportable fringe benefits + reportable employer super contributions",
    options: [
      { label: "Under $93,000", value: "under_93k", subLabel: "Below the MLS threshold" },
      { label: "$93,001 – $108,000", value: "band_93_108", subLabel: "1% surcharge rate" },
      { label: "$108,001 – $144,000", value: "band_108_144", subLabel: "1.25% surcharge rate" },
      { label: "Over $144,000", value: "over_144k", subLabel: "1.5% surcharge rate" },
    ],
  },
  {
    id: "cover_type", step: 4, type: "button_group",
    label: "What private health insurance do you hold?",
    subLabel: "Only hospital cover avoids the MLS — extras only does not count",
    options: [
      { label: "Hospital cover", value: "hospital", subLabel: "Registered hospital policy" },
      { label: "Hospital + extras (combined)", value: "combined", subLabel: "Both hospital and general treatment" },
      { label: "Extras only", value: "extras_only", subLabel: "Dental, optical, physio — NO hospital ✗" },
      { label: "No private health insurance", value: "none", subLabel: "Not currently covered" },
    ],
  },
  {
    id: "cover_timing", step: 5, type: "button_group",
    label: "Did you have hospital cover for the full financial year?",
    subLabel: "The MLS is pro-rated — you pay for every day without appropriate cover",
    options: [
      { label: "Full year — 1 July to 30 June", value: "full_year", subLabel: "Cover held the entire year" },
      { label: "Got cover partway through", value: "part_year_h2", subLabel: "Some months uncovered earlier in year" },
      { label: "Only got cover near EOFY", value: "part_year_q4", subLabel: "Covered for last 3 months or less" },
    ],
    showIf: (a) => a.cover_type === "hospital" || a.cover_type === "combined",
  },
  {
    id: "policy_excess", step: 5, type: "button_group",
    label: "What is the excess on your hospital policy?",
    subLabel: "Policies with excess over $750 (singles) or $1,500 (families) do not avoid the MLS",
    options: [
      { label: "Under the ATO limit", value: "compliant", subLabel: "Under $750 singles / $1,500 families" },
      { label: "Over the ATO limit", value: "high_excess", subLabel: "Over $750 singles / $1,500 families ✗" },
      { label: "Not sure — haven't checked", value: "unknown", subLabel: "Need to check policy document" },
    ],
    showIf: (a) => a.cover_type === "hospital" || a.cover_type === "combined",
  },
  {
    id: "partner_cover", step: 6, type: "two_button",
    label: "Does your partner also have appropriate hospital cover?",
    subLabel: "Both partners need hospital cover — a covered partner does not protect an uncovered one",
    options: [
      { label: "Yes — partner has hospital cover", value: true },
      { label: "No — partner not covered", value: false },
    ],
    showIf: (a) => a.family_status === "couple" || a.family_status === "family",
  },
];

const TOTAL_STEPS = 6;
const SESSION_SUFFIX = "au_mls";

// ─────────────────────────────────────────────────────────────────────────────
// VERDICT BLOCK
// ─────────────────────────────────────────────────────────────────────────────

function VerdictBlock({
  verdict,
  onCheckout,
  loading,
}: {
  verdict: VerdictResult;
  onCheckout: (t: 67 | 147) => void;
  loading: 67 | 147 | null;
}) {
  return (
    <div className={`scroll-mt-4 rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
      <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>
        {verdict.status}
      </p>
      <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {verdict.stats.map((s) => (
          <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
            <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {verdict.consequences.length > 0 && (
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
          <strong className="text-neutral-950">What this means:</strong>
          <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
            {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
          </ul>
        </div>
      )}

      <div className={`mb-4 rounded-xl border px-4 py-2 text-xs ${
        verdict.confidence === "HIGH" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : verdict.confidence === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-800"
      }`}>
        <strong>Confidence: {verdict.confidence}</strong> — {verdict.confidenceNote}
      </div>

      <div className="space-y-3 pt-2">
        <button onClick={() => onCheckout(67)} disabled={loading !== null}
          className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-60">
          {loading === 67 ? "Loading…" : verdict.ctaLabel67}
        </button>
        <button onClick={() => onCheckout(147)} disabled={loading !== null}
          className="w-full rounded-xl border border-neutral-950 bg-white py-3.5 text-sm font-bold text-neutral-950 transition hover:bg-neutral-50 disabled:opacity-60">
          {loading === 147 ? "Loading…" : verdict.ctaLabel147}
        </button>
        <p className="text-center text-xs text-neutral-500">Instant download · ATO-referenced · April 2026</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BLOCK
// ─────────────────────────────────────────────────────────────────────────────

function QuestionBlock({ q, value, onAnswer }: { q: Q; value: AnswerMap[string]; onAnswer: (id: string, v: string | number | boolean) => void }) {
  const sel = (v: string | number | boolean) => value === v;
  const btnClass = (v: string | number | boolean) => `rounded-xl border px-4 py-3 text-left transition ${
    sel(v) ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
  }`;

  return (
    <div>
      <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-sm text-neutral-500">{q.subLabel}</p>}
      {q.type !== "two_button" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((opt) => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value)} className={btnClass(opt.value)}>
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.subLabel && <span className={`mt-0.5 block text-xs ${sel(opt.value) ? "text-neutral-300" : "text-neutral-500"}`}>{opt.subLabel}</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map((opt) => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value)}
              className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${sel(opt.value) ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function MedicareLevySurchargeTrapCalculator() {
  const [answers, setAnswers]     = useState<AnswerMap>({});
  const [step, setStep]           = useState(1);
  const [showVerdict, setVerdict] = useState(false);
  const [loading, setLoading]     = useState<67 | 147 | null>(null);
  const verdictRef                = useRef<HTMLDivElement>(null);

  const verdict = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);

  const visibleQs = QUESTIONS.filter((q) => q.step === step && (!q.showIf || q.showIf(answers)));
  const requiredQs = visibleQs.filter((q) => q.required !== false);
  const stepDone = !visibleQs.length || requiredQs.every((q) => answers[q.id] !== undefined && answers[q.id] !== "");

  useEffect(() => {
    if (!stepDone) return;
    const next = step + 1;
    const t = setTimeout(() => {
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, visibleQs.length ? 300 : 0);
    return () => clearTimeout(t);
  }, [stepDone, step, visibleQs.length]);

  useEffect(() => {
    if (showVerdict && verdictRef.current)
      setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [showVerdict]);

  function answer(id: string, v: string | number | boolean) {
    setAnswers((p) => ({ ...p, [id]: v }));
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) setStep((s) => s - 1);
  }

  async function checkout(tier: 67 | 147) {
    if (!verdict) return;
    setLoading(tier);
    const key = tier === 67 ? verdict.productKey67 : verdict.productKey147;
    await startCheckout(key, tier, SESSION_SUFFIX);
    setLoading(null);
  }

  const maxStep = QUESTIONS.reduce((acc, q) => (!q.showIf || q.showIf(answers)) ? Math.max(acc, q.step) : acc, 1);

  return (
    <div className="space-y-6">
      {!showVerdict && visibleQs.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Step {step} of {maxStep}</p>
            {step > 1 && <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Back</button>}
          </div>
          <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full bg-neutral-950 transition-all duration-300" style={{ width: `${((step - 1) / maxStep) * 100}%` }} />
          </div>
          <div className="space-y-6">
            {visibleQs.map((q) => <QuestionBlock key={q.id} q={q} value={answers[q.id]} onAnswer={answer} />)}
          </div>
        </div>
      )}

      {showVerdict && verdict && (
        <div ref={verdictRef}>
          <button onClick={back} className="mb-3 font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← Change my answers</button>
          <VerdictBlock verdict={verdict} onCheckout={checkout} loading={loading} />
        </div>
      )}
    </div>
  );
}
