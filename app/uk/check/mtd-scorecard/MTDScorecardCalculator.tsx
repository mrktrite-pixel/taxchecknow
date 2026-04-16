"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── VERIFIED CONSTANTS — HMRC.gov.uk April 2026 ───────────────────────────
const FIRST_DEADLINE = new Date("2026-08-07T00:00:00.000+01:00");
const DAYS_TO_DEADLINE = Math.max(0, Math.floor((FIRST_DEADLINE.getTime() - new Date().getTime()) / 86_400_000));

const INCOME_BRACKETS = [
  { label: "Under £20,000",      value: 15_000, inScope2026: false, inScope2027: false, inScope2028: false },
  { label: "£20,000 – £30,000",  value: 25_000, inScope2026: false, inScope2027: false, inScope2028: true  },
  { label: "£30,000 – £50,000",  value: 40_000, inScope2026: false, inScope2027: true,  inScope2028: true  },
  { label: "£50,000 – £100,000", value: 70_000, inScope2026: true,  inScope2027: true,  inScope2028: true  },
  { label: "Over £100,000",      value: 130_000, inScope2026: true,  inScope2027: true,  inScope2028: true  },
] as const;

type SoftwareStatus   = "yes_mtd" | "yes_not_mtd" | "spreadsheet" | "paper" | "nothing";
type RecordsStatus    = "digital_good" | "digital_basic" | "mixed" | "paper";
type RegistrationStatus = "registered" | "started" | "not_started" | "dont_know";
type PackTier = 27 | 67;

interface ReadinessResult {
  score: number;
  band: "not_ready" | "partial" | "mostly" | "ready";
  bandLabel: string;
  bandColour: "red" | "amber" | "blue" | "emerald";
  topGapTitle: string;
  topGap: string;
  firstAction: string;
  urgencyText: string;
  riskText: string;
  whyNow: string;
  projectedScore: number;
}

interface PopupAnswers {
  income_source: string;
  timing: string;
  software_need: string;
}

const PRODUCTS: Record<PackTier, { name: string; tagline: string; bullets: string[]; cta: string }> = {
  27: {
    name: "MTD-50 Decision Pack",
    tagline: "Am I in scope? What do I need to do first?",
    bullets: [
      "Your qualifying income scope — confirmed in writing",
      "HMRC registration steps in plain English",
      "MTD software shortlist — free vs paid for your situation",
      "Quarterly deadline calendar — all 5 obligations",
      "Accountant brief for your first meeting",
    ],
    cta: "Get My Decision Pack — £27 →",
  },
  67: {
    name: "MTD-50 Action Pack",
    tagline: "I am in scope — give me the full compliance plan.",
    bullets: [
      "Everything in the Decision Pack",
      "Your biggest compliance gap and how to fix it first",
      "Software setup, digital records and registration changes",
      "First quarterly submission checklist",
      "Digital records template (Excel/Google Sheets)",
    ],
    cta: "Get My Action Pack — £67 →",
  },
};

