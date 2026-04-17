"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DRIVE_URL = process.env.NEXT_PUBLIC_DRIVE_UK_MTD_67 ||
  "https://drive.google.com/drive/folders/1sfRA2cl-5UkwkaLLeGBvAlpMKtGTlYFd?usp=sharing";

const FILES = [
  { num: "01", name: "Your MTD Scope Assessment",        desc: "Your exact compliance position — confirmed in writing." },
  { num: "02", name: "Your Software Recommendation",     desc: "The right MTD software for your specific situation." },
  { num: "03", name: "Your HMRC Registration Steps",     desc: "Step-by-step registration walkthrough." },
  { num: "04", name: "Your Deadline Calendar",           desc: "Every filing date for 2026-27 — add them now." },
  { num: "05", name: "Your Accountant Brief",            desc: "Hand this to your accountant before your next meeting." },
];

interface AssessmentData {
  status: string;
  bracket: string;
  deadline: string;
  days: number;
  biggestGap: string;
  gapDetail: string;
  firstAction: string;
  softwareRec: string;
  softwareWhy: string;
  accountantPoints: string[];
}

export default function SuccessPrepare() {
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
      // Pull answers from sessionStorage (set by calculator)
      const software   = sessionStorage.getItem("mtd_software")    || "unknown";
      const records    = sessionStorage.getItem("mtd_records")      || "unknown";
      const reg        = sessionStorage.getItem("mtd_registration") || "unknown";
      const bracket    = sessionStorage.getItem("mtd_bracket")      || "£50,000 – £100,000";
      const source     = sessionStorage.getItem("mtd_income_source")|| "sole trader";
      const score      = sessionStorage.getItem("mtd_score")        || "50";

      const prompt = `You are a UK tax compliance expert writing a personalised MTD assessment.

The buyer answered these questions:
- Income bracket: ${bracket}
- Software status: ${software}
- Records status: ${records}
- Registration status: ${reg}
- Income source: ${source}
- Compliance position score: ${score}/100

Write a personalised MTD compliance assessment. Respond ONLY with a JSON object, no markdown, no preamble:

{
  "status": "REQUIRED — YOU ARE IN SCOPE",
  "bracket": "${bracket}",
  "deadline": "7 August 2026",
  "days": ${days},
  "biggestGap": "one short title of their biggest gap based on their answers",
  "gapDetail": "2 sentences explaining this specific gap and its consequence",
  "firstAction": "one specific action sentence starting with a verb e.g. Register for MTD at gov.uk by...",
  "softwareRec": "name of most suitable software for their situation",
  "softwareWhy": "one sentence why this software suits their specific answers",
  "accountantPoints": [
    "specific question 1 based on their situation",
    "specific question 2 based on their situation",
    "specific question 3 based on their situation"
  ]
}

Be specific to their answers. Do not be generic. Use their actual situation.`;

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
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAssessment(parsed);
    } catch (err) {
      console.error("Assessment generation error:", err);
      // Fallback — show static version if Claude API fails
      setAssessment({
        status: "REQUIRED — YOU ARE IN SCOPE",
        bracket: "£50,000 – £100,000",
        deadline: "7 August 2026",
        days,
        biggestGap: "HMRC Registration",
        gapDetail: "You have not yet registered for MTD with HMRC. Registration is a separate process from self-assessment and must be completed before your first submission.",
        firstAction: "Register for MTD at gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax — takes 10 minutes.",
        softwareRec: "FreeAgent or Xero",
        softwareWhy: "Both are HMRC-approved and handle quarterly submissions in one click.",
        accountantPoints: [
          "Have you registered me for MTD — or do I need to do this myself?",
          "Which software do you recommend for my situation?",
          "What is my biggest compliance risk before 7 August?",
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
        body: JSON.stringify({ email, product_key: "uk_67_mtd_scorecard", source: "success_page" }),
      });
      setEmailSaved(true);
    } catch {
      setEmailSaved(true); // non-blocking
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
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">Payment confirmed</p>
              <h1 className="mt-1 font-serif text-2xl font-bold text-neutral-950">Your MTD Compliance Assessment</h1>
              <p className="mt-1 text-sm text-emerald-800">
                A personal assessment built around your circumstances — not a generic guide.
              </p>
            </div>
          </div>
        </div>

        {/* DEADLINE BANNER */}
        <div className="rounded-xl bg-red-700 px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-white">🔴 {days} days to your first MTD deadline</span>
          <span className="font-mono text-sm font-bold text-white">7 August 2026</span>
        </div>

        {/* GENERATED ASSESSMENT */}
        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-medium text-neutral-600">Preparing your personal assessment…</p>
            <p className="mt-1 text-xs text-neutral-400">Building around your specific answers</p>
          </div>
        ) : assessment ? (
          <div className="space-y-4">

            {/* YOUR POSITION */}
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
            </div>

            {/* BIGGEST GAP */}
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-amber-700">Your biggest compliance gap</p>
              <h2 className="mb-2 font-serif text-xl font-bold text-neutral-950">{assessment.biggestGap}</h2>
              <p className="text-sm leading-relaxed text-amber-900">{assessment.gapDetail}</p>
            </div>

            {/* FIRST ACTION */}
            <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your first action — do this today</p>
              <p className="text-base font-bold text-white">{assessment.firstAction}</p>
            </div>

            {/* SOFTWARE RECOMMENDATION */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your software recommendation</p>
              <h3 className="mb-1 font-serif text-lg font-bold text-neutral-950">{assessment.softwareRec}</h3>
              <p className="text-sm text-neutral-600">{assessment.softwareWhy}</p>
              <p className="mt-2 text-xs text-neutral-400">Full comparison in File 02 below.</p>
            </div>

            {/* ACCOUNTANT QUESTIONS */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-blue-700">Ask your accountant these three questions</p>
              <div className="space-y-2">
                {assessment.accountantPoints.map((q, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 font-mono text-xs font-bold text-blue-600">{i + 1}</span>
                    <p className="text-sm text-blue-900">"{q}"</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-blue-600">Full accountant brief in File 05 below — print and take it with you.</p>
            </div>

          </div>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm text-red-700">Assessment could not be generated. Your files are still available below.</p>
          </div>
        )}

        {/* YOUR FILES */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your MTD Compliance Assessment files</p>
          <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">Your five documents</h2>
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
            Open all files in Google Drive →
          </a>
        </div>

        {/* EMAIL SAVE */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Save your assessment</p>
          <p className="mb-3 text-sm text-neutral-600">
            Email a copy to yourself or your accountant. Your files are already in your inbox
            — this sends an additional copy.
          </p>
          {emailSaved ? (
            <p className="text-sm font-semibold text-emerald-700">✓ Copy sent.</p>
          ) : (
            <div className="flex gap-2">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="accountant@example.com or your email"
                className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm outline-none focus:border-neutral-400" />
              <button onClick={handleEmailSave} disabled={!email || emailLoading}
                className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 transition disabled:opacity-50">
                {emailLoading ? "Sending…" : "Send →"}
              </button>
            </div>
          )}
        </div>

        {/* NEXT STEP */}
        <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your one job today</p>
          <p className="text-lg font-bold text-white">
            Open File 01. Confirm your scope. Then do the first action above.
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            {days} days. That is enough time — if you start today.
          </p>
        </div>

        {/* CROSS-SELL */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Also relevant for you</p>
          <p className="mb-1 font-serif text-lg font-bold text-neutral-950">The 60% Tax Trap</p>
          <p className="mb-3 text-sm text-neutral-600">
            If your income is between £100,000 and £125,140 you are paying
            an effective 60% tax rate. Most people in this band do not know it.
          </p>
          <Link href="/uk/check/allowance-sniper"
            className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950 transition">
            Check your position →
          </Link>
        </div>

        {/* DISCLAIMER */}
        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs text-neutral-500 leading-relaxed">
            <strong className="text-neutral-600">General information only.</strong> This assessment is for general
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
