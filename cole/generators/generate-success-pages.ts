// ─────────────────────────────────────────────────────────────────────────────
// COLE Generator — generate-success-pages.ts
// Produces story-driven, personalised success pages for all products.
// Claude is called server-side via /api/assess — API key never exposed.
//
// ┌── HARD RULE (Strategy ruling, 2026-07-23) ─────────────────────────────────┐
// │ NO success-page regeneration runs for ANY product until BOTH land HERE:    │
// │   R-A2  the template emits `buildComposerInputsFromSession("<id>")` for the │
// │         /api/assess `inputs` — NOT the phantom `sessionStorage.getItem(     │
// │         "<id>_<key>") || "<default>"` reads below. Those keys are the OLD   │
// │         bespoke-calculator contract; engine-native calculators write        │
// │         <id>_answers / <id>_qualification instead, so the phantom reads     │
// │         always fall back to defaults → a generic, corpus-contradicting      │
// │         assessment. (Fixed by hand on the two FRCGW pages, commit 50eced7.) │
// │         CAVEAT: R-A2 is safe ONLY for ENGINE-NATIVE products. A legacy      │
// │         bespoke-calculator product still writes the phantom keys, so this   │
// │         switch must be GATED per-product on engine-native status — it is    │
// │         NOT an unconditional template edit. That gating is the open work.   │
// │   R-A3  no hardcoded / stale dates: the fixed `daysToDeadline` countdown    │
// │         off `config.deadline.isoDate` shows "0 days" once the date passes   │
// │         (FRCGW's 2025-12-31 was already past). Per-user-deadline products   │
// │         (e.g. FRCGW settlement) must suppress the countdown; true per-user  │
// │         date capture is R-A4 (backlog).                                     │
// │ Regenerating before R-A2/R-A3 land silently OVERWRITES the FRCGW hand-patch │
// │ with the broken template. The guard below machine-enforces this rule.      │
// │ See reports/2026-07-23-frcgw-success-content-migration-scope.txt           │
// └────────────────────────────────────────────────────────────────────────────┘
import type { ProductConfig } from "../types/product-config";
import { verifyEngineNative } from "./verify-engine-native";

// Machine-enforced hard rule. buildSuccessPage() THROWS unless the template has been
// upgraded (R-A2/R-A3) and the operator opts in with COLE_SUCCESS_TEMPLATE_RA2_RA3=1.
// Deliberate tripwire — a broken template must not silently re-emit over a fixed page.
const RA2_RA3_LANDED = process.env.COLE_SUCCESS_TEMPLATE_RA2_RA3 === "1";

export function generateSuccessAssess(config: ProductConfig): string {
  return buildSuccessPage(config, "tier1");
}
export function generateSuccessPlan(config: ProductConfig): string {
  return buildSuccessPage(config, "tier2");
}
export function getSuccessAssessPath(config: ProductConfig, appRoot: string): string {
  const path = require("path");
  return path.join(appRoot, config.slug, "success", config.tier1.successPath, "page.tsx");
}
export function getSuccessPlanPath(config: ProductConfig, appRoot: string): string {
  const path = require("path");
  return path.join(appRoot, config.slug, "success", config.tier2.successPath, "page.tsx");
}

function sym(config: ProductConfig): string {
  return ["USD","NZD","CAD","AUD"].includes(config.currency) ? "$" : "£";
}

