"use client";

import { useState, useRef, useEffect } from "react";

// ── VERIFIED CONSTANTS ─────────────────────────────────────────────────────
const DAYS_TO_DEADLINE = Math.max(0, Math.floor(
  (new Date("2026-08-07").getTime() - new Date().getTime()) / 86_400_000
));

const INCOME_BRACKETS = [
  { label: "Under £30,000", value: 25_000, inScope2026: false, inScope2027: false, inScope2028: false },
  { label: "£30,000 – £50,000", value: 40_000, inScope2026: false, inScope2027: true, inScope2028: true },
  { label: "£50,000 – £100,000", value: 70_000, inScope2026: true, inScope2027: true, inScope2028: true },
  { label: "£100,000 – £125,140", value: 110_000, inScope2026: true, inScope2027: true, inScope2028: true },
  { label: "Over £125,140", value: 130_000, inScope2026: true, inScope2027: true, inScope2028: true },
];

type SoftwareStatus = "yes_mtd" | "yes_not_mtd" | "spreadsheet" | "paper" | "nothing";
type RecordsStatus = "digital_good" | "digital_basic" | "mixed" | "paper";
type RegistrationStatus = "registered" | "started" | "not_started" | "dont_know";
type AccountantStatus = "yes_sorted" | "yes_not_discussed" | "no_accountant";

interface ReadinessResult {
  score: number;
  band: "not_ready" | "partial" | "mostly" | "ready";
  bandLabel: string;
  bandColour: string;
  topGap: string;
}

function calcReadiness(
  software: SoftwareStatus,
  records: RecordsStatus,
  registration: RegistrationStatus,
  accountant: AccountantStatus,
): ReadinessResult {
  const s = software === "yes_mtd" ? 25 : software === "yes_not_mtd" ? 10 : 0;
  const r = records === "digital_good" ? 25 : records === "digital_basic" ? 15 : records === "mixed" ? 5 : 0;
  const reg = registration === "registered" ? 20 : registration === "started" ? 10 : 0;
  const deadline = 15; // they now know the deadline
  const acc = accountant === "yes_sorted" ? 15 : accountant === "yes_not_discussed" ? 5 : 0;
  const score = s + r + reg + deadline + acc;

  let band: ReadinessResult["band"];
  let bandLabel: string;
  let bandColour: string;

  if (score <= 25) { band = "not_ready"; bandLabel = "Not ready — urgent action needed"; bandColour = "red"; }
  else if (score <= 50) { band = "partial"; bandLabel = "Partially ready — significant gaps"; bandColour = "amber"; }
  else if (score <= 75) { band = "mostly"; bandLabel = "Mostly ready — a few things to fix"; bandColour = "blue"; }
  else { band = "ready"; bandLabel = "Ready — confirm with your accountant"; bandColour = "emerald"; }

  let topGap = "";
  if (software !== "yes_mtd") topGap = "You need MTD-compatible software before your first quarterly deadline.";
  else if (records === "paper" || records === "mixed") topGap = "Your records need to be fully digital before you can file quarterly.";
  else if (registration === "not_started" || registration === "dont_know") topGap = "You need to register for MTD with HMRC before your first deadline.";
  else if (accountant === "no_accountant") topGap = "Consider speaking to an accountant before your first quarterly deadline.";
  else topGap = "Review your setup with your accountant to confirm everything is in order.";

  return { score, band, bandLabel, bandColour, topGap };
}

