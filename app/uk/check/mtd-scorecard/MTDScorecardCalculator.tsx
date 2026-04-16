"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── VERIFIED CONSTANTS — HMRC.gov.uk April 2026 ───────────────────────────
const FIRST_DEADLINE = new Date("2026-08-07T00:00:00.000+01:00");
const DAYS_TO_DEADLINE = Math.max(
  0,
  Math.floor((FIRST_DEADLINE.getTime() - new Date().getTime()) / 86_400_000)
);

// Brackets aligned to confirmed HMRC thresholds:
// 2026: £50,000 | 2027: £30,000 | 2028: £20,000
const INCOME_BRACKETS = [
  { label: "Under £20,000",        value: 15_000, inScope2026: false, inScope2027: false, inScope2028: false },
  { label: "£20,000 – £30,000",    value: 25_000, inScope2026: false, inScope2027: false, inScope2028: true  },
  { label: "£30,000 – £50,000",    value: 40_000, inScope2026: false, inScope2027: true,  inScope2028: true  },
  { label: "£50,000 – £100,000",   value: 70_000, inScope2026: true,  inScope2027: true,  inScope2028: true  },
  { label: "Over £100,000",        value: 130_000, inScope2026: true,  inScope2027: true,  inScope2028: true  },
] as const;

type SoftwareStatus   = "yes_mtd" | "yes_not_mtd" | "spreadsheet" | "paper" | "nothing";
type RecordsStatus    = "digital_good" | "digital_basic" | "mixed" | "paper";
type RegistrationStatus = "registered" | "started" | "not_started" | "dont_know";
type AccountantStatus = "yes_sorted" | "yes_not_discussed" | "no_accountant";
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
}

interface Answers {
  income_source: string;
  timing: string;
  software_need: string;
  biggest_concern: string;
  where_are_you: string;
}

const PRODUCTS: Record<PackTier, { name: string; tagline: string; headline: string; bullets: string[]; cta: string }> = {
  27: {
    name: "MTD-50 Decision Pack",
    tagline: "Am I in scope? What do I need to do?",
    headline: "Get a clear scope decision and the exact checklist for your first HMRC deadline.",
    bullets: [
      "Personal scope decision using your qualifying income",
      "HMRC registration steps in plain English",
      "MTD software shortlist — free vs paid for your situation",
      "Quarterly deadline calendar — what to file and when",
      "Brief for your accountant before the first submission",
    ],
    cta: "Get My Decision Pack — £27 →",
  },
  67: {
    name: "MTD-50 Action Pack",
    tagline: "I am in scope — give me everything to get compliant.",
    headline: "Turn your readiness score into a step-by-step compliance plan before 7 August 2026.",
    bullets: [
      "Everything in the Decision Pack",
      "Your biggest compliance gap and how to fix it first",
      "Software, records and registration changes to make now",
      "First quarterly submission checklist and accountant briefing notes",
      "Digital records template (Excel/Google Sheets compatible)",
    ],
    cta: "Get My Action Pack — £67 →",
  },
};