function buildSuccessPage(config: ProductConfig, tier: "tier1" | "tier2"): string {
  // ── HARD-RULE GUARD (2026-07-23) ──────────────────────────────────────────
  if (!RA2_RA3_LANDED) {
    throw new Error(
      `[COLE hard rule 2026-07-23] Success-page regeneration is BLOCKED (product "${config.id}", ${tier}). ` +
      `R-A2 (emit buildComposerInputsFromSession) and R-A3 (no hardcoded/stale dates) are not yet landed in ` +
      `generate-success-pages.ts. Regenerating now would overwrite the FRCGW hand-patch (commit 50eced7) with ` +
      `the still-broken template. Land R-A2 (gated on the product being engine-native) + R-A3, verify, then set ` +
      `COLE_SUCCESS_TEMPLATE_RA2_RA3=1. See reports/2026-07-23-frcgw-success-content-migration-scope.txt`
    );
  }
  // TEMPORAL v1 Phase 0 supersedes the R-A3 hard block: the countdown now fail-closes on time
  // (daysToDeadline → null suppresses the whole block), so a past deadline.isoDate no longer
  // renders "0 days" and is safe to regenerate. It is still a STALE DECLARATION — surface it
  // loudly (Phase 3 migrates such entries to provisional-with-expiry / undeclared).
  const dl = Date.parse(config.deadline?.isoDate ?? "");
  if (!Number.isNaN(dl) && dl < Date.now()) {
    console.warn(
      `[COLE R-A3 → TEMPORAL] Product "${config.id}" has a PAST deadline.isoDate (${config.deadline.isoDate}). ` +
      `The countdown is suppressed at render, but the declaration is stale — migrate it (Phase 3).`
    );
  }

  const isTier2      = tier === "tier2";
  const tierConfig   = isTier2 ? config.tier2 : config.tier1;
  const price        = tierConfig.price;
  const packName     = tierConfig.name;
  // DOUBLE-"YOUR" FIX. The hero h1 composes a possessive prefix — "<name>, here is your "
  // when we know the buyer's first name, "Your " when we do not — in front of the pack
  // name. Pack names are authored possessive ("Your Rental Deduction Audit Pack"), so the
  // composition doubled it: "Lee, here is your Your Rental Deduction Audit Pack".
  // Observed live on preview j9swc6lie, BOTH tiers. It never appeared in a grep of the
  // built pages because the join happens at render — the literal "Your " sits in a ternary
  // and the pack name is a separate JSX child.
  // Fixed the same way lib/cole-email.ts:41 fixed it on the email path: strip the leading
  // "Your " and let the prefix supply it. Renaming packs does NOT fix this (the names stay
  // possessive by design) — the COMPOSITION is what had to change.
  // Non-possessive pack names are unaffected: the strip is a no-op for them.
  const packNounPhrase = packName.replace(/^Your\s+/i, "");
  const fileCount    = tierConfig.fileCount;
  const tier1Files   = config.files.filter(f => f.tier === 1);
  const visibleFiles = isTier2 ? config.files : tier1Files;
  const calEvents    = isTier2 ? config.tier2Calendar : config.tier1Calendar;
  const promptFields = config.successPromptFields;
  const assessFields = isTier2 ? config.tier2AssessmentFields : config.tier1AssessmentFields;
  const currency     = sym(config);

  // ── R-A2: WHICH ASSESSMENT-INPUT SHAPE DOES THIS PRODUCT GET? ─────────────
  // Declared in the config, VERIFIED against the app dir here. Throws on any
  // disagreement rather than guessing — both wrong answers are silent at runtime.
  const engineNative = verifyEngineNative(config);

  // STEP 2 fallback inputs. STEP 1 (the stored-first fetch) is untouched by this
  // branch: it is correct, and it is the path every real purchase takes.
  //
  //   engine-native → the SAME composer the webhook uses (F5 contract), reading
  //                   the labelled answers EngineCalculator actually wrote.
  //   legacy        → the existing per-field phantom reads, byte-for-byte
  //                   unchanged, because a bespoke calculator does write them.
  const ssReads = engineNative
    ? `      // Bind to the user's REAL engine answers — the keys EngineCalculator actually wrote
      // (<slug>_answers + <slug>_qualification) — via the SAME composer the webhook uses
      // (F5 contract). The legacy per-field keys are never written by an engine-native
      // calculator, so reading them would always fall back to defaults → a generic,
      // corpus-contradicting assessment.
      const inputs = buildComposerInputsFromSession("${config.id}");`
    : promptFields.map(f =>
        `      const ${f.key} = sessionStorage.getItem("${config.id}_${f.key}") || "${f.defaultVal}";`
      ).join("\n");

  // inputs object for /api/assess
  const inputsObj = promptFields.map(f =>
    `        "${f.label}": ${f.key},`
  ).join("\n");

  // calendar storage reads — legacy only. On an engine-native product these read
  // keys nobody writes; on the hand-patched pages they are dead code.
  const calReads = engineNative
    ? ""
    : promptFields.map(f =>
        `    const ${f.key} = sessionStorage.getItem("${config.id}_${f.key}") || "${f.defaultVal}";`
      ).join("\n");

  // ── R-A3 / GAP 3: WHICH CALENDAR EVENTS MAY CARRY A DATE? ─────────────────
  // Same fail-closed rule as the countdown, applied to the surface Phase 0 left
  // alone. An absolute date in a calendar event is a CLAIM about a real date:
  //   · the product must actually claim a date at all (temporal kind deadline /
  //     window / effective_from — never unresolvable or none), and
  //   · the date must still be in the future at generate time.
  // If either fails, the event is dropped entirely rather than shipped stale.
  // Relative events ("relative:+Ndays") are computed from the customer's own
  // "today" at render and assert no legal date, so they are always safe.
  const todayCompact = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const claimsADate  = productClaimsADate(config);

  // ── GAP 2: is the absence of a date DECLARED, or is it a failure? ─────────
  // Declared-absent (unresolvable / none) is a reviewed answer and must be silent.
  // Anything else that fails to produce a countdown IS a defect and must still alert.
  // A user_supplied/user_derived rule joins this group: there is no product-level date to
  // count down to at generate time, and that is DECLARED rather than broken — so it must be
  // silent for the same reason unresolvable/none are. See declaresOnlyAPerCustomerDate().
  const deadlineDeclaredAbsent =
    config.temporal?.kind === "unresolvable"
    || config.temporal?.kind === "none"
    || declaresOnlyAPerCustomerDate(config);
  // The declared stand-in for the countdown. Only honoured when the product has
  // actually declared it has no date — never as a way to dodge a real deadline.
  const qualitative = deadlineDeclaredAbsent ? config.deadline?.qualitative : undefined;

  // What fills the "…before X" slot in prose (the action-checklist heading and the
  // fallback accountant question).
  //
  // `deadline.display` is the wrong source for a declared-dateless product: it is
  // free text that may hold a concrete DATE. SUPERLEAVE's was "31 October 2026" —
  // the individual tax-return date, inapplicable to DASP timing, and already
  // removed from visible copy by 34dfb30 / edd9233 / a152989. Both of these slots
  // render OUTSIDE the deadlineLive gate, so using `display` there would have put
  // that date back in front of customers on the next regeneration.
  //
  // The declaration already carries the right string: `temporal.label`, documented
  // as "Human label used in customer-facing copy" — a name for the anchor, never a
  // date. Absent label on a dateless product ⇒ drop the clause rather than invent one.
  const beforeAnchor = deadlineDeclaredAbsent
    ? (config.temporal?.label ? ` — before ${config.temporal.label}` : "")
    : ` — before ${config.deadline.display}`;
  const beforeAnchorQ = deadlineDeclaredAbsent
    ? (config.temporal?.label ? ` before ${config.temporal.label}` : " now")
    : ` before ${config.deadline.display}`;
  const temporalReason =
    config.temporal && "reason" in config.temporal ? String(config.temporal.reason ?? "") : "";
  const droppedEvents: string[] = [];
  const emittableEvents = calEvents.filter(evt => {
    if (evt.date.startsWith("relative:")) return true;
    if (!claimsADate)            { droppedEvents.push(`${evt.uid} (${evt.date}: product declares no resolvable date)`); return false; }
    if (evt.date < todayCompact) { droppedEvents.push(`${evt.uid} (${evt.date}: in the past)`); return false; }
    return true;
  });
  if (droppedEvents.length) {
    console.warn(
      `[COLE R-A3 calendar] "${config.id}" ${tier}: dropped ${droppedEvents.length} dated event(s) — ` +
      droppedEvents.join("; ") + `. A stale or unfounded calendar date is worse than no event.`
    );
  }

  // .ics events
  const icsEvents = emittableEvents.map(evt => {
    const dateCode = evt.date.startsWith("relative:")
      ? buildRelativeDate(evt.date)
      : `"${evt.date}"`;
    return `
      "BEGIN:VEVENT",
      \`UID:${evt.uid}-\${Date.now()}@taxchecknow.com\`,
      \`DTSTART;VALUE=DATE:\${${dateCode}}\`,
      \`DTEND;VALUE=DATE:\${${dateCode}}\`,
      \`DTSTAMP:\${now}\`,
      "SUMMARY:${icsText(evt.summary)}",
      "DESCRIPTION:${icsText(evt.description)}",
      "STATUS:CONFIRMED",
      "END:VEVENT",`;
  }).join("");

  return `"use client";
// AUTO-GENERATED BY COLE — do not edit manually
// Product: ${config.id} · ${isTier2 ? "Tier 2" : "Tier 1"} Success Page
import { useEffect, useState } from "react";
import Link from "next/link";${engineNative ? `\nimport { buildComposerInputsFromSession } from "@/lib/composer-inputs";` : ""}

const FILES = ${JSON.stringify(visibleFiles.map(f => ({
    num: f.num, slug: f.slug, name: f.name, desc: f.desc, tier: f.tier,
  })), null, 2)};

interface Action { title: string; deadline: string; steps: string[]; }
type Assessment = Record<string, unknown> & {
  accountantQuestions?: string[];
  actions?: Action[];
};

export default function Success${isTier2 ? "Plan" : "Assess"}() {
  const [firstName,  setFirstName]  = useState("there");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [copied,     setCopied]     = useState(false);
${emittableEvents.length === 0 ? "" : `  const [calDone,    setCalDone]    = useState(false);`}
  const [checked,    setChecked]    = useState<Record<number,boolean>>({});

${deadlineDeclaredAbsent ? `${declaresOnlyAPerCustomerDate(config) ? `  // TEMPORAL v1 — this product's deadline is PER CUSTOMER
  // (temporal.kind = "${config.temporal?.kind}", rule source "user_supplied"/"user_derived").
  // A real date exists, but only once a customer has given it, so there is no product-level
  // date to count down to here and nothing to alert about. The page resolves the customer's
  // own date at runtime from their session instead.` : `  // TEMPORAL v1 — this product DECLARES that it has no resolvable date
  // (temporal.kind = "${config.temporal?.kind}"${temporalReason ? `, reason: "${temporalReason}"` : ""}).
  // There is no countdown to suppress and nothing to alert about: the absence is the
  // declared, reviewed answer, not a failure. Emitting a console.error here would fire on
  // every page load for a product behaving exactly as ruled, and Phase 5 alerts on that
  // channel — a channel trained to be ignored is worse than no channel.`}
  const daysToDeadline: number | null = null;
  const deadlineLive = false;

  useEffect(() => { init(); }, []);` : `  // TEMPORAL v1 Phase 0 — fail-closed on time: days remaining, or null when the fixed
  // deadline is absent / unparseable / already passed. null suppresses the countdown entirely
  // (never "0 days", never a negative, never a stale label).
  const daysToDeadline: number | null = (() => {
    const end = new Date("${config.deadline.isoDate}").getTime();
    if (Number.isNaN(end)) return null;
    const d = Math.floor((end - Date.now()) / 86_400_000);
    return d > 0 ? d : null;
  })();
  const deadlineLive = daysToDeadline !== null;

  useEffect(() => { init(); }, []);

  // Suppress + alert (TEMPORAL v1 Phase 0): a deadline this product DOES claim, which has
  // expired or will not parse, is a real defect — surface it so it is never silent.
  // Phase 5 replaces this with real alerting.
  useEffect(() => {
    if (!deadlineLive) console.error("[TEMPORAL] expired deadline suppressed on success page", { product: "${config.id}", deadlineIso: "${config.deadline.isoDate}" });
  }, []);`}

  async function init() {
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    let name = "there";
    if (sessionId) {
      try {
        const r = await fetch(\`/api/get-session?id=\${sessionId}\`);
        const d = await r.json();
        if (d.firstName) { name = d.firstName; setFirstName(d.firstName); }
      } catch { /* non-fatal */ }
    }
    await generateAssessment(name);
  }

  async function generateAssessment(name: string) {
    setLoading(true);
    setError("");
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    try {
      // ── STEP 1: Try fetching pre-generated assessment from Supabase ──
      // Generated by webhook at purchase time — instant load, no API call
      if (sessionId) {
        const r = await fetch(\`/api/get-assessment?session_id=\${sessionId}\`);
        if (r.ok) {
          const d = await r.json();
          if (d.assessment) {
            setAssessment(d.assessment);
            setLoading(false);
            return;
          }
        }
      }

      // ── STEP 2: Fallback — generate now via /api/assess ──────────────
      // Runs if webhook hasn't stored assessment yet (e.g. timing, retry)
${ssReads}
${engineNative ? "" : `
      // Check if we have any real inputs — sessionStorage may be empty after Stripe redirect
      const hasInputs = Object.values({
${promptFields.map(f => `        "${f.key}": ${f.key},`).join("\n")}
      }).some(v => v && v !== "${promptFields[0]?.defaultVal || ""}");
`}
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: "${config.id}",
          market:     "${config.market}",
          authority:  "${config.authority}",
          tier:       ${isTier2 ? 2 : 1},
          name: name === "there" ? "" : name,
${engineNative ? "          inputs," : `          inputs: {
${inputsObj}
          },`}
          fields: ${JSON.stringify(assessFields)},
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Assessment failed");
      setAssessment(data.assessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate assessment");
      // Graceful fallback — page still shows files and calendar
      setAssessment({
        ${assessFields.filter(f => f !== "accountantQuestions" && f !== "actions" && f !== "weekPlan").map(f => `${f}: "Your personalised ${f.replace(/_/g," ")} is being prepared — please refresh in a moment.",`).join("\n        ")}
        accountantQuestions: [
          "What is my exact ${config.authority} position based on my answers?",
          "What is the single most important action I should take${beforeAnchorQ}?",
          "Are there any planning opportunities specific to my situation?",
        ],
        ${isTier2 ? 'actions: [],' : ''}
      } as unknown as Assessment);
    } finally {
      setLoading(false);
    }
  }

${emittableEvents.length === 0 ? `  // handleCalendar() omitted: no event survived the R-A3 date gate, so there is no
  // .ics to build and no button to trigger it.` : `  function handleCalendar() {
    const now = new Date().toISOString().replace(/[-:]/g,"").split(".")[0] + "Z";${calReads ? `\n${calReads}` : ""}
    function relativeDate(d: number): string {
      return new Date(Date.now() + d * 86400000).toISOString().split("T")[0].replace(/-/g,"");
    }
    const ics = [
      "BEGIN:VCALENDAR","VERSION:2.0",
      "PRODID:-//TaxCheckNow//COLE//EN",
      "CALSCALE:GREGORIAN","METHOD:PUBLISH",
      \`X-WR-CALNAME:${config.name} — Deadlines\`,${icsEvents}
      "END:VCALENDAR",
    ].join("\\r\\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "${config.id}.ics";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setCalDone(true);
  }`}

  async function handleCopy() {
    if (!assessment?.accountantQuestions?.length) return;
    const text = (assessment.accountantQuestions as string[])
      .map((q,i) => \`\${i+1}. "\${q}"\`).join("\\n");
    await navigator.clipboard.writeText(
      \`${packName} — questions for my accountant:\\n\\n\${text}\\n\\nTaxCheckNow · taxchecknow.com\`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  const hi = firstName !== "there" ? firstName : "there";
  const greeting = firstName !== "there" ? \`\${firstName}\` : "you";

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      <style>{\`@media print { .no-print{display:none!important} body{font-size:12px;color:#000} .print-section{page-break-inside:avoid} }\`}</style>

      {/* NAV */}
      <nav className="no-print border-b border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
          <button onClick={() => window.print()}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-neutral-700 hover:bg-neutral-950 hover:text-white transition">
            ⬇ Save PDF
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl space-y-5 px-6 py-8">

        {/* ── HERO — confirmation + personal hook ── */}
        <div className="print-section rounded-2xl border-2 border-emerald-500 bg-emerald-50 px-6 py-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700">
            Payment confirmed · ${packName} · ${currency}${price}
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold text-neutral-950">
            {hi !== "there" ? \`\${hi}, here is your \` : "Your "}${packNounPhrase}
          </h1>
          <p className="mt-1 text-sm text-emerald-800">
            ${isTier2
              ? "This is your full implementation plan — built around your specific inputs, not the average taxpayer."
              : "This is your personalised assessment — built around your exact answers, not a generic guide."}
          </p>
${qualitative ? `          {/* No date resolves for this product (temporal kind "${config.temporal?.kind}"), so the
              countdown is replaced by its DECLARED qualitative urgency — corpus-true for every
              customer, and not a fabricated day-count. */}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-red-700 px-4 py-2.5">
            <span className="text-sm font-bold text-white">🔴 ${qualitative.headline}</span>
            <span className="font-mono text-sm font-bold text-white">${qualitative.badge}</span>
          </div>` : `          {deadlineLive && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-red-700 px-4 py-2.5">
            <span className="text-sm font-bold text-white">🔴 {daysToDeadline} days to ${config.deadline.display}</span>
            <span className="font-mono text-sm font-bold text-white">${config.deadline.short}</span>
          </div>
          )}`}
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-semibold text-neutral-700">Building your personalised assessment…</p>
            <p className="mt-1 text-xs text-neutral-400">Analysing your answers against ${config.authority} rules</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {error && !loading && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠ Assessment generation issue — showing your files and calendar below.
            <button onClick={() => generateAssessment(firstName)}
              className="no-print ml-2 underline font-semibold">Try again →</button>
          </div>
        )}

        {/* ── ASSESSMENT ── */}
        {!loading && assessment && (
          <>

            {/* YOUR POSITION — key verdict fields */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your ${config.market} ${config.authority} position
              </p>
              <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">
                What this means for {greeting}
              </h2>
              <div className="space-y-3">
                {(${JSON.stringify(assessFields.slice(0,6))} as string[]).map(key => {
                  const val = assessment[key];
                  if (!val || typeof val !== "string") return null;
                  return (
                    <div key={key} className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-4">
                      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                        {key.replace(/([A-Z])/g,' $1').replace(/_/g,' ').trim().replace(/^./,c=>c.toUpperCase())}
                      </p>
                      <p className="text-sm leading-relaxed text-neutral-900">{val}</p>
                    </div>
                  );
                })}
              </div>
            </div>

${isTier2 ? `
            {/* ACTIONS CHECKLIST — tier 2 */}
            {Array.isArray(assessment.actions) && assessment.actions.length > 0 && (
              <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                  Your action checklist
                </p>
                <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">
                  What to do — in order${beforeAnchor}
                </h2>
                <div className="space-y-4">
                  {(assessment.actions as Action[]).map((action, i) => (
                    <div key={i} className={\`rounded-xl border p-5 transition \${checked[i] ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"}\`}>
                      <div className="flex items-start gap-3 mb-3">
                        <button onClick={() => setChecked(p => ({ ...p, [i]: !p[i] }))}
                          className={\`no-print mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition \${checked[i] ? "border-emerald-500 bg-emerald-500" : "border-neutral-300 bg-white hover:border-neutral-950"}\`}>
                          {checked[i] && <span className="text-xs font-bold text-white">✓</span>}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={\`font-bold \${checked[i] ? "text-neutral-400 line-through" : "text-neutral-950"}\`}>
                              {i + 1}. {action.title}
                            </p>
                            <span className="shrink-0 rounded-lg bg-red-100 px-2 py-0.5 font-mono text-[10px] font-bold text-red-700">
                              {action.deadline}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-9 space-y-2">
                        {action.steps?.map((step, j) => (
                          <div key={j} className="flex items-start gap-2">
                            <span className="mt-0.5 shrink-0 font-mono text-xs text-neutral-400">{j+1}.</span>
                            <p className="text-sm leading-relaxed text-neutral-700">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}` : `
            {/* FIRST ACTION — tier 1 */}
            {assessment.firstAction && (
              <div className="print-section rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                  Your first action
                </p>
                <p className="text-lg font-bold leading-relaxed text-white">
                  {String(assessment.firstAction)}
                </p>
              </div>
            )}`}

            {/* ACCOUNTANT QUESTIONS */}
            {Array.isArray(assessment.accountantQuestions) && assessment.accountantQuestions.length > 0 && (
              <div className="print-section rounded-2xl border border-blue-100 bg-blue-50 p-6">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700">
                      Questions for your accountant
                    </p>
                    <p className="mt-1 text-sm text-blue-800">
                      Copy these and take them to your next meeting. Each one is specific to your situation.
                    </p>
                  </div>
                  <button onClick={handleCopy}
                    className="no-print shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs font-bold text-blue-700 hover:bg-blue-700 hover:text-white transition">
                    {copied ? "Copied ✓" : "Copy all →"}
                  </button>
                </div>
                <div className="space-y-2">
                  {(assessment.accountantQuestions as string[]).map((q, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3">
                      <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-blue-600">{i+1}</span>
                      <p className="text-sm leading-relaxed text-blue-900">"{q}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

${emittableEvents.length === 0 ? `            {/* CALENDAR — suppressed at generate time: every dated event was dropped
                (see the R-A3 calendar warning in the build log). An empty "key dates"
                panel with a download button that yields an eventless .ics is worse than
                no panel at all. */}` : `            {/* CALENDAR */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Key dates for your calendar
              </p>
              <h2 className="mb-4 font-serif text-lg font-bold text-neutral-950">
                Add these now — don't rely on memory
              </h2>
              <div className="mb-4 space-y-2">
                ${emittableEvents.map(evt => `
                <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">${evt.summary}</p>
                    <p className="text-xs text-neutral-500">${evt.description}</p>
                  </div>
                  <span className="ml-3 shrink-0 font-mono text-xs font-bold text-neutral-500">
                    ${evt.date.startsWith("relative:") ? relativeDateLabel(evt.date) : formatDateDisplay(evt.date)}
                  </span>
                </div>`).join("")}
              </div>
              <button onClick={handleCalendar}
                className="no-print w-full rounded-xl bg-neutral-950 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                {calDone ? "✓ Downloaded — open the .ics file to add to your calendar" : "📅 Add all dates to Apple / Google / Outlook calendar →"}
              </button>
            </div>`}

            {/* YOUR FILES */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your ${fileCount === 8 ? "eight" : "five"} personalised documents
              </p>
              <h2 className="mb-1 font-serif text-xl font-bold text-neutral-950">
                Everything you need — in one place
              </h2>
              <p className="mb-4 text-sm text-neutral-500">
                Each document is built around your specific ${config.authority} position.
                Start with File 02 — it has your exact numbers.
                ${isTier2 ? "Files 06–08 are exclusive to this plan." : ""}
              </p>
              <div className="space-y-2">
                {FILES.map((f, i) => (
                  <div key={f.num} className={\`flex items-center justify-between rounded-xl border px-4 py-3 \${
                    i === 1 ? "border-neutral-900 bg-neutral-950"
                    : f.tier === 2 ? "border-blue-100 bg-blue-50"
                    : "border-neutral-100 bg-neutral-50"
                  }\`}>
                    <div>
                      {i === 1 && <span className="block font-mono text-[9px] uppercase tracking-widest text-amber-400 mb-0.5">Start here</span>}
                      {f.tier === 2 && i !== 1 && <span className="block font-mono text-[9px] uppercase tracking-widest text-blue-600 mb-0.5">Plan only</span>}
                      <p className={\`text-sm font-semibold \${i === 1 ? "text-white" : "text-neutral-950"}\`}>{f.num} — {f.name}</p>
                      <p className={\`text-xs \${i === 1 ? "text-neutral-400" : f.tier === 2 ? "text-blue-700" : "text-neutral-500"}\`}>{f.desc}</p>
                    </div>
                    <a href={\`/files/${config.country}/${config.id}/\${f.slug}\`}
                      target="_blank" rel="noopener noreferrer"
                      className={\`no-print ml-4 shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition \${
                        i === 1 ? "border-white/20 bg-white text-neutral-950 hover:bg-neutral-200"
                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-950 hover:text-white"
                      }\`}>
                      Open →
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* CLOSE — start here end here */}
            <div className="print-section rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">One thing to do today</p>
              <p className="mb-4 text-lg font-bold leading-relaxed text-white">
                Open File 02 — your exact numbers are in there.
                Forward File 05 to your accountant.
                ${isTier2 ? "Work through the checklist above." : ""}
                ${qualitative ? qualitative.cta : `{deadlineLive ? \`\${daysToDeadline} days to ${config.deadline.display}.\` : ""}`}
              </p>
              <div className="flex flex-wrap gap-3 no-print">
                <button onClick={() => window.print()}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-800 transition">
                  ⬇ Save as PDF
                </button>
${emittableEvents.length === 0 ? "" : `                <button onClick={handleCalendar}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-800 transition">
                  📅 Add to calendar
                </button>`}
                <button onClick={handleCopy}
                  className="rounded-xl border border-neutral-700 px-5 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-800 transition">
                  📋 Copy accountant questions
                </button>
              </div>
            </div>

${!isTier2 ? `
            {/* UPGRADE */}
            <div className="no-print rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Want the full implementation plan?</p>
              <p className="mb-1 font-serif text-lg font-bold text-neutral-950">${config.tier2.name}</p>
              <p className="mb-3 text-sm text-neutral-600">${config.tier2.value}</p>
              <Link href="/${config.slug}"
                className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950 transition">
                Upgrade — ${sym(config)}${config.tier2.price} →
              </Link>
            </div>` : ""}

            {/* CROSSLINK */}
            ${config.crosslink ? `
            <div className="no-print rounded-2xl border border-neutral-100 bg-neutral-50 p-5">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Also relevant</p>
              <p className="mb-1 text-sm font-bold text-neutral-950">${config.crosslink.title}</p>
              <p className="mb-2 text-xs text-neutral-600">${config.crosslink.body}</p>
              <Link href="${config.crosslink.url}" className="font-mono text-xs font-bold text-neutral-700 underline hover:text-neutral-950">
                ${config.crosslink.label}
              </Link>
            </div>` : ""}

          </>
        )}

        {/* DISCLAIMER */}
        <div className="rounded-xl bg-neutral-100 px-5 py-4">
          <p className="text-xs leading-relaxed text-neutral-500">
            <strong className="text-neutral-600">General information only.</strong>{" "}
            This assessment does not constitute financial, tax or legal advice. TaxCheckNow is not a regulated financial adviser.
            Always consult a qualified ${config.market} tax adviser before making financial decisions.
            Based on ${config.authority} guidance ${config.lastVerified}.{" "}
            ${config.sources.slice(0,2).map(s =>
              `<a href="${s.url}" target="_blank" rel="noopener noreferrer" className="underline">${s.title}</a>`
            ).join(" · ")}
          </p>
        </div>

      </main>
    </div>
  );
}
`;
}

/**
 * Escape a TEXT value for an .ics file (RFC 5545 §3.3.11): backslash, semicolon
 * and comma are escaped, newlines become \n.
 *
 * Every description in these configs contains commas, and an unescaped comma in
 * a TEXT value is a VALUE SEPARATOR — strict parsers truncate the description at
 * the first one or reject the event. The hand-patched FRCGW page escapes them by
 * hand ("...withheld automatically\, 15%..."), which is the correct behaviour;
 * the generator did not, so it could not reproduce that page.
 *
 * NOTE the double layer: the output of this function is written INTO a TypeScript
 * string literal in the generated file, so an emitted `\\,` is what yields the
 * runtime `\,` the .ics actually needs.
 */
function icsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\\\\\")
    .replace(/;/g, "\\\\;")
    .replace(/,/g, "\\\\,")
    .replace(/\r?\n/g, "\\\\n");
}

/**
 * Does this product claim a real, resolvable calendar date at all?
 *
 * `temporal` is authoritative when present — that is the entire point of the
 * declaration. `unresolvable` and `none` mean the product has SAID it cannot
 * produce a date for any customer, so any absolute date sitting in its calendar
 * config is an authoring leftover, not a fact.
 *
 * When `temporal` is absent the product is UNDECLARED, and we fall back to the
 * same signal the countdown uses (`deadline.isoDate`) so this change does not
 * silently strip dates from the 40-odd products that have not declared yet.
 * Undeclared + a future isoDate keeps today's behaviour; undeclared + a past or
 * empty isoDate was already broken and now fails closed.
 */
function productClaimsADate(config: ProductConfig): boolean {
  if (config.temporal) {
    const computable =
      config.temporal.kind === "deadline"
      || config.temporal.kind === "window"
      || config.temporal.kind === "effective_from";
    // A PER-CUSTOMER date is not a PRODUCT-LEVEL date — see declaresOnlyAPerCustomerDate().
    return computable && !declaresOnlyAPerCustomerDate(config);
  }
  const iso = Date.parse(config.deadline?.isoDate ?? "");
  return !Number.isNaN(iso) && iso >= Date.now();
}

/**
 * Does this product declare a real date that only ever exists PER CUSTOMER?
 *
 * TEMPORAL v1 split the world into "has a computable date" (deadline / window /
 * effective_from) and "declared it has none" (unresolvable / none), and the generator
 * treated the first group as necessarily having a date AT GENERATE TIME. That holds for a
 * `fixed` rule — "30 June" resolves without a customer. It does not hold for a
 * `user_supplied` or `user_derived` rule, where the date is an answer and there is no
 * customer standing in front of the generator.
 *
 * Nothing hit this until FRCGW re-declared as user_supplied (E3), and the result was
 * revealing: the generator classified it as claiming a date, could not produce one from
 * `deadline.isoDate` (empty by design), and therefore emitted the EXPIRED-DEADLINE branch —
 * a console.error on every page load, for a product behaving exactly as declared. That is
 * the "channel trained to be ignored" failure the Phase 0 comment in this file warns about,
 * arriving through the one door it did not cover.
 *
 * So: statically, such a product is silent and may use its qualitative stand-in, exactly
 * like a declared-absent one. Dynamically it is richer than either — the page resolves the
 * customer's own date at runtime. Both are true; this predicate answers only the static
 * question the generator is entitled to ask.
 */
function declaresOnlyAPerCustomerDate(config: ProductConfig): boolean {
  const t = config.temporal;
  if (!t) return false;
  const src = (rule: { source?: string } | undefined): boolean =>
    rule?.source === "user_supplied" || rule?.source === "user_derived";
  if (t.kind === "deadline" || t.kind === "effective_from") return src(t.rule);
  // A window needs a customer for BOTH edges before it can be called per-customer; if only
  // one edge is user-supplied the other is still a real product-level date worth stating.
  if (t.kind === "window") return src(t.opens) && src(t.closes);
  return false;
}

/**
 * Human label for a relative calendar event in the visible list.
 *
 * Previously every relative event was labelled "This week", which is simply
 * false for the +21 and +28 day events FRCGW declares — the customer reads
 * "This week" against an event a month out.
 */
function relativeDateLabel(relativeStr: string): string {
  const m = relativeStr.match(/\+(\d+)days/);
  if (!m) return "Soon";
  const d = Number(m[1]);
  if (d === 0) return "Now";
  if (d <= 7)  return "This week";
  if (d <= 14) return "In 2 weeks";
  return `In ${d} days`;
}

function buildRelativeDate(relativeStr: string): string {
  const match = relativeStr.match(/\+(\d+)days/);
  if (!match) return `"${relativeStr}"`;
  return `relativeDate(${match[1]})`;
}

function formatDateDisplay(dateStr: string): string {
  if (dateStr.length !== 8) return dateStr;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const year  = dateStr.slice(0,4);
  const month = parseInt(dateStr.slice(4,6)) - 1;
  const day   = parseInt(dateStr.slice(6,8));
  return `${day} ${months[month]} ${year}`;
}
