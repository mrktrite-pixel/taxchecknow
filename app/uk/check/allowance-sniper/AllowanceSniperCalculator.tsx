"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const TAX_YEAR_END = new Date("2027-04-05T23:59:59.000+01:00");
const DAYS_TO_YEAR_END = Math.max(
  0,
  Math.floor((TAX_YEAR_END.getTime() - new Date().getTime()) / 86_400_000)
);

const BRACKETS = [
  { label: "Under £90,000",          value: 85_000,  status: "clear"      as const },
  { label: "£90,000 – £100,000",     value: 95_000,  status: "approaching" as const },
  { label: "£100,000 – £110,000",    value: 105_000, status: "trap"        as const },
  { label: "£110,000 – £125,140",    value: 117_000, status: "deep_trap"   as const },
  { label: "£125,140 – £150,000",    value: 135_000, status: "above_trap"  as const },
  { label: "Over £150,000",          value: 160_000, status: "above_trap"  as const },
] as const;

type PackTier = 67 | 147;

interface Answers {
  contribution_timing:    string;
  salary_sacrifice_access: string;
  bonus_expected:         string;
  main_goal:              string;
  accountant_status:      string;
}

const PRODUCTS: Record<PackTier, {
  name: string; tagline: string; value: string; cta: string;
}> = {
  67: {
    name:    "Your Allowance Sniper Assessment",
    tagline: "What is my exact trap position and what contribution gets me out?",
    value:   "A personal assessment built around your income, your ANI position, and your specific escape route — not a generic pension guide.",
    cta:     "Get My Assessment — £67 →",
  },
  147: {
    name:    "Your Allowance Sniper Action Plan",
    tagline: "I am in the trap — build my full implementation plan.",
    value:   "A personal assessment built around your income, your ANI position, and your specific escape route — not a generic pension guide.",
    cta:     "Get My Action Plan — £147 →",
  },
};

