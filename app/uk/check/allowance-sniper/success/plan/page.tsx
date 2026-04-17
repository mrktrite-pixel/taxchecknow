"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const ALL_FILES = [
  { num: "01", name: "Your ANI Position Assessment",          desc: "Exact ANI, personal allowance remaining, hidden tax cost confirmed.", url: "/files/uk/allowance-sniper/allowance-sniper-01" },
  { num: "02", name: "Your SIPP Escape Calculation",          desc: "Exact gross contribution and net cost after all relief.", url: "/files/uk/allowance-sniper/allowance-sniper-02", start: true },
  { num: "03", name: "SIPP vs Salary Sacrifice Guide",        desc: "Which route works for your employer and situation.", url: "/files/uk/allowance-sniper/allowance-sniper-03" },
  { num: "04", name: "Gift Aid Alternative",                  desc: "How Gift Aid reduces ANI alongside or instead of SIPP.", url: "/files/uk/allowance-sniper/allowance-sniper-04" },
  { num: "05", name: "Your Accountant Brief",                 desc: "Print and forward to your accountant before your next meeting.", url: "/files/uk/allowance-sniper/allowance-sniper-05" },
  { num: "06", name: "Year-by-Year Contribution Schedule",    desc: "Multi-year plan — thresholds frozen to 2031, this recurs.", url: "/files/uk/allowance-sniper/allowance-sniper-06" },
  { num: "07", name: "Bonus Timing Guide",                    desc: "When to take bonuses to avoid deepening the trap.", url: "/files/uk/allowance-sniper/allowance-sniper-07" },
  { num: "08", name: "Your Implementation Checklist",         desc: "Every step before 5 April 2027 — with tick boxes.", url: "/files/uk/allowance-sniper/allowance-sniper-08" },
];

interface Action {
  title: string;
  deadline: string;
  steps: string[];
}

interface WeekPlan {
  week: string;
  action: string;
}

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
  actions: Action[];
  sipprec: string;
  sippWhy: string;
  bonusTip: string;
  accountantQuestions: string[];
  weekPlan: WeekPlan[];
}

