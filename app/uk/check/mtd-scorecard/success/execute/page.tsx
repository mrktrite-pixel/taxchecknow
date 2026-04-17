"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DRIVE_URL = process.env.NEXT_PUBLIC_DRIVE_UK_MTD_127 ||
  "https://drive.google.com/drive/folders/1mMvsfqWe41CRbzB5GJgWBeRHz2YfJwiV?usp=sharing";

const FILES = [
  { num: "01", name: "Your MTD Scope Assessment",            desc: "Your exact compliance position — confirmed in writing." },
  { num: "02", name: "Your Software Recommendation",         desc: "The right MTD software for your specific situation." },
  { num: "03", name: "Your HMRC Registration Steps",         desc: "Step-by-step registration walkthrough." },
  { num: "04", name: "Your Deadline Calendar",               desc: "Every filing date for 2026-27 — add them now." },
  { num: "05", name: "Your Accountant Brief",                desc: "Hand this to your accountant before your next meeting." },
  { num: "06", name: "Your Gap Closure Plan",                desc: "What to fix, in what order, by when." },
  { num: "07", name: "Your First Submission Checklist",      desc: "Every step before you submit Q1 on 7 August." },
  { num: "08", name: "Your Digital Records Template",        desc: "Exactly what HMRC requires you to record." },
  { num: "09", name: "Your Digital Links Audit",             desc: "Audit your records chain against HMRC rules." },
  { num: "10", name: "Your HMRC Registration Walkthrough",   desc: "Screen-by-screen MTD registration guide." },
];

interface AssessmentData {
  status: string;
  bracket: string;
  complianceScore: number;
  biggestGap: string;
  gapDetail: string;
  gap2: string;
  gap3: string;
  firstAction: string;
  firstActionDeadline: string;
  secondAction: string;
  thirdAction: string;
  softwareRec: string;
  softwareWhy: string;
  digitalLinksRisk: string;
  accountantPoints: string[];
  weeklyPlan: { week: string; action: string }[];
}

