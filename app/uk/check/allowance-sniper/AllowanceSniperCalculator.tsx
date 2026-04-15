"use client";

import { useState, useRef, useEffect } from "react";

// ── HELPERS ────────────────────────────────────────────────────────────────
const fmtGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

// ── VERIFIED CONSTANTS 2026/27 ─────────────────────────────────────────────
const PERSONAL_ALLOWANCE = 12_570;
const TAPER_START = 100_000;
const TAPER_END = TAPER_START + (2 * PERSONAL_ALLOWANCE); // 125,140
const HIGHER_RATE = 0.40;
const NI_RATE = 0.02; // Employee NI above UEL
const PENSION_ANNUAL_ALLOWANCE = 60_000;
const TAPERED_AA_THRESHOLD_INCOME = 200_000;
const TAPERED_AA_ADJUSTED_INCOME = 260_000;

// ── CALCULATION ────────────────────────────────────────────────────────────
interface SniperResult {
  inTrap: boolean;
  incomeAboveThreshold: number;
  allowanceLost: number;
  currentPersonalAllowance: number;
  effectiveRate: number;
  effectiveRateWithNI: number;
  annualExtraTax: number;
  sippsNeededToEscape: number;
  sippNetCost: number;
  sippTaxSaving: number;
  sippTotalIntoPension: number;
  childcareTrap: boolean;
  taperedAA: boolean;
  score: number;
  urgencyLevel: "critical" | "high" | "medium" | "low";
  recommendation: string;
}

function calcSniper(
  grossIncome: number,
  pensionContributions: number,
  hasChildren: boolean,
): SniperResult {
  const adjustedNetIncome = Math.max(0, grossIncome - pensionContributions);
  const inTrap = adjustedNetIncome > TAPER_START && adjustedNetIncome < TAPER_END;
  const fullyAboveTrap = adjustedNetIncome >= TAPER_END;

  const incomeAboveThreshold = Math.max(0, Math.min(adjustedNetIncome, TAPER_END) - TAPER_START);
  const allowanceLost = Math.min(PERSONAL_ALLOWANCE, incomeAboveThreshold / 2);
  const currentPersonalAllowance = PERSONAL_ALLOWANCE - allowanceLost;

  // Effective rate in the trap
  const effectiveRate = inTrap ? 0.60 : fullyAboveTrap ? 0.45 : HIGHER_RATE;
  const effectiveRateWithNI = effectiveRate + (inTrap || fullyAboveTrap ? NI_RATE : 0);

  // Annual extra tax vs expected 40% rate
  const expectedTax = incomeAboveThreshold * HIGHER_RATE;
  const actualTax = (incomeAboveThreshold * HIGHER_RATE) + (allowanceLost * HIGHER_RATE);
  const annualExtraTax = actualTax - expectedTax;

  // SIPP calculation to escape
  const sippsNeededToEscape = Math.max(0, adjustedNetIncome - TAPER_START);
  const sippTaxSaving = sippsNeededToEscape > 0
    ? (Math.min(sippsNeededToEscape, allowanceLost) * HIGHER_RATE) + (sippsNeededToEscape * HIGHER_RATE * 0.5)
    : 0;

  // Simplified: for £10k contribution in trap
  const sampleContrib = Math.min(sippsNeededToEscape, 10_000);
  const basicRateRelief = sampleContrib * 0.20;
  const higherRateRelief = sampleContrib * 0.20;
  const allowanceRestored = Math.min(sampleContrib / 2, allowanceLost) * HIGHER_RATE;
  const sippTaxSaving10k = basicRateRelief + higherRateRelief + allowanceRestored;
  const sippNetCost = sampleContrib - (sippTaxSaving10k - basicRateRelief); // net after self-assessment relief
  const sippTotalIntoPension = sampleContrib + basicRateRelief;

  const childcareTrap = hasChildren && adjustedNetIncome > TAPER_START;
  const taperedAA = grossIncome > TAPERED_AA_THRESHOLD_INCOME;

  let score = 50;
  if (inTrap) score = 85;
  if (inTrap && pensionContributions === 0) score = 95;
  if (!inTrap && !fullyAboveTrap) score = 20;

  let urgencyLevel: SniperResult["urgencyLevel"] = "low";
  if (inTrap && pensionContributions === 0) urgencyLevel = "critical";
  else if (inTrap) urgencyLevel = "high";
  else if (adjustedNetIncome > 90_000) urgencyLevel = "medium";

  let recommendation = "";
  if (!inTrap && adjustedNetIncome <= TAPER_START) {
    recommendation = `Your adjusted net income of ${fmtGBP(adjustedNetIncome)} is below £100,000 — you are not currently in the 60% trap. If your income rises above £100,000 through a pay rise or bonus, the trap will apply immediately.`;
  } else if (fullyAboveTrap) {
    recommendation = `Your adjusted net income of ${fmtGBP(adjustedNetIncome)} is above £125,140 — you are past the taper zone and paying the 45% additional rate. Your full personal allowance has been withdrawn. Consider whether pension contributions can reduce your adjusted income back into a lower band.`;
  } else if (inTrap && pensionContributions > 0) {
    recommendation = `Your adjusted net income of ${fmtGBP(adjustedNetIncome)} puts you in the 60% trap — but your pension contributions of ${fmtGBP(pensionContributions)} have already reduced it from your gross income. Increasing contributions further could move you below £100,000 and restore your full personal allowance.`;
  } else {
    recommendation = `Your adjusted net income of ${fmtGBP(adjustedNetIncome)} puts you in the 60% dead zone — between £100,000 and £125,140. You are paying 60% effective tax (62% including NI) on ${fmtGBP(incomeAboveThreshold)} of income. A SIPP or salary sacrifice contribution of ${fmtGBP(sippsNeededToEscape)} would restore your full personal allowance and drop your effective rate back to 40%.`;
  }

  return {
    inTrap,
    incomeAboveThreshold,
    allowanceLost,
    currentPersonalAllowance,
    effectiveRate,
    effectiveRateWithNI,
    annualExtraTax,
    sippsNeededToEscape,
    sippNetCost,
    sippTaxSaving: sippTaxSaving10k,
    sippTotalIntoPension,
    childcareTrap,
    taperedAA,
    score,
    urgencyLevel,
    recommendation,
  };
}

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Answers {
  income_type: string;
  pension_provider: string;
  childcare: string;
  timing: string;
  where_are_you: string;
}