export default function SuccessPlan() {
  const [firstName,  setFirstName]  = useState("there");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [copied,     setCopied]     = useState(false);
  const [calDone,    setCalDone]    = useState(false);
  const [checked,    setChecked]    = useState<Record<number, boolean>>({});

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
      const bracket    = sessionStorage.getItem("sniper_bracket")             || "£110,000 – £125,140";
      const ani        = sessionStorage.getItem("sniper_ani")                 || "117000";
      const hiddenTax  = sessionStorage.getItem("sniper_hidden_tax")          || "3400";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed") || "17000";
      const netCost    = sessionStorage.getItem("sniper_net_cost")            || "10200";
      const childcare  = sessionStorage.getItem("sniper_childcare")           || "false";
      const answers    = sessionStorage.getItem("sniper_answers")             || "{}";

      const prompt = `You are a UK tax planning expert. Write a personalised 60% trap ACTION PLAN for ${name}.

Their data:
- Income bracket: ${bracket}
- Adjusted net income: £${Number(ani).toLocaleString("en-GB")}
- Hidden extra tax per year: £${Number(hiddenTax).toLocaleString("en-GB")}
- Gross SIPP contribution needed: £${Number(contNeeded).toLocaleString("en-GB")}
- Net cost after relief: £${Number(netCost).toLocaleString("en-GB")}
- Children under 12: ${childcare}
- Their questionnaire answers: ${answers}

Write a detailed, personalised action plan. Use their name. Reference their specific numbers. Be direct and actionable — not generic. The plan should feel written for them specifically.

Respond ONLY with a valid JSON object. No markdown. No backticks. No preamble. Just the JSON:

{
  "status": "their exact trap label",
  "ani": "formatted £ figure",
  "hiddenTax": "formatted £ figure",
  "paRemaining": "calculated PA remaining",
  "escapeAmount": "formatted £ figure",
  "netCost": "formatted £ figure",
  "trapSummary": "2-3 sentences specific to ${name}'s deep trap position — reference their numbers and urgency",
  "gap2": "second planning gap specific to their situation — short phrase",
  "gap3": "third planning gap — short phrase",
  "actions": [
    {
      "title": "specific action 1 for ${name}",
      "deadline": "this week",
      "steps": ["specific step 1", "specific step 2", "specific step 3"]
    },
    {
      "title": "specific action 2",
      "deadline": "by March 2027",
      "steps": ["step 1", "step 2", "step 3"]
    },
    {
      "title": "specific action 3",
      "deadline": "before 5 April 2027",
      "steps": ["step 1", "step 2", "step 3"]
    }
  ],
  "sipprec": "specific SIPP provider recommendation",
  "sippWhy": "2 sentences why that provider for ${name}'s situation",
  "bonusTip": "1-2 sentences about bonus timing relevant to their answers",
  "accountantQuestions": [
    "q1 specific to ${name}",
    "q2 specific to ${name}",
    "q3 specific to ${name}",
    "q4 specific to ${name}",
    "q5 specific to ${name}"
  ],
  "weekPlan": [
    { "week": "This week", "action": "specific action" },
    { "week": "Next week", "action": "specific action" },
    { "week": "Week 3", "action": "specific action" },
    { "week": "Before 5 April", "action": "Make SIPP contribution — escape the trap for good" }
  ]
}`;

      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:      "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages:   [{ role: "user", content: prompt }],
        }),
      });
      const data   = await res.json();
      const text   = data.content?.[0]?.text || "";
      const clean  = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAssessment(parsed);
    } catch {
      const ani        = sessionStorage.getItem("sniper_ani")                 || "117000";
      const hiddenTax  = sessionStorage.getItem("sniper_hidden_tax")          || "3400";
      const contNeeded = sessionStorage.getItem("sniper_contribution_needed") || "17000";
      const netCost    = sessionStorage.getItem("sniper_net_cost")            || "10200";
      const aniNum     = Number(ani);
      const paLeft     = Math.max(0, 12570 - Math.max(0, (aniNum - 100000) / 2));
      setAssessment({
        status:      "DEEP IN THE TRAP — 60% EFFECTIVE RATE",
        ani:         `£${aniNum.toLocaleString("en-GB")}`,
        hiddenTax:   `£${Number(hiddenTax).toLocaleString("en-GB")}`,
        paRemaining: `£${paLeft.toLocaleString("en-GB")}`,
        escapeAmount:`£${Number(contNeeded).toLocaleString("en-GB")}`,
        netCost:     `£${Number(netCost).toLocaleString("en-GB")}`,
        trapSummary: `${name !== "there" ? name : "Your"} adjusted net income places you deep in the 60% trap. You are losing £${Number(hiddenTax).toLocaleString("en-GB")} per year to the personal allowance taper. A gross SIPP contribution of £${Number(contNeeded).toLocaleString("en-GB")} would pull your ANI back below £100,000 and restore your full personal allowance before 5 April 2027.`,
        gap2:        "Bonus timing not yet optimised",
        gap3:        "Multi-year plan needed — thresholds frozen to 2031",
        actions: [
          {
            title:    "Confirm your exact ANI with your accountant",
            deadline: "this week",
            steps: [
              "Request your exact ANI figure for 2026-27 including all income sources",
              "Confirm pension contributions already made this tax year",
              "Identify any Gift Aid donations to include in the calculation",
            ],
          },
          {
            title:    "Set up your SIPP and make the escape contribution",
            deadline: "by 20 March 2027",
            steps: [
              "Open a SIPP if you do not already have one — see your recommendation above",
              "Make the net payment (80% of gross contribution) to the SIPP",
              "Confirm the contribution has landed in the account before 5 April",
            ],
          },
          {
            title:    "Claim higher-rate pension relief via self-assessment",
            deadline: "by 31 January 2028",
            steps: [
              "Include gross pension contributions on your 2026-27 self-assessment return",
              "HMRC will apply the additional 20% higher-rate relief automatically",
              "Verify your 2027-28 PAYE tax code reflects the change",
            ],
          },
        ],
        sipprec:  "Vanguard SIPP or AJ Bell SIPP",
        sippWhy:  "Both offer low-cost, flexible personal pension contributions with relief at source. Vanguard suits index investors. AJ Bell offers more investment choice and is better if you want telephone support.",
        bonusTip: "If you expect a bonus this tax year, consider making your SIPP contribution before the bonus lands — or sacrifice part of the bonus into your pension via your employer before it is contractually due.",
        accountantQuestions: [
          `What is my exact adjusted net income for 2026-27 after all income sources?`,
          `What is the most efficient route for my situation — personal SIPP, salary sacrifice or Gift Aid?`,
          `Do I have unused annual allowance from previous years I can carry forward?`,
          `Do I need to file self-assessment to claim the full higher-rate pension relief?`,
          `Is my income approaching the £200,000 threshold for the tapered annual allowance?`,
        ],
        weekPlan: [
          { week: "This week",      action: "Confirm exact ANI with accountant. Open SIPP if not already done." },
          { week: "Next week",      action: "Calculate exact gross SIPP contribution. Check salary sacrifice availability with HR." },
          { week: "Week 3",         action: "Make SIPP contribution or initiate salary sacrifice arrangement." },
          { week: "Before 5 April", action: "Confirm contribution landed. Check ANI is now below £100,000." },
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
      "PRODID:-//TaxCheckNow//Allowance Sniper Plan//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:60% Trap — Action Plan",
      "BEGIN:VEVENT",
      `UID:sniper-plan-action1-${Date.now()}@taxchecknow.com`,
      `DTSTART;VALUE=DATE:${actionDate}`,
      `DTEND;VALUE=DATE:${actionDate}`,
      `DTSTAMP:${now}`,
      "SUMMARY:60% Trap — Confirm ANI with accountant",
      "DESCRIPTION:Confirm your exact adjusted net income for 2026-27. Agree SIPP contribution amount and route. See File 05 — Accountant Brief at taxchecknow.com/files/uk/allowance-sniper/allowance-sniper-05",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      `UID:sniper-plan-sipp-${Date.now()}@taxchecknow.com`,
      "DTSTART;VALUE=DATE:20270315",
      "DTEND;VALUE=DATE:20270315",
      `DTSTAMP:${now}`,
      "SUMMARY:60% Trap — Make SIPP contribution (3 weeks before year end)",
      "DESCRIPTION:Make your gross SIPP contribution. Allow 3-5 working days for processing. See your implementation checklist at taxchecknow.com/files/uk/allowance-sniper/allowance-sniper-08",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      `UID:sniper-plan-yearend-${Date.now()}@taxchecknow.com`,
      "DTSTART;VALUE=DATE:20270405",
      "DTEND;VALUE=DATE:20270405",
      `DTSTAMP:${now}`,
      "SUMMARY:🔴 Tax Year End — 5 April 2027",
      "DESCRIPTION:Last date for SIPP contributions and Gift Aid to count for 2026-27. After this date the opportunity is permanently gone for this tax year.",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      `UID:sniper-plan-review-${Date.now()}@taxchecknow.com`,
      "DTSTART;VALUE=DATE:20271001",
      "DTEND;VALUE=DATE:20271001",
      `DTSTAMP:${now}`,
      "SUMMARY:60% Trap — Review 2027-28 ANI position",
      "DESCRIPTION:Thresholds frozen to April 2031. Check if salary rise has increased exposure for next year. See your year-by-year schedule at taxchecknow.com/files/uk/allowance-sniper/allowance-sniper-06",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      `UID:sniper-plan-sa-${Date.now()}@taxchecknow.com`,
      "DTSTART;VALUE=DATE:20280131",
      "DTEND;VALUE=DATE:20280131",
      `DTSTAMP:${now}`,
      "SUMMARY:Self-Assessment — Claim pension relief",
      "DESCRIPTION:Claim additional higher-rate pension relief on your 2026-27 self-assessment return. HMRC does not add this automatically.",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = "allowance-sniper-action-plan.ics";
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
          .action-check { background: #f5f5f5 !important; }
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
                Payment confirmed · Action Plan · £147
              </p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">
                {greeting !== "your" ? `${greeting}, your` : "Your"} Allowance Sniper Action Plan
              </h1>
              <p className="mt-1 text-sm text-emerald-800">
                Not a guide to the 60% trap. A plan to escape it — built around your numbers.
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
            <p className="text-sm font-medium text-neutral-600">Building your personal action plan…</p>
            <p className="mt-1 text-xs text-neutral-400">Generating around your specific numbers and situation</p>
          </div>
        ) : assessment && (
          <>
            {/* ── COMPLIANCE POSITION ── */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your compliance position
              </p>
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Your ANI",     value: assessment.ani,         red: false },
                  { label: "PA remaining", value: assessment.paRemaining, red: false },
                  { label: "Hidden cost",  value: assessment.hiddenTax,   red: true  },
                ].map(item => (
                  <div key={item.label}
                    className={`rounded-xl border px-3 py-2.5 text-center ${item.red ? "border-red-100 bg-red-50" : "border-neutral-100 bg-neutral-50"}`}>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">{item.label}</p>
                    <p className={`mt-0.5 text-sm font-bold ${item.red ? "text-red-800" : "text-neutral-900"}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm leading-relaxed text-red-900">{assessment.trapSummary}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Gap 1", value: "SIPP contribution",  urgent: true  },
                  { label: "Gap 2", value: assessment.gap2,      urgent: false },
                  { label: "Gap 3", value: assessment.gap3,      urgent: false },
                ].map((g, i) => (
                  <div key={i}
                    className={`rounded-xl border px-3 py-2 text-center ${g.urgent ? "border-red-100 bg-red-50" : "border-neutral-100 bg-neutral-50"}`}>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">{g.label}</p>
                    <p className={`mt-0.5 text-xs font-semibold leading-tight ${g.urgent ? "text-red-800" : "text-neutral-600"}`}>{g.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ESCAPE NUMBERS ── */}
            <div className="print-section rounded-2xl border-2 border-red-300 bg-red-50 p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-red-700">
                Your escape numbers
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-xl border border-red-100 bg-white px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-neutral-400">Gross SIPP needed</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-neutral-950">{assessment.escapeAmount}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                  <p className="font-mono text-[10px] text-neutral-400">Net cost after all relief</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-emerald-700">{assessment.netCost}</p>
                </div>
              </div>
              <p className="text-xs text-red-700">
                Full calculation with net payment breakdown in{" "}
                <a href="/files/uk/allowance-sniper/allowance-sniper-02" target="_blank" rel="noopener noreferrer"
                  className="font-semibold underline hover:text-red-900 transition">File 02 →</a>
              </p>
            </div>

            {/* ── ACTION CHECKLIST ── */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your action checklist
              </p>
              <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">
                Three actions. One outcome.
              </h2>
              <div className="space-y-4">
                {assessment.actions.map((action, i) => (
                  <div key={i}
                    className={`action-check rounded-xl border p-4 transition-colors ${checked[i] ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"}`}>
                    <div className="mb-3 flex items-start gap-3">
                      <button
                        onClick={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                        className={`no-print mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${checked[i] ? "border-emerald-500 bg-emerald-500" : "border-neutral-300 bg-white hover:border-neutral-950"}`}>
                        {checked[i] && <span className="text-[10px] font-bold text-white">✓</span>}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-bold ${checked[i] ? "text-neutral-400 line-through" : "text-neutral-950"}`}>
                            {i + 1}. {action.title}
                          </p>
                          <span className="shrink-0 font-mono text-[10px] font-bold text-red-600">{action.deadline}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-8 space-y-1.5">
                      {action.steps.map((step, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0 text-neutral-300">→</span>
                          <p className="text-xs leading-relaxed text-neutral-600">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-neutral-400">
                Full implementation checklist with tick boxes in{" "}
                <a href="/files/uk/allowance-sniper/allowance-sniper-08"
                  className="font-semibold underline hover:text-neutral-700 transition">File 08 →</a>
              </p>
            </div>

            {/* ── SIPP + BONUS ── */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your SIPP recommendation
              </p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{assessment.sipprec}</h2>
              <p className="mb-3 text-sm leading-relaxed text-neutral-600">{assessment.sippWhy}</p>
              <div className="mb-4 grid gap-2 sm:grid-cols-3">
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
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">Bonus tip</p>
                <p className="text-sm leading-relaxed text-amber-900">{assessment.bonusTip}</p>
                <p className="mt-1 text-xs text-amber-700">
                  Full bonus timing strategy in{" "}
                  <a href="/files/uk/allowance-sniper/allowance-sniper-07" target="_blank" rel="noopener noreferrer"
                    className="font-semibold underline hover:text-amber-900 transition">File 07 →</a>
                </p>
              </div>
            </div>

            {/* ── WEEK PLAN + CALENDAR ── */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your week-by-week plan
              </p>
              <h2 className="mb-4 font-serif text-lg font-bold text-neutral-950">
                Four weeks to escape the trap
              </h2>
              <div className="mb-5 space-y-2">
                {assessment.weekPlan.map((w, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <span className="mt-0.5 w-24 shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      {w.week}
                    </span>
                    <p className="text-sm leading-relaxed text-neutral-700">{w.action}</p>
                  </div>
                ))}
              </div>
              <button onClick={handleCalendar}
                className="no-print w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                {calDone
                  ? "✓ Calendar downloaded — open in Apple / Google / Outlook"
                  : "📅 Add all action dates to my calendar →"}
              </button>
              <p className="mt-2 text-center text-xs text-neutral-400">
                5 events · Apple Calendar · Google Calendar · Outlook
              </p>
            </div>

            {/* ── ACCOUNTANT ── */}
            <div className="print-section rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">
                    Five questions for your accountant
                  </p>
                  <p className="mt-0.5 text-xs text-blue-600">
                    Full accountant brief in{" "}
                    <a href="/files/uk/allowance-sniper/allowance-sniper-05" target="_blank" rel="noopener noreferrer"
                      className="font-semibold underline">File 05 →</a>
                    {" "}— print and take to your next meeting
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

            {/* ── ALL 8 FILES ── */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your eight documents
              </p>
              <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">
                Everything in one place
              </h2>
              <p className="mb-4 text-sm text-neutral-500">
                Each file opens in your browser and saves as a clean PDF.
                Files 06, 07 and 08 are exclusive to this Action Plan.
              </p>
              <div className="space-y-2">
                {ALL_FILES.map(f => (
                  <div key={f.num}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${f.start ? "border-neutral-900 bg-neutral-950" : Number(f.num) >= 6 ? "border-blue-100 bg-blue-50" : "border-neutral-100 bg-neutral-50"}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        {f.start && (
                          <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400">Start here</span>
                        )}
                        {Number(f.num) >= 6 && (
                          <span className="font-mono text-[9px] uppercase tracking-widest text-blue-600">Action Plan only</span>
                        )}
                      </div>
                      <p className={`text-sm font-semibold ${f.start ? "text-white" : "text-neutral-950"}`}>
                        {f.num} — {f.name}
                      </p>
                      <p className={`text-xs ${f.start ? "text-neutral-400" : Number(f.num) >= 6 ? "text-blue-700" : "text-neutral-500"}`}>
                        {f.desc}
                      </p>
                    </div>
                    <a href={f.url} target="_blank" rel="noopener noreferrer"
                      className={`no-print ml-4 shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition ${f.start
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
                {greeting !== "your" ? `${greeting}, tick` : "Tick"} off action 1 above. Open File 02 for the exact numbers.
                Forward File 05 to your accountant.
                Make the SIPP contribution before 5 April 2027.
                Then open File 06 — the trap recurs every year until 2031.
              </p>
              <div className="mb-4 flex flex-wrap gap-3 no-print">
                <button onClick={() => window.print()}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:bg-neutral-800">
                  ⬇ Save this page as PDF
                </button>
                <button onClick={handleCalendar}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:bg-neutral-800">
                  📅 Calendar →
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
                <p className="mt-2 text-xs text-neutral-500">
                  5 April 2027 · No backdating after this date ·{" "}
                  <a href="https://www.gov.uk/income-tax-rates" target="_blank" rel="noopener noreferrer"
                    className="underline hover:text-neutral-400 transition">GOV.UK source</a>
                </p>
              </div>
            </div>

            {/* ── CROSSLINK ── */}
            <div className="no-print rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Also relevant for you
              </p>
              <p className="mb-1 font-serif text-lg font-bold text-white">
                Making Tax Digital — 7 August 2026
              </p>
              <p className="mb-3 text-sm text-neutral-400">
                If your income includes self-employment or rental above £50,000,
                MTD applies from 6 April 2026. First quarterly deadline: 7 August 2026.
              </p>
              <Link href="/uk/check/mtd-scorecard"
                className="font-mono text-xs font-bold text-neutral-400 underline transition hover:text-white">
                Check your MTD compliance position →
              </Link>
            </div>
          </>
        )}

        {/* ── DISCLAIMER ── */}
        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs leading-relaxed text-neutral-500">
            <strong className="text-neutral-600">General information only.</strong>{" "}
            This action plan does not constitute financial, tax or legal advice.
            TaxCheckNow is not a regulated financial adviser.
            Always consult a qualified UK tax adviser before making pension or financial decisions.
            SIPP provider links may include affiliate links — we may earn a small commission at no extra cost to you.
            Based on HMRC guidance April 2026.{" "}
            <a href="https://www.gov.uk/income-tax-rates" target="_blank" rel="noopener noreferrer"
              className="underline hover:text-neutral-700">GOV.UK — Income Tax rates</a> ·{" "}
            <a href="https://www.gov.uk/guidance/adjusted-net-income" target="_blank" rel="noopener noreferrer"
              className="underline hover:text-neutral-700">GOV.UK — Adjusted net income</a> ·{" "}
            <a href="https://www.gov.uk/tax-on-your-private-pension/annual-allowance" target="_blank" rel="noopener noreferrer"
              className="underline hover:text-neutral-700">GOV.UK — Pension annual allowance</a>
          </p>
        </div>

      </main>
    </div>
  );
}
