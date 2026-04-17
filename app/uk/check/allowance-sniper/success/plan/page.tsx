"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ALL_FILES = [
  { num: "01", name: "Your ANI Position Assessment",        desc: "Your exact adjusted net income and trap status.",                 url: "/files/uk/allowance-sniper/allowance-sniper-01" },
  { num: "02", name: "Your SIPP Escape Calculation",        desc: "The exact gross contribution needed — and the net cost.",        url: "/files/uk/allowance-sniper/allowance-sniper-02" },
  { num: "03", name: "SIPP vs Salary Sacrifice Guide",      desc: "Which route works for your situation.",                          url: "/files/uk/allowance-sniper/allowance-sniper-03" },
  { num: "04", name: "Gift Aid Alternative",                desc: "How Gift Aid can also reduce ANI.",                              url: "/files/uk/allowance-sniper/allowance-sniper-04" },
  { num: "05", name: "Your Accountant Brief",               desc: "Print and take to your next meeting.",                           url: "/files/uk/allowance-sniper/allowance-sniper-05" },
  { num: "06", name: "Year-by-Year Contribution Schedule",  desc: "Monthly contribution plan timed around your bonus window.",       url: "/files/uk/allowance-sniper/allowance-sniper-06" },
  { num: "07", name: "Bonus Timing Guide",                  desc: "How to time bonus windows so they don't push ANI deeper.",        url: "/files/uk/allowance-sniper/allowance-sniper-07" },
  { num: "08", name: "Implementation Checklist",            desc: "Step-by-step plan from today to the 28 March 2027 hard deadline.", url: "/files/uk/allowance-sniper/allowance-sniper-08" },
];

interface ActionPlan {
  status: string;
  ani: string;
  hiddenTax: string;
  paRemaining: string;
  escapeAmount: string;
  netCost: string;
  trapSummary: string;
  firstAction: string;
  softwareRec: string;
  weekPlan: { week: string; action: string }[];
  bonusStrategy: string;
  accountantQuestions: string[];
  bonusTip: string;
}