function calcReadiness(software: SoftwareStatus, records: RecordsStatus, registration: RegistrationStatus): ReadinessResult {
  const s = software === "yes_mtd" ? 30 : software === "yes_not_mtd" ? 15 : software === "spreadsheet" ? 10 : 0;
  const r = records === "digital_good" ? 30 : records === "digital_basic" ? 18 : records === "mixed" ? 8 : 0;
  const reg = registration === "registered" ? 25 : registration === "started" ? 12 : 0;
  const awareness = 15;
  const score = s + r + reg + awareness;

  let band: ReadinessResult["band"];
  let bandLabel: string;
  let bandColour: ReadinessResult["bandColour"];

  if (score <= 25)      { band = "not_ready"; bandLabel = "Not ready — urgent action needed";     bandColour = "red"; }
  else if (score <= 50) { band = "partial";   bandLabel = "Partially ready — significant gaps";   bandColour = "amber"; }
  else if (score <= 75) { band = "mostly";    bandLabel = "Mostly ready — a few things to fix";   bandColour = "blue"; }
  else                  { band = "ready";     bandLabel = "Ready — confirm with your accountant"; bandColour = "emerald"; }

  let topGapTitle = "";
  let topGap = "";
  let firstAction = "";
  let projectedGain = 0;

  if (software !== "yes_mtd") {
    topGapTitle = "Software gap";
    topGap = "You need HMRC-compatible software before your first quarterly submission. This is the most common reason people miss the August deadline.";
    firstAction = "Choose your MTD software now — QuickBooks, Xero, FreeAgent or a bridging option. This is the single most important thing to fix.";
    projectedGain = 30;
  } else if (records === "paper" || records === "mixed") {
    topGapTitle = "Records gap";
    topGap = "MTD requires fully digital records from the start of the tax year. Paper and mixed records need converting before quarterly filing is realistic.";
    firstAction = "Move income and expense records into one digital system before worrying about filing submissions.";
    projectedGain = 25;
  } else if (registration === "not_started" || registration === "dont_know") {
    topGapTitle = "Registration gap";
    topGap = "You have not completed MTD registration with HMRC. Registration must be done before you can submit quarterly updates.";
    firstAction = "Clarify whether you or your accountant will handle HMRC registration, then complete it before July 2026.";
    projectedGain = 20;
  } else {
    topGapTitle = "Final confirmation";
    topGap = "Your setup looks strong. Run a pre-submission check to confirm software, registration and process are all linked correctly.";
    firstAction = "Test your software connection to HMRC before July. Do not wait until August to discover a technical issue.";
    projectedGain = 10;
  }

  const urgencyText = band === "ready"
    ? `You are in a strong position — but ${DAYS_TO_DEADLINE} days passes quickly when quarterly filing is new.`
    : `You are in scope and the first HMRC deadline is in ${DAYS_TO_DEADLINE} days. Waiting makes this harder.`;
  const riskText = band === "ready"
    ? "Your main risk is assuming you are done and missing a technical issue before the first filing."
    : "Your main risk is entering August without software, digital records or HMRC registration sorted.";
  const whyNow = band === "ready"
    ? "This is now about reducing avoidable friction before your first quarterly filing."
    : "HMRC has already switched the rule on. The question is whether your setup is ready.";

  return { score, band, bandLabel, bandColour, topGapTitle, topGap, firstAction, urgencyText, riskText, whyNow, projectedScore: Math.min(100, score + projectedGain) };
}

