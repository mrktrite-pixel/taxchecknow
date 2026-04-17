"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { generateMTDCalendar, downloadICS } from "@/lib/generate-ics";

const DRIVE_FOLDER = "https://drive.google.com/drive/folders/1mMvsfqWe41CRbzB5GJgWBeRHz2YfJwiV?usp=sharing";

const ALL_FILES = [
  { num: "01", name: "Your MTD Scope Assessment",          desc: "Your exact compliance position confirmed in writing." },
  { num: "02", name: "Your Software Recommendation",       desc: "One specific recommendation for your situation." },
  { num: "03", name: "Your HMRC Registration Steps",       desc: "Step-by-step walkthrough — GOV.UK process." },
  { num: "04", name: "Your Deadline Calendar",             desc: "Every filing date for 2026-27." },
  { num: "05", name: "Your Accountant Brief",              desc: "Print and take to your next meeting." },
  { num: "06", name: "Your Gap Closure Plan",              desc: "What to fix, in what order, by when." },
  { num: "07", name: "Your First Submission Checklist",    desc: "Every step before you submit Q1 on 7 August." },
  { num: "08", name: "Your Digital Records Template",      desc: "Pre-built template — start using today." },
  { num: "09", name: "Your Digital Links Audit",           desc: "Audit your records chain against HMRC rules." },
  { num: "10", name: "Your HMRC Registration Walkthrough", desc: "Screen-by-screen registration guide." },
];

interface Action {
  title: string;
  deadline: string;
  steps: string[];
  hmrcLink?: string;
  fileRef: string;
  fileLabel: string;
}

interface Assessment {
  status: string;
  bracket: string;
  complianceScore: number;
  biggestGap: string;
  gapDetail: string;
  gap2: string;
  gap3: string;
  actions: Action[];
  softwareRec: string;
  softwareWhy: string;
  softwareLink: string;
  digitalLinksRisk: string;
  digitalLinksFixes: string[];
  accountantQuestions: string[];
  weekPlan: { week: string; action: string }[];
}

