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

// ── VERIFIED CONSTANTS ─────────────────────────────────────────────────────
const MTD_THRESHOLD_2026 = 50_000;
const MTD_THRESHOLD_2027 = 30_000;
const MTD_THRESHOLD_2028 = 20_000;

// ── TYPES ──────────────────────────────────────────────────────────────────
type IncomeSource = "self_employed" | "landlord" | "both" | "other";
type SoftwareStatus = "yes_mtd" | "yes_not_mtd" | "spreadsheet" | "paper" | "nothing";
type RecordsStatus = "digital_good" | "digital_basic" | "mixed" | "paper";
type RegistrationStatus = "registered" | "started" | "not_started" | "dont_know";
type AccountantStatus = "yes_sorted" | "yes_not_discussed" | "no_accountant";

interface MTDResult {
  inScope2026: boolean;
  inScope2027: boolean;
  qualifyingIncome: number;
  score: number;
  band: "not_ready" | "partial" | "mostly" | "ready";
  bandLabel: string;
  bandColour: string;
  firstDeadline: string;
  daysToDeadline: number;
  urgencyLevel: "critical" | "high" | "medium" | "low";
  topGap: string;
  recommendation: string;
}

interface Answers {
  income_source: string;
  timing: string;
  software_need: string;
  biggest_concern: string;
  where_are_you: string;
}

function calcMTD(
  selfEmployedIncome: number,
  propertyIncome: number,
  softwareStatus: SoftwareStatus,
  recordsStatus: RecordsStatus,
  registrationStatus: RegistrationStatus,
  accountantStatus: AccountantStatus,
): MTDResult {
  const qualifyingIncome = selfEmployedIncome + propertyIncome;
  const inScope2026 = qualifyingIncome >= MTD_THRESHOLD_2026;
  const inScope2027 = qualifyingIncome >= MTD_THRESHOLD_2027;
  const daysToDeadline = 114; // Aug 7, 2026 from April 15, 2026

  // Score calculation
  let score = 0;
  const softwareScore = softwareStatus === "yes_mtd" ? 25 : softwareStatus === "yes_not_mtd" ? 10 : 0;
  const recordsScore = recordsStatus === "digital_good" ? 25 : recordsStatus === "digital_basic" ? 15 : recordsStatus === "mixed" ? 5 : 0;
  const registrationScore = registrationStatus === "registered" ? 20 : registrationStatus === "started" ? 10 : 0;
  const deadlineScore = 15; // We give this for running the calculator — they now know
  const accountantScore = accountantStatus === "yes_sorted" ? 15 : accountantStatus === "yes_not_discussed" ? 5 : 0;
  score = softwareScore + recordsScore + registrationScore + deadlineScore + accountantScore;

  let band: MTDResult["band"];
  let bandLabel: string;
  let bandColour: string;

  if (score <= 25) { band = "not_ready"; bandLabel = "Not ready — urgent action needed"; bandColour = "red"; }
  else if (score <= 50) { band = "partial"; bandLabel = "Partially ready — significant gaps"; bandColour = "amber"; }
  else if (score <= 75) { band = "mostly"; bandLabel = "Mostly ready — a few things to fix"; bandColour = "blue"; }
  else { band = "ready"; bandLabel = "Ready — confirm with your accountant"; bandColour = "emerald"; }

  // Top gap
  let topGap = "";
  if (softwareStatus !== "yes_mtd") topGap = "You need MTD-compatible software before your first quarterly deadline.";
  else if (recordsStatus === "paper" || recordsStatus === "mixed") topGap = "Your records need to be fully digital before you can file quarterly.";
  else if (registrationStatus === "not_started" || registrationStatus === "dont_know") topGap = "You need to register for MTD with HMRC before your first deadline.";
  else if (accountantStatus === "no_accountant") topGap = "You should speak to an accountant before your first quarterly deadline.";
  else topGap = "Review your setup with your accountant to confirm everything is in order.";

  let recommendation = "";
  if (!inScope2026 && inScope2027) {
    recommendation = `Your qualifying income of ${fmtGBP(qualifyingIncome)} is below the £50,000 threshold for 2026. You are not required to use MTD this year. However, the threshold drops to £30,000 in April 2027 — which means you may be in scope next year. Check your position now so you are not caught out.`;
  } else if (!inScope2026) {
    recommendation = `Your qualifying income of ${fmtGBP(qualifyingIncome)} is below the £50,000 MTD threshold for 2026 and the £30,000 threshold for 2027. You are not currently required to use MTD. The threshold drops to £20,000 in April 2028.`;
  } else {
    recommendation = `Your qualifying income of ${fmtGBP(qualifyingIncome)} means MTD for Income Tax is mandatory for you from 6 April 2026. Your first HMRC quarterly submission is due 7 August 2026 — ${daysToDeadline} days away.`;
  }

  return {
    inScope2026,
    inScope2027,
    qualifyingIncome,
    score: inScope2026 ? score : 0,
    band,
    bandLabel,
    bandColour,
    firstDeadline: "7 August 2026",
    daysToDeadline,
    urgencyLevel: !inScope2026 ? "low" : score <= 25 ? "critical" : score <= 50 ? "high" : "medium",
    topGap,
    recommendation,
  };
}

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

