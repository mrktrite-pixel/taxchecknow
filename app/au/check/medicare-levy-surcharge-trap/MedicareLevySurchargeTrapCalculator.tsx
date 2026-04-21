"use client";

/**
 * AU-10 — Medicare Levy Surcharge Trap Calculator
 * Full pattern: progressive reveal → verdict → email capture → single CTA → popup with 3 questions → Stripe
 */

import { useState, useRef, useEffect, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | number | boolean>;
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
type Tier = 67 | 147;

interface VerdictResult {
  status: string;
  statusClass: string;
  panelClass: string;
  headline: string;
  stats: Array<{ label: string; value: string; highlight?: boolean }>;
  consequences: string[];
  confidence: ConfidenceLevel;
  confidenceNote: string;
  tier: Tier;
  ctaLabel: string;           // single CTA — algorithm picks tier
  altTierLabel: string;       // downgrade/upgrade option in popup
  productKey67: string;
  productKey147: string;
  mlsAnnual: number;          // raw number for popup display
}

interface PopupAnswers {
  situation: string;
  urgency: string;
  accountant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MLS CALCULATION LOGIC
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
  const policyExcess = String(answers.policy_excess ?? "compliant");

  const isFamily         = familyStatus !== "single";
  const income           = INCOME_MIDPOINTS[incomeBand] ?? 0;
  const hasHospitalCover = coverType === "hospital" || coverType === "combined";
  const extrasOnly       = coverType === "extras_only";
  const highExcess       = policyExcess === "high_excess";
  const effectiveCover   = hasHospitalCover && !highExcess;
  const mlsRate          = effectiveCover ? 0 : calcMLSRate(incomeBand, isFamily);
  const annualMLSBase    = income * mlsRate;
  const annualMLS        = effectiveCover ? 0 : prorateMLS(annualMLSBase, coverTiming);

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

  const KEYS = {
    p67: "au_67_medicare_levy_surcharge_trap",
    p147: "au_147_medicare_levy_surcharge_trap",
  };

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
        "No Medicare Levy Surcharge applies at your current income",
        "The standard 2% Medicare Levy still applies — MLS is additional to this",
        "If your income rises above $93,001 and you have no hospital cover, re-check your position",
      ],
      confidence, confidenceNote,
      tier: 67,
      ctaLabel: "Get My MLS Position Confirmed — $67 →",
      altTierLabel: "Want full income and cover optimisation? — $147",
      productKey67: KEYS.p67,
      productKey147: KEYS.p147,
      mlsAnnual: 0,
    };
  }

  // ── Full year cover — no surcharge ───────────────────────────────────────
  if (effectiveCover && (coverTiming === "full_year" || !coverTiming)) {
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
        "If you cancel or change cover during the year, MLS applies for the uncovered days",
      ],
      confidence, confidenceNote,
      tier: 67,
      ctaLabel: "Get My Cover Suitability Check — $67 →",
      altTierLabel: "Want full income and cover optimisation? — $147",
      productKey67: KEYS.p67,
      productKey147: KEYS.p147,
      mlsAnnual: 0,
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
        "The ATO requires HOSPITAL cover — extras (dental, optical, physio) does not satisfy the MLS requirement",
        "This is one of the most common MLS mistakes in Australia",
        `Adding hospital cover would likely eliminate ${formatAUD(mls)}/yr in MLS`,
        netSavingLow > 0
          ? `At your income, hospital cover saves approximately ${formatAUD(netSavingLow)}–${formatAUD(netSavingHigh)} per year net`
          : "At your income, cover cost and MLS are similar — worth comparing insurer quotes",
      ],
      confidence, confidenceNote,
      tier: 147,
      ctaLabel: "Get My MLS Avoidance Plan — $147 →",
      altTierLabel: "Just want the essentials? — $67 instead",
      productKey67: KEYS.p67,
      productKey147: KEYS.p147,
      mlsAnnual: mls,
    };
  }

  // ── High excess ───────────────────────────────────────────────────────────
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
        "Check your current policy document — what is the hospital excess per admission?",
        "Switching to a compliant lower-excess policy eliminates the MLS entirely",
      ],
      confidence: "LOW",
      confidenceNote: "Policy excess confirmed as high — check your policy document before lodging your return.",
      tier: 147,
      ctaLabel: "Get My Income & Insurance Optimisation System — $147 →",
      altTierLabel: "Just want the essentials? — $67 instead",
      productKey67: KEYS.p67,
      productKey147: KEYS.p147,
      mlsAnnual: mls,
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
      headline: `The MLS applies for the ~${months} months without appropriate cover. Estimated exposure: ${formatAUD(mls)}.`,
      stats: [
        { label: "Estimated MLS (pro-rated)", value: formatAUD(mls), highlight: true },
        { label: "Months without cover", value: `~${months} months` },
        { label: "MLS rate", value: `${mlsRate * 100}%` },
      ],
      consequences: [
        "MLS is calculated on a daily basis — you pay for the exact days without appropriate cover",
        "The pro-rated amount is assessed in your annual tax return",
        "Getting cover from 1 July next year eliminates the full-year exposure",
      ],
      confidence, confidenceNote,
      tier: 147,
      ctaLabel: "Get My Income & Insurance Optimisation System — $147 →",
      altTierLabel: "Just want the essentials? — $67 instead",
      productKey67: KEYS.p67,
      productKey147: KEYS.p147,
      mlsAnnual: mls,
    };
  }

  // ── Full surcharge — no cover ─────────────────────────────────────────────
  const mls = Math.round(annualMLS);
  const rateLabel = mlsRate === 0.015 ? "1.5%" : mlsRate === 0.0125 ? "1.25%" : "1%";
  const recommendHighTier = income > 108000;

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
      "You pay this surcharge every year you earn over the threshold without hospital cover",
      income > 108000
        ? "At your income, hospital cover almost certainly costs less than the MLS — get quotes now"
        : "At your income, cover cost and MLS are similar — compare a basic hospital-only policy",
      "Acting before 30 June limits this year's exposure — MLS is assessed in your annual return",
    ],
    confidence, confidenceNote,
    tier: 147,
    ctaLabel: "Get My Income & Insurance Optimisation System — $147 →",
    altTierLabel: "Just want the essentials? — $67 instead",
    productKey67: KEYS.p67,
    productKey147: KEYS.p147,
    mlsAnnual: mls,
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
    subLabel: "Policies with excess over $750 (singles) or $1,500 (families) may not avoid the MLS",
    options: [
      { label: "Within ATO limits", value: "compliant", subLabel: "Under $750 singles / $1,500 families ✓" },
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function MedicareLevySurchargeTrapCalculator() {
  const [answers, setAnswers]       = useState<AnswerMap>({});
  const [step, setStep]             = useState(1);
  const [showVerdict, setVerdict]   = useState(false);
  const [showPopup, setShowPopup]   = useState(false);
  const [showQuestions, setShowQ]   = useState(false);
  const [popupTier, setPopupTier]   = useState<Tier>(67);
  const [popupAnswers, setPopupA]   = useState<PopupAnswers>({ situation: "", urgency: "", accountant: "" });
  const [email, setEmail]           = useState("");
  const [emailSent, setEmailSent]   = useState(false);
  const [checkoutLoading, setLoading] = useState(false);
  const [error, setError]           = useState("");
  const [sessionId, setSessionId]   = useState<string | null>(null);

  const verdictRef = useRef<HTMLDivElement>(null);

  const verdict = useMemo(() => showVerdict ? calcVerdict(answers) : null, [showVerdict, answers]);

  const visibleQs = QUESTIONS.filter((q) => q.step === step && (!q.showIf || q.showIf(answers)));
  const requiredQs = visibleQs.filter((q) => q.required !== false);
  const stepDone = !visibleQs.length || requiredQs.every((q) => answers[q.id] !== undefined && answers[q.id] !== "");
  const popupComplete = Object.values(popupAnswers).every((v) => v !== "");

  // Auto advance steps
  useEffect(() => {
    if (!stepDone) return;
    const t = setTimeout(() => {
      const next = step + 1;
      if (next <= TOTAL_STEPS) setStep(next);
      else setVerdict(true);
    }, visibleQs.length ? 300 : 0);
    return () => clearTimeout(t);
  }, [stepDone, step, visibleQs.length]);

  // Scroll to verdict
  useEffect(() => {
    if (showVerdict && verdictRef.current)
      setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [showVerdict]);

  // Lock body scroll when popup open
  useEffect(() => {
    document.body.style.overflow = showPopup ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPopup]);

  // Create decision session on verdict
  useEffect(() => {
    if (!showVerdict || !verdict) return;
    fetch("/api/decision-sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_slug: "medicare-levy-surcharge-trap",
        source_path: "/au/check/medicare-levy-surcharge-trap",
        country_code: "AU", currency_code: "AUD", site: "taxchecknow",
        inputs: answers,
        output: { status: verdict.status, mls_annual: verdict.mlsAnnual, tier: verdict.tier },
        recommended_tier: verdict.tier,
      }),
    }).then((r) => r.json()).then((d) => {
      if (d.id) { setSessionId(d.id); }
    }).catch(() => {});
  }, [showVerdict]);

  function answer(id: string, v: string | number | boolean) {
    setAnswers((p) => ({ ...p, [id]: v }));
  }

  function back() {
    if (showVerdict) { setVerdict(false); return; }
    if (step > 1) setStep((s) => s - 1);
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "medicare_levy_surcharge_trap", country_code: "AU", site: "taxchecknow" }),
    }).catch(() => {});
    setEmailSent(true);
  }

  function openPopup(tier: Tier) {
    setPopupTier(tier);
    setShowQ(false);
    setShowPopup(true);
    setError("");
  }

  async function handleCheckout() {
    if (checkoutLoading || !verdict) return;
    setLoading(true); setError("");
    const sid = sessionId || `mls_${Date.now()}`;
    const key = popupTier === 67 ? verdict.productKey67 : verdict.productKey147;

    // Save for success page personalisation
    sessionStorage.setItem("medicare-levy-surcharge-trap_answers", JSON.stringify(answers));
    sessionStorage.setItem("medicare-levy-surcharge-trap_annual_income", String(answers.income_band ?? ""));
    sessionStorage.setItem("medicare-levy-surcharge-trap_has_hospital_cover", String(answers.cover_type === "hospital" || answers.cover_type === "combined"));
    sessionStorage.setItem("medicare-levy-surcharge-trap_is_family", String(answers.family_status !== "single"));
    sessionStorage.setItem("medicare-levy-surcharge-trap_status", verdict.status);
    sessionStorage.setItem("medicare-levy-surcharge-trap_mls_annual", String(verdict.mlsAnnual));
    sessionStorage.setItem("medicare-levy-surcharge-trap_tier", String(popupTier));

    // Update session with popup answers
    if (sessionId) {
      fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sessionId, tier_intended: popupTier, product_key: key,
          questionnaire_payload: popupAnswers, email: email || undefined,
        }),
      }).catch(() => {});
    }

    try {
      const successPath = popupTier === 67 ? "assess" : "plan";
      const res = await fetch("/api/create-checkout-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_session_id: sid,
          tier: popupTier,
          product_key: key,
          success_url: `${window.location.origin}/au/check/medicare-levy-surcharge-trap/success/${successPath}`,
          cancel_url: `${window.location.origin}/au/check/medicare-levy-surcharge-trap`,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setError(data.error || "Checkout failed — please try again."); setLoading(false); }
    } catch {
      setError("Checkout failed — please try again.");
      setLoading(false);
    }
  }

  const maxStep = QUESTIONS.reduce((acc, q) => (!q.showIf || q.showIf(answers)) ? Math.max(acc, q.step) : acc, 1);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">

        {/* ── PROGRESSIVE FORM ── */}
        {!showVerdict && visibleQs.length > 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">
                Step {step} of {maxStep}
              </p>
              {step > 1 && (
                <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">
                  ← Back
                </button>
              )}
            </div>
            <div className="mb-5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full bg-neutral-950 transition-all duration-300"
                style={{ width: `${((step - 1) / maxStep) * 100}%` }} />
            </div>
            <div className="space-y-6">
              {visibleQs.map((q) => (
                <QuestionBlock key={q.id} q={q} value={answers[q.id]} onAnswer={answer} />
              ))}
            </div>
          </div>
        )}

        {/* ── VERDICT ── */}
        {showVerdict && verdict && (
          <div ref={verdictRef} className="space-y-4">
            <button onClick={back} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">
              ← Change my answers
            </button>

            {/* Result panel */}
            <div className={`rounded-2xl border p-5 sm:p-6 ${verdict.panelClass}`}>
              <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass}`}>
                {verdict.status}
              </p>
              <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{verdict.headline}</h3>

              {/* 3-stat grid */}
              <div className="mb-4 grid gap-2 sm:grid-cols-3">
                {verdict.stats.map((s) => (
                  <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{s.label}</p>
                    <p className={`font-serif text-lg font-bold ${s.highlight ? "text-red-700" : "text-neutral-950"}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Consequences */}
              <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
                <strong className="text-neutral-950">What this means:</strong>
                <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
                  {verdict.consequences.map((c, i) => <li key={i}>→ {c}</li>)}
                </ul>
              </div>

              {/* Confidence */}
              <div className={`mb-4 rounded-xl border px-4 py-2 text-xs ${
                verdict.confidence === "HIGH" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : verdict.confidence === "MEDIUM" ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-800"
              }`}>
                <strong>Confidence: {verdict.confidence}</strong> — {verdict.confidenceNote}
              </div>

              {/* Email capture */}
              <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-3">
                <p className="mb-1 text-sm font-semibold text-neutral-800">Save your result to show your accountant.</p>
                <p className="mb-2 text-xs text-neutral-500">Get a copy of your MLS position by email — free.</p>
                {!emailSent ? (
                  <div className="flex gap-2">
                    <input type="email" placeholder="Your email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                    <button onClick={handleSaveEmail}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
                      Save
                    </button>
                  </div>
                ) : <p className="text-sm font-semibold text-emerald-700">✓ Saved — check your inbox.</p>}
              </div>

              {/* Conversion line */}
              <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="text-sm text-neutral-700 leading-relaxed">
                  Most people in your situation either overpay tax every year — or pay for cover they don't actually need.
                  <strong className="text-neutral-950"> This check shows which side you're on.</strong>
                  The personalised plan below tells you exactly what to do about it.
                </p>
              </div>

              {/* What you get */}
              <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                  What's in your personalised plan
                </p>
                <ul className="space-y-1 text-xs text-neutral-700">
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Your exact MLS liability — calculated to the dollar</span></li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Cover timing strategy built around your income and family status</span></li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Cost vs tax comparison — hospital cover vs MLS for your income band</span></li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>Threshold optimisation — strategies to reduce or eliminate your MLS</span></li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600 shrink-0">✓</span><span>3 accountant questions written for your exact situation</span></li>
                </ul>
              </div>

              {/* Single CTA — algorithm-recommended tier */}
              <button onClick={() => openPopup(verdict.tier)}
                className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800">
                {verdict.ctaLabel}
              </button>
              <p className="mt-2 text-center text-xs text-neutral-400">
                ${verdict.tier} · One-time · Built around your answers above
              </p>

              {/* Alt tier option */}
              <p className="mt-2 text-center">
                <button
                  onClick={() => openPopup(verdict.tier === 67 ? 147 : 67)}
                  className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                  {verdict.altTierLabel}
                </button>
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── POPUP ── */}
      {showPopup && verdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">

            {/* Popup header */}
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${verdict.statusClass.replace("700", "400")}`}>
                    {verdict.status}
                  </p>
                  {verdict.mlsAnnual > 0 && (
                    <p className="mt-1 font-serif text-2xl font-bold text-white">
                      {formatAUD(verdict.mlsAnnual)}/yr MLS exposure
                    </p>
                  )}
                  {verdict.mlsAnnual === 0 && (
                    <p className="mt-1 font-serif text-2xl font-bold text-white">Your MLS position confirmed</p>
                  )}
                  <p className="mt-1 text-sm text-neutral-300">ATO-referenced · April 2026</p>
                </div>
                <button onClick={() => { setShowPopup(false); setShowQ(false); }}
                  className="rounded-lg bg-white/10 px-2 py-1 font-mono text-xs text-neutral-300 hover:bg-white/20 transition">
                  ✕ close
                </button>
              </div>
            </div>

            <div className="px-6 pt-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Based on your MLS position
              </p>

              {!showQuestions ? (
                <>
                  {/* What you get */}
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">What you get</p>
                    <p className="text-sm font-bold text-neutral-950 mb-2">
                      {popupTier === 67 ? "Your MLS Avoidance Plan" : "Your Income & Insurance Optimisation System"}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {popupTier === 67
                        ? "A personalised MLS analysis — surcharge calculation, cover timing strategy, and cost vs tax comparison. Built around your income, your family status, and your cover position."
                        : "Full income and tax optimisation — family structuring, next-year planning calendar, and a combined tax-versus-cover decision framework for your adviser or broker."}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">${popupTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Not a generic MLS guide. A plan for your MLS position.
                    </p>
                  </div>

                  <button onClick={() => setShowQ(true)}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {popupTier === 67 ? "Get My MLS Avoidance Plan →" : "Get My Optimisation System →"}
                  </button>

                  {/* Alt tier switch */}
                  <p className="text-center mt-2">
                    <button
                      onClick={() => setPopupTier(popupTier === 67 ? 147 : 67)}
                      className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                      {popupTier === 147 ? "Just want the essentials? — $67 instead" : "Want full optimisation? — $147 instead"}
                    </button>
                  </p>
                </>
              ) : (
                /* 3 qualifying questions */
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">${popupTier}</p>
                  </div>

                  {[
                    {
                      label: "What is your main situation?",
                      key: "situation",
                      options: [
                        ["salary", "Salary / employment income"],
                        ["smsf", "SMSF or investment income"],
                        ["business", "Business or self-employed"],
                        ["mixed", "Mixed income sources"],
                      ],
                    },
                    {
                      label: "How urgently do you need this?",
                      key: "urgency",
                      options: [
                        ["before_return", "Before lodging my tax return"],
                        ["next_year", "Planning for next financial year"],
                        ["general", "Just understanding my position"],
                      ],
                    },
                    {
                      label: "Do you have an accountant?",
                      key: "accountant",
                      options: [
                        ["yes_active", "Yes — meeting them soon"],
                        ["yes_inactive", "Yes — but haven't spoken recently"],
                        ["no", "No — managing myself"],
                      ],
                    },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">{field.label}</label>
                      <select
                        value={popupAnswers[field.key as keyof PopupAnswers]}
                        onChange={(e) => setPopupA((p) => ({ ...p, [field.key]: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                      >
                        <option value="">Select…</option>
                        {field.options.map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  <button
                    onClick={handleCheckout}
                    disabled={!popupComplete || checkoutLoading}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkoutLoading ? "Redirecting to Stripe…" : `Pay $${popupTier} →`}
                  </button>
                  {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                </div>
              )}

              <button
                onClick={() => { setShowPopup(false); setShowQ(false); }}
                className="mt-3 w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-500 hover:bg-neutral-50 transition"
              >
                Not now — keep reading
              </button>
            </div>

            <div className="px-6 pb-5 pt-2">
              <p className="text-center text-[10px] text-neutral-400">
                Secure checkout via Stripe · TaxCheckNow.com · ATO-sourced content
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE STICKY BAR — shows after verdict on mobile ── */}
      {showVerdict && verdict && verdict.mlsAnnual > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">MLS Exposure</p>
              <p className="text-sm font-bold text-neutral-950">{formatAUD(verdict.mlsAnnual)}/yr — get your avoidance plan</p>
            </div>
            <button
              onClick={() => openPopup(verdict.tier)}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 whitespace-nowrap"
            >
              From ${Math.min(67, verdict.tier)} →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTION BLOCK
// ─────────────────────────────────────────────────────────────────────────────

function QuestionBlock({
  q, value, onAnswer,
}: {
  q: Q;
  value: AnswerMap[string];
  onAnswer: (id: string, v: string | number | boolean) => void;
}) {
  const sel = (v: string | number | boolean) => value === v;
  const base = "rounded-xl border px-4 py-3 text-left transition";
  const active = "border-neutral-950 bg-neutral-950 text-white";
  const inactive = "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400";

  return (
    <div>
      <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">{q.label}</h2>
      {q.subLabel && <p className="mb-4 text-sm text-neutral-500">{q.subLabel}</p>}

      {q.type !== "two_button" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((opt) => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value)}
              className={`${base} ${sel(opt.value) ? active : inactive}`}>
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.subLabel && (
                <span className={`mt-0.5 block text-xs ${sel(opt.value) ? "text-neutral-300" : "text-neutral-500"}`}>
                  {opt.subLabel}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map((opt) => (
            <button key={String(opt.value)} onClick={() => onAnswer(q.id, opt.value)}
              className={`rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${sel(opt.value) ? active : inactive}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