export default function SuccessExecute() {
  const [firstName, setFirstName] = useState("there");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [calDone, setCalDone] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [dlChecked, setDlChecked] = useState<Record<number, boolean>>({});

  const days = Math.max(0, Math.floor(
    (new Date("2026-08-07").getTime() - Date.now()) / 86_400_000
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
      const software = sessionStorage.getItem("mtd_software") || "unknown";
      const records  = sessionStorage.getItem("mtd_records")  || "unknown";
      const reg      = sessionStorage.getItem("mtd_registration") || "unknown";
      const bracket  = sessionStorage.getItem("mtd_bracket")  || "£50,000 – £100,000";
      const source   = sessionStorage.getItem("mtd_income_source") || "sole trader";
      const score    = sessionStorage.getItem("mtd_score") || "40";

      const prompt = `You are a UK MTD tax expert writing a personalised action plan for ${name}.

Their answers:
- Name: ${name}
- Income bracket: ${bracket}
- Income source: ${source}
- Software status: ${software}
- Records status: ${records}
- Registration status: ${reg}
- Compliance score: ${score}/100

Respond ONLY with a JSON object, no markdown:

{
  "status": "REQUIRED — IN SCOPE FROM 6 APRIL 2026",
  "bracket": "${bracket}",
  "complianceScore": ${score},
  "biggestGap": "Short title of biggest gap for ${name} based on their answers",
  "gapDetail": "2-3 sentences specific to ${name}'s situation and why it is urgent",
  "gap2": "Second gap — short title",
  "gap3": "Third gap — short title",
  "actions": [
    {
      "title": "Action 1 title based on their biggest gap",
      "deadline": "specific deadline e.g. by 30 June 2026",
      "steps": ["step 1", "step 2", "step 3"],
      "hmrcLink": "relevant HMRC URL",
      "fileRef": "File 10" ,
      "fileLabel": "Registration Walkthrough"
    },
    {
      "title": "Action 2 title",
      "deadline": "deadline",
      "steps": ["step 1", "step 2", "step 3"],
      "fileRef": "File 06",
      "fileLabel": "Gap Closure Plan"
    },
    {
      "title": "Action 3 title",
      "deadline": "by 7 August 2026",
      "steps": ["step 1", "step 2", "step 3"],
      "hmrcLink": "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
      "fileRef": "File 07",
      "fileLabel": "First Submission Checklist"
    }
  ],
  "softwareRec": "Single best software name for ${name}'s situation",
  "softwareWhy": "2 sentences why this software suits ${name} — reference their software and records answers specifically",
  "softwareLink": "direct URL to trial or signup",
  "digitalLinksRisk": "1-2 sentences about ${name}'s specific digital links risk based on their software and records answers",
  "digitalLinksFixes": [
    "specific fix 1 for their situation",
    "specific fix 2 for their situation"
  ],
  "accountantQuestions": [
    "question 1 specific to ${name}",
    "question 2 specific to ${name}",
    "question 3 specific to ${name}",
    "question 4 specific to ${name}",
    "question 5 specific to ${name}"
  ],
  "weekPlan": [
    { "week": "This week", "action": "specific action for ${name} based on their biggest gap" },
    { "week": "Next week", "action": "specific second action" },
    { "week": "Week 3 (by 15 July)", "action": "specific third action" },
    { "week": "Week 4 (by 7 Aug)", "action": "Submit Q1 quarterly update through your software before 7 August 2026" }
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
      setAssessment({
        status: "REQUIRED — IN SCOPE FROM 6 APRIL 2026",
        bracket: sessionStorage.getItem("mtd_bracket") || "£50,000 – £100,000",
        complianceScore: Number(sessionStorage.getItem("mtd_score") || 40),
        biggestGap: "HMRC Registration Not Complete",
        gapDetail: `${firstName !== "there" ? firstName : "You"} must register for MTD separately from self-assessment. Without registration you cannot submit your first quarterly update by 7 August 2026. This is your most urgent action.`,
        gap2: "MTD Software Not Set Up",
        gap3: "Q1 Digital Records Not Started",
        actions: [
          {
            title: "Register for MTD with HMRC",
            deadline: "by 30 June 2026",
            steps: [
              "Go to gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax",
              "Sign in with your Government Gateway credentials",
              "Select your income sources and MTD software",
              "Confirm your 6 April 2026 start date and submit",
            ],
            hmrcLink: "https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax",
            fileRef: "File 10",
            fileLabel: "Registration Walkthrough",
          },
          {
            title: "Set up MTD software and connect bank feed",
            deadline: "by 15 July 2026",
            steps: [
              "Sign up for your chosen MTD software",
              "Connect your business bank account via bank feed",
              "Import or enter transactions from 6 April 2026",
              "Test connection to HMRC is working",
            ],
            fileRef: "File 02",
            fileLabel: "Software Recommendation",
          },
          {
            title: "Submit Q1 before 7 August 2026",
            deadline: "by 7 August 2026",
            steps: [
              "Reconcile all Q1 transactions (6 April to 30 June 2026)",
              "Review income and expense summary in your software",
              "Run through File 07 submission checklist",
              "Submit quarterly update to HMRC through your software",
            ],
            hmrcLink: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
            fileRef: "File 07",
            fileLabel: "First Submission Checklist",
          },
        ],
        softwareRec: "FreeAgent",
        softwareWhy: "FreeAgent is HMRC-approved and built specifically for sole traders and landlords. If you bank with NatWest, RBS or Mettle it is completely free — otherwise £19/month with a 30-day trial.",
        softwareLink: "https://www.freeagent.com",
        digitalLinksRisk: "Your current records setup requires attention. The digital links rule means every step in your chain must be digitally connected — no manual copying between systems or spreadsheets.",
        digitalLinksFixes: [
          "Connect your bank account via bank feed — no manual entry",
          "Use your software to capture receipts — not paper or email",
        ],
        accountantQuestions: [
          "Have you registered me for MTD — or do I need to do this myself?",
          "Which MTD software do you recommend for my situation?",
          "What is my biggest compliance risk before 7 August 2026?",
          "Who is handling my Q1 submission — you or me?",
          "What changes for my January 2028 final declaration under MTD?",
        ],
        weekPlan: [
          { week: "This week", action: "Choose MTD software, sign up for trial, connect bank feed" },
          { week: "Next week", action: "Register with HMRC for MTD — takes 10 minutes" },
          { week: "Week 3 (by 15 July)", action: "Enter and reconcile all Q1 transactions — 6 April to 30 June" },
          { week: "Week 4 (by 7 Aug)", action: "Submit Q1 quarterly update through your software before 7 August 2026" },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() { window.print(); }

  function handleCalendar() {
    const ics = generateMTDCalendar({
      firstName,
      tier: "127",
      softwareRec: assessment?.softwareRec,
    });
    downloadICS(ics, "mtd-action-plan-deadlines.ics");
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
  const greetingCap = firstName !== "there" ? firstName : "You";

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
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
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Payment confirmed · £127</p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">
                {greetingCap} MTD Action Plan
              </h1>
              <p className="mt-1 text-sm text-emerald-800">
                Not a guide to MTD. A plan for your MTD.
              </p>
            </div>
            <button onClick={handlePrint}
              className="no-print shrink-0 rounded-xl border-2 border-neutral-950 bg-white px-4 py-2.5 text-sm font-bold text-neutral-950 hover:bg-neutral-950 hover:text-white transition whitespace-nowrap">
              ⬇ Save as PDF
            </button>
          </div>
        </div>

        {/* DEADLINE */}
        <div className="rounded-xl bg-red-700 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">🔴 {days} days to your first MTD deadline</span>
          <span className="font-mono text-sm font-bold text-white">7 August 2026</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-600">Building {greeting} action plan…</p>
            <p className="mt-1 text-xs text-neutral-400">Analysing your specific compliance gaps</p>
          </div>
        ) : assessment && (
          <>
            {/* ── SECTION 2: COMPLIANCE POSITION ──────────────────────── */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your compliance position</p>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-xs text-neutral-500">Today</span>
                    <span className="font-mono text-sm font-bold text-neutral-950">{assessment.complianceScore}/100</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-neutral-100">
                    <div className="h-2.5 rounded-full bg-neutral-950 transition-all"
                      style={{ width: `${assessment.complianceScore}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-[10px] text-neutral-400">Target</p>
                  <p className="font-mono text-sm font-bold text-emerald-600">100/100</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Gap 1", value: assessment.biggestGap, urgent: true },
                  { label: "Gap 2", value: assessment.gap2, urgent: false },
                  { label: "Gap 3", value: assessment.gap3, urgent: false },
                ].map((g, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2.5 text-center ${g.urgent ? "bg-red-50 border border-red-100" : "bg-neutral-50 border border-neutral-100"}`}>
                    <p className={`font-mono text-[9px] uppercase tracking-widest ${g.urgent ? "text-red-600" : "text-neutral-400"}`}>{g.label}</p>
                    <p className={`mt-0.5 text-xs font-semibold leading-tight ${g.urgent ? "text-red-800" : "text-neutral-600"}`}>{g.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── SECTION 3: BIGGEST GAP ───────────────────────────────── */}
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Your biggest compliance gap — fix this first</p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{assessment.biggestGap}</h2>
              <p className="text-sm leading-relaxed text-red-900">{assessment.gapDetail}</p>
            </div>

            {/* ── SECTION 4: ACTION CHECKLIST ──────────────────────────── */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your action checklist — three steps to compliance</p>
              <div className="space-y-4">
                {assessment.actions.map((action, i) => (
                  <div key={i} className={`rounded-xl border p-4 transition ${checked[i] ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <button onClick={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                        className={`mt-0.5 h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition no-print ${checked[i] ? "border-emerald-500 bg-emerald-500" : "border-neutral-300 bg-white hover:border-neutral-950"}`}>
                        {checked[i] && <span className="text-white text-xs">✓</span>}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-bold ${checked[i] ? "line-through text-neutral-400" : "text-neutral-950"}`}>
                            {i + 1}. {action.title}
                          </p>
                          <span className="shrink-0 font-mono text-[10px] text-red-600 font-bold">{action.deadline}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-8 space-y-1 mb-3">
                      {action.steps.map((step, j) => (
                        <p key={j} className="text-xs text-neutral-600 flex items-start gap-2">
                          <span className="shrink-0 text-neutral-300 mt-0.5">→</span>{step}
                        </p>
                      ))}
                    </div>
                    <div className="ml-8 flex gap-2 flex-wrap no-print">
                      {action.hmrcLink && (
                        <a href={action.hmrcLink} target="_blank" rel="noopener noreferrer"
                          className="rounded-lg bg-neutral-950 px-3 py-1.5 font-mono text-xs font-bold text-white hover:bg-neutral-700 transition">
                          Go to HMRC →
                        </a>
                      )}
                      <a href={DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-neutral-700 hover:bg-neutral-50 transition">
                        {action.fileRef} — {action.fileLabel} →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── SECTION 5: SOFTWARE ──────────────────────────────────── */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your software recommendation</p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{assessment.softwareRec}</h2>
              <p className="mb-4 text-sm leading-relaxed text-neutral-600">{assessment.softwareWhy}</p>
              <div className="flex gap-3 flex-wrap no-print">
                <a href={assessment.softwareLink} target="_blank" rel="noopener noreferrer"
                  className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 transition">
                  Start free trial →
                </a>
                <a href="https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax"
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition">
                  All HMRC-approved software →
                </a>
              </div>
              <p className="mt-3 text-xs text-neutral-400">
                Full comparison in File 02 · Affiliate disclosure: we may earn a commission at no cost to you.
              </p>
            </div>

            {/* ── SECTION 6: DIGITAL LINKS ─────────────────────────────── */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">Your digital links risk</p>
              <p className="mb-3 text-sm leading-relaxed text-amber-900">{assessment.digitalLinksRisk}</p>
              <div className="space-y-2 mb-4">
                {["No manual copying between systems — use bank feeds", "Submit directly from software — not the HMRC portal", "All receipts stored digitally — no paper records"].map((check, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <button onClick={() => setDlChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                      className={`no-print h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition ${dlChecked[i] ? "border-emerald-500 bg-emerald-500" : "border-amber-400 bg-white"}`}>
                      {dlChecked[i] && <span className="text-white text-xs">✓</span>}
                    </button>
                    <p className="text-sm text-amber-900">{check}</p>
                  </div>
                ))}
              </div>
              <a href={DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
                className="no-print inline-block rounded-lg border border-amber-300 bg-white px-4 py-2 font-mono text-xs font-bold text-amber-800 hover:bg-amber-100 transition">
                File 09 — Full Digital Links Audit →
              </a>
            </div>

            {/* ── SECTION 7: WEEK PLAN + CALENDAR ─────────────────────── */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your week-by-week plan to 7 August</p>
              <h2 className="mb-4 font-serif text-lg font-bold text-neutral-950">Four weeks. One goal.</h2>
              <div className="space-y-2 mb-5">
                {assessment.weekPlan.map((w, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <span className="mt-0.5 w-28 shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400">{w.week}</span>
                    <p className="text-sm text-neutral-700">{w.action}</p>
                  </div>
                ))}
              </div>
              <button onClick={handleCalendar}
                className="no-print w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white hover:bg-neutral-800 transition">
                {calDone ? "✓ Calendar downloaded — open the .ics file" : "📅 Add all action reminders + MTD deadlines to my calendar →"}
              </button>
              {calDone && (
                <p className="mt-2 text-center text-xs text-neutral-500">
                  Open the .ics file to add to Apple Calendar, Google Calendar or Outlook.
                </p>
              )}
            </div>

            {/* ── SECTION 8: ACCOUNTANT QUESTIONS ─────────────────────── */}
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
              <div className="flex gap-3 no-print">
                <a href={DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg border border-blue-200 bg-white px-4 py-2 font-mono text-xs font-bold text-blue-700 hover:bg-blue-50 transition">
                  File 05 — Print accountant brief →
                </a>
              </div>
            </div>

            {/* ── SECTION 9: ALL 10 FILES ──────────────────────────────── */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your complete MTD Action Plan — 10 documents</p>
              <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">Everything in one place</h2>
              <div className="space-y-2 mb-5">
                {ALL_FILES.map(f => (
                  <div key={f.num} className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">{f.num} — {f.name}</p>
                      <p className="text-xs text-neutral-500">{f.desc}</p>
                    </div>
                    <a href={DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
                      className="no-print ml-4 shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-neutral-700 hover:bg-neutral-950 hover:text-white transition">
                      Open →
                    </a>
                  </div>
                ))}
              </div>
              <a href={DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
                className="no-print block w-full rounded-xl bg-neutral-950 py-3.5 text-center text-sm font-bold text-white hover:bg-neutral-800 transition">
                📁 Open all 10 files in Google Drive →
              </a>
            </div>

            {/* ── SECTION 10: END HERE ─────────────────────────────────── */}
            <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Start here. End here.</p>
              <p className="mb-3 text-lg font-bold text-white leading-relaxed">
                {greetingCap}, tick off action 1 above. Then open File 06 — it tells you exactly what to fix and in what order.
              </p>
              <div className="flex gap-3 flex-wrap no-print">
                <a href="https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax"
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-neutral-950 hover:bg-neutral-100 transition">
                  Register with HMRC →
                </a>
                <a href={DRIVE_FOLDER} target="_blank" rel="noopener noreferrer"
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-800 transition">
                  Open File 06 →
                </a>
                <button onClick={handlePrint}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-800 transition">
                  ⬇ Save as PDF
                </button>
              </div>
              <p className="mt-3 text-sm text-neutral-400">
                {days} days to 7 August. Your calendar reminders are set. Start today.
              </p>
            </div>

            {/* CROSS-SELL */}
            <div className="no-print rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Also relevant for you</p>
              <p className="mb-1 font-serif text-lg font-bold text-neutral-950">The 60% Tax Trap</p>
              <p className="mb-3 text-sm text-neutral-600">
                If your income is between £100,000 and £125,140 you are paying
                an effective 60% marginal rate. Most people in this band do not realise it.
              </p>
              <Link href="/uk/check/allowance-sniper"
                className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950 transition">
                Check your position →
              </Link>
            </div>

          </>
        )}

        {/* DISCLAIMER */}
        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs text-neutral-500 leading-relaxed">
            <strong className="text-neutral-600">General information only.</strong>{" "}
            This action plan is for general guidance only and does not constitute financial, tax, or legal advice.
            TaxCheckNow is not a regulated financial adviser. Always consult a qualified UK tax adviser before
            making financial decisions. Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source
            for all MTD obligations. Software links may include affiliate links — we may earn a commission at no
            extra cost to you. This does not influence our recommendations.
          </p>
        </div>

      </main>
    </div>
  );
}
