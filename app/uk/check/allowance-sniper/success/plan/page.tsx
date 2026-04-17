"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ALL_FILES = [
  { num: "01", name: "Your ANI Position Assessment",         desc: "Exact ANI, personal allowance remaining, hidden tax cost.", url: "/files/uk/allowance-sniper/allowance-sniper-01" },
  { num: "02", name: "Your SIPP Escape Calculation",         desc: "Exact gross contribution and net cost after relief.", url: "/files/uk/allowance-sniper/allowance-sniper-02" },
  { num: "03", name: "SIPP vs Salary Sacrifice Guide",       desc: "Which route works for your employer and situation.", url: "/files/uk/allowance-sniper/allowance-sniper-03" },
  { num: "04", name: "Gift Aid Alternative",                 desc: "How Gift Aid reduces ANI alongside or instead of SIPP.", url: "/files/uk/allowance-sniper/allowance-sniper-04" },
  { num: "05", name: "Your Accountant Brief",                desc: "Print and take to your next meeting.", url: "/files/uk/allowance-sniper/allowance-sniper-05" },
  { num: "06", name: "Year-by-Year Contribution Schedule",   desc: "Multi-year plan as frozen thresholds affect more people.", url: "/files/uk/allowance-sniper/allowance-sniper-06" },
  { num: "07", name: "Bonus Timing Guide",                   desc: "When to take bonuses to minimise the trap exposure.", url: "/files/uk/allowance-sniper/allowance-sniper-07" },
  { num: "08", name: "Implementation Checklist",             desc: "Every step before 5 April 2027.", url: "/files/uk/allowance-sniper/allowance-sniper-08" },
];

interface Assessment {
  status: string;
  ani: string;
  hiddenTax: string;
  paRemaining: string;
  escapeAmount: string;
  netCost: string;
  trapSummary: string;
  gap2: string;
  gap3: string;
  actions: { title: string; deadline: string; steps: string[] }[];
  sipprec: string; sippWhy: string;
  bonusTip: string;
  accountantQuestions: string[];
  weekPlan: { week: string; action: string }[];
}

