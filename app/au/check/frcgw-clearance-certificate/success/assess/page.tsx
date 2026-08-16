"use client";
// Product: frcgw-clearance-certificate · Tier 1 Success Page
//
// HAND-MAINTAINED, NOT GENERATOR OUTPUT. The COLE success-page template does not yet emit
// the terminal-driven strip/calendar (R2), the tier-bounded terminal-ordered pack (R3), the
// combined print view (R4) or the generic-field display fallback (C8). Those are all built
// as SHARED components — SuccessDeadline, SuccessPack, lib/terminal-presentation,
// lib/assessment-fields — so this page is thin and any other product inherits the behaviour
// by importing the same four things. Regenerating this page from the current template would
// revert it; the template work is tracked separately (R-A2/R-A3 tripwire).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { buildComposerInputsFromSession } from "@/lib/composer-inputs";
import { buyerContextFromSession, type BuyerContext } from "@/lib/buyer-context";
import { resolveDisplayFields, humaniseFieldKey } from "@/lib/assessment-fields";
import SuccessDeadline from "@/app/_components/SuccessDeadline";
import SuccessPack, { type PackDoc } from "@/app/_components/SuccessPack";
import docsJson from "../../docs.json";

const PRODUCT_ID = "frcgw-clearance-certificate";
const TIER = 1 as const;
const PACK_NAME = "FRCGW Clearance Pack"; // NOT possessive — the hero supplies "your" (C7)
const DOCS = docsJson as Record<string, PackDoc>;

// C8 — must equal cole/config tier1AssessmentFields and lib/assessment-fields.ts.
const FIELDS = [
  "salePrice",
  "withholdingExposure",
  "residencyStatusConfirm",
  "certificateEligibility",
  "certificateProcessingTime",
  "daysToSettlementAnalysis",
  "applicationUrgency",
  "cashFlowImpact",
  "firstAction",
];

// The verdict fields shown in the position block, in order. `firstAction` is rendered
// separately below, so it is deliberately not repeated here.
const POSITION_FIELDS = FIELDS.filter((f) => f !== "firstAction");

interface Action { title: string; deadline: string; steps: string[] }
type Assessment = Record<string, unknown> & {
  accountantQuestions?: string[];
  actions?: Action[];
};