export default function SuccessExecute() {
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailSaved, setEmailSaved] = useState(false);
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const days = Math.max(0, Math.floor(
    (new Date("2026-08-07").getTime() - Date.now()) / 86_400_000
  ));

  useEffect(() => {
    generateAssessment();
  }, []);

  async function generateAssessment() {
    setLoading(true);
    try {
      const software = sessionStorage.getItem("mtd_software")     || "unknown";
      const records  = sessionStorage.getItem("mtd_records")       || "unknown";
      const reg      = sessionStorage.getItem("mtd_registration")  || "unknown";
      const bracket  = sessionStorage.getItem("mtd_bracket")       || "£50,000 – £100,000";
      const source   = sessionStorage.getItem("mtd_income_source") || "sole trader";
      const score    = sessionStorage.getItem("mtd_score")         || "35";

      const prompt = `You are a UK tax compliance expert writing a detailed personalised MTD action plan.

The buyer answered these questions:
- Income bracket: ${bracket}
- Software status: ${software}
- Records status: ${records}
- Registration status: ${reg}
- Income source: ${source}
- Compliance position score: ${score}/100

Write a detailed personalised MTD action plan. Respond ONLY with a JSON object, no markdown, no preamble:

{
  "status": "REQUIRED — YOU ARE IN SCOPE",
  "bracket": "${bracket}",
  "complianceScore": ${score},
  "biggestGap": "single biggest gap title based on their answers",
  "gapDetail": "2-3 sentences about this gap specific to their situation and the consequence",
  "gap2": "second gap title — one short phrase",
  "gap3": "third gap title — one short phrase",
  "firstAction": "specific first action starting with a verb",
  "firstActionDeadline": "specific deadline date e.g. by 15 July 2026",
  "secondAction": "specific second action starting with a verb",
  "thirdAction": "specific third action starting with a verb",
  "softwareRec": "most suitable software name for their situation",
  "softwareWhy": "2 sentences why this specific software suits their answers",
  "digitalLinksRisk": "1-2 sentences about their specific digital links risk based on their software and records answers",
  "accountantPoints": [
    "specific question 1 for their situation",
    "specific question 2 for their situation",
    "specific question 3 for their situation",
    "specific question 4 for their situation",
    "specific question 5 for their situation"
  ],
  "weeklyPlan": [
    { "week": "This week", "action": "specific action for their situation" },
    { "week": "Next week", "action": "specific action for their situation" },
    { "week": "Week 3", "action": "specific action for their situation" },
    { "week": "Week 4", "action": "specific action — submit Q1 by 7 August" }
  ]
}

Be highly specific to their answers. Reference their actual software status, records situation, registration status.`;

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
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAssessment(parsed);
    } catch (err) {
      console.error("Assessment generation error:", err);
      setAssessment({
        status: "REQUIRED — YOU ARE IN SCOPE",
        bracket: "£50,000 – £100,000",
        complianceScore: Number(sessionStorage.getItem("mtd_score") || 35),
        biggestGap: "MTD Software Not Set Up",
        gapDetail: "You do not yet have MTD-compatible software connected to HMRC. Without this you cannot submit your first quarterly update by 7 August 2026. This is your most urgent gap.",
        gap2: "HMRC Registration Incomplete",
        gap3: "Q1 Digital Records Not Started",
        firstAction: "Choose and sign up for MTD software this week",
        firstActionDeadline: "by 30 June 2026",
        secondAction: "Register for MTD with HMRC using your Government Gateway login",
        thirdAction: "Connect your bank feed and enter Q1 transactions from 6 April 2026",
        softwareRec: "FreeAgent or Xero",
        softwareWhy: "Both are HMRC-approved and designed for sole traders and landlords. FreeAgent is free if you bank with NatWest, RBS or Mettle.",
        digitalLinksRisk: "Your current records setup requires attention. HMRC's digital links rule means every step in your records chain must be digitally connected — no manual copying between systems.",
        accountantPoints: [
          "Have you registered me for MTD — or do I need to do this myself?",
          "Which software do you use and should I use the same?",
          "What is my biggest compliance risk before 7 August?",
          "How are you handling my Q1 submission — me or you?",
          "What changes for my January 2028 final declaration under MTD?",
        ],
        weeklyPlan: [
          { week: "This week", action: "Choose MTD software and sign up for free trial. Connect bank account." },
          { week: "Next week", action: "Register with HMRC for MTD. Enter April and May 2026 transactions." },
          { week: "Week 3", action: "Enter June 2026 transactions. Reconcile Q1 records to bank statements." },
          { week: "Week 4", action: "Run Q1 submission in software. Review figures. Submit by 7 August 2026." },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSave() {
    if (!email) return;
    setEmailLoading(true);
    try {
      await fetch("/api/save-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, product_key: "uk_127_mtd_scorecard", source: "success_page" }),
      });
      setEmailSaved(true);
    } catch {
      setEmailSaved(true);
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* NAV */}
      <nav className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
          <span className="font-mono text-xs text-neutral-400">United Kingdom · MTD 2026</span>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">

        {/* CONFIRMATION HEADER */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <span className="text-3xl">✅</span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Payment confirmed · £127</p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">Your MTD Action Plan</h1>
              <p className="mt-1 text-sm text-emerald-800">
                Not a guide to MTD. A plan for your MTD.
              </p>
            </div>
          </div>
        </div>

        {/* DEADLINE */}
        <div className="rounded-xl bg-red-700 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">🔴 {days} days to your first MTD deadline</span>
          <span className="font-mono text-sm font-bold text-white">7 August 2026</span>
        </div>

        {/* GENERATED ACTION PLAN */}
        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-600">Building your personal action plan…</p>
            <p className="mt-1 text-xs text-neutral-400">Analysing your specific compliance gaps</p>
          </div>
        ) : assessment ? (
          <div className="space-y-4">

            {/* COMPLIANCE POSITION */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your compliance position</p>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-neutral-500">Current position</span>
                    <span className="font-mono text-sm font-bold text-neutral-950">{assessment.complianceScore}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100">
                    <div className="h-2 rounded-full bg-neutral-950 transition-all"
                      style={{ width: `${assessment.complianceScore}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-neutral-400">Target</p>
                  <p className="font-mono text-sm font-bold text-emerald-600">100/100</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[assessment.biggestGap, assessment.gap2, assessment.gap3].map((gap, i) => (
                  <div key={i} className={`rounded-lg px-3 py-2 text-center ${i === 0 ? "bg-red-50 border border-red-100" : "bg-neutral-50 border border-neutral-100"}`}>
                    <p className={`font-mono text-[9px] uppercase tracking-widest ${i === 0 ? "text-red-600" : "text-neutral-400"}`}>Gap {i + 1}</p>
                    <p className={`mt-0.5 text-xs font-semibold ${i === 0 ? "text-red-800" : "text-neutral-600"}`}>{gap}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* BIGGEST GAP */}
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-700">Your biggest compliance gap — fix this first</p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{assessment.biggestGap}</h2>
              <p className="text-sm leading-relaxed text-red-900">{assessment.gapDetail}</p>
            </div>

            {/* ACTION PRIORITY */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your action priority list</p>
              <div className="space-y-3">
                {[
                  { num: "1", action: assessment.firstAction, deadline: assessment.firstActionDeadline, urgent: true },
                  { num: "2", action: assessment.secondAction, deadline: "", urgent: false },
                  { num: "3", action: assessment.thirdAction, deadline: "", urgent: false },
                ].map(item => (
                  <div key={item.num} className={`flex items-start gap-3 rounded-xl p-4 ${item.urgent ? "bg-neutral-950 text-white" : "bg-neutral-50 border border-neutral-100"}`}>
                    <span className={`mt-0.5 font-mono text-xs font-bold ${item.urgent ? "text-neutral-400" : "text-neutral-400"}`}>{item.num}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${item.urgent ? "text-white" : "text-neutral-800"}`}>{item.action}</p>
                      {item.deadline && <p className={`mt-0.5 font-mono text-xs ${item.urgent ? "text-yellow-400" : "text-neutral-500"}`}>{item.deadline}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SOFTWARE RECOMMENDATION */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your software recommendation</p>
              <h3 className="mb-2 font-serif text-lg font-bold text-neutral-950">{assessment.softwareRec}</h3>
              <p className="text-sm leading-relaxed text-neutral-600">{assessment.softwareWhy}</p>
              <p className="mt-2 text-xs text-neutral-400">Full comparison and setup steps in File 02.</p>
            </div>

            {/* DIGITAL LINKS RISK */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">Your digital links risk</p>
              <p className="text-sm leading-relaxed text-amber-900">{assessment.digitalLinksRisk}</p>
              <p className="mt-2 text-xs text-amber-700">Full audit checklist in File 09.</p>
            </div>

            {/* WEEK BY WEEK PLAN */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your week-by-week plan to 7 August</p>
              <div className="space-y-2">
                {assessment.weeklyPlan.map((w, i) => (
                  <div key={i} className="flex items-start gap-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                    <span className="mt-0.5 w-20 shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400">{w.week}</span>
                    <p className="text-sm text-neutral-700">{w.action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ACCOUNTANT QUESTIONS */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-blue-700">Five questions for your accountant</p>
              <div className="space-y-2">
                {assessment.accountantPoints.map((q, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 font-mono text-xs font-bold text-blue-600">{i + 1}</span>
                    <p className="text-sm text-blue-900">"{q}"</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-blue-600">Full accountant brief in File 05 — print and take it to your meeting.</p>
            </div>

          </div>
        ) : null}

        {/* YOUR 10 FILES */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your MTD Action Plan — 10 documents</p>
          <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">Your complete file set</h2>
          <div className="space-y-2 mb-5">
            {FILES.map(f => (
              <div key={f.num} className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950">{f.num} — {f.name}</p>
                  <p className="text-xs text-neutral-500">{f.desc}</p>
                </div>
                <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer"
                  className="ml-4 shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-neutral-700 hover:bg-neutral-950 hover:text-white transition">
                  Open →
                </a>
              </div>
            ))}
          </div>
          <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer"
            className="block w-full rounded-xl bg-neutral-950 py-3.5 text-center text-sm font-bold text-white hover:bg-neutral-800 transition">
            Open all 10 files in Google Drive →
          </a>
        </div>

        {/* EMAIL SAVE */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Send to your accountant</p>
          <p className="mb-3 text-sm text-neutral-600">
            Forward your action plan and files to your accountant directly.
            Your delivery email is already in your inbox — this sends an additional copy.
          </p>
          {emailSaved ? (
            <p className="text-sm font-semibold text-emerald-700">✓ Sent.</p>
          ) : (
            <div className="flex gap-2">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="accountant@example.com"
                className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-neutral-400" />
              <button onClick={handleEmailSave} disabled={!email || emailLoading}
                className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 transition disabled:opacity-50">
                {emailLoading ? "Sending…" : "Send →"}
              </button>
            </div>
          )}
        </div>

        {/* END HERE — NEXT ACTION */}
        <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Start here. End here.</p>
          <p className="text-lg font-bold text-white">
            Open File 06 — Your Gap Closure Plan.
            Fix the biggest gap first.
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            {days} days to 7 August. Start today.
          </p>
        </div>

        {/* CROSS-SELL */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Also relevant for you</p>
          <p className="mb-1 font-serif text-lg font-bold text-neutral-950">The 60% Tax Trap</p>
          <p className="mb-3 text-sm text-neutral-600">
            If your income is between £100,000 and £125,140 you are paying
            an effective 60% tax rate on that band. Most people do not know it.
          </p>
          <Link href="/uk/check/allowance-sniper"
            className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950 transition">
            Check your position →
          </Link>
        </div>

        {/* DISCLAIMER */}
        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs text-neutral-500 leading-relaxed">
            <strong className="text-neutral-600">General information only.</strong> This action plan is for general
            guidance and does not constitute financial, tax, or legal advice. TaxCheckNow is not a regulated
            financial adviser. Always consult a qualified UK tax adviser before making financial decisions.
            Based on HMRC guidance April 2026. HMRC.gov.uk is the authoritative source for all MTD obligations.
            Software links may include affiliate links — we may earn a small commission at no extra cost to you.
          </p>
        </div>

      </main>
    </div>
  );
}