const PRODUCTS = {
  47: {
    name: "60% Allowance Sniper — Decision Pack",
    tagline: "Am I in the trap? What is the exact SIPP contribution to escape?",
    files: [
      "Your personal trap assessment — exact adjusted net income and allowance position",
      "The SIPP escape calculation — contribution needed and net cost after tax relief",
      "Salary sacrifice vs personal SIPP comparison — which works better for your situation",
      "Gift Aid alternative guide — charitable donations that also reduce adjusted net income",
      "Childcare benefit trap guide — how the 30 hours free childcare interacts with the £100k threshold",
      "Brief for your accountant or financial adviser — what to action before 5 April 2027",
    ],
  },
  97: {
    name: "60% Allowance Sniper — Planning Pack",
    tagline: "I am in the trap — give me the full implementation plan.",
    files: [
      "Everything in the Decision Pack",
      "Year-by-year pension contribution scheduling plan — optimised for your income level",
      "Bonus and variable income planning guide — how to time payments to stay below £100k",
      "Tapered annual allowance checker — if adjusted income approaches £260,000",
      "Combined strategy document — SIPP + Gift Aid + salary sacrifice in one tax year",
    ],
  },
};

// ── SLIDER ─────────────────────────────────────────────────────────────────
function Slider({ label, sublabel, min, max, step, value, onChange, format }: {
  label: string; sublabel?: string; min: number; max: number;
  step: number; value: number; onChange: (v: number) => void; format: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-800">{label}</p>
          {sublabel && <p className="mt-0.5 text-xs text-neutral-400">{sublabel}</p>}
        </div>
        <p className="shrink-0 font-serif text-xl font-bold text-neutral-950">{format(value)}</p>
      </div>
      <div className="relative h-2 rounded-full bg-neutral-200">
        <div className="absolute left-0 top-0 h-2 rounded-full bg-neutral-950 transition-all" style={{ width: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <div className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-neutral-950 bg-white shadow"
          style={{ left: `calc(${pct}% - 10px)` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-neutral-400">
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  );
}

function Radio({ name, value, current, label, sub, onChange }: {
  name: string; value: string; current: string; label: string; sub?: string; onChange: (v: string) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${current === value ? "border-neutral-950 bg-neutral-50 font-medium" : "border-neutral-200 hover:border-neutral-300"}`}>
      <input type="radio" name={name} checked={current === value} onChange={() => onChange(value)} className="mt-0.5 shrink-0 accent-neutral-950" />
      <div>
        <p className={current === value ? "font-semibold text-neutral-900" : "text-neutral-700"}>{label}</p>
        {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
      </div>
    </label>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function AllowanceSniperCalculator() {
  const [grossIncome, setGrossIncome] = useState(110_000);
  const [pensionContributions, setPensionContributions] = useState(0);
  const [hasChildren, setHasChildren] = useState(false);

  const [hasResult, setHasResult] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({ income_type: "", pension_provider: "", childcare: "", timing: "", where_are_you: "" });
  const [overrideTier, setOverrideTier] = useState<47 | 97 | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const questionnaireRef = useRef<HTMLDivElement>(null);

  const result = calcSniper(grossIncome, pensionContributions, hasChildren);
  const calcTier: 47 | 97 = result.inTrap && pensionContributions === 0 ? 97 : 47;
  const effectiveTier = overrideTier ?? calcTier;
  const product = PRODUCTS[effectiveTier];
  const answersComplete = Object.values(answers).every(v => v !== "");

  useEffect(() => {
    if (hasResult && resultRef.current) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [hasResult]);

  useEffect(() => {
    if (showQuestionnaire && questionnaireRef.current) setTimeout(() => questionnaireRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [showQuestionnaire]);

  async function handleCalculate() {
    setHasResult(true); setShowModal(false); setShowQuestionnaire(false); setError("");
    try {
      const res = await fetch("/api/decision-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_slug: "allowance-sniper",
          source_path: "/uk/check/allowance-sniper",
          country_code: "UK", currency_code: "GBP", site: "taxchecknow",
          inputs: { gross_income: grossIncome, pension_contributions: pensionContributions, has_children: hasChildren },
          output: { in_trap: result.inTrap, effective_rate: result.effectiveRate, sipp_needed: result.sippsNeededToEscape, score: result.score },
          recommended_tier: effectiveTier,
          email: email || undefined,
        }),
      });
      const data = await res.json();
      if (data.id) { setSessionId(data.id); localStorage.setItem("sniper_session_id", data.id); }
    } catch { /* non-blocking */ }
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, balance: grossIncome, source: "allowance_sniper", country_code: "UK", site: "taxchecknow" }) }).catch(() => {});
    setEmailSent(true);
  }

  async function handleContinueToPayment() {
    if (!answersComplete || checkoutLoading) return;
    const sid = sessionId || localStorage.getItem("sniper_session_id");
    if (!sid) { setError("Session expired. Run the calculator again."); return; }
    setCheckoutLoading(true); setError("");
    try {
      await fetch("/api/decision-sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sid, tier_intended: effectiveTier, product_key: `uk_${effectiveTier}_allowance_sniper`, questionnaire_payload: answers, email: email || undefined }) });
      const res = await fetch("/api/create-checkout-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision_session_id: sid, tier: effectiveTier, product_key: `uk_${effectiveTier}_allowance_sniper`, success_url: `${window.location.origin}/uk/check/allowance-sniper/success/${effectiveTier === 97 ? "execute" : "prepare"}`, cancel_url: `${window.location.origin}/uk/check/allowance-sniper` }) });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to continue."); setCheckoutLoading(false); }
  }

  const trapColour = result.inTrap ? "border-red-200 bg-red-50" : result.effectiveRate === 0.45 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50";

  return (
    <div id="calculator" className="scroll-mt-8 space-y-6">

      {/* CALCULATOR */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Free personal allowance trap check — United Kingdom</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-neutral-950">Are you in the 60% dead zone?</h2>
        <p className="mt-1 text-sm text-neutral-500">Based on GOV.UK Income Tax rates 2026/27. Not personal tax advice.</p>

        <div className="mt-6 space-y-6">
          <Slider label="Your gross annual income" sublabel="Total income from all sources — salary, bonus, dividends, rental income, self-employment" min={80_000} max={200_000} step={5_000} value={grossIncome} onChange={setGrossIncome} format={fmtGBP} />

          <Slider label="Current pension contributions this tax year" sublabel="Personal pension or SIPP contributions you are already making. This reduces your adjusted net income." min={0} max={60_000} step={1_000} value={pensionContributions} onChange={setPensionContributions} format={fmtGBP} />

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-800">Do you have children under 12?</p>
            <p className="mb-3 text-xs text-neutral-400">The 30 hours free childcare is withdrawn when adjusted net income exceeds £100,000 — worth £5,000-£8,000 per year.</p>
            <div className="flex gap-3">
              {[{ v: true, l: "Yes — I have children under 12" }, { v: false, l: "No" }].map(o => (
                <button key={String(o.v)} onClick={() => setHasChildren(o.v)}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${hasChildren === o.v ? "border-neutral-950 bg-neutral-50 font-semibold" : "border-neutral-200 hover:border-neutral-300"}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div className={`rounded-xl border px-4 py-3 ${grossIncome - pensionContributions > TAPER_START && grossIncome - pensionContributions < TAPER_END ? "border-red-200 bg-red-50" : grossIncome - pensionContributions >= TAPER_END ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Your adjusted net income</p>
            <p className="font-serif text-2xl font-bold text-neutral-950">{fmtGBP(Math.max(0, grossIncome - pensionContributions))}</p>
            <p className="text-xs text-neutral-500 mt-1">
              {grossIncome - pensionContributions > TAPER_START && grossIncome - pensionContributions < TAPER_END
                ? `In the 60% trap zone — between £100,000 and £125,140`
                : grossIncome - pensionContributions >= TAPER_END
                ? `Above £125,140 — full personal allowance withdrawn, 45% rate applies`
                : `Below £100,000 — personal allowance intact`}
            </p>
          </div>
        </div>

        <button onClick={handleCalculate}
          className="mt-8 w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800">
          Calculate My Trap Position →
        </button>
        <p className="mt-2 text-center text-xs text-neutral-400">Based on GOV.UK 2026/27 rates. Not personal tax advice.</p>
      </div>

      {/* RESULT */}
      {hasResult && (
        <div ref={resultRef} className="scroll-mt-8">
          <div className={`rounded-2xl border p-6 sm:p-8 ${trapColour}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your personal allowance position</span>
              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${result.inTrap ? "bg-red-100 text-red-700" : result.effectiveRate === 0.45 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {result.inTrap ? "In the trap" : result.effectiveRate === 0.45 ? "Above trap" : "Clear"}
              </span>
            </div>

            <h3 className={`font-serif text-2xl font-bold text-neutral-950 mb-3 ${result.inTrap ? "text-red-900" : ""}`}>
              {result.inTrap
                ? `You are paying ${fmtPct(result.effectiveRate)} tax on ${fmtGBP(result.incomeAboveThreshold)} of your income.`
                : result.effectiveRate === 0.45
                ? "You are above the trap. Your personal allowance is fully withdrawn."
                : "You are below the £100,000 threshold — personal allowance intact."}
            </h3>

            <p className="text-sm text-neutral-700 mb-5">{result.recommendation}</p>

            <div className="grid gap-3 sm:grid-cols-4 mb-4">
              {[
                { label: "Effective tax rate", value: fmtPct(result.effectiveRate), highlight: result.inTrap, red: result.inTrap },
                { label: "With NI", value: fmtPct(result.effectiveRateWithNI), highlight: false, red: result.inTrap },
                { label: "Personal allowance remaining", value: fmtGBP(result.currentPersonalAllowance), highlight: false, red: result.allowanceLost > 0 },
                { label: "SIPP needed to escape", value: result.sippsNeededToEscape > 0 ? fmtGBP(result.sippsNeededToEscape) : "None needed", highlight: result.inTrap, red: false },
              ].map(item => (
                <div key={item.label} className={`rounded-xl border px-4 py-3 ${item.highlight ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{item.label}</p>
                  <p className={`font-serif text-lg font-bold ${item.red ? "text-red-700" : "text-neutral-950"}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {result.inTrap && result.sippsNeededToEscape > 0 && (
              <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 mb-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-2">The SIPP escape — your numbers</p>
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <div>
                    <p className="text-xs text-neutral-400">You pay into SIPP</p>
                    <p className="font-bold text-neutral-950">{fmtGBP(Math.min(result.sippsNeededToEscape, 10_000))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Total tax saving</p>
                    <p className="font-bold text-emerald-700">{fmtGBP(result.sippTaxSaving)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400">Pension total (inc. basic rate relief)</p>
                    <p className="font-bold text-neutral-950">{fmtGBP(result.sippTotalIntoPension)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-neutral-400">Example based on £10,000 SIPP contribution. Full calculation in the pack. Claim higher rate relief via Self Assessment.</p>
              </div>
            )}

            {result.childcareTrap && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700 mb-1">⚠ Childcare trap alert</p>
                <p className="text-sm text-amber-900">Your income above £100,000 means you lose the 30 hours free childcare — worth approximately £5,000-£8,000 per year. A pension contribution that reduces your adjusted net income below £100,000 restores this entitlement AND saves you the 60% trap tax.</p>
              </div>
            )}

            {result.taperedAA && (
              <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 mb-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Note — tapered pension annual allowance</p>
                <p className="text-sm text-neutral-700">Your income approaches the £200,000 threshold income limit for the tapered annual allowance. If your adjusted income exceeds £260,000, the £60,000 pension annual allowance begins to reduce. Check with your adviser before making large pension contributions.</p>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-neutral-950 bg-neutral-950 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">What happens next</p>
              <h4 className="mt-2 font-serif text-xl font-bold text-white">
                {effectiveTier === 97
                  ? "Get the full SIPP implementation plan — contribution schedule, timing, and Self Assessment guide."
                  : "Understand your exact position and the contribution needed to escape the trap."}
              </h4>
              <button onClick={() => setShowModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-neutral-950 transition hover:bg-neutral-100">
                Get My {effectiveTier === 97 ? "Planning" : "Decision"} Pack — £{effectiveTier} →
              </button>
              <p className="mt-2 text-xs text-neutral-500">One-time · £{effectiveTier} · No subscription</p>
            </div>

            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-500 mb-2">Leave your email and we will send a copy to show your financial adviser.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">Save</button>
                </div>
              ) : <p className="text-sm font-semibold text-emerald-700">✓ Saved. A copy is on its way.</p>}
            </div>
          </div>
        </div>
      )}

      {/* QUESTIONNAIRE */}
      {showQuestionnaire && product && (
        <div ref={questionnaireRef} className="scroll-mt-8 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-1">{product.name} — £{effectiveTier}</p>
          <h3 className="font-serif text-2xl font-bold text-neutral-950 mb-2">Tell us about your situation</h3>
          <p className="text-sm text-neutral-500 mb-6">5 quick questions — personalises the documents you receive.</p>

          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-semibold text-neutral-900">How do you receive your income?</p>
              <div className="space-y-2">
                {[
                  { v: "employed", l: "Employed — salary through PAYE", s: "Pay is processed by your employer" },
                  { v: "employed_bonus", l: "Employed with bonus or variable pay", s: "Base salary plus performance bonus" },
                  { v: "director", l: "Ltd company director — salary plus dividends", s: "You control how you pay yourself" },
                  { v: "self_employed", l: "Self-employed or consultant", s: "Gross income from multiple clients" },
                  { v: "multiple", l: "Multiple income sources", s: "Combination of salary, dividends, rental etc" },
                ].map(o => <Radio key={o.v} name="income_type" value={o.v} current={answers.income_type} label={o.l} sub={o.s} onChange={v => setAnswers(a => ({ ...a, income_type: v }))} />)}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-neutral-900">Do you have an existing pension or SIPP?</p>
              <div className="space-y-2">
                {[
                  { v: "workplace", l: "Yes — workplace pension only", s: "Employer contributes through payroll" },
                  { v: "sipp_also", l: "Yes — workplace pension and a personal SIPP", s: "I have both" },
                  { v: "sipp_only", l: "Yes — personal SIPP only", s: "No workplace scheme" },
                  { v: "none", l: "No pension at all", s: "Need to set one up" },
                ].map(o => <Radio key={o.v} name="pension_provider" value={o.v} current={answers.pension_provider} label={o.l} sub={o.s} onChange={v => setAnswers(a => ({ ...a, pension_provider: v }))} />)}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-neutral-900">Are you affected by the childcare trap?</p>
              <div className="space-y-2">
                {[
                  { v: "yes_losing", l: "Yes — I am losing 30 hours free childcare because of my income", s: "Worth £5,000-£8,000 per year" },
                  { v: "yes_at_risk", l: "My income is approaching £100,000 — childcare at risk", s: "Could lose it this year" },
                  { v: "no_children", l: "No children under 12", s: "Not relevant for me" },
                  { v: "no_income", l: "No — my income is below £100,000", s: "Not affected" },
                ].map(o => <Radio key={o.v} name="childcare" value={o.v} current={answers.childcare} label={o.l} sub={o.s} onChange={v => setAnswers(a => ({ ...a, childcare: v }))} />)}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-neutral-900">When are you planning to act?</p>
              <div className="space-y-2">
                {[
                  { v: "now", l: "Now — I want to sort this before the tax year ends" },
                  { v: "this_year", l: "This tax year (before 5 April 2027)" },
                  { v: "planning", l: "Planning ahead — my income is approaching £100,000" },
                  { v: "review", l: "Reviewing my position — not urgent" },
                ].map(o => <Radio key={o.v} name="timing" value={o.v} current={answers.timing} label={o.l} onChange={v => setAnswers(a => ({ ...a, timing: v }))} />)}
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="mb-3 text-sm font-semibold text-neutral-900">Which best describes where you are?</p>
              <div className="space-y-2">
                {[
                  { v: "understanding", l: "I need to understand my exact position and the SIPP calculation before acting" },
                  { v: "ready", l: "I am ready to contribute — I need the implementation plan and contribution schedule" },
                ].map(o => (
                  <Radio key={o.v} name="where_are_you" value={o.v} current={answers.where_are_you} label={o.l}
                    onChange={v => { setAnswers(a => ({ ...a, where_are_you: v })); if (v === "understanding") setOverrideTier(47); if (v === "ready") setOverrideTier(97); }} />
                ))}
              </div>
              {answers.where_are_you === "understanding" && <p className="mt-3 text-xs text-blue-800">→ <strong>Decision Pack (£47)</strong> — personal trap assessment, SIPP escape calculation, salary sacrifice vs SIPP comparison.</p>}
              {answers.where_are_you === "ready" && <p className="mt-3 text-xs text-blue-800">→ <strong>Planning Pack (£97)</strong> — full contribution schedule, bonus timing guide, tapered AA checker, combined strategy.</p>}
            </div>

            {answersComplete && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 mb-2">{product.name}</p>
                <ul className="space-y-1.5">
                  {product.files.map((f, i) => <li key={i} className="flex items-start gap-2 text-xs text-neutral-700"><span className="mt-0.5 shrink-0 text-emerald-600">✓</span>{f}</li>)}
                </ul>
              </div>
            )}

            <button onClick={handleContinueToPayment} disabled={!answersComplete || checkoutLoading}
              className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-40">
              {checkoutLoading ? "Redirecting..." : `Continue to Payment — £${effectiveTier} →`}
            </button>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        </div>
      )}

      {/* MODAL */}
      {showModal && product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl my-auto">
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Before you continue</p>
            <h3 className="mt-2 font-serif text-2xl font-bold text-neutral-950">{product.name}</h3>
            <div className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 p-4">
              <ul className="space-y-1.5">
                {product.files.map((f, i) => <li key={i} className="flex items-start gap-2 text-sm text-neutral-700"><span className="mt-0.5 shrink-0 text-emerald-500">✓</span>{f}</li>)}
              </ul>
            </div>
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-xs text-neutral-500">One-time payment · No subscription</p>
              <p className="mt-0.5 font-serif text-xl font-bold text-neutral-950">£{effectiveTier}</p>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => { setShowModal(false); setShowQuestionnaire(true); }} className="flex-1 rounded-xl bg-neutral-950 py-3 text-sm font-bold text-white transition hover:bg-neutral-800">Continue →</button>
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50">Not now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