export default function SuccessPlan() {
  const [firstName,  setFirstName]  = useState("there");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [copied,     setCopied]     = useState(false);
  const [calDone,    setCalDone]    = useState(false);
  const [checked,    setChecked]    = useState<Record<number,boolean>>({});

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
      const bracket   = sessionStorage.getItem("sniper_bracket") || "£110,000 – £125,140";
      const ani       = sessionStorage.getItem("sniper_ani") || "117000";
      const hiddenTax = sessionStorage.getItem("sniper_hidden_tax") || "3400";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed") || "17000";
      const netCost   = sessionStorage.getItem("sniper_net_cost") || "10200";
      const childcare = sessionStorage.getItem("sniper_childcare") || "false";
      const answers   = sessionStorage.getItem("sniper_answers") || "{}";

      const prompt = `You are a UK tax planning expert writing a personalised 60% trap ACTION PLAN for ${name}.

Data:
- Name: ${name}
- Income bracket: ${bracket}
- ANI: £${ani}
- Hidden extra tax: £${hiddenTax}/year
- Gross SIPP needed: £${contNeeded}
- Net cost after relief: £${netCost}
- Children under 12: ${childcare}
- Their answers: ${answers}

Respond ONLY with JSON, no markdown:

{
  "status": "DEEP IN THE TRAP — 60% EFFECTIVE RATE",
  "ani": "£${ani}",
  "hiddenTax": "£${hiddenTax}",
  "paRemaining": "calculated personal allowance remaining",
  "escapeAmount": "£${contNeeded}",
  "netCost": "£${netCost}",
  "trapSummary": "2-3 sentences specific to ${name}'s deep trap position and urgency",
  "gap2": "second planning gap — one short phrase",
  "gap3": "third planning gap — one short phrase",
  "actions": [
    { "title": "action 1", "deadline": "by X date", "steps": ["step 1","step 2","step 3"] },
    { "title": "action 2", "deadline": "by Y date", "steps": ["step 1","step 2","step 3"] },
    { "title": "action 3", "deadline": "by 5 April 2027", "steps": ["step 1","step 2","step 3"] }
  ],
  "sipprec": "specific SIPP provider recommendation",
  "sippWhy": "2 sentences why this provider for ${name}'s situation",
  "bonusTip": "1-2 sentences about bonus timing relevant to their answers",
  "accountantQuestions": [
    "q1 specific to ${name}", "q2 specific to ${name}", "q3 specific to ${name}", "q4 specific to ${name}", "q5 specific to ${name}"
  ],
  "weekPlan": [
    { "week": "This week", "action": "specific action" },
    { "week": "Next week", "action": "specific action" },
    { "week": "Week 3", "action": "specific action" },
    { "week": "Before 5 April", "action": "Make SIPP contribution — escape the trap" }
  ]
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
      setAssessment(parsed);
    } catch {
      const ani = sessionStorage.getItem("sniper_ani") || "117000";
      const hiddenTax = sessionStorage.getItem("sniper_hidden_tax") || "3400";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed") || "17000";
      const netCost = sessionStorage.getItem("sniper_net_cost") || "10200";
      setAssessment({
        status: "DEEP IN THE TRAP — 60% EFFECTIVE RATE",
        ani: `£${Number(ani).toLocaleString("en-GB")}`,
        hiddenTax: `£${Number(hiddenTax).toLocaleString("en-GB")}`,
        paRemaining: `£${Math.max(0, 12570 - Math.max(0, (Number(ani) - 100000) / 2)).toLocaleString("en-GB")}`,
        escapeAmount: `£${Number(contNeeded).toLocaleString("en-GB")}`,
        netCost: `£${Number(netCost).toLocaleString("en-GB")}`,
        trapSummary: `${name !== "there" ? name : "You"} are deep in the 60% trap, losing £${Number(hiddenTax).toLocaleString("en-GB")} per year to the taper. A gross SIPP contribution of £${Number(contNeeded).toLocaleString("en-GB")} would pull ANI back below £100,000 before 5 April 2027.`,
        gap2: "Bonus timing not optimised",
        gap3: "Multi-year plan needed — thresholds frozen to 2031",
        actions: [
          { title: "Confirm your exact ANI with your accountant", deadline: "this week", steps: ["Request ANI figure for 2026-27", "Confirm pension contributions already made", "Identify any Gift Aid donations to add"] },
          { title: "Set up or use SIPP for the escape contribution", deadline: "by March 2027", steps: ["Open SIPP if not already have one", "Calculate exact gross contribution needed", "Make the contribution before 5 April 2027"] },
          { title: "Claim higher-rate relief via self-assessment", deadline: "by 31 January 2028", steps: ["Include personal pension contributions on return", "Claim the additional 20% relief HMRC does not auto-add", "Verify your tax code is correct for next year"] },
        ],
        sipprec: "Vanguard SIPP or AJ Bell SIPP",
        sippWhy: "Both offer low-cost, flexible personal pension contributions. Vanguard suits DIY investors; AJ Bell is better if you want more investment choice.",
        bonusTip: "If you expect a bonus this year, consider delaying it to a month where SIPP contributions are already in place — or making the SIPP contribution before the bonus hits your tax calculation.",
        accountantQuestions: [
          "What is my exact ANI for 2026-27 after all income sources?",
          "What is the most efficient route — salary sacrifice or personal SIPP?",
          "Should I use carry-forward to make a larger contribution?",
          "Do I need self-assessment to claim the full higher-rate relief?",
          "Is my income approaching the £200,000 threshold for tapered annual allowance?",
        ],
        weekPlan: [
          { week: "This week", action: "Confirm exact ANI with accountant. Open SIPP if not already done." },
          { week: "Next week", action: "Calculate exact gross SIPP contribution needed. Check salary sacrifice availability." },
          { week: "Week 3", action: "Make SIPP contribution or initiate salary sacrifice arrangement." },
          { week: "Before 5 April", action: "Confirm contribution landed. Check ANI is now below £100,000." },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() { window.print(); }

  function handleCalendar() {
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TaxCheckNow//Allowance Sniper Plan//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:60% Trap — Action Plan\r\nBEGIN:VEVENT\r\nUID:sniper-plan-action1@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:${new Date(Date.now()+7*86400000).toISOString().split("T")[0].replace(/-/g,"")}\r\nSUMMARY:60% Trap — Confirm ANI with accountant\r\nDESCRIPTION:Confirm your exact adjusted net income for 2026-27. See your Allowance Sniper Action Plan at taxchecknow.com\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:sniper-plan-sipp@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:20270315\r\nSUMMARY:60% Trap — Make SIPP contribution (2 weeks before year end)\r\nDESCRIPTION:Make your gross SIPP contribution to escape the 60% trap before 5 April 2027.\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:sniper-plan-yearend@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:20270405\r\nSUMMARY:🔴 Tax Year End — 5 April 2027\r\nDESCRIPTION:Last date for 2026-27 SIPP contributions and Gift Aid. After this date the opportunity is gone.\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:sniper-plan-sa@taxchecknow.com\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z\r\nDTSTART;VALUE=DATE:20280131\r\nSUMMARY:Self-Assessment — Claim pension relief\r\nDESCRIPTION:Claim additional higher-rate pension relief on your 2026-27 self-assessment return.\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "allowance-sniper-action-plan.ics";
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
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Payment confirmed · £147</p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">{greeting}, your Allowance Sniper Action Plan</h1>
              <p className="mt-1 text-sm text-emerald-800">Not a guide to the trap. A plan to escape it.</p>
            </div>
            <button onClick={handlePrint}
              className="no-print shrink-0 rounded-xl border-2 border-neutral-950 bg-white px-4 py-2.5 text-sm font-bold text-neutral-950 hover:bg-neutral-950 hover:text-white transition whitespace-nowrap">
              ⬇ Save as PDF
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-red-700 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">🔴 {daysToYearEnd} days to tax year end</span>
          <span className="font-mono text-sm font-bold text-white">5 April 2027</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-600">Building your personal action plan…</p>
          </div>
        ) : assessment && (
          <>
            {/* POSITION */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your compliance position</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "Your ANI",     value: assessment.ani },
                  { label: "PA remaining", value: assessment.paRemaining },
                  { label: "Hidden cost",  value: assessment.hiddenTax, red: true },
                ].map((item, i) => (
                  <div key={i} className={`rounded-xl border px-3 py-2.5 text-center ${item.red ? "bg-red-50 border-red-100" : "bg-neutral-50 border-neutral-100"}`}>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">{item.label}</p>
                    <p className={`mt-0.5 text-xs font-bold ${item.red ? "text-red-800" : "text-neutral-800"}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 mb-3">
                <p className="text-sm leading-relaxed text-red-900">{assessment.trapSummary}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Gap 1", value: "SIPP contribution", urgent: true },
                  { label: "Gap 2", value: assessment.gap2, urgent: false },
                  { label: "Gap 3", value: assessment.gap3, urgent: false },
                ].map((g, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2 text-center ${g.urgent ? "bg-red-50 border border-red-100" : "bg-neutral-50 border border-neutral-100"}`}>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">{g.label}</p>
                    <p className={`mt-0.5 text-xs font-semibold leading-tight ${g.urgent ? "text-red-800" : "text-neutral-600"}`}>{g.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ESCAPE */}
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Your escape numbers</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white border border-red-100 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-neutral-400">Gross SIPP needed</p>
                  <p className="font-serif text-xl font-bold text-neutral-950 mt-1">{assessment.escapeAmount}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-neutral-400">Net cost after relief</p>
                  <p className="font-serif text-xl font-bold text-emerald-700 mt-1">{assessment.netCost}</p>
                </div>
              </div>
            </div>

            {/* ACTION CHECKLIST */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your action checklist</p>
              <div className="space-y-4">
                {assessment.actions.map((action, i) => (
                  <div key={i} className={`rounded-xl border p-4 transition ${checked[i] ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <button onClick={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                        className={`no-print mt-0.5 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition ${checked[i] ? "border-emerald-500 bg-emerald-500" : "border-neutral-300 bg-white hover:border-neutral-950"}`}>
                        {checked[i] && <span className="text-white text-xs">✓</span>}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-bold ${checked[i] ? "line-through text-neutral-400" : "text-neutral-950"}`}>{i + 1}. {action.title}</p>
                          <span className="shrink-0 font-mono text-[10px] text-red-600 font-bold">{action.deadline}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-8 space-y-1">
                      {action.steps.map((step, j) => (
                        <p key={j} className="text-xs text-neutral-600 flex items-start gap-2">
                          <span className="shrink-0 text-neutral-300">→</span>{step}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SIPP REC */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your SIPP recommendation</p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{assessment.sipprec}</h2>
              <p className="mb-3 text-sm leading-relaxed text-neutral-600">{assessment.sippWhy}</p>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="font-mono text-[10px] text-amber-700 mb-1">Bonus tip</p>
                <p className="text-sm text-amber-900">{assessment.bonusTip}</p>
              </div>
            </div>

            {/* WEEK PLAN + CALENDAR */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your week-by-week plan</p>
              <div className="space-y-2 mb-5">
                {assessment.weekPlan.map((w, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <span className="mt-0.5 w-24 shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400">{w.week}</span>
                    <p className="text-sm text-neutral-700">{w.action}</p>
                  </div>
                ))}
              </div>
              <button onClick={handleCalendar}
                className="no-print w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white hover:bg-neutral-800 transition">
                {calDone ? "✓ Calendar downloaded" : "📅 Add all action dates to my calendar →"}
              </button>
            </div>

            {/* ACCOUNTANT */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">Five questions for your accountant</p>
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
              <a href="/files/uk/allowance-sniper/allowance-sniper-05" target="_blank" rel="noopener noreferrer"
                className="no-print text-xs font-bold text-blue-700 underline">File 05 — Print accountant brief →</a>
            </div>

            {/* ALL FILES */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your 8 documents</p>
              <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">Everything in one place</h2>
              <div className="space-y-2">
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
                {greeting}, tick off action 1 above. Then open File 02 for the exact numbers. Make your SIPP contribution before 5 April 2027.
              </p>
              <div className="flex gap-3 flex-wrap no-print">
                <button onClick={handlePrint}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-800 transition">
                  ⬇ Save as PDF
                </button>
              </div>
              <p className="mt-3 text-sm text-neutral-400">{daysToYearEnd} days to 5 April 2027. Start today.</p>
            </div>

            <div className="no-print rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Also relevant for you</p>
              <p className="mb-1 font-serif text-lg font-bold text-neutral-950">Making Tax Digital — 7 August 2026</p>
              <p className="mb-3 text-sm text-neutral-600">If your income includes self-employment or rental above £50,000, MTD applies from 6 April 2026.</p>
              <Link href="/uk/check/mtd-scorecard"
                className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950 transition">
                Check your MTD position →
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