function pounds(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

function personalAllowanceFromANI(ani: number) {
  const reduction = Math.max(0, (ani - 100_000) / 2);
  return Math.max(0, 12_570 - reduction);
}

function trapSliceFromANI(ani: number) {
  return clamp(ani - 100_000, 0, 25_140);
}

function statusFromANI(ani: number) {
  if (ani < 90_000) return {
    key: "clear" as const,
    label: "CLEAR — BELOW THE £100,000 THRESHOLD",
    headline: "You are below the 60% trap threshold — personal allowance intact.",
    panelClass: "border-emerald-200 bg-emerald-50",
    badgeClass: "text-emerald-700",
    score: 92,
    scoreLabel: "Compliance in place — confirm the details",
  };
  if (ani < 100_000) return {
    key: "approaching" as const,
    label: "APPROACHING — WITHIN £10,000 OF THE TRAP",
    headline: "You are within £10,000 of the 60% trap threshold.",
    panelClass: "border-amber-200 bg-amber-50",
    badgeClass: "text-amber-700",
    score: 68,
    scoreLabel: "Partial compliance — gaps to close",
  };
  if (ani <= 110_000) return {
    key: "trap" as const,
    label: "IN THE TRAP — 60% EFFECTIVE RATE",
    headline: "You are in the personal allowance dead zone.",
    panelClass: "border-red-200 bg-red-50",
    badgeClass: "text-red-700",
    score: 42,
    scoreLabel: "Significant gaps — action needed now",
  };
  if (ani <= 125_140) return {
    key: "deep_trap" as const,
    label: "DEEP IN THE TRAP — 60% EFFECTIVE RATE",
    headline: "You are deep in the taper zone and losing personal allowance quickly.",
    panelClass: "border-red-200 bg-red-50",
    badgeClass: "text-red-700",
    score: 28,
    scoreLabel: "Significant gaps — action needed now",
  };
  return {
    key: "above_trap" as const,
    label: "ABOVE THE TRAP — PERSONAL ALLOWANCE FULLY WITHDRAWN",
    headline: "Your full personal allowance has already been withdrawn.",
    panelClass: "border-blue-200 bg-blue-50",
    badgeClass: "text-blue-700",
    score: 54,
    scoreLabel: "Partial compliance — gaps to close",
  };
}

function recommendedTier(hiddenTax: number, childcareHit: boolean): PackTier {
  if (hiddenTax >= 2_000 || childcareHit) return 147;
  return 67;
}

export default function AllowanceSniperCalculator() {
  const [selectedBracket,    setSelectedBracket]    = useState<number | null>(null);
  const [existingPension,    setExistingPension]    = useState<number>(0);
  const [hasChildrenUnder12, setHasChildrenUnder12] = useState<boolean>(false);
  const [showQuestions,      setShowQuestions]      = useState(false);
  const [email,              setEmail]              = useState("");
  const [emailSent,          setEmailSent]          = useState(false);
  const [sessionId,          setSessionId]          = useState<string | null>(null);
  const [answers,            setAnswers]            = useState<Answers>({
    contribution_timing: "", salary_sacrifice_access: "",
    bonus_expected: "", main_goal: "", accountant_status: "",
  });
  const [overrideTier,       setOverrideTier]       = useState<PackTier | null>(null);
  const [showPopup,          setShowPopup]          = useState(false);
  const [popupStep,          setPopupStep]          = useState<"intro" | "questions">("intro");
  const [checkoutLoading,    setCheckoutLoading]    = useState(false);
  const [error,              setError]              = useState("");

  const resultRef = useRef<HTMLDivElement>(null);

  const grossIncome = selectedBracket !== null ? BRACKETS[selectedBracket].value : null;

  const model = useMemo(() => {
    if (grossIncome === null) return null;
    const adjustedNetIncome   = Math.max(0, grossIncome - existingPension);
    const personalAllowance   = personalAllowanceFromANI(adjustedNetIncome);
    const trapSlice           = trapSliceFromANI(adjustedNetIncome);
    const hiddenExtraTax      = trapSlice * 0.2;
    const contributionNeeded  = Math.max(0, adjustedNetIncome - 100_000);
    const reliefAtSourceNetPayment = contributionNeeded * 0.8;
    const extraRelief         = contributionNeeded * 0.2;
    const netCostAfterRelief  = Math.max(0, reliefAtSourceNetPayment - extraRelief);
    const status              = statusFromANI(adjustedNetIncome);
    const childcareTrap       = hasChildrenUnder12 && adjustedNetIncome > 100_000;

    return {
      grossIncome, adjustedNetIncome, personalAllowance,
      trapSlice, hiddenExtraTax, contributionNeeded,
      reliefAtSourceNetPayment, extraRelief, netCostAfterRelief,
      status, childcareTrap,
    };
  }, [grossIncome, existingPension, hasChildrenUnder12]);

  // Algorithm decides tier — no user override in popup
  const calculatedTier: PackTier = model
    ? recommendedTier(model.hiddenExtraTax, model.childcareTrap)
    : 67;
  const effectiveTier   = overrideTier ?? calculatedTier;
  const selectedProduct = PRODUCTS[effectiveTier];
  const answersComplete = Object.values(answers).every(Boolean);

  useEffect(() => {
    if (selectedBracket !== null && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [selectedBracket]);

  async function handleBracketSelect(index: number) {
    setSelectedBracket(index);
    setExistingPension(0);
    setHasChildrenUnder12(false);
    setShowQuestions(false);
    setOverrideTier(null);
    setError("");
    // Save for success page
    sessionStorage.setItem("sniper_bracket", BRACKETS[index].label);
    sessionStorage.setItem("sniper_status", BRACKETS[index].status);
    try {
      const selected = BRACKETS[index];
      const response = await fetch("/api/decision-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_slug: "allowance-sniper",
          source_path: "/uk/check/allowance-sniper",
          country_code: "UK", currency_code: "GBP", site: "taxchecknow",
          inputs: { gross_income_bracket: selected.label, gross_income_value: selected.value },
          output: { initial_status: selected.status },
          recommended_tier: 67,
        }),
      });
      const data = await response.json();
      if (data.id) {
        setSessionId(data.id);
        localStorage.setItem("allowance_sniper_session_id", data.id);
      }
    } catch { /* non-blocking */ }
  }

  async function handleSaveEmail() {
    if (!email) return;
    fetch("/api/save-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "allowance_sniper_result", country_code: "UK", site: "taxchecknow",
        session_id: sessionId || localStorage.getItem("allowance_sniper_session_id") || "" }),
    }).catch(() => {});
    setEmailSent(true);
  }

  async function handleContinueToPayment() {
    if (!answersComplete || checkoutLoading || !model) return;
    // Save answers for success page
    sessionStorage.setItem("sniper_pension",    String(existingPension));
    sessionStorage.setItem("sniper_childcare",  String(hasChildrenUnder12));
    sessionStorage.setItem("sniper_answers",    JSON.stringify(answers));
    sessionStorage.setItem("sniper_hidden_tax", String(model.hiddenExtraTax));
    sessionStorage.setItem("sniper_contribution_needed", String(model.contributionNeeded));
    sessionStorage.setItem("sniper_net_cost",   String(model.netCostAfterRelief));
    sessionStorage.setItem("sniper_ani",        String(model.adjustedNetIncome));

    const sid = sessionId || localStorage.getItem("allowance_sniper_session_id");
    // Fallback SID — never block checkout
    const effectiveSid = sid || `fallback_${Date.now()}`;

    setCheckoutLoading(true);
    setError("");
    try {
      if (sid) {
        fetch("/api/decision-sessions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: sid, tier_intended: effectiveTier,
            product_key: `uk_${effectiveTier}_allowance_sniper`,
            questionnaire_payload: answers,
            email: email || undefined,
            calculation_payload: {
              gross_income: model.grossIncome,
              adjusted_net_income: model.adjustedNetIncome,
              personal_allowance_remaining: model.personalAllowance,
              hidden_extra_tax: model.hiddenExtraTax,
              contribution_needed: model.contributionNeeded,
              net_cost_after_relief: model.netCostAfterRelief,
              childcare_trap: model.childcareTrap,
              status: model.status.key,
            },
          }),
        }).catch(() => {});
      }
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_session_id: effectiveSid,
          tier: effectiveTier,
          product_key: `uk_${effectiveTier}_allowance_sniper`,
          success_url: `${window.location.origin}/uk/check/allowance-sniper/success/${effectiveTier === 147 ? "plan" : "decide"}`,
          cancel_url: `${window.location.origin}/uk/check/allowance-sniper`,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue.");
      setCheckoutLoading(false);
    }
  }

  const mobileStickyVisible = !!model &&
    (model.status.key === "trap" || model.status.key === "deep_trap" || model.status.key === "approaching");

  return (
    <>
      <div id="calculator" className="scroll-mt-8 space-y-5">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">

          <div className="mb-4 rounded-xl border-2 border-neutral-900 bg-neutral-950 px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">The rule — HMRC confirmed</p>
            <p className="mt-1 text-sm leading-relaxed text-white">
              The 60% trap begins at <strong className="text-amber-300">£100,000 adjusted net income</strong>.
              Personal allowance tapers to zero at <strong className="text-amber-300">£125,140</strong>.
            </p>
          </div>

          <p className="mb-2 font-serif text-2xl font-bold text-neutral-950">
            What is your gross annual income from all sources?
          </p>
          <p className="mb-4 text-sm text-neutral-600">
            Tap your bracket. The tool calculates your real trigger: <strong>adjusted net income</strong>.
          </p>

          <div className="space-y-2">
            {BRACKETS.map((item, index) => {
              const selected = selectedBracket === index;
              return (
                <button key={item.label} onClick={() => handleBracketSelect(index)}
                  className={`flex w-full items-center justify-between rounded-xl border-2 px-5 py-4 text-left transition ${
                    selected
                      ? "scale-[1.01] border-neutral-950 bg-neutral-950 text-white"
                      : "border-neutral-800 bg-white text-neutral-900 hover:bg-neutral-950 hover:text-white"
                  }`}>
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span className={`font-mono text-[10px] uppercase tracking-widest ${selected ? "text-neutral-300" : "text-neutral-500"}`}>
                    tap to check →
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-700">⚠️ key clarification</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              A <strong>£10,000 SIPP contribution</strong> can pull ANI from{" "}
              <strong>£110,000</strong> back to <strong>£100,000</strong> — outside the trap entirely.
            </p>
          </div>
        </div>

        {model && (
          <div ref={resultRef} className={`rounded-2xl border p-6 sm:p-8 ${model.status.panelClass}`}>
            <p className={`mb-1 font-mono text-sm font-bold uppercase tracking-widest ${model.status.badgeClass}`}>
              {model.status.label}
            </p>
            <h3 className="mb-3 font-serif text-2xl font-bold text-neutral-950">{model.status.headline}</h3>

            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: "ANI",          value: pounds(model.adjustedNetIncome) },
                { label: "PA remaining", value: pounds(model.personalAllowance) },
                { label: "Hidden cost",  value: pounds(model.hiddenExtraTax), red: true },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{item.label}</p>
                  <p className={`font-serif text-lg font-bold ${item.red ? "text-red-700" : "text-neutral-950"}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-4 text-sm leading-relaxed text-neutral-800">
              <strong>The gap is the sale:</strong> you are losing{" "}
              <strong>{pounds(model.hiddenExtraTax)}</strong> per year to the taper.
              This is the hidden cost most taxpayers never see on the payslip.
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Two quick optimisation checks
              </p>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-neutral-800">
                    Existing pension contributions this tax year (gross)
                  </label>
                  <input type="range" min={0} max={60000} step={500} value={existingPension}
                    onChange={e => setExistingPension(Number(e.target.value))}
                    className="w-full" />
                  <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                    <span>£0</span>
                    <span className="font-semibold text-neutral-900">{pounds(existingPension)}</span>
                    <span>£60,000</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">Children under 12?</p>
                    <p className="text-xs text-neutral-500">Triggers childcare trap warning.</p>
                  </div>
                  <button type="button" onClick={() => setHasChildrenUnder12(prev => !prev)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                      hasChildrenUnder12 ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white text-neutral-700"
                    }`}>
                    {hasChildrenUnder12 ? "Yes" : "No"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Gross SIPP needed",   value: pounds(model.contributionNeeded) },
                  { label: "Net payment",          value: pounds(model.reliefAtSourceNetPayment) },
                  { label: "Net cost after relief",value: pounds(model.netCostAfterRelief), green: true },
                ].map(item => (
                  <div key={item.label} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{item.label}</p>
                    <p className={`font-serif text-lg font-bold ${item.green ? "text-emerald-700" : "text-neutral-950"}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-relaxed text-emerald-900">
                <strong>Escape route:</strong> A gross SIPP contribution of{" "}
                <strong>{pounds(model.contributionNeeded)}</strong> would pull ANI back to around{" "}
                <strong>£100,000</strong>. Estimated net cost after relief:{" "}
                <strong>{pounds(model.netCostAfterRelief)}</strong>.
              </div>

              {model.childcareTrap && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  <strong>Childcare trap alert:</strong> if ANI stays above{" "}
                  <strong>£100,000</strong>, childcare support may also be affected.
                </div>
              )}
            </div>

            {/* Email save */}
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="mb-1 text-sm font-semibold text-neutral-800">Save your result to show your accountant.</p>
              <p className="mb-2 text-xs text-neutral-500">Get a copy of your ANI position by email — free.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail}
                    className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
                    Save
                  </button>
                </div>
              ) : <p className="text-sm font-semibold text-emerald-700">✓ Saved.</p>}
            </div>

            {/* Single CTA — algorithm decided tier */}
            <button onClick={() => { setShowQuestions(true); setShowPopup(true); setPopupStep("intro"); }}
              className="mt-4 w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800">
              Check my exact escape route →
            </button>
            <p className="mt-2 text-center text-xs text-neutral-500">
              £{effectiveTier} · One-time · No subscription
            </p>
            {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
          </div>
        )}
      </div>

      {/* ── POPUP ─────────────────────────────────────────────────────────── */}
      {showPopup && model && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="bg-neutral-950 px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                    Based on your income position
                  </p>
                  <p className="mt-1 font-serif text-xl font-bold text-white">{selectedProduct.name}</p>
                  <p className="mt-1 text-sm text-neutral-300">
                    {DAYS_TO_YEAR_END} days to 5 April 2027
                  </p>
                </div>
                <button onClick={() => setShowPopup(false)}
                  className="text-sm text-neutral-400 transition hover:text-white">✕</button>
              </div>
            </div>

            <div className="px-5 py-5">
              {popupStep === "intro" ? (
                <>
                  <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">What you get</p>
                    <p className="text-sm font-bold text-neutral-950 mb-2">{selectedProduct.name}</p>
                    <p className="text-sm leading-relaxed text-neutral-700">{selectedProduct.value}</p>
                  </div>
                  <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-serif text-2xl font-bold text-neutral-950">£{effectiveTier}</p>
                      <p className="text-xs text-neutral-400">One-time · No subscription</p>
                    </div>
                    <p className="text-xs text-neutral-500">Not a guide to ANI. A plan for your ANI.</p>
                  </div>
                  <button onClick={() => setPopupStep("questions")}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                    {selectedProduct.cta}
                  </button>
                  {effectiveTier === 147 && (
                    <p className="text-center mt-2">
                      <button onClick={() => setOverrideTier(67)}
                        className="text-xs text-neutral-400 underline hover:text-neutral-600 transition">
                        Need less detail? Assessment — £67 instead
                      </button>
                    </p>
                  )}
                  <button onClick={() => setShowPopup(false)}
                    className="mt-3 w-full text-sm text-neutral-500 underline">
                    Not now — keep reading
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">5 quick questions then pay</p>
                    <p className="font-serif text-lg font-bold text-neutral-950">£{effectiveTier}</p>
                  </div>
                  {[
                    { key: "contribution_timing", label: "When would you act?", options: [
                      ["before_april", "Before 5 April 2027"],
                      ["bonus_window", "Around bonus time"],
                      ["monthly",      "Monthly contributions"],
                      ["unsure",       "Not sure yet"],
                    ]},
                    { key: "salary_sacrifice_access", label: "Salary sacrifice available?", options: [
                      ["yes",      "Yes"],
                      ["no",       "No"],
                      ["not_sure", "Not sure"],
                    ]},
                    { key: "bonus_expected", label: "Bonus expected this year?", options: [
                      ["yes_large", "Yes — meaningful bonus"],
                      ["yes_small", "Yes — small bonus"],
                      ["no",        "No"],
                      ["unknown",   "Not sure"],
                    ]},
                    { key: "main_goal", label: "Main goal?", options: [
                      ["escape_trap",      "Get below £100,000 ANI"],
                      ["restore_allowance","Restore personal allowance"],
                      ["childcare",        "Protect childcare eligibility"],
                      ["plan_next_year",   "Plan next year better"],
                    ]},
                    { key: "accountant_status", label: "Accountant status?", options: [
                      ["already_discussed","Already discussed"],
                      ["need_to_raise",    "Need to raise it"],
                      ["no_accountant",    "No accountant currently"],
                    ]},
                  ].map(field => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">{field.label}</label>
                      <select value={answers[field.key as keyof Answers]}
                        onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400">
                        <option value="">Select…</option>
                        {field.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </div>
                  ))}
                  <button onClick={handleContinueToPayment}
                    disabled={!answersComplete || checkoutLoading}
                    className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    {checkoutLoading ? "Redirecting…" : `Pay £${effectiveTier} →`}
                  </button>
                  {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                  <button onClick={() => setShowPopup(false)}
                    className="w-full text-sm text-neutral-500 underline">
                    Not now — keep reading
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE STICKY BAR ────────────────────────────────────────────── */}
      {mobileStickyVisible && (
        <div className="fixed bottom-0 left-0 right-0 z-[90] border-t border-neutral-200 bg-white px-4 py-3 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">{selectedProduct.name}</p>
              <p className="truncate text-xs text-neutral-500">From £67</p>
            </div>
            <button onClick={() => { setShowQuestions(true); setShowPopup(true); setPopupStep("intro"); }}
              className="rounded-xl bg-neutral-950 px-4 py-3 text-sm font-bold text-white">
              From £67 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