function Radio({ name, value, current, label, sub, onChange }: {
  name: string; value: string; current: string; label: string; sub?: string; onChange: (v: string) => void;
}) {
  const checked = current === value;
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${checked ? "border-neutral-950 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300"}`}>
      <input type="radio" name={name} checked={checked} onChange={() => onChange(value)} className="mt-0.5 shrink-0 accent-neutral-950" />
      <div>
        <p className={checked ? "font-semibold text-neutral-900" : "text-neutral-700"}>{label}</p>
        {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
      </div>
    </label>
  );
}

export default function MTDScorecardCalculator() {
  const [selectedBracket, setSelectedBracket]   = useState<number | null>(null);
  const [showReadiness, setShowReadiness]         = useState(false);
  const [showPopup, setShowPopup]                 = useState(false);
  const [showQuestions, setShowQuestions]         = useState(false);
  const [software, setSoftware]                   = useState<SoftwareStatus>("nothing");
  const [records, setRecords]                     = useState<RecordsStatus>("paper");
  const [registration, setRegistration]           = useState<RegistrationStatus>("dont_know");
  const [email, setEmail]                         = useState("");
  const [emailSent, setEmailSent]                 = useState(false);
  const [sessionId, setSessionId]                 = useState<string | null>(null);
  const [overrideTier, setOverrideTier]           = useState<PackTier | null>(null);
  const [checkoutLoading, setCheckoutLoading]     = useState(false);
  const [error, setError]                         = useState("");
  const [popupAnswers, setPopupAnswers]           = useState<PopupAnswers>({ income_source: "", timing: "", software_need: "" });

  const resultRef     = useRef<HTMLDivElement>(null);
  const readinessRef  = useRef<HTMLDivElement>(null);
  const questionsRef  = useRef<HTMLDivElement>(null);

  const bracket = selectedBracket !== null ? INCOME_BRACKETS[selectedBracket] : null;
  const readiness = useMemo(() => {
    if (!showReadiness || !bracket) return null;
    return calcReadiness(software, records, registration);
  }, [showReadiness, bracket, software, records, registration]);

  const calculatedTier: PackTier = readiness && bracket?.inScope2026 ? (readiness.score <= 50 ? 67 : 27) : 27;
  const effectiveTier = overrideTier ?? calculatedTier;
  const selectedProduct = PRODUCTS[effectiveTier];
  const popupAnswersComplete = Object.values(popupAnswers).every(v => v !== "");

  const answerSummary = useMemo(() => {
    if (!bracket) return null;
    if (bracket.inScope2026) return {
      status: "REQUIRED — YOU ARE IN SCOPE",
      statusClass: "text-red-700",
      headline: "Making Tax Digital for Income Tax applies to you from 6 April 2026.",
      panelClass: "border-red-200 bg-red-50",
      softLanding: true,
    };
    if (bracket.inScope2027) return {
      status: "UPCOMING — IN SCOPE FROM APRIL 2027",
      statusClass: "text-amber-700",
      headline: "Not in scope for 2026 — but the threshold drops to £30,000 in April 2027.",
      panelClass: "border-amber-200 bg-amber-50",
      softLanding: false,
    };
    if (bracket.inScope2028) return {
      status: "WATCH APRIL 2028",
      statusClass: "text-blue-700",
      headline: "Not in scope for 2026 or 2027. The threshold drops to £20,000 in April 2028.",
      panelClass: "border-blue-200 bg-blue-50",
      softLanding: false,
    };
    return {
      status: "NOT CURRENTLY REQUIRED",
      statusClass: "text-emerald-700",
      headline: "You are below all confirmed MTD thresholds for 2026, 2027 and 2028.",
      panelClass: "border-emerald-200 bg-emerald-50",
      softLanding: false,
    };
  }, [bracket]);

  useEffect(() => {
    if (selectedBracket !== null && resultRef.current) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [selectedBracket]);

  useEffect(() => {
    if (showReadiness && readinessRef.current) setTimeout(() => readinessRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [showReadiness]);

  useEffect(() => {
    if (showQuestions && questionsRef.current) setTimeout(() => questionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [showQuestions]);

  // Lock body scroll when popup open
  useEffect(() => {
    if (showPopup) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [showPopup]);

  async function handleBracketSelect(index: number) {
    setSelectedBracket(index);
    setShowReadiness(false);
    setShowPopup(false);
    setShowQuestions(false);
    setOverrideTier(null);
    setError("");
    try {
      const b = INCOME_BRACKETS[index];
      const res = await fetch("/api/decision-sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_slug: "mtd-scorecard", source_path: "/uk/check/mtd-scorecard",
          country_code: "UK", currency_code: "GBP", site: "taxchecknow",
          inputs: { income_bracket: b.label, income_value: b.value },
          output: { in_scope_2026: b.inScope2026, in_scope_2027: b.inScope2027, in_scope_2028: b.inScope2028 },
          recommended_tier: 27, email: email || undefined,
        }),
      });
      const data = await res.json();
      if (data.id) { setSessionId(data.id); localStorage.setItem("mtd_session_id", data.id); }
    } catch { /* non-blocking */ }
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, source: "mtd_scorecard", country_code: "UK", site: "taxchecknow" }) }).catch(() => {});
    setEmailSent(true);
  }

  async function handleCheckout() {
    if (checkoutLoading) return;
    const sid = sessionId || localStorage.getItem("mtd_session_id");
    if (!sid) { setError("Session expired. Run the calculator again."); return; }
    setCheckoutLoading(true); setError("");
    try {
      await fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sid, tier_intended: effectiveTier, product_key: `uk_${effectiveTier}_mtd_scorecard`,
          questionnaire_payload: popupAnswers, email: email || undefined,
          readiness_payload: readiness ? { score: readiness.score, band: readiness.band, top_gap_title: readiness.topGapTitle } : undefined,
        }),
      });
      const res = await fetch("/api/create-checkout-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_session_id: sid, tier: effectiveTier, product_key: `uk_${effectiveTier}_mtd_scorecard`,
          success_url: `${window.location.origin}/uk/check/mtd-scorecard/success/${effectiveTier === 67 ? "execute" : "prepare"}`,
          cancel_url: `${window.location.origin}/uk/check/mtd-scorecard`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to continue."); setCheckoutLoading(false); }
  }

  const readinessBadge = readiness?.bandColour === "red" ? "bg-red-100 text-red-700" : readiness?.bandColour === "amber" ? "bg-amber-100 text-amber-700" : readiness?.bandColour === "blue" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700";
  const readinessPanel = readiness?.bandColour === "red" ? "border-red-200 bg-red-50" : readiness?.bandColour === "amber" ? "border-amber-200 bg-amber-50" : readiness?.bandColour === "blue" ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50";

  return (
    <>
      <div id="calculator" className="scroll-mt-4 space-y-4">

        {/* ── STEP 1: INCOME BRACKETS ── */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-neutral-400">Free UK MTD scope check</p>
          <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">Check whether Making Tax Digital applies to you</h2>
          <p className="mb-3 text-sm text-neutral-600">
            Select your approximate annual <strong>qualifying income (gross turnover before expenses)</strong> from
            self-employment and UK property rental only.
          </p>
          <div className="mb-3 rounded-xl border-2 border-neutral-950 bg-neutral-950 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">The rule — HMRC confirmed</p>
            <p className="text-sm font-bold text-white">
              MTD applies if your qualifying income exceeds <span className="text-yellow-300">£50,000</span> in 2026.
            </p>
            <p className="text-xs text-neutral-300 mt-1">
              Use <strong className="text-white">gross turnover before expenses</strong> — not profit. PAYE wages excluded.
            </p>
          </div>
          <div className="space-y-2">
            {INCOME_BRACKETS.map((b, i) => {
              const selected = selectedBracket === i;
              return (
                <button key={b.label} onClick={() => handleBracketSelect(i)}
                  className={`flex w-full items-center justify-between rounded-xl border-2 px-5 py-4 text-left font-semibold transition-all ${
                    selected
                      ? "border-neutral-950 bg-neutral-950 text-white shadow-lg scale-[1.01]"
                      : "border-neutral-800 bg-white text-neutral-900 hover:border-neutral-950 hover:bg-neutral-950 hover:text-white hover:shadow-md"
                  }`}>
                  <span className="text-sm font-bold">{b.label}</span>
                  <span className={`font-mono text-xs ${selected ? "text-neutral-300" : "text-neutral-400"}`}>
                    {selected ? "Selected ✓" : "tap to check →"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-amber-800 mb-1">⚠️ Turnover not profit</p>
            <p className="text-xs font-semibold text-amber-900">
              HMRC uses <strong>gross turnover before expenses</strong> — not profit.
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Example: £55,000 turnover + £10,000 profit = <strong>£55,000 qualifying income — IN SCOPE</strong>
            </p>
          </div>
          <p className="mt-2 text-center text-xs text-neutral-400">
            Based on HMRC.gov.uk · qualifying income = gross self-employment + UK property rental only
          </p>
        </div>

        {/* ── STEP 2: INSTANT RESULT ── */}
        {bracket && answerSummary && (
          <div ref={resultRef} className={`rounded-2xl border p-5 sm:p-6 ${answerSummary.panelClass}`}>
            <p className={`mb-1 font-mono text-xs font-bold uppercase tracking-widest ${answerSummary.statusClass}`}>
              {answerSummary.status}
            </p>
            <h3 className="mb-3 font-serif text-xl font-bold text-neutral-950">{answerSummary.headline}</h3>

            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              {[
                { label: "2026 threshold", value: "£50,000" },
                { label: "Your bracket", value: bracket.label },
                { label: bracket.inScope2026 ? "First deadline" : "Next phase", value: bracket.inScope2026 ? "7 Aug 2026" : bracket.inScope2027 ? "Apr 2027" : bracket.inScope2028 ? "Apr 2028" : "Not required" },
              ].map(item => (
                <div key={item.label} className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{item.label}</p>
                  <p className="font-serif text-lg font-bold text-neutral-950">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Soft landing consequence */}
            {answerSummary.softLanding && (
              <div className="mb-4 space-y-2">
                <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm">
                  <strong className="text-neutral-950">If not ready by 7 August 2026:</strong>
                  <ul className="mt-1.5 space-y-1 text-xs text-red-800">
                    <li>→ Cannot submit first quarterly return through software</li>
                    <li>→ Compliance record starts with a missed obligation</li>
                    <li>→ Late payment penalties NOT covered by grace period</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-neutral-700">
                  <strong className="text-neutral-950">HMRC soft landing 2026-27:</strong> No late quarterly submission penalty <em>points</em> in year one. Late payment penalties still apply. Use this window to prepare.
                </div>
              </div>
            )}

            {/* Email save */}
            <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-3">
              <p className="mb-1.5 text-xs text-neutral-500">Save your result to show your accountant.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">Save</button>
                </div>
              ) : <p className="text-sm font-semibold text-emerald-700">✓ Saved.</p>}
            </div>

            {/* Two paths */}
            {bracket.inScope2026 && (
              <div className="space-y-2">
                <button onClick={() => setShowReadiness(true)}
                  className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                  Check my readiness before buying →
                </button>
                <button onClick={() => { setOverrideTier(27); setShowPopup(true); }}
                  className="w-full rounded-xl border border-neutral-300 bg-white py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
                  I know I need this — show me what I get
                </button>
              </div>
            )}
            {bracket.inScope2027 && !bracket.inScope2026 && (
              <button onClick={() => setShowReadiness(true)}
                className="w-full rounded-xl border border-neutral-950 bg-white py-3.5 text-sm font-bold text-neutral-950 transition hover:bg-neutral-50">
                Get my 2027 readiness score →
              </button>
            )}
          </div>
        )}

        {/* ── STEP 3: READINESS QUESTIONS (3 only) ── */}
        {showReadiness && bracket && (bracket.inScope2026 || bracket.inScope2027) && (
          <div ref={readinessRef} className="scroll-mt-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6">
            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-neutral-400">Readiness assessment — 3 quick questions</p>
            <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">How prepared are you for MTD?</h2>
            <p className="mb-5 text-sm text-neutral-500">Your score appears instantly as you answer.</p>
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-neutral-800">1. Do you have MTD-compatible accounting software?</p>
                <div className="space-y-2">
                  {[
                    { v: "yes_mtd",     l: "Yes — MTD-compatible software",     s: "QuickBooks, Xero, FreeAgent, Sage" },
                    { v: "yes_not_mtd", l: "Yes — not sure if MTD-compatible",   s: "Need to confirm with the provider" },
                    { v: "spreadsheet", l: "Spreadsheets",                       s: "May need bridging software" },
                    { v: "paper",       l: "Paper records",                      s: "Will need to go fully digital" },
                    { v: "nothing",     l: "No records system yet",              s: "Needs setting up from scratch" },
                  ].map(o => <Radio key={o.v} name="software" value={o.v} current={software} label={o.l} sub={o.s} onChange={v => setSoftware(v as SoftwareStatus)} />)}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-neutral-800">2. How are your records currently kept?</p>
                <div className="space-y-2">
                  {[
                    { v: "digital_good",  l: "Fully digital — updated as I go", s: "Ready for quarterly submissions" },
                    { v: "digital_basic", l: "Digital but occasionally updated", s: "Needs to be more regular" },
                    { v: "mixed",         l: "Mix of digital and paper",          s: "Needs to be fully digital" },
                    { v: "paper",         l: "Mainly paper receipts",             s: "Needs full digital overhaul" },
                  ].map(o => <Radio key={o.v} name="records" value={o.v} current={records} label={o.l} sub={o.s} onChange={v => setRecords(v as RecordsStatus)} />)}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-neutral-800">3. Have you registered for MTD with HMRC?</p>
                <div className="space-y-2">
                  {[
                    { v: "registered",  l: "Yes — fully registered",                  s: "Software linked, process understood" },
                    { v: "started",     l: "Started but not finished",                 s: "In progress" },
                    { v: "not_started", l: "Not started",                              s: "Needs to happen before first filing" },
                    { v: "dont_know",   l: "I do not know what registration involves", s: "Need clarity" },
                  ].map(o => <Radio key={o.v} name="registration" value={o.v} current={registration} label={o.l} sub={o.s} onChange={v => setRegistration(v as RegistrationStatus)} />)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: READINESS SCORE + GAP + POPUP TRIGGER ── */}
        {showReadiness && readiness && (
          <div className={`rounded-2xl border p-5 sm:p-6 ${readinessPanel}`}>
            <div className="mb-2 flex items-center gap-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your readiness score</p>
              <span className={`rounded-full px-2 py-0.5 font-mono text-sm font-bold ${readinessBadge}`}>{readiness.score}/100</span>
            </div>
            <h3 className="mb-4 font-serif text-xl font-bold text-neutral-950">{readiness.bandLabel}</h3>

            {/* Gap reveal */}
            <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 space-y-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">What this means</p>
                <p className="text-sm leading-relaxed text-neutral-800">{readiness.whyNow} {readiness.urgencyText}</p>
              </div>
              <div className="border-t border-neutral-100 pt-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-red-600 mb-1">Biggest gap — {readiness.topGapTitle}</p>
                <p className="text-sm text-neutral-800">{readiness.topGap}</p>
              </div>
              {readiness.score < 75 && (
                <div className="border-t border-neutral-100 pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-blue-600 mb-1">If you fix this gap</p>
                  <p className="text-sm text-neutral-700">
                    Score improves from{" "}
                    <strong className="text-red-600">{readiness.score}/100</strong> →{" "}
                    <strong className="text-emerald-600">{readiness.projectedScore}/100</strong>
                  </p>
                </div>
              )}
              <div className="border-t border-neutral-100 pt-3 rounded-lg bg-neutral-50 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-1">First action</p>
                <p className="text-sm font-semibold text-neutral-900">{readiness.firstAction}</p>
              </div>
            </div>

            {/* POPUP TRIGGER BUTTON — the pattern interrupt */}
            <button onClick={() => setShowPopup(true)}
              className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800">
              {effectiveTier === 67
                ? `Get My Action Pack — close these gaps before 7 August →`
                : `Get My Decision Pack — your personalised MTD plan →`}
            </button>
            <p className="mt-2 text-center text-xs text-neutral-400">
              £{effectiveTier} · One-time · No subscription
            </p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          POPUP — Pattern interrupt. Full screen overlay.
          User sees: status, days, what they get, price, buy.
      ══════════════════════════════════════════════════════════════════ */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl my-auto">

            {/* Popup header */}
            <div className="rounded-t-2xl bg-neutral-950 px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`font-mono text-xs font-bold uppercase tracking-widest ${bracket?.inScope2026 ? "text-red-400" : "text-amber-400"}`}>
                    {answerSummary?.status}
                  </p>
                  <p className="mt-1 font-serif text-2xl font-bold text-white">{DAYS_TO_DEADLINE} days to 7 August 2026</p>
                  <p className="mt-1 text-sm text-neutral-300">Your first quarterly deadline.</p>
                </div>
                <button onClick={() => setShowPopup(false)} className="rounded-lg bg-white/10 px-2 py-1 font-mono text-xs text-neutral-300 hover:bg-white/20 transition">✕ close</button>
              </div>
              {readiness && (
                <div className="mt-3 rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-xs text-neutral-300">
                    Your readiness score: <strong className="text-white">{readiness.score}/100</strong> ·{" "}
                    Biggest gap: <strong className="text-red-300">{readiness.topGapTitle}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Tier switcher in popup */}
            <div className="px-6 pt-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Choose your pack</p>
              <div className="flex gap-2 mb-4">
                {([27, 67] as const).map(t => {
                  const active = effectiveTier === t;
                  return (
                    <button key={t} onClick={() => setOverrideTier(t)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"}`}>
                      <p className={`font-mono text-sm font-bold ${active ? "text-white" : "text-neutral-800"}`}>£{t}</p>
                      <p className={`text-xs ${active ? "text-neutral-300" : "text-neutral-500"}`}>
                        {t === 27 ? "Decision Pack" : "Action Pack"}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* What you get */}
              <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">What you get</p>
                <p className="text-sm font-semibold text-neutral-900 mb-3">{selectedProduct.tagline}</p>
                <ul className="space-y-1.5">
                  {selectedProduct.bullets.map(b => (
                    <li key={b} className="flex items-start gap-2 text-sm text-neutral-700">
                      <span className="mt-0.5 text-emerald-500 shrink-0">✓</span>{b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price + personalisation note */}
              <div className="mb-4 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3">
                <div>
                  <p className="font-serif text-2xl font-bold text-neutral-950">£{effectiveTier}</p>
                  <p className="text-xs text-neutral-400">One-time · No subscription</p>
                </div>
                <p className="text-xs text-neutral-500 text-right max-w-[160px]">
                  3 quick questions after payment personalise your documents
                </p>
              </div>

              {/* Questions before checkout */}
              {!showQuestions ? (
                <button onClick={() => setShowQuestions(true)}
                  className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800">
                  {selectedProduct.cta}
                </button>
              ) : (
                <div ref={questionsRef} className="space-y-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">3 quick questions</p>
                  {[
                    { label: "Your main income source", key: "income_source", options: [["sole_trader", "Sole trader"], ["landlord", "UK landlord"], ["both", "Both"]] },
                    { label: "When do you need to be ready?", key: "timing", options: [["asap", "As soon as possible"], ["before_august", "Before 7 August 2026"], ["before_2027", "Before April 2027"]] },
                    { label: "Software situation", key: "software_need", options: [["choosing", "Still choosing software"], ["have_it", "Have software, need setup help"], ["accountant", "My accountant handles this"]] },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700">{field.label}</label>
                      <select value={popupAnswers[field.key as keyof PopupAnswers]}
                        onChange={e => setPopupAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400">
                        <option value="">Select…</option>
                        {field.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </div>
                  ))}
                  <button onClick={handleCheckout} disabled={!popupAnswersComplete || checkoutLoading}
                    className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    {checkoutLoading ? "Redirecting to checkout…" : `Continue to Payment — £${effectiveTier} →`}
                  </button>
                  {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                </div>
              )}

              <button onClick={() => { setShowPopup(false); setShowQuestions(false); }}
                className="mt-3 w-full rounded-xl border border-neutral-200 bg-white py-3 text-sm font-medium text-neutral-500 hover:bg-neutral-50 transition">
                Not now — keep reading
              </button>
            </div>
            <div className="px-6 pb-5 pt-2">
              <p className="text-center text-[10px] text-neutral-400">
                Secure checkout via Stripe · TaxCheckNow.com · HMRC-sourced content
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE STICKY BAR — shows after result on mobile ── */}
      {selectedBracket !== null && bracket?.inScope2026 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white px-4 py-3 lg:hidden shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">MTD Decision Pack</p>
              <p className="text-sm font-bold text-neutral-950">Get compliant before 7 August</p>
            </div>
            <button onClick={() => { setOverrideTier(27); setShowPopup(true); }}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 whitespace-nowrap">
              From £27 →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