// ── PRODUCTS ───────────────────────────────────────────────────────────────
const PRODUCTS = {
  27: {
    name: "MTD-50 Decision Pack",
    tagline: "Am I in scope? What do I need to do?",
    files: [
      "Your personal MTD scope assessment — qualifying income calculation with your numbers",
      "Step-by-step MTD registration guide for HMRC online services",
      "MTD-compatible software comparison — free vs paid options for your situation",
      "Digital records checklist — what HMRC requires and what counts",
      "Quarterly deadline calendar — August 7, November 7, February 7, May 7",
      "Brief for your accountant — what to discuss before your first submission",
    ],
  },
  67: {
    name: "MTD-50 Action Pack",
    tagline: "I am in scope — give me everything to get compliant.",
    files: [
      "Everything in the Decision Pack",
      "MTD registration walkthrough — step by step with screenshots",
      "First quarterly submission checklist — what to include and what to leave out",
      "Income and expenses digital records template (Excel/Google Sheets compatible)",
      "Sole trader vs landlord MTD guide — different rules for different income types",
    ],
  },
};

const INITIAL_ANSWERS: Answers = {
  income_source: "",
  timing: "",
  software_need: "",
  biggest_concern: "",
  where_are_you: "",
};

// ── MAIN ───────────────────────────────────────────────────────────────────
export default function MTDScorecardCalculator() {
  const [selfEmployed, setSelfEmployed] = useState(55_000);
  const [property, setProperty] = useState(0);
  const [software, setSoftware] = useState<SoftwareStatus>("nothing");
  const [records, setRecords] = useState<RecordsStatus>("paper");
  const [registration, setRegistration] = useState<RegistrationStatus>("dont_know");
  const [accountant, setAccountant] = useState<AccountantStatus>("yes_not_discussed");

  const [hasResult, setHasResult] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [overrideTier, setOverrideTier] = useState<27 | 67 | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const questionnaireRef = useRef<HTMLDivElement>(null);

  const result = calcMTD(selfEmployed, property, software, records, registration, accountant);
  const calcTier: 27 | 67 = result.inScope2026 && result.score <= 50 ? 67 : 27;
  const effectiveTier = overrideTier ?? calcTier;
  const product = PRODUCTS[effectiveTier];
  const answersComplete = Object.values(answers).every(v => v !== "");

  useEffect(() => {
    if (hasResult && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [hasResult]);

  useEffect(() => {
    if (showQuestionnaire && questionnaireRef.current) {
      setTimeout(() => questionnaireRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [showQuestionnaire]);

  async function handleCalculate() {
    setHasResult(true);
    setShowModal(false);
    setShowQuestionnaire(false);
    setError("");
    try {
      const res = await fetch("/api/decision-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_slug: "mtd-scorecard",
          source_path: "/uk/check/mtd-scorecard",
          country_code: "UK",
          currency_code: "GBP",
          site: "taxchecknow",
          inputs: { self_employed: selfEmployed, property, software, records, registration, accountant },
          output: { in_scope: result.inScope2026, score: result.score, band: result.band, qualifying_income: result.qualifyingIncome },
          recommended_tier: effectiveTier,
          email: email || undefined,
        }),
      });
      const data = await res.json();
      if (data.id) { setSessionId(data.id); localStorage.setItem("mtd_session_id", data.id); }
    } catch { /* non-blocking */ }
  }

  async function handleSaveEmail() {
    if (!email) return;
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, balance: selfEmployed + property, source: "mtd_scorecard", country_code: "UK", site: "taxchecknow" }),
    }).catch(() => {});
    setEmailSent(true);
  }

  async function handleContinueToPayment() {
    if (!answersComplete || checkoutLoading) return;
    const sid = sessionId || localStorage.getItem("mtd_session_id");
    if (!sid) { setError("Session expired. Run the calculator again."); return; }
    setCheckoutLoading(true);
    setError("");
    try {
      await fetch("/api/decision-sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sid,
          tier_intended: effectiveTier,
          product_key: `uk_${effectiveTier}_mtd_scorecard`,
          questionnaire_payload: answers,
          email: email || undefined,
        }),
      });
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision_session_id: sid,
          tier: effectiveTier,
          product_key: `uk_${effectiveTier}_mtd_scorecard`,
          success_url: `${window.location.origin}/uk/check/mtd-scorecard/success/${effectiveTier === 67 ? "execute" : "prepare"}`,
          cancel_url: `${window.location.origin}/uk/check/mtd-scorecard`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue to checkout.");
      setCheckoutLoading(false);
    }
  }

  const scoreColour = result.bandColour === "red" ? "text-red-700" : result.bandColour === "amber" ? "text-amber-700" : result.bandColour === "blue" ? "text-blue-700" : "text-emerald-700";
  const scoreBg = result.bandColour === "red" ? "border-red-200 bg-red-50" : result.bandColour === "amber" ? "border-amber-200 bg-amber-50" : result.bandColour === "blue" ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50";

  return (
    <div id="calculator" className="scroll-mt-8 space-y-6">

      {/* CALCULATOR */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Free MTD readiness check — United Kingdom</p>
        <h2 className="mt-1 font-serif text-2xl font-bold text-neutral-950">Get your MTD readiness score in 60 seconds</h2>
        <p className="mt-1 text-sm text-neutral-500">Based on HMRC.gov.uk qualifying income rules. Not personal tax advice.</p>

        <div className="mt-6 space-y-6">
          <Slider label="Self-employment income (gross turnover)" sublabel="Your total receipts before expenses — not profit. This is what HMRC uses for MTD eligibility." min={0} max={200_000} step={5_000} value={selfEmployed} onChange={setSelfEmployed} format={fmtGBP} />

          <Slider label="UK property rental income (gross)" sublabel="Rental receipts before expenses. Include if you have rental income from UK property." min={0} max={100_000} step={5_000} value={property} onChange={setProperty} format={fmtGBP} />

          {(selfEmployed + property) > 0 && (
            <div className={`rounded-xl border px-4 py-3 ${(selfEmployed + property) >= MTD_THRESHOLD_2026 ? "border-red-200 bg-red-50" : (selfEmployed + property) >= MTD_THRESHOLD_2027 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Your qualifying income</p>
              <p className={`font-serif text-2xl font-bold ${(selfEmployed + property) >= MTD_THRESHOLD_2026 ? "text-red-700" : "text-emerald-700"}`}>
                {fmtGBP(selfEmployed + property)}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {(selfEmployed + property) >= MTD_THRESHOLD_2026
                  ? "Above the £50,000 MTD threshold — you are in scope from April 6, 2026"
                  : (selfEmployed + property) >= MTD_THRESHOLD_2027
                  ? "Below £50,000 for 2026 but above £30,000 — in scope from April 2027"
                  : "Below the MTD threshold for 2026 and 2027"}
              </p>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-800">Do you have MTD-compatible accounting software?</p>
            <div className="space-y-2">
              {[
                { v: "yes_mtd" as SoftwareStatus, l: "Yes — I already use MTD-compatible software", s: "QuickBooks, Xero, FreeAgent, Sage etc" },
                { v: "yes_not_mtd" as SoftwareStatus, l: "Yes — but I am not sure if it is MTD-compatible", s: "Need to check with the software provider" },
                { v: "spreadsheet" as SoftwareStatus, l: "I use spreadsheets (Excel or Google Sheets)", s: "May need bridging software to submit to HMRC" },
                { v: "paper" as SoftwareStatus, l: "I keep paper records", s: "Will need to switch to digital records" },
                { v: "nothing" as SoftwareStatus, l: "I do not currently keep formal records", s: "Need to set up digital record-keeping" },
              ].map(o => <Radio key={o.v} name="software" value={o.v} current={software} label={o.l} sub={o.s} onChange={v => setSoftware(v as SoftwareStatus)} />)}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-800">How are your current records kept?</p>
            <div className="space-y-2">
              {[
                { v: "digital_good" as RecordsStatus, l: "Fully digital — income and expenses recorded as they happen", s: "Ready for quarterly submissions" },
                { v: "digital_basic" as RecordsStatus, l: "Digital but basic — I update them occasionally", s: "Needs to be more regular for MTD" },
                { v: "mixed" as RecordsStatus, l: "Mix of digital and paper", s: "Needs to be fully digital" },
                { v: "paper" as RecordsStatus, l: "Mainly paper receipts and manual records", s: "Needs full digital overhaul" },
              ].map(o => <Radio key={o.v} name="records" value={o.v} current={records} label={o.l} sub={o.s} onChange={v => setRecords(v as RecordsStatus)} />)}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-800">Have you registered for MTD with HMRC?</p>
            <div className="space-y-2">
              {[
                { v: "registered" as RegistrationStatus, l: "Yes — fully registered and set up", s: "I have my MTD credentials and software linked" },
                { v: "started" as RegistrationStatus, l: "I have started the process but not finished", s: "In progress" },
                { v: "not_started" as RegistrationStatus, l: "No — I have not started registration", s: "Need to do this before first deadline" },
                { v: "dont_know" as RegistrationStatus, l: "I do not know what MTD registration involves", s: "Need guidance" },
              ].map(o => <Radio key={o.v} name="registration" value={o.v} current={registration} label={o.l} sub={o.s} onChange={v => setRegistration(v as RegistrationStatus)} />)}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-800">Have you spoken to your accountant about MTD?</p>
            <div className="space-y-2">
              {[
                { v: "yes_sorted" as AccountantStatus, l: "Yes — we have a plan in place", s: "Software chosen, process agreed" },
                { v: "yes_not_discussed" as AccountantStatus, l: "I have an accountant but we have not discussed MTD yet", s: "Need to raise it at next meeting" },
                { v: "no_accountant" as AccountantStatus, l: "I do not have an accountant", s: "May need one for MTD compliance" },
              ].map(o => <Radio key={o.v} name="accountant" value={o.v} current={accountant} label={o.l} sub={o.s} onChange={v => setAccountant(v as AccountantStatus)} />)}
            </div>
          </div>
        </div>

        <button onClick={handleCalculate}
          className="mt-8 w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800">
          Get My MTD Readiness Score →
        </button>
        <p className="mt-2 text-center text-xs text-neutral-400">Based on HMRC.gov.uk guidance. Not personal tax advice.</p>
      </div>

      {/* RESULT */}
      {hasResult && (
        <div ref={resultRef} className="scroll-mt-8 space-y-4">
          <div className={`rounded-2xl border p-6 sm:p-8 ${scoreBg}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your MTD readiness score</span>
              {result.inScope2026 && (
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${result.bandColour === "red" ? "bg-red-100 text-red-700" : result.bandColour === "amber" ? "bg-amber-100 text-amber-700" : result.bandColour === "blue" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {result.score}/100
                </span>
              )}
            </div>

            {!result.inScope2026 ? (
              <>
                <h3 className="font-serif text-2xl font-bold text-neutral-950 mb-2">
                  {result.inScope2027
                    ? "Not in scope for 2026 — but you will be in 2027."
                    : "You are not currently required to use MTD for Income Tax."}
                </h3>
                <p className="text-sm text-neutral-700 mb-4">{result.recommendation}</p>
                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  {[
                    { label: "Your qualifying income", value: fmtGBP(result.qualifyingIncome), highlight: false },
                    { label: "2026 MTD threshold", value: "£50,000", highlight: false },
                    { label: "2027 MTD threshold", value: "£30,000", highlight: result.inScope2027 },
                  ].map(item => (
                    <div key={item.label} className={`rounded-xl border px-4 py-3 ${item.highlight ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white"}`}>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{item.label}</p>
                      <p className={`font-serif text-xl font-bold ${item.highlight ? "text-amber-700" : "text-neutral-950"}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className={`font-serif text-2xl font-bold text-neutral-950 mb-2 ${scoreColour}`}>
                  {result.bandLabel}
                </h3>
                <p className="text-sm text-neutral-700 mb-4">{result.recommendation}</p>

                <div className="grid gap-3 sm:grid-cols-4 mb-4">
                  {[
                    { label: "Readiness score", value: `${result.score}/100`, highlight: true },
                    { label: "Qualifying income", value: fmtGBP(result.qualifyingIncome), highlight: false },
                    { label: "First UK deadline", value: result.firstDeadline, highlight: false },
                    { label: "Days to act", value: `${result.daysToDeadline} days`, highlight: result.daysToDeadline < 90 },
                  ].map(item => (
                    <div key={item.label} className={`rounded-xl border px-4 py-3 ${item.highlight ? scoreBg : "border-neutral-200 bg-white"}`}>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{item.label}</p>
                      <p className={`font-serif text-lg font-bold ${item.highlight ? scoreColour : "text-neutral-950"}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {result.topGap && (
                  <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 mb-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Your biggest gap right now</p>
                    <p className="text-sm text-neutral-800">{result.topGap}</p>
                  </div>
                )}

                <div className="mt-4 rounded-xl border border-neutral-950 bg-neutral-950 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">What happens next</p>
                  <h4 className="mt-2 font-serif text-xl font-bold text-white">
                    {effectiveTier === 67
                      ? "Your readiness gaps are significant. Get the action plan."
                      : "Check your exact scope and get the compliance checklist."}
                  </h4>
                  <button onClick={() => setShowModal(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-neutral-950 transition hover:bg-neutral-100">
                    Get My {effectiveTier === 67 ? "Action" : "Decision"} Pack — £{effectiveTier} →
                  </button>
                  <p className="mt-2 text-xs text-neutral-500">One-time · £{effectiveTier} · No subscription</p>
                </div>
              </>
            )}

            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-500 mb-2">Leave your email and we will send a copy to show your accountant.</p>
              {!emailSent ? (
                <div className="flex gap-2">
                  <input type="email" placeholder="Your email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                  <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">Save</button>
                </div>
              ) : (
                <p className="text-sm font-semibold text-emerald-700">✓ Saved. A copy is on its way.</p>
              )}
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
              <p className="mb-3 text-sm font-semibold text-neutral-900">What is your main income source?</p>
              <div className="space-y-2">
                {[
                  { v: "self_employed", l: "Self-employed / sole trader", s: "Freelancer, contractor, tradesperson" },
                  { v: "landlord", l: "UK landlord / property investor", s: "Residential or commercial rental income" },
                  { v: "both", l: "Both self-employed and landlord", s: "Multiple qualifying income sources" },
                  { v: "other", l: "Other qualifying UK income", s: "Other self-employment income" },
                ].map(o => <Radio key={o.v} name="income_source" value={o.v} current={answers.income_source} label={o.l} sub={o.s} onChange={v => setAnswers(a => ({ ...a, income_source: v }))} />)}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-neutral-900">When are you planning to get MTD-compliant?</p>
              <div className="space-y-2">
                {[
                  { v: "now", l: "Right now — I want to get this sorted immediately" },
                  { v: "before_aug", l: "Before 7 August 2026 — the first UK quarterly deadline" },
                  { v: "this_year", l: "Sometime this year — not urgent yet" },
                  { v: "unsure", l: "Not sure — I need to understand what is required first" },
                ].map(o => <Radio key={o.v} name="timing" value={o.v} current={answers.timing} label={o.l} onChange={v => setAnswers(a => ({ ...a, timing: v }))} />)}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-neutral-900">What software do you want to use for MTD?</p>
              <div className="space-y-2">
                {[
                  { v: "quickbooks", l: "QuickBooks — I already have it or plan to use it" },
                  { v: "xero", l: "Xero — I already have it or plan to use it" },
                  { v: "free", l: "A free option — I want the cheapest route to compliance" },
                  { v: "help_choose", l: "I need help choosing the right software" },
                  { v: "accountant_handles", l: "My accountant handles this for me" },
                ].map(o => <Radio key={o.v} name="software_need" value={o.v} current={answers.software_need} label={o.l} onChange={v => setAnswers(a => ({ ...a, software_need: v }))} />)}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-neutral-900">What concerns you most about MTD?</p>
              <div className="space-y-2">
                {[
                  { v: "penalties", l: "Missing a deadline and getting penalised by HMRC" },
                  { v: "cost", l: "The cost of software and switching" },
                  { v: "time", l: "The time it takes to submit quarterly" },
                  { v: "complexity", l: "Getting the numbers right for HMRC" },
                  { v: "all", l: "All of the above" },
                ].map(o => <Radio key={o.v} name="biggest_concern" value={o.v} current={answers.biggest_concern} label={o.l} onChange={v => setAnswers(a => ({ ...a, biggest_concern: v }))} />)}
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="mb-3 text-sm font-semibold text-neutral-900">Which best describes where you are right now?</p>
              <div className="space-y-2">
                {[
                  { v: "understanding", l: "I need to understand my MTD scope and what is required before doing anything" },
                  { v: "ready", l: "I know I am in scope — I need the full compliance checklist and registration guide" },
                ].map(o => (
                  <Radio key={o.v} name="where_are_you" value={o.v} current={answers.where_are_you} label={o.l}
                    onChange={(v) => {
                      setAnswers(a => ({ ...a, where_are_you: v }));
                      if (v === "understanding") setOverrideTier(27);
                      if (v === "ready") setOverrideTier(67);
                    }} />
                ))}
              </div>
              {answers.where_are_you === "understanding" && <p className="mt-3 text-xs text-blue-800">→ You receive the <strong>Decision Pack (£27)</strong> — scope assessment, software comparison, quarterly deadline calendar.</p>}
              {answers.where_are_you === "ready" && <p className="mt-3 text-xs text-blue-800">→ You receive the <strong>Action Pack (£67)</strong> — registration walkthrough, first submission checklist, digital records template.</p>}
            </div>

            {answersComplete && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 mb-2">{product.name} — what you receive</p>
                <ul className="space-y-1.5">
                  {product.files.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-neutral-700">
                      <span className="mt-0.5 shrink-0 text-emerald-600">✓</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={handleContinueToPayment}
              disabled={!answersComplete || checkoutLoading}
              className="w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-40">
              {checkoutLoading ? "Redirecting to payment..." : `Continue to Payment — £${effectiveTier} →`}
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
                {product.files.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                    <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3">
              <p className="text-xs text-neutral-500">One-time payment · No subscription</p>
              <p className="mt-0.5 font-serif text-xl font-bold text-neutral-950">£{effectiveTier}</p>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => { setShowModal(false); setShowQuestionnaire(true); }}
                className="flex-1 rounded-xl bg-neutral-950 py-3 text-sm font-bold text-white transition hover:bg-neutral-800">
                Continue →
              </button>
              <button onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50">
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
