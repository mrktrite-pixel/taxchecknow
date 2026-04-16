"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function SuccessPreparePage() {
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState({ income_source: "", accountant: "", timeline: "" });
  const [loading, setLoading] = useState(false);
  const answersComplete = Object.values(answers).every(v => v !== "");

  useEffect(() => {
    // Fire COLE delivery on page load
    const sid = typeof window !== "undefined" ? localStorage.getItem("mtd_session_id") : null;
    if (sid) {
      fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sid, status: "paid", product_key: "uk_27_mtd_scorecard" }),
      }).catch(() => {});
    }
  }, []);

  async function handleSubmit() {
    if (!answersComplete || loading) return;
    setLoading(true);
    const sid = localStorage.getItem("mtd_session_id");
    if (sid) {
      await fetch("/api/decision-sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sid, delivery_answers: answers }),
      }).catch(() => {});
    }
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <nav className="border-b border-neutral-200 bg-white px-6 py-4">
        <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
      </nav>
      <main className="mx-auto max-w-lg px-6 py-12">
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 mb-1">Payment confirmed</p>
          <h1 className="font-serif text-3xl font-bold text-neutral-950">Your MTD Decision Pack is on its way.</h1>
          <p className="mt-2 text-sm text-neutral-600">Check your email — your documents are being prepared and will arrive within a few minutes.</p>
        </div>

        {!submitted ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-1">Two quick questions</p>
            <h2 className="font-serif text-xl font-bold text-neutral-950 mb-1">Personalise your Decision Pack</h2>
            <p className="text-sm text-neutral-500 mb-5">These answers make your documents specific to your situation.</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-neutral-800">Are you a sole trader, landlord, or both?</label>
                <select value={answers.income_source} onChange={e => setAnswers(p => ({ ...p, income_source: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400">
                  <option value="">Select…</option>
                  <option value="sole_trader">Sole trader</option>
                  <option value="landlord">UK landlord</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-neutral-800">Do you have an accountant?</label>
                <select value={answers.accountant} onChange={e => setAnswers(p => ({ ...p, accountant: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400">
                  <option value="">Select…</option>
                  <option value="yes_involved">Yes — they are handling MTD</option>
                  <option value="yes_not_discussed">Yes — we have not discussed MTD</option>
                  <option value="no">No accountant</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-neutral-800">When do you need to be fully compliant?</label>
                <select value={answers.timeline} onChange={e => setAnswers(p => ({ ...p, timeline: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-400">
                  <option value="">Select…</option>
                  <option value="asap">As soon as possible</option>
                  <option value="before_august">Before 7 August 2026</option>
                  <option value="this_year">Sometime this year</option>
                </select>
              </div>
            </div>
            <button onClick={handleSubmit} disabled={!answersComplete || loading}
              className="mt-5 w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50">
              {loading ? "Sending…" : "Send my personalised pack →"}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-4xl mb-3">✓</p>
            <h2 className="font-serif text-xl font-bold text-neutral-950 mb-2">Your personalised pack is being prepared.</h2>
            <p className="text-sm text-neutral-600 mb-5">It will arrive in your inbox within 5 minutes.</p>
            <Link href="/uk" className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-800 transition">
              See all six UK tax tools →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
