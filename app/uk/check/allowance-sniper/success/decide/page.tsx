"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const FILES_67 = [
  { num: "01", name: "Your ANI Position Assessment",      desc: "Your exact adjusted net income and trap status.", url: "/files/uk/allowance-sniper/allowance-sniper-01" },
  { num: "02", name: "Your SIPP Escape Calculation",      desc: "The exact gross contribution needed — and the net cost.", url: "/files/uk/allowance-sniper/allowance-sniper-02" },
  { num: "03", name: "SIPP vs Salary Sacrifice Guide",    desc: "Which route works for your situation.", url: "/files/uk/allowance-sniper/allowance-sniper-03" },
  { num: "04", name: "Gift Aid Alternative",              desc: "How Gift Aid can also reduce ANI.", url: "/files/uk/allowance-sniper/allowance-sniper-04" },
  { num: "05", name: "Your Accountant Brief",             desc: "Print and take to your next meeting.", url: "/files/uk/allowance-sniper/allowance-sniper-05" },
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
  softwareRec: string;
  accountantQuestions: string[];
}

export default function SuccessDecide() {
  const [firstName,   setFirstName]  = useState("there");
  const [assessment,  setAssessment] = useState<Assessment | null>(null);
  const [loading,     setLoading]    = useState(true);
  const [copied,      setCopied]     = useState(false);
  const [calDone,     setCalDone]    = useState(false);

  const daysToYearEnd = Math.max(0, Math.floor(
    (new Date("2027-04-05").getTime() - Date.now()) / 86_400_000
  ));

  useEffect(() => { init(); }, []);

  async function init() {
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
      const bracket   = sessionStorage.getItem("sniper_bracket") || "£100,000 – £110,000";
      const ani       = sessionStorage.getItem("sniper_ani") || "105000";
      const hiddenTax = sessionStorage.getItem("sniper_hidden_tax") || "1000";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed") || "5000";
      const netCost   = sessionStorage.getItem("sniper_net_cost") || "3000";
      const childcare = sessionStorage.getItem("sniper_childcare") || "false";
      const answers   = sessionStorage.getItem("sniper_answers") || "{}";

      const prompt = `You are a UK tax planning expert writing a personalised 60% tax trap assessment for ${name}.

Their data:
- Name: ${name}
- Income bracket: ${bracket}
- Adjusted net income: £${ani}
- Hidden extra tax per year: £${hiddenTax}
- Gross SIPP contribution needed to escape: £${contNeeded}
- Estimated net cost after relief: £${netCost}
- Has children under 12: ${childcare}
- Their answers: ${answers}

Write a personalised assessment. Respond ONLY with JSON, no markdown:

{
  "status": "IN THE TRAP — 60% EFFECTIVE RATE",
  "ani": "£${ani}",
  "hiddenTax": "£${hiddenTax}",
  "paRemaining": "calculated personal allowance remaining based on ANI",
  "escapeAmount": "£${contNeeded}",
  "netCost": "£${netCost}",
  "trapSummary": "2-3 sentences specific to ${name}'s situation — reference their ANI, the hidden cost, and why it matters for them",
  "firstAction": "one specific action for ${name} starting with a verb — what to do this week",
  "softwareRec": "pension provider or platform recommendation — e.g. Vanguard SIPP, Hargreaves Lansdown, AJ Bell — based on their situation",
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
      const ani = sessionStorage.getItem("sniper_ani") || "105000";
      const hiddenTax = sessionStorage.getItem("sniper_hidden_tax") || "1000";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed") || "5000";
      const netCost = sessionStorage.getItem("sniper_net_cost") || "3000";
      setAssessment({
        status: "IN THE TRAP — 60% EFFECTIVE RATE",
        ani: `£${Number(ani).toLocaleString("en-GB")}`,
        hiddenTax: `£${Number(hiddenTax).toLocaleString("en-GB")}`,
        paRemaining: `£${Math.max(0, 12570 - Math.max(0, (Number(ani) - 100000) / 2)).toLocaleString("en-GB")}`,
        escapeAmount: `£${Number(contNeeded).toLocaleString("en-GB")}`,
        netCost: `£${Number(netCost).toLocaleString("en-GB")}`,
        trapSummary: `${name !== "there" ? name : "You"}, your adjusted net income places you in the 60% effective tax zone. You are losing £${Number(hiddenTax).toLocaleString("en-GB")} per year to the personal allowance taper. A gross SIPP contribution of £${Number(contNeeded).toLocaleString("en-GB")} would pull your ANI back below £100,000.`,
        firstAction: `Make a gross SIPP contribution of £${Number(contNeeded).toLocaleString("en-GB")} before 5 April 2027 to escape the trap.`,
        softwareRec: "Vanguard SIPP or Hargreaves Lansdown SIPP",
        accountantQuestions: [
          "What is my exact adjusted net income for 2026-27?",
          "What is the most efficient route — salary sacrifice or personal SIPP?",
          "Do I need to claim additional tax relief through self-assessment?",
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() { window.print(); }

  function handleCalendar() {
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TaxCheckNow//Allowance Sniper//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:60% Trap — Action Dates\r\nBEGIN:VEVENT\r\nUID:sniper-action@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:20270320\r\nDTEND;VALUE=DATE:20270320\r\nSUMMARY:60% Trap — Make SIPP contribution before tax year end\r\nDESCRIPTION:Make your SIPP contribution before 5 April 2027 to reduce ANI and escape the 60% trap. See your Allowance Sniper Assessment at taxchecknow.com\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:sniper-deadline@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:20270405\r\nDTEND;VALUE=DATE:20270405\r\nSUMMARY:🔴 Tax Year End — 5 April 2027\r\nDESCRIPTION:Last date to make pension contributions and Gift Aid for 2026-27. After this date the opportunity is gone for this tax year.\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "allowance-sniper-deadlines.ics";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setCalDone(true);
  }

  async function handleCopyQuestions() {
    if (!assessment) return;
    const text = assessment.accountantQuestions.map((q, i) => `${i + 1}. "${q}"`).join("\n");
    await navigator.clipboard.writeText(`60% trap questions for my accountant:\n\n${text}\n\n— Prepared by TaxCheckNow`);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const greeting = firstName !== "there" ? firstName : "You";

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; color: #000; }
          a[href]:after { content: " (" attr(href) ")"; font-size: 9px; color: #555; word-break: break-all; }
          a[href^="#"]:after { content: ""; }
        }
      `}</style>

      <nav className="no-print border-b border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
          <span className="font-mono text-xs text-neutral-400">United Kingdom · 60% Trap</span>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-5">

        {/* CONFIRMATION */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Payment confirmed · £67</p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">{greeting}, your Allowance Sniper Assessment</h1>
              <p className="mt-1 text-sm text-emerald-800">A personal assessment built around your ANI — not a generic pension guide.</p>
            </div>
            <button onClick={handlePrint}
              className="no-print shrink-0 rounded-xl border-2 border-neutral-950 bg-white px-4 py-2.5 text-sm font-bold text-neutral-950 hover:bg-neutral-950 hover:text-white transition whitespace-nowrap">
              ⬇ Save as PDF
            </button>
          </div>
        </div>

        {/* DEADLINE */}
        <div className="rounded-xl bg-red-700 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">🔴 {daysToYearEnd} days to tax year end</span>
          <span className="font-mono text-sm font-bold text-white">5 April 2027</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-600">Preparing your ANI assessment…</p>
          </div>
        ) : assessment && (
          <>
            {/* YOUR POSITION */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your tax trap position</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Your ANI",      value: assessment.ani },
                  { label: "PA remaining",  value: assessment.paRemaining },
                  { label: "Hidden cost",   value: assessment.hiddenTax, red: true },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border px-3 py-3 text-center ${item.red ? "bg-red-50 border-red-100" : "bg-neutral-50 border-neutral-100"}`}>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">{item.label}</p>
                    <p className={`mt-1 text-sm font-bold ${item.red ? "text-red-800" : "text-neutral-800"}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Your trap summary</p>
                <p className="text-sm leading-relaxed text-red-900">{assessment.trapSummary}</p>
              </div>
            </div>

            {/* ESCAPE ROUTE */}
            <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your escape route — do this before 5 April 2027</p>
              <p className="mb-4 text-base font-bold text-white leading-relaxed">{assessment.firstAction}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-white/10 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-neutral-400">Gross SIPP needed</p>
                  <p className="font-serif text-xl font-bold text-white mt-1">{assessment.escapeAmount}</p>
                </div>
                <div className="rounded-xl bg-emerald-900/50 border border-emerald-700 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-emerald-400">Net cost after relief</p>
                  <p className="font-serif text-xl font-bold text-emerald-300 mt-1">{assessment.netCost}</p>
                </div>
              </div>
              <p className="text-sm text-neutral-400">Full calculation and comparison in File 02 below.</p>
            </div>

            {/* SOFTWARE REC */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your SIPP recommendation</p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{assessment.softwareRec}</h2>
              <p className="text-sm text-neutral-600">Based on your answers — personal contributions route vs salary sacrifice compared in File 03.</p>
            </div>

            {/* ACCOUNTANT QUESTIONS */}
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
              <p className="text-xs text-blue-600">Full accountant brief in File 05 →</p>
            </div>

            {/* CALENDAR */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your action deadlines</p>
              <h2 className="mb-3 font-serif text-lg font-bold text-neutral-950">Never miss the tax year end</h2>
              <div className="space-y-1.5 mb-4">
                {[
                  { date: "20 March 2027",  label: "Make SIPP contribution — 2 weeks before year end", urgent: true },
                  { date: "5 April 2027",   label: "Tax year end — last date for 2026-27 contributions", urgent: true },
                  { date: "31 January 2028", label: "Self-assessment return — claim higher-rate relief", urgent: false },
                ].map(d => (
                  <div key={d.date} className={`flex justify-between items-center rounded-lg px-3 py-2 ${d.urgent ? "bg-red-50 border border-red-100" : "bg-neutral-50"}`}>
                    <span className={`text-sm ${d.urgent ? "font-bold text-red-800" : "text-neutral-700"}`}>{d.label}</span>
                    <span className={`font-mono text-xs font-bold shrink-0 ml-2 ${d.urgent ? "text-red-700" : "text-neutral-500"}`}>{d.date}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleCalendar}
                className="no-print w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white hover:bg-neutral-800 transition">
                {calDone ? "✓ Calendar downloaded" : "📅 Add all deadlines to my calendar →"}
              </button>
            </div>

            {/* FILES */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your five documents</p>
              <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">Everything you need in one place</h2>
              <div className="space-y-2 mb-4">
                {FILES_67.map(f => (
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
            </div>

            {/* END HERE */}
            <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Start here. End here.</p>
              <p className="mb-3 text-lg font-bold text-white leading-relaxed">
                {greeting}, open File 02 — it shows your exact SIPP contribution and net cost. Do it before 5 April 2027.
              </p>
              <div className="flex gap-3 flex-wrap no-print">
                <button onClick={handlePrint}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-800 transition">
                  ⬇ Save as PDF
                </button>
              </div>
              <p className="mt-3 text-sm text-neutral-400">{daysToYearEnd} days to 5 April 2027. Start today.</p>
            </div>

            {/* UPGRADE */}
            <div className="no-print rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Want the full implementation plan?</p>
              <p className="mb-1 font-serif text-lg font-bold text-neutral-950">Upgrade to Your Action Plan</p>
              <p className="mb-3 text-sm text-neutral-600">
                Includes year-by-year contribution schedule, bonus timing guide, tapered annual allowance checker, combined SIPP and Gift Aid strategy, and full implementation checklist.
              </p>
              <Link href="/uk/check/allowance-sniper"
                className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950 transition">
                Get the full Action Plan — £147 →
              </Link>
            </div>
          </>
        )}

        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs text-neutral-500 leading-relaxed">
            <strong className="text-neutral-600">General information only.</strong> This assessment does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or financial decisions. Based on HMRC guidance April 2026.
          </p>
        </div>
      </main>
    </div>
  );
}