function calcReadiness(
  software: SoftwareStatus,
  records: RecordsStatus,
  registration: RegistrationStatus,
  accountant: AccountantStatus
): ReadinessResult {
  const s = software === "yes_mtd" ? 25 : software === "yes_not_mtd" ? 12 : software === "spreadsheet" ? 8 : 0;
  const r = records === "digital_good" ? 25 : records === "digital_basic" ? 15 : records === "mixed" ? 6 : 0;
  const reg = registration === "registered" ? 20 : registration === "started" ? 10 : 0;
  const acc = accountant === "yes_sorted" ? 15 : accountant === "yes_not_discussed" ? 5 : 0;
  const awareness = 15;
  const score = s + r + reg + acc + awareness;

  let band: ReadinessResult["band"];
  let bandLabel: string;
  let bandColour: ReadinessResult["bandColour"];

  if (score <= 25)      { band = "not_ready"; bandLabel = "Not ready — urgent action needed";       bandColour = "red"; }
  else if (score <= 50) { band = "partial";   bandLabel = "Partially ready — significant gaps";     bandColour = "amber"; }
  else if (score <= 75) { band = "mostly";    bandLabel = "Mostly ready — a few things to fix";     bandColour = "blue"; }
  else                  { band = "ready";     bandLabel = "Ready — confirm with your accountant";   bandColour = "emerald"; }

  let topGapTitle = "";
  let topGap = "";
  let firstAction = "";

  if (software !== "yes_mtd") {
    topGapTitle = "Software gap";
    topGap = "You need HMRC-compatible software before your first quarterly submission. This is the most common reason people miss the August deadline.";
    firstAction = "Confirm your MTD software now — QuickBooks, Xero, FreeAgent or a bridging option. This is the single most important thing to fix.";
  } else if (records === "paper" || records === "mixed") {
    topGapTitle = "Records gap";
    topGap = "MTD requires digital record-keeping from the start of the tax year. Paper and mixed records need converting before quarterly filing is realistic.";
    firstAction = "Move income and expense records into one digital system before worrying about filing. Without this, quarterly submission is not possible.";
  } else if (registration === "not_started" || registration === "dont_know") {
    topGapTitle = "Registration gap";
    topGap = "You have not completed MTD registration with HMRC. Registration must be done before you can file quarterly updates.";
    firstAction = "Clarify whether you or your accountant will complete HMRC registration, then do it before July 2026.";
  } else if (accountant === "no_accountant") {
    topGapTitle = "Support gap";
    topGap = "You do not have professional support in place for the transition. MTD changes how your accountant interacts with HMRC.";
    firstAction = "Decide whether you will file yourself or use an accountant. If self-filing, confirm your software has an end-to-end MTD journey.";
  } else {
    topGapTitle = "Final confirmation needed";
    topGap = "Your setup looks strong. The remaining job is a pre-submission check to make sure software, registration and process are all linked correctly.";
    firstAction = "Run a final end-to-end test with your accountant before August 2026. Confirm software is registered and linked to HMRC.";
  }

  const urgencyText = band === "ready"
    ? `You are in a strong position, but ${DAYS_TO_DEADLINE} days passes quickly when quarterly filing replaces your old annual routine.`
    : `You are in scope and the first HMRC quarterly deadline is in ${DAYS_TO_DEADLINE} days. Waiting makes this harder, not easier.`;

  const riskText = band === "ready"
    ? "Your main risk is assuming you are done and missing a technical setup issue before the first filing."
    : "Your main risk is entering August without software, digital records, or HMRC registration fully sorted.";

  const whyNow = band === "ready"
    ? "This is now about reducing avoidable friction before your first quarterly filing."
    : "HMRC has already switched the rule on. The question is whether your setup is ready before the first deadline.";

  return { score, band, bandLabel, bandColour, topGapTitle, topGap, firstAction, urgencyText, riskText, whyNow };
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
  const [selectedBracket, setSelectedBracket] = useState<number | null>(null);
  const [showReadiness, setShowReadiness] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [software, setSoftware] = useState<SoftwareStatus>("nothing");
  const [records, setRecords] = useState<RecordsStatus>("paper");
  const [registration, setRegistration] = useState<RegistrationStatus>("dont_know");
  const [accountant, setAccountant] = useState<AccountantStatus>("yes_not_discussed");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({ income_source: "", timing: "", software_need: "", biggest_concern: "", where_are_you: "" });
  const [overrideTier, setOverrideTier] = useState<PackTier | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");

  const resultRef = useRef<HTMLDivElement>(null);
  const readinessRef = useRef<HTMLDivElement>(null);
  const questionnaireRef = useRef<HTMLDivElement>(null);

  const bracket = selectedBracket !== null ? INCOME_BRACKETS[selectedBracket] : null;

  const readiness = useMemo(() => {
    if (!showReadiness || !bracket) return null;
    return calcReadiness(software, records, registration, accountant);
  }, [showReadiness, bracket, software, records, registration, accountant]);

  const calculatedTier: PackTier = readiness && bracket?.inScope2026 ? (readiness.score <= 50 ? 67 : 27) : 27;
  const effectiveTier = overrideTier ?? calculatedTier;
  const selectedProduct = PRODUCTS[effectiveTier];
  const answersComplete = Object.values(answers).every(v => v !== "");

  const answerSummary = useMemo(() => {
    if (!bracket) return null;
    if (bracket.inScope2026) return {
      status: "REQUIRED — YOU ARE IN SCOPE",
      statusClass: "text-red-700",
      headline: "Making Tax Digital for Income Tax applies to you from 6 April 2026.",
      explanation: `Your income bracket (${bracket.label}) exceeds the £50,000 qualifying income threshold. HMRC requires quarterly digital filing from April 2026. Your first quarterly deadline is 7 August 2026.`,
      panelClass: "border-red-200 bg-red-50",
      softLanding: true,
    };
    if (bracket.inScope2027) return {
      status: "UPCOMING — IN SCOPE FROM APRIL 2027",
      statusClass: "text-amber-700",
      headline: "You are not in scope for 2026, but the threshold drops to £30,000 in April 2027.",
      explanation: `Your income bracket (${bracket.label}) is below the £50,000 threshold for 2026. However, HMRC is reducing this to £30,000 in April 2027. This is a one-year window to prepare without pressure.`,
      panelClass: "border-amber-200 bg-amber-50",
      softLanding: false,
    };
    if (bracket.inScope2028) return {
      status: "WATCH APRIL 2028",
      statusClass: "text-blue-700",
      headline: "Not in scope for 2026 or 2027. The threshold drops to £20,000 in April 2028.",
      explanation: `Your income bracket (${bracket.label}) is below the 2026 (£50,000) and 2027 (£30,000) thresholds. HMRC has confirmed a further drop to £20,000 from April 2028.`,
      panelClass: "border-blue-200 bg-blue-50",
      softLanding: false,
    };
    return {
      status: "NOT CURRENTLY REQUIRED",
      statusClass: "text-emerald-700",
      headline: "You are below all confirmed MTD thresholds for 2026, 2027 and 2028.",
      explanation: `Your income bracket (${bracket.label}) is below the confirmed thresholds. You are not required to use Making Tax Digital under the current confirmed rules.`,
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
    if (showQuestionnaire && questionnaireRef.current) setTimeout(() => questionnaireRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [showQuestionnaire]);

  async function handleBracketSelect(index: number) {
    setSelectedBracket(index);
    setShowReadiness(false);
    setShowQuestionnaire(false);
    setOverrideTier(null);
    setError("");
    try {
      const b = INCOME_BRACKETS[index];
      const res = await fetch("/api/decision-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  async function handleContinueToPayment() {
    if (!answersComplete || checkoutLoading) return;
    const sid = sessionId || localStorage.getItem("mtd_session_id");
    if (!sid) { setError("Session expired. Run the calculator again."); return; }
    setCheckoutLoading(true); setError("");
    try {
      await fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sid, tier_intended: effectiveTier, product_key: `uk_${effectiveTier}_mtd_scorecard`,
          questionnaire_payload: answers, email: email || undefined,
          readiness_payload: readiness ? { score: readiness.score, band: readiness.band, top_gap_title: readiness.topGapTitle, top_gap: readiness.topGap } : undefined,
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
    <div id="calculator" className="scroll-mt-8 space-y-5">

      {/* STEP 1: INCOME BRACKETS */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-neutral-400">Free UK MTD scope check</p>
        <h2 className="mb-2 font-serif text-2xl font-bold text-neutral-950">Check whether Making Tax Digital applies to you</h2>
        <p className="mb-4 text-sm text-neutral-600">
          Select your approximate annual qualifying income from <strong>self-employment and UK property rental only</strong>.
          PAYE wages, dividends, savings interest and pension income do not count toward this threshold.
        </p>

        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">Quick rule — HMRC confirmed</p>
          <p className="mt-1 text-sm text-blue-900">
            From <strong>6 April 2026</strong>, MTD applies to qualifying income over <strong>£50,000</strong>.
            Threshold drops to <strong>£30,000</strong> in 2027 and <strong>£20,000</strong> in 2028.
          </p>
        </div>

        <div className="space-y-2">
          {INCOME_BRACKETS.map((b, i) => {
            const selected = selectedBracket === i;
            return (
              <button key={b.label} onClick={() => handleBracketSelect(i)}
                className={`flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left transition ${selected ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50 hover:border-neutral-400 hover:bg-white text-neutral-900"}`}>
                <span className="text-sm font-semibold">{b.label}</span>
                {selected && <span className="font-mono text-xs text-neutral-300">Selected ✓</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-xs text-neutral-400">
          Based on HMRC.gov.uk guidance · qualifying income = gross self-employment + UK property rental only
        </p>
      </div>

      {/* STEP 2: INSTANT RESULT */}
      {bracket && answerSummary && (
        <div ref={resultRef} className={`rounded-2xl border p-6 sm:p-8 ${answerSummary.panelClass}`}>
          <p className={`mb-1 font-mono text-sm font-bold uppercase tracking-widest ${answerSummary.statusClass}`}>
            {answerSummary.status}
          </p>
          <h3 className="mb-3 font-serif text-2xl font-bold text-neutral-950">{answerSummary.headline}</h3>
          <p className="mb-4 text-sm leading-relaxed text-neutral-700">{answerSummary.explanation}</p>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
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

          {/* Soft landing — REQUIRED only */}
          {answerSummary.softLanding && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-neutral-700">
              <strong className="text-neutral-950">HMRC soft landing (2026-27 only):</strong>{" "}
              HMRC will not apply late quarterly submission penalty points in the first year.
              But the filing obligation still exists, and late payment penalties are separate and still apply.
              Use this grace period to build your compliance setup — not to delay.
            </div>
          )}

          {/* Email save */}
          <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
            <p className="mb-2 text-xs text-neutral-500">Save your result to show your accountant.</p>
            {!emailSent ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-neutral-400" />
                <button onClick={handleSaveEmail} className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">Save result</button>
              </div>
            ) : <p className="text-sm font-semibold text-emerald-700">✓ Saved. A copy is on its way.</p>}
          </div>

          {(bracket.inScope2026 || bracket.inScope2027) && (
            <button onClick={() => setShowReadiness(true)}
              className={`w-full rounded-xl py-4 text-sm font-bold transition ${bracket.inScope2026 ? "bg-neutral-950 text-white hover:bg-neutral-800" : "border border-neutral-950 bg-white text-neutral-950 hover:bg-neutral-50"}`}>
              {bracket.inScope2026 ? "Get my full readiness score →" : "Get my 2027 readiness score →"}
            </button>
          )}
        </div>
      )}

      {/* STEP 3: READINESS QUESTIONS */}
      {showReadiness && bracket && (bracket.inScope2026 || bracket.inScope2027) && (
        <div ref={readinessRef} className="scroll-mt-8 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-neutral-400">Readiness assessment</p>
          <h2 className="mb-2 font-serif text-2xl font-bold text-neutral-950">How prepared are you for MTD?</h2>
          <p className="mb-6 text-sm text-neutral-500">Four questions. Your score appears instantly.</p>
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">Do you have MTD-compatible accounting software?</p>
              <div className="space-y-2">
                {[
                  { v: "yes_mtd",     l: "Yes — MTD-compatible software",       s: "QuickBooks, Xero, FreeAgent, Sage" },
                  { v: "yes_not_mtd", l: "Yes — not sure if MTD-compatible",     s: "Need to confirm with the provider" },
                  { v: "spreadsheet", l: "Spreadsheets",                         s: "May need bridging software" },
                  { v: "paper",       l: "Paper records",                        s: "Will need to go digital" },
                  { v: "nothing",     l: "No records system",                    s: "Needs setting up from scratch" },
                ].map(o => <Radio key={o.v} name="software" value={o.v} current={software} label={o.l} sub={o.s} onChange={v => setSoftware(v as SoftwareStatus)} />)}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">How are your records currently kept?</p>
              <div className="space-y-2">
                {[
                  { v: "digital_good",  l: "Fully digital — updated as I go",  s: "Ready for quarterly submissions" },
                  { v: "digital_basic", l: "Digital but occasionally updated",  s: "Needs to be more regular" },
                  { v: "mixed",         l: "Mix of digital and paper",           s: "Needs to be fully digital" },
                  { v: "paper",         l: "Mainly paper receipts",              s: "Needs full digital overhaul" },
                ].map(o => <Radio key={o.v} name="records" value={o.v} current={records} label={o.l} sub={o.s} onChange={v => setRecords(v as RecordsStatus)} />)}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">Have you registered for MTD with HMRC?</p>
              <div className="space-y-2">
                {[
                  { v: "registered",   l: "Yes — fully registered",                 s: "Software linked, process understood" },
                  { v: "started",      l: "Started but not finished",                s: "In progress" },
                  { v: "not_started",  l: "Not started",                             s: "Needs to happen before first filing" },
                  { v: "dont_know",    l: "I do not know what registration involves", s: "Need clarity" },
                ].map(o => <Radio key={o.v} name="registration" value={o.v} current={registration} label={o.l} sub={o.s} onChange={v => setRegistration(v as RegistrationStatus)} />)}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-neutral-800">Have you spoken to your accountant about MTD?</p>
              <div className="space-y-2">
                {[
                  { v: "yes_sorted",           l: "Yes — we have a plan",                           s: "Software chosen, process agreed" },
                  { v: "yes_not_discussed",    l: "I have an accountant but we have not discussed", s: "Need to raise it" },
                  { v: "no_accountant",        l: "I do not have an accountant",                    s: "May need support for compliance" },
                ].map(o => <Radio key={o.v} name="accountant" value={o.v} current={accountant} label={o.l} sub={o.s} onChange={v => setAccountant(v as AccountantStatus)} />)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: READINESS RESULT + GAP + BUY */}
      {showReadiness && readiness && (
        <div className={`rounded-2xl border p-6 sm:p-8 ${readinessPanel}`}>
          <div className="mb-3 flex items-center gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your readiness score</p>
            <span className={`rounded-full px-2 py-0.5 font-mono text-sm font-bold ${readinessBadge}`}>{readiness.score}/100</span>
          </div>
          <h3 className="mb-4 font-serif text-2xl font-bold text-neutral-950">{readiness.bandLabel}</h3>

          {/* THE GAP — this is the sale */}
          <div className="mb-5 rounded-xl border border-neutral-200 bg-white px-5 py-4 space-y-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">What this actually means</p>
              <p className="text-sm leading-relaxed text-neutral-800">{readiness.whyNow} {readiness.urgencyText}</p>
            </div>
            <div className="border-t border-neutral-100 pt-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-red-600 mb-1">Biggest gap — {readiness.topGapTitle}</p>
              <p className="text-sm text-neutral-800">{readiness.topGap}</p>
            </div>
            <div className="border-t border-neutral-100 pt-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Main risk</p>
              <p className="text-sm text-neutral-700">{readiness.riskText}</p>
            </div>
            <div className="border-t border-neutral-100 pt-3 rounded-lg bg-neutral-50 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-1">First action</p>
              <p className="text-sm font-semibold text-neutral-900">{readiness.firstAction}</p>
            </div>
          </div>

          {/* Tier switcher */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            {([27, 67] as const).map(t => {
              const active = effectiveTier === t;
              const p = PRODUCTS[t];
              return (
                <button key={t} onClick={() => setOverrideTier(t)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-left transition ${active ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${active ? "bg-white/10 text-white" : "bg-neutral-100 text-neutral-700"}`}>£{t}</span>
                    <span className="text-sm font-semibold">{p.name}</span>
                  </div>
                  <p className={`text-xs ${active ? "text-neutral-300" : "text-neutral-500"}`}>{p.tagline}</p>
                </button>
              );
            })}
          </div>

          {/* Product + buy */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Recommended next step</p>
            <h4 className="mt-2 font-serif text-xl font-bold text-neutral-950">{selectedProduct.headline}</h4>
            <ul className="mt-4 space-y-2">
              {selectedProduct.bullets.map(b => (
                <li key={b} className="flex items-start gap-2 text-sm text-neutral-700">
                  <span className="mt-0.5 text-neutral-400">•</span><span>{b}</span>
                </li>
              ))}
            </ul>
            {!showQuestionnaire && (
              <button onClick={() => setShowQuestionnaire(true)}
                className="mt-5 w-full rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800">
                {selectedProduct.cta}
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
        </div>
      )}

      {/* STEP 5: QUESTIONNAIRE */}
      {showQuestionnaire && readiness && (
        <div ref={questionnaireRef} className="scroll-mt-8 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-neutral-400">Personalise your pack</p>
          <h2 className="mb-2 font-serif text-2xl font-bold text-neutral-950">Final questions before checkout</h2>
          <p className="mb-6 text-sm text-neutral-500">These answers personalise the documents you receive after payment.</p>

          <div className="space-y-5">
            {[
              { label: "What is your main income source?", key: "income_source", options: [["sole_trader","Sole trader"],["landlord","UK landlord"],["both","Both self-employment and rental"]] },
              { label: "When do you want to be fully ready?", key: "timing", options: [["asap","As soon as possible"],["before_august","Before 7 August 2026"],["before_2027","Before April 2027"]] },
              { label: "What do you need most from software?", key: "software_need", options: [["simple","Simple and cheap"],["accountant","Easy accountant collaboration"],["banking","Bank feed and automation"],["unsure","Not sure yet"]] },
              { label: "What is your biggest concern right now?", key: "biggest_concern", options: [["software","Choosing software"],["records","Getting records digital"],["registration","HMRC registration"],["deadlines","Missing deadlines"]] },
              { label: "Where are you in the process today?", key: "where_are_you", options: [["just_found_out","I just found out about MTD"],["researching","I am researching options"],["starting_setup","I have started setup"],["mostly_ready","I am mostly ready"]] },
            ].map(field => (
              <div key={field.key}>
                <label className="mb-2 block text-sm font-semibold text-neutral-800">{field.label}</label>
                <select value={answers[field.key as keyof Answers]}
                  onChange={e => setAnswers(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400">
                  <option value="">Select…</option>
                  {field.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">What you are buying</p>
            <p className="mt-1 text-sm text-blue-900">
              {effectiveTier === 67
                ? "A full action plan to close your readiness gaps before the first HMRC quarterly deadline."
                : "A scope decision pack telling you exactly what applies to you and what to do next."}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button onClick={handleContinueToPayment} disabled={!answersComplete || checkoutLoading}
              className="flex-1 rounded-xl bg-neutral-950 py-4 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">
              {checkoutLoading ? "Redirecting to checkout…" : selectedProduct.cta}
            </button>
            <button onClick={() => setShowQuestionnaire(false)}
              className="rounded-xl border border-neutral-200 bg-white px-6 py-4 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
              Back
            </button>
          </div>
          {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