function Radio({ name, value, current, label, sub, onChange }: {
  name: string; value: string; current: string; label: string; sub?: string; onChange: (v: string) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition ${current === value ? "border-neutral-950 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300"}`}>
      <input type="radio" name={name} checked={current === value} onChange={() => onChange(value)} className="mt-0.5 shrink-0 accent-neutral-950" />
      <div>
        <p className={current === value ? "font-semibold text-neutral-900" : "text-neutral-700"}>{label}</p>
        {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
      </div>
    </label>
  );
}

interface Answers {
  income_source: string;
  timing: string;
  software_need: string;
  biggest_concern: string;
  where_are_you: string;
}

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

export default function MTDScorecardCalculator() {
  // Step tracking
  const [selectedBracket, setSelectedBracket] = useState<number | null>(null);
  const [showReadiness, setShowReadiness] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  // Readiness inputs
  const [software, setSoftware] = useState<SoftwareStatus>("nothing");
  const [records, setRecords] = useState<RecordsStatus>("paper");
  const [registration, setRegistration] = useState<RegistrationStatus>("dont_know");
  const [accountant, setAccountant] = useState<AccountantStatus>("yes_not_discussed");

  // Buy flow
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({ income_source: "", timing: "", software_need: "", biggest_concern: "", where_are_you: "" });
  const [overrideTier, setOverrideTier] = useState<27 | 67 | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);
  const readinessRef = useRef<HTMLDivElement>(null);
  const questionnaireRef = useRef<HTMLDivElement>(null);

  const bracket = selectedBracket !== null ? INCOME_BRACKETS[selectedBracket] : null;
  const readiness = showReadiness ? calcReadiness(software, records, registration, accountant) : null;
  const calcTier: 27 | 67 = readiness && readiness.score <= 50 ? 67 : 27;
  const effectiveTier = overrideTier ?? calcTier;
  const product = PRODUCTS[effectiveTier];
  const answersComplete = Object.values(answers).every(v => v !== "");

  useEffect(() => {
    if (selectedBracket !== null && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    }
  }, [selectedBracket]);

  useEffect(() => {
    if (showReadiness && readinessRef.current) {
      setTimeout(() => readinessRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [showReadiness]);

  useEffect(() => {
    if (showQuestionnaire && questionnaireRef.current) {
      setTimeout(() => questionnaireRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [showQuestionnaire]);

  async function handleBracketSelect(index: number) {
    setSelectedBracket(index);
    setShowReadiness(false);
    setError("");
    try {
      const b = INCOME_BRACKETS[index];
      const res = await fetch("/api/decision-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_slug: "mtd-scorecard",
          source_path: "/uk/check/mtd-scorecard",
          country_code: "UK", currency_code: "GBP", site: "taxchecknow",
          inputs: { income_bracket: b.label, income_value: b.value },
          output: { in_scope_2026: b.inScope2026, in_scope_2027: b.inScope2027 },
          recommended_tier: 27,
          email: email || undefined,
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

  async function handleContinueToPayment() {
    if (!answersComplete || checkoutLoading) return;
    const sid = sessionId || localStorage.getItem("mtd_session_id");
    if (!sid) { setError("Session expired. Run the calculator again."); return; }
    setCheckoutLoading(true); setError("");
    try {
      await fetch("/api/decision-sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sid, tier_intended: effectiveTier, product_key: `uk_${effectiveTier}_mtd_scorecard`, questionnaire_payload: answers, email: email || undefined }) });
      const res = await fetch("/api/create-checkout-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision_session_id: sid, tier: effectiveTier, product_key: `uk_${effectiveTier}_mtd_scorecard`, success_url: `${window.location.origin}/uk/check/mtd-scorecard/success/${effectiveTier === 67 ? "execute" : "prepare"}`, cancel_url: `${window.location.origin}/uk/check/mtd-scorecard` }) });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed.");
      window.location.href = data.url;
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to continue."); setCheckoutLoading(false); }
  }

  const scoreColour = readiness?.bandColour === "red" ? "text-red-700" : readiness?.bandColour === "amber" ? "text-amber-700" : readiness?.bandColour === "blue" ? "text-blue-700" : "text-emerald-700";
  const scoreBg = readiness?.bandColour === "red" ? "border-red-200 bg-red-50" : readiness?.bandColour === "amber" ? "border-amber-200 bg-amber-50" : readiness?.bandColour === "blue" ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50";

  return (
    <div id="calculator" className="scroll-mt-8 space-y-5">

      {/* ── STEP 1: BRACKET BUTTONS ── */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-1">
          Free MTD scope check — United Kingdom
        </p>
        <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-1">
          Are you in scope for Making Tax Digital?
        </h2>
        <p className="text-sm text-neutral-500 mb-6">
          Select your approximate annual income from self-employment or UK property rental.
          PAYE wages do not count toward this threshold.
        </p>

        <div className="space-y-2">
          {INCOME_BRACKETS.map((b, i) => (
            <button
              key={i}
              onClick={() => handleBracketSelect(i)}
              className={`w-full flex items-center justify-between rounded-xl border px-5 py-4 text-left transition ${
                selectedBracket === i
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-neutral-50 text-neutral-900 hover:border-neutral-400 hover:bg-white"
              }`}
            >
              <span className="font-semibold text-sm">{b.label}</span>
              {selectedBracket === i && (
                <span className="font-mono text-xs text-neutral-300">Selected ✓</span>
              )}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs text-neutral-400 text-center">
          Qualifying income = gross self-employment + UK property rental only.
          Based on HMRC.gov.uk · April 2026.
        </p>
      </div>

      {/* ── STEP 2: INSTANT RESULT ── */}
      {bracket && (
        <div ref={resultRef} className={`rounded-2xl border p-6 sm:p-8 ${
          bracket.inScope2026
            ? "border-red-200 bg-red-50"
            : bracket.inScope2027
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
        }`}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
            Your MTD position — {bracket.label}
          </p>

          {bracket.inScope2026 ? (
            <>
              <h3 className="font-serif text-2xl font-bold text-red-900 mb-3">
                You are in scope. Quarterly HMRC filing is mandatory from 6 April 2026.
              </h3>
              <div className="grid gap-3 sm:grid-cols-3 mb-5">
                {[
                  { label: "Your income bracket", value: bracket.label, red: true },
                  { label: "First quarterly deadline", value: "7 August 2026", red: true },
                  { label: "Days remaining", value: `${DAYS_TO_DEADLINE} days`, red: DAYS_TO_DEADLINE < 90 },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border px-4 py-3 ${item.red ? "border-red-200 bg-white" : "border-neutral-200 bg-white"}`}>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{item.label}</p>
                    <p className={`font-serif text-lg font-bold ${item.red ? "text-red-700" : "text-neutral-950"}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-red-200 bg-white px-4 py-3 mb-5 text-sm text-neutral-700">
                <strong className="text-neutral-950">What this means:</strong> Instead of one Self Assessment return per year,
                you must now submit quarterly income and expense updates to HMRC through approved software.
                The traditional HMRC portal is no longer available for you.
                You need MTD-compatible software and digital records in place before 7 August 2026.
              </div>

              {!showReadiness && (
                <button
                  onClick={() => setShowReadiness(true)}
                  className="w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800"
                >
                  Get my full readiness score — how prepared am I? →
                </button>
              )}
            </>
          ) : bracket.inScope2027 ? (
            <>
              <h3 className="font-serif text-2xl font-bold text-amber-900 mb-3">
                Not in scope for 2026 — but the threshold drops to £30,000 in April 2027.
              </h3>
              <p className="text-sm text-amber-900 mb-4">
                Your income of <strong>{bracket.label}</strong> is below the £50,000 threshold for April 2026.
                You do not need to use MTD this year. However, HMRC is reducing the threshold to £30,000 in April 2027 —
                which means you will likely be in scope next year.
                Now is the right time to understand what is coming and choose your software.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 mb-4">
                <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">2026 threshold</p>
                  <p className="font-serif text-lg font-bold text-neutral-400">£50,000 — you are below this</p>
                </div>
                <div className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1">2027 threshold — your date</p>
                  <p className="font-serif text-lg font-bold text-amber-800">£30,000 — you will be above this</p>
                </div>
              </div>
              <button
                onClick={() => setShowReadiness(true)}
                className="w-full rounded-xl border border-neutral-950 bg-white py-4 text-sm font-bold text-neutral-950 transition hover:bg-neutral-50"
              >
                Get my 2027 readiness score — prepare now →
              </button>
            </>
          ) : (
            <>
              <h3 className="font-serif text-2xl font-bold text-emerald-900 mb-3">
                Not currently in scope for Making Tax Digital.
              </h3>
              <p className="text-sm text-emerald-900 mb-4">
                Your income of <strong>{bracket.label}</strong> is below the MTD threshold for 2026 (£50,000),
                2027 (£30,000), and the confirmed 2028 threshold (£20,000).
                You are not required to use MTD under the current confirmed rules.
              </p>
              <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-neutral-600">
                Worth noting: the £20,000 threshold from April 2028 could bring you into scope
                if your income grows. Keep an eye on HMRC communications.
              </div>
            </>
          )}

          {/* Email save */}
          <div className="mt-5 rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500 mb-2">
              Save your result and we will send a copy to show your accountant.
            </p>
            {!emailSent ? (
              <div className="flex gap-2">
                <input type="email" placeholder="Your email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                <button onClick={handleSaveEmail}
                  className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm font-semibold text-emerald-700">✓ Saved. A copy is on its way.</p>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: FULL READINESS QUESTIONS ── */}
      {showReadiness && bracket?.inScope2026 && (
        <div ref={readinessRef} className="scroll-mt-8 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-1">Full readiness assessment</p>
          <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-1">
            How prepared are you for 7 August?
          </h2>
          <p className="text-sm text-neutral-500 mb-6">Four quick questions. Your readiness score appears instantly.</p>

          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">
                Do you have MTD-compatible accounting software?
              </p>
              <div className="space-y-2">
                {[
                  { v: "yes_mtd" as SoftwareStatus, l: "Yes — already using MTD-compatible software", s: "QuickBooks, Xero, FreeAgent, Sage etc" },
                  { v: "yes_not_mtd" as SoftwareStatus, l: "Yes — but not sure if it is MTD-compatible", s: "Need to check with the provider" },
                  { v: "spreadsheet" as SoftwareStatus, l: "I use spreadsheets", s: "May need bridging software to submit to HMRC" },
                  { v: "paper" as SoftwareStatus, l: "Paper records", s: "Will need to switch to digital" },
                  { v: "nothing" as SoftwareStatus, l: "No formal records system", s: "Need to set up from scratch" },
                ].map(o => <Radio key={o.v} name="software" value={o.v} current={software} label={o.l} sub={o.s} onChange={v => setSoftware(v as SoftwareStatus)} />)}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">How are your current records kept?</p>
              <div className="space-y-2">
                {[
                  { v: "digital_good" as RecordsStatus, l: "Fully digital — updated as I go", s: "Ready for quarterly submissions" },
                  { v: "digital_basic" as RecordsStatus, l: "Digital but updated occasionally", s: "Needs to be more regular for MTD" },
                  { v: "mixed" as RecordsStatus, l: "Mix of digital and paper", s: "Needs to be fully digital" },
                  { v: "paper" as RecordsStatus, l: "Mainly paper receipts", s: "Needs full digital overhaul" },
                ].map(o => <Radio key={o.v} name="records" value={o.v} current={records} label={o.l} sub={o.s} onChange={v => setRecords(v as RecordsStatus)} />)}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">Have you registered for MTD with HMRC?</p>
              <div className="space-y-2">
                {[
                  { v: "registered" as RegistrationStatus, l: "Yes — fully registered and set up", s: "MTD credentials and software linked" },
                  { v: "started" as RegistrationStatus, l: "Started but not finished", s: "In progress" },
                  { v: "not_started" as RegistrationStatus, l: "Not started", s: "Need to do this before first deadline" },
                  { v: "dont_know" as RegistrationStatus, l: "I do not know what MTD registration involves", s: "Need guidance" },
                ].map(o => <Radio key={o.v} name="registration" value={o.v} current={registration} label={o.l} sub={o.s} onChange={v => setRegistration(v as RegistrationStatus)} />)}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">Have you spoken to your accountant about MTD?</p>
              <div className="space-y-2">
                {[
                  { v: "yes_sorted" as AccountantStatus, l: "Yes — we have a plan in place", s: "Software chosen, process agreed" },
                  { v: "yes_not_discussed" as AccountantStatus, l: "I have an accountant but we have not discussed MTD", s: "Need to raise it" },
                  { v: "no_accountant" as AccountantStatus, l: "I do not have an accountant", s: "May need one for MTD compliance" },
                ].map(o => <Radio key={o.v} name="accountant" value={o.v} current={accountant} label={o.l} sub={o.s} onChange={v => setAccountant(v as AccountantStatus)} />)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: READINESS SCORE + GAP REVEAL ── */}
      {showReadiness && bracket?.inScope2026 && readiness && (
        <div className={`rounded-2xl border p-6 sm:p-8 ${scoreBg}`}>
          <div className="flex items-center gap-3 mb-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your readiness score</p>
            <span className={`font-mono text-sm font-bold px-2 py-0.5 rounded-full ${
              readiness.bandColour === "red" ? "bg-red-100 text-red-700" :
              readiness.bandColour === "amber" ? "bg-amber-100 text-amber-700" :
              readiness.bandColour === "blue" ? "bg-blue-100 text-blue-700" :
              "bg-emerald-100 text-emerald-700"
            }`}>
              {readiness.score}/100
            </span>
          </div>

          <h3 className={`font-serif text-2xl font-bold text-neutral-950 mb-3 ${scoreColour}`}>
            {readiness.bandLabel}
          </h3>

          {/* THE GAP — this is the sale */}
          <div className="rounded-xl border border-neutral-200 bg-white px-5 py-4 mb-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
              What this actually means
            </p>
            {readiness.band === "not_ready" || readiness.band === "partial" ? (
              <p className="text-sm text-neutral-800 leading-relaxed">
                You expected to keep filing one Self Assessment return per year.
                From April 6, you have <strong>four quarterly deadlines</strong> using software you
                {software === "nothing" ? " do not have yet" : " may not have set up for MTD yet"}.
                Your first deadline is <strong>7 August 2026</strong> — {DAYS_TO_DEADLINE} days away.
                {readiness.topGap && <><br /><br /><strong>Your biggest gap:</strong> {readiness.topGap}</>}
              </p>
            ) : (
              <p className="text-sm text-neutral-800 leading-relaxed">
                You are {readiness.band === "mostly" ? "mostly" : "well"} prepared for MTD.
                {readiness.topGap && <> {readiness.topGap}</>}
                {" "}Your first deadline is <strong>7 August 2026</strong> — {DAYS_TO_DEADLINE} days away.
                Confirm your setup with your accountant before that date.
              </p>
            )}
          </div>

          {/* BUY */}
          <div className="rounded-xl border border-neutral-950 bg-neutral-950 p-5 mb-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">What happens next</p>
            <h4 className="mt-2 font-serif text-xl font-bold text-white">
              {effectiveTier === 67
                ? "Your readiness gaps are significant. Get the full action plan before 7 August."
                : "Get your personal scope assessment and compliance checklist."}
            </h4>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <button onClick={() => setShowModal(true)}
                className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-neutral-950 transition hover:bg-neutral-100">
                Get My {effectiveTier === 67 ? "Action" : "Decision"} Pack — £{effectiveTier} →
              </button>
              <p className="text-xs text-neutral-500">One-time · No subscription</p>
            </div>
          </div>

          {/* Tier switcher */}
          <div className="flex gap-3">
            {([27, 67] as const).map(t => (
              <button key={t} onClick={() => setOverrideTier(t)}
                className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition ${effectiveTier === t ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"}`}>
                £{t} {t === 27 ? "Decision" : "Action"} Pack
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── QUESTIONNAIRE ── */}
      {showQuestionnaire && product && (
        <div ref={questionnaireRef} className="scroll-mt-8 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-1">{product.name} — £{effectiveTier}</p>
          <h3 className="font-serif text-2xl font-bold text-neutral-950 mb-2">Five quick questions</h3>
          <p className="text-sm text-neutral-500 mb-6">Personalises the documents you receive.</p>

          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-semibold">What is your main income source?</p>
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
              <p className="mb-3 text-sm font-semibold">When are you planning to get compliant?</p>
              <div className="space-y-2">
                {[
                  { v: "now", l: "Right now — sorting this immediately" },
                  { v: "before_aug", l: "Before 7 August 2026" },
                  { v: "this_year", l: "Sometime this year" },
                  { v: "unsure", l: "Not sure — need to understand what is required first" },
                ].map(o => <Radio key={o.v} name="timing" value={o.v} current={answers.timing} label={o.l} onChange={v => setAnswers(a => ({ ...a, timing: v }))} />)}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">What software do you want to use for MTD?</p>
              <div className="space-y-2">
                {[
                  { v: "quickbooks", l: "QuickBooks" },
                  { v: "xero", l: "Xero" },
                  { v: "free", l: "A free option — cheapest route to compliance" },
                  { v: "help_choose", l: "I need help choosing" },
                  { v: "accountant_handles", l: "My accountant handles this" },
                ].map(o => <Radio key={o.v} name="software_need" value={o.v} current={answers.software_need} label={o.l} onChange={v => setAnswers(a => ({ ...a, software_need: v }))} />)}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold">What concerns you most about MTD?</p>
              <div className="space-y-2">
                {[
                  { v: "penalties", l: "Missing a deadline and getting penalised" },
                  { v: "cost", l: "The cost of software and switching" },
                  { v: "time", l: "The time it takes to submit quarterly" },
                  { v: "complexity", l: "Getting the numbers right for HMRC" },
                  { v: "all", l: "All of the above" },
                ].map(o => <Radio key={o.v} name="biggest_concern" value={o.v} current={answers.biggest_concern} label={o.l} onChange={v => setAnswers(a => ({ ...a, biggest_concern: v }))} />)}
              </div>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="mb-3 text-sm font-semibold">Which best describes where you are?</p>
              <div className="space-y-2">
                {[
                  { v: "understanding", l: "I need to understand my MTD scope before doing anything" },
                  { v: "ready", l: "I know I am in scope — I need the full compliance checklist" },
                ].map(o => (
                  <Radio key={o.v} name="where_are_you" value={o.v} current={answers.where_are_you} label={o.l}
                    onChange={v => { setAnswers(a => ({ ...a, where_are_you: v })); if (v === "understanding") setOverrideTier(27); if (v === "ready") setOverrideTier(67); }} />
                ))}
              </div>
              {answers.where_are_you === "understanding" && <p className="mt-3 text-xs text-blue-800">→ <strong>Decision Pack (£27)</strong> — scope assessment, software comparison, deadline calendar.</p>}
              {answers.where_are_you === "ready" && <p className="mt-3 text-xs text-blue-800">→ <strong>Action Pack (£67)</strong> — registration walkthrough, first submission checklist, records template.</p>}
            </div>

            {answersComplete && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 mb-2">{product.name} — what you receive</p>
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

      {/* ── MODAL ── */}
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