export default function SuccessAssess() {
  const [firstName, setFirstName] = useState("there");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [ctx, setCtx] = useState<BuyerContext | null>(null);

  const generate = useCallback(async (name: string, buyer: BuyerContext | null) => {
    setLoading(true);
    setError("");
    const sessionId = new URLSearchParams(window.location.search).get("session_id");

    try {
      // STEP 1 — the webhook's pre-generated assessment, if it landed.
      if (sessionId) {
        const r = await fetch(`/api/get-assessment?session_id=${sessionId}`);
        if (r.ok) {
          const d = await r.json();
          if (d.assessment) {
            setAssessment(d.assessment);
            // The STORED path carries both the terminal (W4) and the buyer's settlement
            // date, resolved server-side from the linked decision_sessions row. Adopt
            // whichever the server could supply.
            //
            // sessionStorage is empty on every visit that is not the checkout tab — the
            // receipt-email link, another device, a reopened browser. Without this, every
            // terminal-conditioned surface fell back to the neutral default and every dated
            // surface (countdown, lodge-by, settlement-anchored calendar) simply vanished,
            // even though the buyer had typed a date and it was sitting in the database.
            //
            // Rebuilt in ONE call so the whole context is derived by the same code the client
            // path runs; the date goes in as a raw answer, not as pre-computed values.
            const storedTerminal = typeof d.terminalId === "string" && d.terminalId ? d.terminalId : null;
            const storedDate = typeof d.settlementDate === "string" && d.settlementDate ? d.settlementDate : null;
            if ((storedTerminal && storedTerminal !== buyer?.terminalId) ||
                (storedDate && storedDate !== buyer?.values.settlement_date_iso)) {
              setCtx(buyerContextFromSession(PRODUCT_ID, TIER, storedTerminal, storedDate));
            }
            setLoading(false);
            return;
          }
        }
      }

      // STEP 2 — generate now. Bound to the buyer's REAL engine answers.
      const inputs = buildComposerInputsFromSession(PRODUCT_ID);
      // E7 — only ever sent when the buyer typed a real date. Absent ⇒ the generator is
      // told to use relative language and forbidden from inventing a calendar date.
      const iso = buyer?.values.settlement_date_iso;
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: PRODUCT_ID,
          market: "Australia",
          authority: "ATO",
          tier: 1,
          name,
          inputs,
          fields: FIELDS,
          ...(iso ? { deadline: { isoDate: iso, label: "Settlement date" } } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Assessment failed");
      setAssessment(data.assessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate assessment");
      // C7 — the old fallback filled every field with "Your personalised <fieldName> is being
      // prepared", which rendered nine near-identical placeholder rows that read as content.
      // A retry state says the true thing instead; the files and dates below still render.
      setAssessment(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const buyer = buyerContextFromSession(PRODUCT_ID, TIER);
      setCtx(buyer);
      const sessionId = new URLSearchParams(window.location.search).get("session_id");
      let name = "there";
      if (sessionId) {
        try {
          const r = await fetch(`/api/get-session?id=${sessionId}`);
          const d = await r.json();
          if (d.firstName) { name = d.firstName; setFirstName(d.firstName); }
        } catch { /* non-fatal */ }
      }
      await generate(name, buyer);
    })();
  }, [generate]);

  async function handleCopy() {
    const qs = assessment?.accountantQuestions;
    if (!Array.isArray(qs) || !qs.length) return;
    await navigator.clipboard.writeText(
      `Your ${PACK_NAME} — questions for my accountant:\n\n${qs.map((q, i) => `${i + 1}. "${q}"`).join("\n")}\n\nTaxCheckNow · taxchecknow.com`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const known = firstName !== "there";
  const displayFields = resolveDisplayFields(assessment, PRODUCT_ID, 67, POSITION_FIELDS);

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      <style>{`@media print { .no-print{display:none!important} body{font-size:12px;color:#000} .print-section{page-break-inside:avoid} }`}</style>

      <nav className="no-print border-b border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
          <button onClick={() => window.print()}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-neutral-700 transition hover:bg-neutral-950 hover:text-white">
            ⬇ Save PDF — assessment + all {Object.values(DOCS).filter(d => d.tier <= TIER).length} documents
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-6 py-8">

        {/* HERO — C7: "your" comes from the prefix, the pack name is not possessive, so no "your Your". */}
        <div className="print-section rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-6 py-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">
            Payment confirmed · Your {PACK_NAME} · $67
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold text-neutral-950">
            {known ? `${firstName}, here is your ${PACK_NAME}` : `Your ${PACK_NAME}`}
          </h1>
          {/* C7 — the personalisation claim renders only where there is something bound to
              point at. With no answers in session it would be an empty boast. */}
          {ctx && ctx.flags.length > 0 ? (
            <p className="mt-1 text-sm text-emerald-800">
              Worked through against the answers you gave in the check.
            </p>
          ) : (
            <p className="mt-1 text-sm text-emerald-800">
              Your ATO clearance certificate pack.
            </p>
          )}

          <SuccessDeadline
            productId={PRODUCT_ID}
            productName="FRCGW clearance certificate"
            calendarFileName="frcgw-clearance-certificate.ics"
            ctx={ctx}
            fallback={{
              headline: "Your certificate needs to reach the purchaser before settlement",
              badge: "Free · valid 12 months",
            }}
          />
        </div>

        {loading && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-semibold text-neutral-700">Building your assessment…</p>
            <p className="mt-1 text-xs text-neutral-400">Working through your answers against the ATO rules</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠ Your assessment has not generated yet. Your documents and dates are below and are complete.
            <button onClick={() => generate(firstName, ctx)} className="no-print ml-2 font-semibold underline">Try again →</button>
          </div>
        )}

        {!loading && assessment && (
          <>
            {displayFields.length > 0 && (
              <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                  Your ATO position
                </p>
                <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">
                  {known ? `What this means for you, ${firstName}` : "What this means for you"}
                </h2>
                <div className="space-y-3">
                  {displayFields.map((key) => (
                    <div key={key} className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-4">
                      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                        {humaniseFieldKey(key)}
                      </p>
                      <p className="text-sm leading-relaxed text-neutral-900">{String(assessment[key])}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {typeof assessment.firstAction === "string" && assessment.firstAction.trim() && (
              <div className="print-section rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Your first action</p>
                <p className="text-lg font-bold leading-relaxed text-white">{String(assessment.firstAction)}</p>
              </div>
            )}

            {Array.isArray(assessment.accountantQuestions) && assessment.accountantQuestions.length > 0 && (
              <div className="print-section rounded-2xl border border-blue-100 bg-blue-50 p-6">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">
                      Questions for your accountant
                    </p>
                    <p className="mt-1 text-sm text-blue-800">
                      Most sellers do not need an accountant for the certificate itself. These are the ones worth
                      asking if you are already speaking to one.
                    </p>
                  </div>
                  <button onClick={handleCopy}
                    className="no-print shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-blue-700 transition hover:bg-blue-700 hover:text-white">
                    {copied ? "Copied ✓" : "Copy all →"}
                  </button>
                </div>
                <div className="space-y-2">
                  {(assessment.accountantQuestions as string[]).map((q, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3">
                      <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-blue-600">{i + 1}</span>
                      <p className="text-sm leading-relaxed text-blue-900">&ldquo;{q}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* R3 + R4 */}
        <SuccessPack
          productId={PRODUCT_ID}
          filesBasePath="/files/au/frcgw-clearance-certificate"
          tier={TIER}
          packName={`Your ${PACK_NAME}`}
          docs={DOCS}
          ctx={ctx}
          upsell={{
            heading: "Also available — the Execution Pack",
            body: "Three further documents, for the situations this pack does not cover in depth: recovering an amount already withheld, and the foreign-resident variation notice.",
            ctaLabel: "See the Execution Pack — $147 →",
            ctaHref: "/au/check/frcgw-clearance-certificate",
          }}
        />

        <div className="no-print rounded-2xl border border-neutral-100 bg-neutral-50 p-5">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Also relevant</p>
          <p className="mb-1 text-sm font-bold text-neutral-950">
            Also check your CGT main residence exemption — FRCGW sits on top of the other property rules.
          </p>
          <p className="mb-2 text-xs text-neutral-600">
            The 15% withholding applies whether or not the property is your main residence. If it is, you may owe
            no capital gains tax at all — but you still need the certificate, because the purchaser cannot assess
            that themselves.
          </p>
          <Link href="/au/check/cgt-main-residence" className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950">
            Check your main residence exemption →
          </Link>
        </div>

        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs leading-relaxed text-neutral-500">
            <strong className="text-neutral-600">General information only.</strong>{" "}
            This assessment does not constitute financial, tax or legal advice. TaxCheckNow is not a regulated
            financial adviser. Always consult a qualified Australian tax adviser before making financial decisions.
            Based on ATO guidance April 2026.{" "}
            <a href="https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/foreign-residents-and-capital-gains-tax/foreign-resident-capital-gains-withholding" target="_blank" rel="noopener noreferrer" className="underline">ATO — Foreign resident capital gains withholding</a> · <a href="https://www.legislation.gov.au" target="_blank" rel="noopener noreferrer" className="underline">Treasury Laws Amendment (Foreign Resident Capital Gains Withholding) Act 2024</a>
          </p>
        </div>

      </main>
    </div>
  );
}
