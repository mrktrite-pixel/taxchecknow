"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { generateMTDCalendar, downloadICS } from "@/lib/generate-ics";

const FEATURED_FILES = [
  { num: "01", name: "Your MTD Scope Assessment",        desc: "Your exact compliance position — confirmed in writing.", url: "/files/uk/01-scope-assessment" },
  { num: "02", name: "Your Software Recommendation",     desc: "The right MTD software for your specific situation.", url: "/files/uk/02-software-recommendation" },
  { num: "03", name: "Your HMRC Registration Steps",     desc: "Step-by-step registration walkthrough.", url: "/files/uk/03-registration-steps" },
  { num: "04", name: "Your Deadline Calendar",           desc: "Every filing date for 2026-27 — add them now.", url: "/files/uk/04-deadline-calendar" },
  { num: "05", name: "Your Accountant Brief",            desc: "Print and take to your next meeting.", url: "/files/uk/05-accountant-brief" },
];

interface Assessment {
  status: string;
  bracket: string;
  scopeConfirmed: string;
  firstAction: string;
  firstActionLink: string;
  softwareRec: string;
  softwareWhy: string;
  softwareLink: string;
  accountantQuestions: string[];
}

export default function SuccessPrepare() {
  const [firstName, setFirstName] = useState("there");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [calDone, setCalDone] = useState(false);

  const days = Math.max(0, Math.floor(
    (new Date("2026-08-07").getTime() - Date.now()) / 86_400_000
  ));

  useEffect(() => {
    init();
  }, []);

  async function init() {
    // Pull name from Stripe session
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    let name = "there";
    if (sessionId) {
      try {
        const res = await fetch(`/api/get-session?id=${sessionId}`);
        const data = await res.json();
        name = data.firstName || "there";
        setFirstName(name);
      } catch { /* non-fatal */ }
    }
    await generateAssessment(name);
  }

  async function generateAssessment(name: string) {
    setLoading(true);
    try {
      const software = sessionStorage.getItem("mtd_software") || "unknown";
      const records  = sessionStorage.getItem("mtd_records")  || "unknown";
      const reg      = sessionStorage.getItem("mtd_registration") || "unknown";
      const bracket  = sessionStorage.getItem("mtd_bracket")  || "£50,000 – £100,000";
      const source   = sessionStorage.getItem("mtd_income_source") || "sole trader";

      const prompt = `You are a UK tax compliance expert writing a personalised MTD assessment for ${name}.

Their answers:
- Name: ${name}
- Income bracket: ${bracket}
- Income source: ${source}
- Software status: ${software}
- Records status: ${records}
- Registration status: ${reg}

Write a personal MTD compliance assessment. Respond ONLY with JSON, no markdown:

{
  "status": "REQUIRED — IN SCOPE FROM 6 APRIL 2026",
  "bracket": "${bracket}",
  "scopeConfirmed": "2-3 sentences confirming ${name}'s MTD position using their name and source. Reference the specific bracket. Be direct and reassuring.",
  "firstAction": "One specific action sentence for ${name} based on their registration status. Start with a verb. Include a deadline.",
  "firstActionLink": "https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax",
  "softwareRec": "Single best software name for their situation",
  "softwareWhy": "2 sentences why this specific software suits ${name}'s situation — reference their software and records answers",
  "softwareLink": "direct URL to the software signup page",
  "accountantQuestions": [
    "specific question 1 for ${name}'s situation",
    "specific question 2 for ${name}'s situation",
    "specific question 3 for ${name}'s situation"
  ]
}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setAssessment(parsed);
    } catch {
      setAssessment({
        status: "REQUIRED — IN SCOPE FROM 6 APRIL 2026",
        bracket: sessionStorage.getItem("mtd_bracket") || "£50,000 – £100,000",
        scopeConfirmed: `${name}, your qualifying income places you in scope for Making Tax Digital from 6 April 2026. Your first quarterly submission deadline is 7 August 2026. You must use HMRC-approved software — the HMRC portal is not available for MTD taxpayers.`,
        firstAction: "Register for MTD with HMRC today — takes 10 minutes and must be done before 7 August 2026.",
        firstActionLink: "https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax",
        softwareRec: "FreeAgent",
        softwareWhy: "FreeAgent is HMRC-approved, built specifically for sole traders and landlords, and free if you bank with NatWest, RBS or Mettle. It handles quarterly submissions in one click.",
        softwareLink: "https://www.freeagent.com",
        accountantQuestions: [
          "Have you registered me for MTD — or do I need to do this myself?",
          "Which MTD software do you recommend for my situation?",
          "What is my biggest compliance risk before 7 August 2026?",
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() { window.print(); }

  function handleCalendar() {
    const ics = generateMTDCalendar({ firstName, tier: "67" });
    downloadICS(ics, "mtd-deadlines-2026.ics");
    setCalDone(true);
  }

  async function handleCopyQuestions() {
    if (!assessment) return;
    const text = assessment.accountantQuestions
      .map((q, i) => `${i + 1}. "${q}"`)
      .join("\n");
    await navigator.clipboard.writeText(
      `MTD questions for my accountant:\n\n${text}\n\n— Prepared by TaxCheckNow`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const greeting = firstName !== "there" ? `${firstName}, your` : "Your";
  const greetingCap = firstName !== "there" ? `${firstName}` : "Your";

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { font-size: 12px; color: #000; }
          a[href]:after {
            content: " (" attr(href) ")";
            font-size: 9px;
            color: #555;
            word-break: break-all;
          }
          a[href^="#"]:after,
          a[href^="javascript"]:after { content: ""; }
          .rounded-2xl, .rounded-xl { border-radius: 8px !important; }
          .space-y-5 > * { margin-bottom: 12px !important; }
        }
      `}</style>

      {/* NAV */}
      <nav className="no-print border-b border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
          <span className="font-mono text-xs text-neutral-400">United Kingdom · MTD 2026</span>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-5">

        {/* ── SECTION 1: CONFIRMATION + PDF ───────────────────────────── */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Payment confirmed · £67</p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">
                {greetingCap} MTD Compliance Assessment
              </h1>
              <p className="mt-1 text-sm text-emerald-800">
                A personal assessment built around your circumstances — not a generic guide.
              </p>
            </div>
            <button onClick={handlePrint}
              className="no-print shrink-0 rounded-xl border-2 border-neutral-950 bg-white px-4 py-2.5 text-sm font-bold text-neutral-950 hover:bg-neutral-950 hover:text-white transition whitespace-nowrap">
              ⬇ Save as PDF
            </button>
          </div>
        </div>

        {/* DEADLINE BANNER */}
        <div className="rounded-xl bg-red-700 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">🔴 {days} days to your first MTD deadline</span>
          <span className="font-mono text-sm font-bold text-white">7 August 2026</span>
        </div>

        {/* ── SECTION 2: YOUR MTD POSITION ────────────────────────────── */}
        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-600">Preparing {greeting} assessment…</p>
            <p className="mt-1 text-xs text-neutral-400">Building around your specific answers</p>
          </div>
        ) : assessment && (
          <>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your MTD position</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-3 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-red-600">Status</p>
                  <p className="mt-1 text-xs font-bold text-red-800">REQUIRED</p>
                </div>
                <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-3 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">Bracket</p>
                  <p className="mt-1 text-xs font-bold text-neutral-800">{assessment.bracket}</p>
                </div>
                <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-3 text-center">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">First deadline</p>
                  <p className="mt-1 text-xs font-bold text-neutral-800">7 Aug 2026</p>
                </div>
              </div>

              {/* ── SECTION 3: SCOPE CONFIRMED ── */}
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-4">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-blue-700">Your scope — confirmed</p>
                <p className="text-sm leading-relaxed text-blue-900">{assessment.scopeConfirmed}</p>
              </div>
            </div>

            {/* ── SECTION 4: ONE FIRST ACTION ─────────────────────────── */}
            <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your one action — do this today</p>
              <p className="mb-4 text-base font-bold text-white leading-relaxed">{assessment.firstAction}</p>
              <a href={assessment.firstActionLink} target="_blank" rel="noopener noreferrer"
                className="no-print inline-block rounded-xl bg-white px-5 py-3 text-sm font-bold text-neutral-950 hover:bg-neutral-100 transition">
                Register at HMRC.gov.uk →
              </a>
              <p className="mt-3 text-xs text-neutral-500">
                See File 03 in your documents for the full step-by-step walkthrough.
              </p>
            </div>

            {/* ── SECTION 5: SOFTWARE RECOMMENDATION ──────────────────── */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your software recommendation</p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{assessment.softwareRec}</h2>
              <p className="mb-4 text-sm leading-relaxed text-neutral-600">{assessment.softwareWhy}</p>
              <div className="flex gap-3 flex-wrap">
                <a href={assessment.softwareLink} target="_blank" rel="noopener noreferrer"
                  className="no-print rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 transition">
                  Start free trial →
                </a>
                <a href="https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax"
                  target="_blank" rel="noopener noreferrer"
                  className="no-print rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
                  All HMRC-approved software →
                </a>
              </div>
              <p className="mt-3 text-xs text-neutral-400">
                Full comparison in File 02 · Software affiliate disclosure: we may earn a commission at no cost to you.
              </p>
            </div>

            {/* ── SECTION 6: ACCOUNTANT QUESTIONS ─────────────────────── */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">Three questions for your accountant</p>
                <button onClick={handleCopyQuestions}
                  className="no-print shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-blue-700 hover:bg-blue-700 hover:text-white transition">
                  {copied ? "Copied ✓" : "Copy all →"}
                </button>
              </div>
              <div className="space-y-2 mb-3">
                {assessment.accountantQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-white border border-blue-100 px-4 py-3">
                    <span className="mt-0.5 font-mono text-xs font-bold text-blue-600 shrink-0">{i + 1}</span>
                    <p className="text-sm text-blue-900">"{q}"</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-600">
                Full accountant brief in File 05 — print and take it to your meeting.
                <a href="/files/uk/05-accountant-brief" target="_blank" rel="noopener noreferrer"
                  className="no-print ml-1 underline font-semibold">Open File 05 →</a>
              </p>
            </div>

            {/* ── SECTION 7: CALENDAR ─────────────────────────────────── */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your MTD deadline calendar</p>
              <h2 className="mb-1 font-serif text-lg font-bold text-neutral-950">Never miss a deadline</h2>
              <p className="mb-4 text-sm text-neutral-600">
                Add all five MTD deadlines to your calendar in one click.
                Works with Apple Calendar, Google Calendar and Outlook.
              </p>
              <div className="mb-4 space-y-1.5">
                {[
                  { date: "7 August 2026", label: "Q1 submission deadline", urgent: true },
                  { date: "7 November 2026", label: "Q2 submission deadline", urgent: false },
                  { date: "7 February 2027", label: "Q3 submission deadline", urgent: false },
                  { date: "7 May 2027", label: "Q4 submission deadline", urgent: false },
                  { date: "31 January 2028", label: "Final declaration", urgent: false },
                ].map(d => (
                  <div key={d.date} className={`flex justify-between items-center rounded-lg px-3 py-2 ${d.urgent ? "bg-red-50 border border-red-100" : "bg-neutral-50"}`}>
                    <span className={`text-sm ${d.urgent ? "font-bold text-red-800" : "text-neutral-700"}`}>{d.label}</span>
                    <span className={`font-mono text-xs font-bold ${d.urgent ? "text-red-700" : "text-neutral-500"}`}>{d.date}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleCalendar}
                className="no-print w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white hover:bg-neutral-800 transition">
                {calDone ? "✓ Calendar file downloaded" : "📅 Add all MTD deadlines to my calendar →"}
              </button>
              {calDone && (
                <p className="mt-2 text-center text-xs text-neutral-500">
                  Open the downloaded .ics file to add to your calendar app.
                </p>
              )}
            </div>

            {/* ── SECTION 8: YOUR FILES ────────────────────────────────── */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your five documents</p>
              <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">Everything you need in one place</h2>
              <div className="space-y-2 mb-4">
                {FEATURED_FILES.map(f => (
                  <div key={f.num} className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">{f.num} — {f.name}</p>
                      <p className="text-xs text-neutral-500">{f.desc}</p>
                    </div>
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                      className="no-print ml-4 shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-neutral-700 hover:bg-neutral-950 hover:text-white transition">
                      Open →
                    </a>
                  </div>
                ))}
              </div>
              <a href="/files/uk/01-scope-assessment" target="_blank" rel="noopener noreferrer"
                className="no-print block w-full rounded-xl bg-neutral-950 py-3.5 text-center text-sm font-bold text-white hover:bg-neutral-800 transition">
                Open File 01 — Start Here →
              </a>
            </div>

            {/* ── SECTION 9: END HERE ──────────────────────────────────── */}
            <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Start here. End here.</p>
              <p className="mb-3 text-lg font-bold text-white leading-relaxed">
                {greetingCap}, your one job today is to register for MTD with HMRC.
                It takes 10 minutes. Do it now while this page is open.
              </p>
              <div className="flex gap-3 flex-wrap">
                <a href="https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax"
                  target="_blank" rel="noopener noreferrer"
                  className="no-print rounded-xl bg-white px-5 py-3 text-sm font-bold text-neutral-950 hover:bg-neutral-100 transition">
                  Register at HMRC →
                </a>
                <button onClick={handlePrint}
                  className="no-print rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-800 transition">
                  ⬇ Save as PDF
                </button>
              </div>
              <p className="mt-3 text-sm text-neutral-400">
                {days} days to 7 August 2026. That is enough time — if you start today.
              </p>
            </div>

            {/* ── SECTION 10: UPGRADE CROSS-SELL ──────────────────────── */}
            <div className="no-print rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Want the complete plan?</p>
              <p className="mb-1 font-serif text-lg font-bold text-neutral-950">Upgrade to Your MTD Action Plan</p>
              <p className="mb-3 text-sm text-neutral-600">
                Includes your gap closure plan, digital links audit, week-by-week action checklist,
                first submission checklist and HMRC registration walkthrough — 10 documents total.
              </p>
              <Link href="/uk/check/mtd-scorecard"
                className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950 transition">
                Get the full Action Plan — £127 →
              </Link>
            </div>

          </>
        )}

        {/* DISCLAIMER */}
        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs text-neutral-500 leading-relaxed">
            <strong className="text-neutral-600">General information only.</strong>{" "}
            This assessment is for general guidance and does not constitute financial, tax, or legal advice.
            TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser.
            Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all MTD obligations.
            Software links may include affiliate links — we may earn a small commission at no extra cost to you.
          </p>
        </div>

      </main>
    </div>
  );
}