export default function SuccessPlan() {
  const [firstName,  setFirstName]  = useState("there");
  const [plan,       setPlan]       = useState<ActionPlan | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [copied,     setCopied]     = useState(false);
  const [calDone,    setCalDone]    = useState(false);

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
    await generatePlan(name);
  }

  async function generatePlan(name: string) {
    setLoading(true);
    try {
      const bracket    = sessionStorage.getItem("sniper_bracket") || "£110,000 – £125,140";
      const ani        = sessionStorage.getItem("sniper_ani") || "117000";
      const hiddenTax  = sessionStorage.getItem("sniper_hidden_tax") || "3400";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed") || "17000";
      const netCost    = sessionStorage.getItem("sniper_net_cost") || "10200";
      const childcare  = sessionStorage.getItem("sniper_childcare") || "false";
      const answers    = sessionStorage.getItem("sniper_answers") || "{}";

      const prompt = `You are a UK tax planning expert writing a personalised 60% tax trap ACTION PLAN for ${name}.

Their data:
- Name: ${name}
- Income bracket: ${bracket}
- Adjusted net income: £${ani}
- Hidden extra tax per year: £${hiddenTax}
- Gross SIPP contribution needed to escape: £${contNeeded}
- Estimated net cost after relief: £${netCost}
- Has children under 12: ${childcare}
- Their answers: ${answers}

This is the £147 Action Plan tier — go deeper than a basic assessment.
Produce a full implementation plan with week-by-week actions, bonus-window strategy, and a tip that accountants charge to share.

Respond ONLY with JSON, no markdown:

{
  "status": "IN THE TRAP — 60% EFFECTIVE RATE",
  "ani": "£${ani}",
  "hiddenTax": "£${hiddenTax}",
  "paRemaining": "calculated personal allowance remaining based on ANI",
  "escapeAmount": "£${contNeeded}",
  "netCost": "£${netCost}",
  "trapSummary": "3-4 sentences specific to ${name}'s situation — reference their ANI, the hidden cost, the contribution strategy, and why the £147 plan is right for them",
  "firstAction": "one specific action for ${name} to take THIS WEEK, starting with a verb",
  "softwareRec": "pension provider recommendation specific to their situation — e.g. Vanguard SIPP if cost-focused, Hargreaves Lansdown if fund choice matters, AJ Bell if they want platform flexibility",
  "weekPlan": [
    {"week": "This week", "action": "specific action starting with a verb"},
    {"week": "Next 2 weeks", "action": "specific action"},
    {"week": "Before 31 December 2026", "action": "specific action for mid-year review"},
    {"week": "January – March 2027", "action": "specific action for final contribution window"},
    {"week": "By 5 April 2027", "action": "specific action to lock in"}
  ],
  "bonusStrategy": "specific paragraph about how to handle any bonus — based on their answer about bonus_expected. Include the pension redirect mechanics.",
  "accountantQuestions": [
    "specific question 1",
    "specific question 2",
    "specific question 3",
    "specific question 4",
    "specific question 5"
  ],
  "bonusTip": "one insider tip specific to their ANI bracket — something accountants charge to share"
}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setPlan(parsed);
    } catch {
      const ani = sessionStorage.getItem("sniper_ani") || "117000";
      const hiddenTax = sessionStorage.getItem("sniper_hidden_tax") || "3400";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed") || "17000";
      const netCost = sessionStorage.getItem("sniper_net_cost") || "10200";
      setPlan({
        status: "IN THE TRAP — 60% EFFECTIVE RATE",
        ani: `£${Number(ani).toLocaleString("en-GB")}`,
        hiddenTax: `£${Number(hiddenTax).toLocaleString("en-GB")}`,
        paRemaining: `£${Math.max(0, 12570 - Math.max(0, (Number(ani) - 100000) / 2)).toLocaleString("en-GB")}`,
        escapeAmount: `£${Number(contNeeded).toLocaleString("en-GB")}`,
        netCost: `£${Number(netCost).toLocaleString("en-GB")}`,
        trapSummary: `${name !== "there" ? name : "You"}, your adjusted net income of £${Number(ani).toLocaleString("en-GB")} places you firmly in the 60% effective tax band. You are losing £${Number(hiddenTax).toLocaleString("en-GB")} per year to the personal allowance taper. A gross SIPP contribution of £${Number(contNeeded).toLocaleString("en-GB")} would pull ANI back below £100,000 and restore your full personal allowance. This plan shows the exact month-by-month execution.`,
        firstAction: "Open a SIPP this week if you do not already have one. Vanguard and Hargreaves Lansdown both process applications within 2 business days.",
        softwareRec: "Vanguard SIPP (lowest cost) or Hargreaves Lansdown SIPP (fund choice)",
        weekPlan: [
          { week: "This week", action: "Open a SIPP and confirm your 2026/27 available annual allowance including any carry-forward from the previous three years." },
          { week: "Next 2 weeks", action: "Make a first instalment contribution (e.g. £5,000 gross) to start reducing ANI immediately." },
          { week: "Before 31 December 2026", action: "Mid-year review: recalculate projected ANI including any bonus received and adjust the remaining contribution plan." },
          { week: "January – March 2027", action: "Make the final top-up contribution to pull ANI to £100,000 or below." },
          { week: "By 5 April 2027", action: "Confirm the full gross contribution has cleared the SIPP provider — after this date it counts for 2027/28." },
        ],
        bonusStrategy: "If a meaningful bonus is expected, ask your employer to redirect it directly into a pension via bonus sacrifice. This avoids bonus income hitting your ANI in the first place — cleaner than contributing after the fact and claiming relief via self-assessment. Available through most large employers. Request in writing before the bonus is processed.",
        accountantQuestions: [
          "What is my exact adjusted net income for 2026-27 including all benefits-in-kind?",
          "Which route is most efficient for my situation — personal SIPP, salary sacrifice, or bonus sacrifice?",
          "Do I have unused annual allowance from 2023-24, 2024-25 or 2025-26 I can carry forward?",
          "Do I need to file a self-assessment return to claim the higher-rate pension tax relief?",
          "Am I approaching the £260,000 tapered annual allowance threshold?",
        ],
        bonusTip: "If your employer offers salary sacrifice, sacrificing gross salary is roughly 2% more efficient than making a personal pension contribution — because you save employee NIC as well as income tax. Most payroll teams will process the change mid-year if you ask.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() { window.print(); }

  function handleCalendar() {
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TaxCheckNow//Allowance Sniper Plan//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:60% Trap — Action Plan\r\nBEGIN:VEVENT\r\nUID:sniper-plan-midyear@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20261231\r\nSUMMARY:60% Trap — Mid-year ANI review\r\nDESCRIPTION:Recalculate projected ANI including any bonus received and adjust remaining pension contribution plan.\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:sniper-plan-topup@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:20270320\r\nDTEND;VALUE=DATE:20270320\r\nSUMMARY:60% Trap — Final top-up contribution\r\nDESCRIPTION:Make final SIPP top-up contribution to pull ANI to £100,000 or below before tax year end.\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:sniper-plan-deadline@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:20270405\r\nDTEND;VALUE=DATE:20270405\r\nSUMMARY:🔴 Tax Year End — 5 April 2027\r\nDESCRIPTION:Last date for 2026-27 pension contributions and Gift Aid. After this date the opportunity is gone.\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:sniper-plan-sa@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:20280131\r\nDTEND;VALUE=DATE:20280131\r\nSUMMARY:Self-assessment deadline — claim higher-rate pension relief\r\nDESCRIPTION:Final date to file self-assessment for 2026-27 and claim additional higher-rate pension tax relief.\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "allowance-sniper-action-plan.ics";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setCalDone(true);
  }

  async function handleCopyQuestions() {
    if (!plan) return;
    const text = plan.accountantQuestions.map((q, i) => `${i + 1}. "${q}"`).join("\n");
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
          <span className="font-mono text-xs text-neutral-400">United Kingdom · 60% Trap · Action Plan</span>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-5">

        {/* CONFIRMATION */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Payment confirmed · £147</p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">{greeting}, your Allowance Sniper Action Plan</h1>
              <p className="mt-1 text-sm text-emerald-800">A personal plan built around your ANI, your bonus window, and your deadline — not a generic pension guide.</p>
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
            <p className="text-sm font-medium text-neutral-600">Preparing your action plan…</p>
          </div>
        ) : plan && (
          <>
            {/* YOUR POSITION */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your tax trap position</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Your ANI",     value: plan.ani },
                  { label: "PA remaining", value: plan.paRemaining },
                  { label: "Hidden cost",  value: plan.hiddenTax, red: true },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border px-3 py-3 text-center ${item.red ? "bg-red-50 border-red-100" : "bg-neutral-50 border-neutral-100"}`}>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">{item.label}</p>
                    <p className={`mt-1 text-sm font-bold ${item.red ? "text-red-800" : "text-neutral-800"}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Your trap summary</p>
                <p className="text-sm leading-relaxed text-red-900">{plan.trapSummary}</p>
              </div>
            </div>

            {/* PRIMARY ACTION */}
            <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Do this week</p>
              <p className="mb-4 text-base font-bold text-white leading-relaxed">{plan.firstAction}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl bg-white/10 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-neutral-400">Gross SIPP needed</p>
                  <p className="font-serif text-xl font-bold text-white mt-1">{plan.escapeAmount}</p>
                </div>
                <div className="rounded-xl bg-emerald-900/50 border border-emerald-700 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-emerald-400">Net cost after relief</p>
                  <p className="font-serif text-xl font-bold text-emerald-300 mt-1">{plan.netCost}</p>
                </div>
              </div>
              <p className="text-sm text-neutral-400">Full calculation in File 02.</p>
            </div>

            {/* WEEK-BY-WEEK PLAN */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your implementation plan</p>
              <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">5 stages to 5 April 2027</h2>
              <div className="space-y-2">
                {plan.weekPlan.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-950 font-mono text-xs font-bold text-white">{i + 1}</span>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{item.week}</p>
                      <p className="mt-0.5 text-sm text-neutral-800">{item.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BONUS STRATEGY */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-800">Your bonus strategy</p>
              <p className="text-sm leading-relaxed text-amber-900">{plan.bonusStrategy}</p>
            </div>

            {/* SOFTWARE REC */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your SIPP recommendation</p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{plan.softwareRec}</h2>
              <p className="text-sm text-neutral-600">Personal contributions route vs salary sacrifice compared in File 03. Year-by-year schedule in File 06.</p>
            </div>

            {/* BONUS TIP */}
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-800">Insider tip</p>
              <p className="text-sm leading-relaxed text-emerald-900 font-medium">{plan.bonusTip}</p>
            </div>

            {/* ACCOUNTANT QUESTIONS */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">Five questions for your accountant</p>
                <button onClick={handleCopyQuestions}
                  className="no-print shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-blue-700 hover:bg-blue-700 hover:text-white transition">
                  {copied ? "Copied ✓" : "Copy all →"}
                </button>
              </div>
              <div className="space-y-2 mb-3">
                {plan.accountantQuestions.map((q, i) => (
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
                  { date: "31 December 2026", label: "Mid-year ANI review — recalculate including bonus",       urgent: false },
                  { date: "20 March 2027",    label: "Final SIPP top-up — 2 weeks before year end",             urgent: true  },
                  { date: "5 April 2027",     label: "Tax year end — last date for 2026-27 contributions",      urgent: true  },
                  { date: "31 January 2028",  label: "Self-assessment deadline — claim higher-rate relief",     urgent: false },
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
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your eight documents</p>
              <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">Everything you need in one place</h2>
              <div className="space-y-2 mb-4">
                {ALL_FILES.map(f => (
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
                {greeting}, open File 08 — the full implementation checklist. Work through it step by step, starting today.
              </p>
              <div className="flex gap-3 flex-wrap no-print">
                <button onClick={handlePrint}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-800 transition">
                  ⬇ Save as PDF
                </button>
              </div>
              <p className="mt-3 text-sm text-neutral-400">{daysToYearEnd} days to 5 April 2027. Start today.</p>
            </div>

            {/* CROSSLINK */}
            <div className="no-print rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Also relevant for you</p>
              <p className="mb-2 font-serif text-lg font-bold text-neutral-950">Self-employed or a landlord? MTD is live.</p>
              <p className="mb-3 text-sm text-neutral-600">
                From 6 April 2026, Making Tax Digital for Income Tax is mandatory for self-employed and landlord income above £50,000 qualifying income. The 60% trap is about what you owe. MTD is about how you report it.
              </p>
              <Link href="/uk/check/mtd-scorecard"
                className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950 transition">
                Check your MTD Scorecard →
              </Link>
            </div>
          </>
        )}

        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs text-neutral-500 leading-relaxed">
            <strong className="text-neutral-600">General information only.</strong> This action plan does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before making pension or financial decisions. Based on HMRC guidance April 2026.
          </p>
        </div>
      </main>
    </div>
  );
}
