"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const FILES_67 = [
  { num: "01", name: "Your ANI Position Assessment",   desc: "Your exact adjusted net income, trap status and personal allowance remaining.", url: "/files/uk/allowance-sniper/allowance-sniper-01" },
  { num: "02", name: "Your SIPP Escape Calculation",   desc: "The exact gross contribution needed and net cost after relief.", url: "/files/uk/allowance-sniper/allowance-sniper-02" },
  { num: "03", name: "SIPP vs Salary Sacrifice Guide", desc: "Which route works for your employer and situation.", url: "/files/uk/allowance-sniper/allowance-sniper-03" },
  { num: "04", name: "Gift Aid Alternative",           desc: "How Gift Aid reduces ANI alongside or instead of SIPP.", url: "/files/uk/allowance-sniper/allowance-sniper-04" },
  { num: "05", name: "Your Accountant Brief",          desc: "Print this and take it to your next meeting.", url: "/files/uk/allowance-sniper/allowance-sniper-05" },
];

interface Assessment {
  status: string;
  ani: string;
  hiddenTax: string;
  paRemaining: string;
  escapeAmount: string;
  netCost: string;
  trapSummary: string;
  firstAction: string;
  sipprec: string;
  sippWhy: string;
  accountantQuestions: string[];
}

export default function SuccessDecide() {
  const [firstName,  setFirstName]  = useState("there");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [copied,     setCopied]     = useState(false);
  const [calDone,    setCalDone]    = useState(false);

  const daysToYearEnd = Math.max(0, Math.floor(
    (new Date("2027-04-05T23:59:59.000+01:00").getTime() - Date.now()) / 86_400_000
  ));

  useEffect(() => { init(); }, []);

  async function init() {
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    let name        = "there";
    if (sessionId) {
      try {
        const res  = await fetch(`/api/get-session?id=${sessionId}`);
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
      const bracket    = sessionStorage.getItem("sniper_bracket")              || "£100,000 – £110,000";
      const ani        = sessionStorage.getItem("sniper_ani")                  || "105000";
      const hiddenTax  = sessionStorage.getItem("sniper_hidden_tax")           || "1000";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed")  || "5000";
      const netCost    = sessionStorage.getItem("sniper_net_cost")             || "3000";
      const childcare  = sessionStorage.getItem("sniper_childcare")            || "false";
      const answers    = sessionStorage.getItem("sniper_answers")              || "{}";

      const prompt = `You are a UK tax planning expert. Write a personalised 60% tax trap assessment for ${name}.

Their data:
- Income bracket: ${bracket}
- Adjusted net income: £${Number(ani).toLocaleString("en-GB")}
- Hidden extra tax per year: £${Number(hiddenTax).toLocaleString("en-GB")}
- Gross SIPP contribution needed to escape: £${Number(contNeeded).toLocaleString("en-GB")}
- Estimated net cost after relief: £${Number(netCost).toLocaleString("en-GB")}
- Has children under 12: ${childcare}
- Their questionnaire answers: ${answers}

Write a personalised assessment. Use their name. Reference their specific numbers. Be direct and specific — not generic.

Respond ONLY with a valid JSON object. No markdown. No backticks. No preamble. Just the JSON:

{
  "status": "their exact status label e.g. IN THE TRAP — 60% EFFECTIVE RATE",
  "ani": "formatted e.g. £105,000",
  "hiddenTax": "formatted e.g. £1,000",
  "paRemaining": "calculated e.g. £10,070",
  "escapeAmount": "formatted e.g. £5,000",
  "netCost": "formatted e.g. £3,000",
  "trapSummary": "2-3 sentences specific to ${name} — reference their ANI, the hidden cost and what it means for them personally",
  "firstAction": "one specific action starting with a verb — what ${name} should do this week",
  "sipprec": "one specific SIPP provider e.g. Vanguard SIPP, Hargreaves Lansdown SIPP or AJ Bell SIPP — based on their answers",
  "sippWhy": "2 sentences explaining why that provider suits their specific situation",
  "accountantQuestions": [
    "specific question 1 for ${name}'s exact situation",
    "specific question 2 for ${name}'s exact situation",
    "specific question 3 for ${name}'s exact situation"
  ]
}`;

      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:      "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages:   [{ role: "user", content: prompt }],
        }),
      });
      const data   = await res.json();
      const text   = data.content?.[0]?.text || "";
      const clean  = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAssessment(parsed);
    } catch {
      // Fallback using sessionStorage values directly
      const ani        = sessionStorage.getItem("sniper_ani")                 || "105000";
      const hiddenTax  = sessionStorage.getItem("sniper_hidden_tax")          || "1000";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed") || "5000";
      const netCost    = sessionStorage.getItem("sniper_net_cost")            || "3000";
      const aniNum     = Number(ani);
      const paLeft     = Math.max(0, 12570 - Math.max(0, (aniNum - 100000) / 2));
      setAssessment({
        status:      "IN THE TRAP — 60% EFFECTIVE RATE",
        ani:         `£${aniNum.toLocaleString("en-GB")}`,
        hiddenTax:   `£${Number(hiddenTax).toLocaleString("en-GB")}`,
        paRemaining: `£${paLeft.toLocaleString("en-GB")}`,
        escapeAmount:`£${Number(contNeeded).toLocaleString("en-GB")}`,
        netCost:     `£${Number(netCost).toLocaleString("en-GB")}`,
        trapSummary: `${name !== "there" ? name : "Your"} adjusted net income places you in the 60% effective tax zone. You are losing £${Number(hiddenTax).toLocaleString("en-GB")} per year to the personal allowance taper. A gross SIPP contribution of £${Number(contNeeded).toLocaleString("en-GB")} would pull your ANI back below £100,000 and restore your full personal allowance.`,
        firstAction: `Make a gross SIPP contribution of £${Number(contNeeded).toLocaleString("en-GB")} before 5 April 2027 to escape the trap and recover your personal allowance.`,
        sipprec:     "Vanguard SIPP or Hargreaves Lansdown SIPP",
        sippWhy:     "Both accept personal contributions with relief at source. Vanguard suits low-cost index investors. Hargreaves Lansdown suits those wanting more investment choice and telephone support.",
        accountantQuestions: [
          "What is my exact adjusted net income for 2026-27 after all income sources?",
          "What is the most efficient route for me — personal SIPP, salary sacrifice or Gift Aid?",
          "Do I need to file self-assessment to claim the additional higher-rate pension relief?",
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  function handleCalendar() {
    const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const actionDate = new Date(Date.now() + 7 * 86400000)
      .toISOString().split("T")[0].replace(/-/g, "");

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TaxCheckNow//Allowance Sniper//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:60% Trap — Action Dates",
      "BEGIN:VEVENT",
      `UID:sniper-action-${Date.now()}@taxchecknow.com`,
      `DTSTART;VALUE=DATE:${actionDate}`,
      `DTEND;VALUE=DATE:${actionDate}`,
      `DTSTAMP:${now}`,
      "SUMMARY:60% Trap — Confirm ANI with accountant",
      "DESCRIPTION:Confirm your exact adjusted net income for 2026-27 and agree the gross SIPP contribution needed to escape the trap. See File 05 — Accountant Brief at taxchecknow.com/files/uk/allowance-sniper/allowance-sniper-05",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      `UID:sniper-sipp-${Date.now()}@taxchecknow.com`,
      "DTSTART;VALUE=DATE:20270320",
      "DTEND;VALUE=DATE:20270320",
      `DTSTAMP:${now}`,
      "SUMMARY:60% Trap — Make SIPP contribution (2 weeks before year end)",
      "DESCRIPTION:Make your gross SIPP contribution before 5 April 2027. Allow 3-5 working days for processing. Do not leave this until the last day.",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      `UID:sniper-yearend-${Date.now()}@taxchecknow.com`,
      "DTSTART;VALUE=DATE:20270405",
      "DTEND;VALUE=DATE:20270405",
      `DTSTAMP:${now}`,
      "SUMMARY:🔴 Tax Year End — 5 April 2027",
      "DESCRIPTION:Last date for SIPP contributions and Gift Aid to count for 2026-27. After this date the opportunity is gone for this tax year.",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      `UID:sniper-sa-${Date.now()}@taxchecknow.com`,
      "DTSTART;VALUE=DATE:20280131",
      "DTEND;VALUE=DATE:20280131",
      `DTSTAMP:${now}`,
      "SUMMARY:Self-Assessment — Claim higher-rate pension relief",
      "DESCRIPTION:Include your 2026-27 SIPP contributions on your self-assessment return to claim the additional 20% higher-rate relief HMRC does not add automatically.",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = "allowance-sniper-deadlines.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCalDone(true);
  }

  async function handleCopy() {
    if (!assessment) return;
    const text = assessment.accountantQuestions
      .map((q, i) => `${i + 1}. "${q}"`)
      .join("\n");
    await navigator.clipboard.writeText(
      `60% trap — questions for my accountant:\n\n${text}\n\nPrepared by TaxCheckNow · taxchecknow.com`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const greeting = firstName !== "there" ? firstName : "your";

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; color: #000; }
          a[href]:after {
            content: " (" attr(href) ")";
            font-size: 9px; color: #555; word-break: break-all;
          }
          a[href^="#"]:after,
          a[href^="javascript"]:after { content: ""; }
          .print-section { page-break-inside: avoid; }
        }
      `}</style>

      {/* NAV */}
      <nav className="no-print border-b border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
          <span className="font-mono text-xs text-neutral-400">United Kingdom · 60% Tax Trap</span>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-6 py-8">

        {/* ── CONFIRMATION ── */}
        <div className="print-section rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">
                Payment confirmed · Decision Pack · £67
              </p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">
                {greeting !== "your" ? `${greeting}, your` : "Your"} Allowance Sniper Assessment
              </h1>
              <p className="mt-1 text-sm text-emerald-800">
                A personal assessment built around your ANI, your gaps, your deadline — not the average taxpayer.
              </p>
            </div>
            <button onClick={() => window.print()}
              className="no-print shrink-0 rounded-xl border-2 border-neutral-950 bg-white px-4 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-neutral-950 hover:text-white whitespace-nowrap">
              ⬇ Save as PDF
            </button>
          </div>
        </div>

        {/* ── DEADLINE ── */}
        <div className="print-section flex items-center justify-between rounded-xl bg-red-700 px-5 py-3">
          <span className="text-sm font-bold text-white">🔴 {daysToYearEnd} days to tax year end</span>
          <span className="font-mono text-sm font-bold text-white">5 April 2027</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-600">Preparing your ANI assessment…</p>
            <p className="mt-1 text-xs text-neutral-400">Building around your specific numbers</p>
          </div>
        ) : assessment && (
          <>
            {/* ── YOUR POSITION ── */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your compliance position
              </p>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {[
                  { label: "Your ANI",      value: assessment.ani,         red: false },
                  { label: "PA remaining",  value: assessment.paRemaining, red: false },
                  { label: "Hidden cost",   value: assessment.hiddenTax,   red: true  },
                ].map(item => (
                  <div key={item.label}
                    className={`rounded-xl border px-3 py-3 text-center ${item.red ? "border-red-100 bg-red-50" : "border-neutral-100 bg-neutral-50"}`}>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">{item.label}</p>
                    <p className={`mt-1 text-base font-bold ${item.red ? "text-red-800" : "text-neutral-900"}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Your trap summary</p>
                <p className="text-sm leading-relaxed text-red-900">{assessment.trapSummary}</p>
              </div>
            </div>

            {/* ── ESCAPE ROUTE ── */}
            <div className="print-section rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your escape route — do this before 5 April 2027
              </p>
              <p className="mb-4 text-base font-bold leading-relaxed text-white">{assessment.firstAction}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-white/10 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-neutral-400">Gross SIPP needed</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-white">{assessment.escapeAmount}</p>
                </div>
                <div className="rounded-xl border border-emerald-600 bg-emerald-900/40 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-emerald-400">Net cost after relief</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-emerald-300">{assessment.netCost}</p>
                </div>
              </div>
              <p className="text-xs text-neutral-500">
                Net payment = gross × 80%. SIPP provider claims 20% basic rate relief automatically.
                Claim the additional 20% higher-rate relief via self-assessment by 31 January 2028.
                Full calculation in{" "}
                <a href="/files/uk/allowance-sniper/allowance-sniper-02" target="_blank" rel="noopener noreferrer"
                  className="text-neutral-400 underline hover:text-white transition">
                  File 02 →
                </a>
              </p>
            </div>

            {/* ── SIPP RECOMMENDATION ── */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your SIPP recommendation
              </p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{assessment.sipprec}</h2>
              <p className="mb-3 text-sm leading-relaxed text-neutral-600">{assessment.sippWhy}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <a href="https://www.vanguardinvestor.co.uk/what-we-offer/sipp"
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-sm font-semibold text-neutral-700 transition hover:bg-neutral-950 hover:text-white">
                  Vanguard SIPP ↗
                </a>
                <a href="https://www.hl.co.uk/pensions/sipp"
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-sm font-semibold text-neutral-700 transition hover:bg-neutral-950 hover:text-white">
                  Hargreaves Lansdown ↗
                </a>
                <a href="https://www.ajbell.co.uk/sipp"
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-sm font-semibold text-neutral-700 transition hover:bg-neutral-950 hover:text-white">
                  AJ Bell SIPP ↗
                </a>
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                Full comparison — SIPP vs salary sacrifice — in{" "}
                <a href="/files/uk/allowance-sniper/allowance-sniper-03" target="_blank" rel="noopener noreferrer"
                  className="underline hover:text-neutral-700 transition">File 03 →</a>
              </p>
            </div>

            {/* ── ACCOUNTANT QUESTIONS ── */}
            <div className="print-section rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">
                    Three questions for your accountant
                  </p>
                  <p className="mt-0.5 text-xs text-blue-600">
                    Ask these before 5 April 2027 — full brief in{" "}
                    <a href="/files/uk/allowance-sniper/allowance-sniper-05" target="_blank" rel="noopener noreferrer"
                      className="font-semibold underline">File 05 →</a>
                  </p>
                </div>
                <button onClick={handleCopy}
                  className="no-print shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-blue-700 transition hover:bg-blue-700 hover:text-white">
                  {copied ? "Copied ✓" : "Copy all →"}
                </button>
              </div>
              <div className="space-y-2">
                {assessment.accountantQuestions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3">
                    <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-blue-600">{i + 1}</span>
                    <p className="text-sm text-blue-900">"{q}"</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CALENDAR ── */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your action deadlines
              </p>
              <h2 className="mb-3 font-serif text-lg font-bold text-neutral-950">
                Add these to your calendar now
              </h2>
              <div className="mb-4 space-y-2">
                {[
                  { date: "This week",       label: "Confirm ANI with accountant — agree SIPP amount",    urgent: true  },
                  { date: "20 March 2027",   label: "Make SIPP contribution (2 weeks before year end)",    urgent: true  },
                  { date: "5 April 2027",    label: "🔴 Tax year end — last date for 2026-27 contributions", urgent: true  },
                  { date: "31 January 2028", label: "Self-assessment — claim higher-rate pension relief",   urgent: false },
                ].map(d => (
                  <div key={d.date}
                    className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${d.urgent ? "border border-red-100 bg-red-50" : "bg-neutral-50"}`}>
                    <span className={`text-sm ${d.urgent ? "font-semibold text-red-900" : "text-neutral-700"}`}>{d.label}</span>
                    <span className={`ml-3 shrink-0 font-mono text-xs font-bold ${d.urgent ? "text-red-700" : "text-neutral-500"}`}>{d.date}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleCalendar}
                className="no-print w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                {calDone ? "✓ Calendar downloaded — open in Apple / Google / Outlook" : "📅 Add all deadlines to my calendar →"}
              </button>
              <p className="mt-2 text-center text-xs text-neutral-400">
                Works with Apple Calendar · Google Calendar · Outlook
              </p>
            </div>

            {/* ── FILES ── */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your five documents
              </p>
              <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">
                Everything you need — start with File 02
              </h2>
              <p className="mb-4 text-sm text-neutral-500">
                Each file opens in your browser and can be saved as a PDF.
                File 05 is designed to print and hand to your accountant.
              </p>
              <div className="space-y-2">
                {FILES_67.map(f => (
                  <div key={f.num}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${f.num === "02" ? "border-neutral-900 bg-neutral-950" : "border-neutral-100 bg-neutral-50"}`}>
                    <div>
                      <p className={`text-sm font-semibold ${f.num === "02" ? "text-white" : "text-neutral-950"}`}>
                        {f.num === "02" && <span className="mr-2 font-mono text-[9px] uppercase tracking-widest text-amber-400">Start here</span>}
                        {f.num} — {f.name}
                      </p>
                      <p className={`text-xs ${f.num === "02" ? "text-neutral-400" : "text-neutral-500"}`}>{f.desc}</p>
                    </div>
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                      className={`no-print ml-4 shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition ${f.num === "02"
                        ? "border-white/20 bg-white text-neutral-950 hover:bg-neutral-200"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-950 hover:text-white"}`}>
                      Open →
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* ── START HERE END HERE ── */}
            <div className="print-section rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Start here. End here.
              </p>
              <p className="mb-4 text-lg font-bold leading-relaxed text-white">
                {greeting !== "your" ? `${greeting}, open` : "Open"} File 02 — it shows your exact SIPP contribution and what it will cost you net.
                Then open File 05 and forward it to your accountant.
                Make the contribution before 5 April 2027.
              </p>
              <div className="mb-4 flex flex-wrap gap-3 no-print">
                <button onClick={() => window.print()}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:bg-neutral-800">
                  ⬇ Save this page as PDF
                </button>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Days remaining to act</span>
                  <span className="font-mono text-lg font-bold text-red-400">{daysToYearEnd} days</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-neutral-800">
                  <div className="h-1.5 rounded-full bg-red-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(5, ((365 - daysToYearEnd) / 365) * 100))}%` }} />
                </div>
                <p className="mt-2 text-xs text-neutral-500">5 April 2027 · No backdating after this date</p>
              </div>
            </div>

            {/* ── UPGRADE ── */}
            <div className="no-print rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Want the full implementation plan?
              </p>
              <p className="mb-1 font-serif text-lg font-bold text-neutral-950">
                Upgrade to Your Allowance Sniper Action Plan
              </p>
              <p className="mb-3 text-sm leading-relaxed text-neutral-600">
                Includes a year-by-year contribution schedule (thresholds frozen to 2031 — this recurs),
                bonus timing guide, tapered annual allowance checker, and a step-by-step
                implementation checklist with exact deadlines.
              </p>
              <Link href="/uk/check/allowance-sniper"
                className="font-mono text-xs font-bold text-neutral-700 underline transition hover:text-neutral-950">
                Get the full Action Plan — £147 →
              </Link>
            </div>
          </>
        )}

        {/* ── DISCLAIMER ── */}
        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs leading-relaxed text-neutral-500">
            <strong className="text-neutral-600">General information only.</strong>{" "}
            This assessment does not constitute financial, tax or legal advice.
            TaxCheckNow is not a regulated financial adviser.
            Always consult a qualified UK tax adviser before making pension or financial decisions.
            Based on HMRC guidance April 2026.{" "}
            <a href="https://www.gov.uk/income-tax-rates" target="_blank" rel="noopener noreferrer"
              className="underline hover:text-neutral-700">GOV.UK — Income Tax rates</a> ·{" "}
            <a href="https://www.gov.uk/guidance/adjusted-net-income" target="_blank" rel="noopener noreferrer"
              className="underline hover:text-neutral-700">GOV.UK — Adjusted net income</a>
          </p>
        </div>

      </main>
    </div>
  );
}
