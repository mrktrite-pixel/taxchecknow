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
import { verifyEngineNative, engineSessionKey } from "./verify-engine-native";
// The ONE predicate that decides rule-vs-stored, shared with the gate and files generators so
// three surfaces cannot disagree about which mode a product is in.
import { resolvesFromRule } from "./generate-gate-page";

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
  // EUR first — the ternary's else-branch is "£", so any non-dollar currency became GBP.
  // Kept structurally identical to app/_components/engine-config.ts currencySymbol(): the two
  // are mirrors and the comment there says they change together. This is that change.
  if (config.currency === "EUR") return "€";
  return ["USD","NZD","CAD","AUD"].includes(config.currency) ? "$" : "£";
}

/**
 * D2 — the SHORT, prose-safe form of config.market.
 *
 * config.market is the ASSESSMENT CONTEXT string, and it is deliberately verbose: 183-day's
 * is "United States (IRS Substantial Presence Test)", narrowed on purpose so /api/assess
 * answers on one jurisdiction's test rather than across five. That string is correct where it
 * is POSTED and wrong where it is READ: the heading rendered "Your United States (IRS
 * Substantial Presence Test) IRS position" and the disclaimer "a qualified United States (IRS
 * Substantial Presence Test) tax adviser".
 *
 * DERIVED, not a new config field and not a lookup table: drop a trailing parenthetical and
 * trim. Measured across all 48 configs — only 4 carry a parenthetical
 * ("United States (IRS Substantial Presence Test)" -> "United States", "Global (cross-border)"
 * and "Global (cross-border departure)" -> "Global"), so for the other 44 this is a no-op and
 * their prose cannot move. The full string still goes to /api/assess untouched.
 */
/**
 * A — the SHORT, prose-safe form of config.authority. Same shape as marketProse above,
 * and the same reasoning: the string is right where it is CITED and wrong where it is READ.
 *
 * config.authority is the full legal name of the regulator, which is correct in a citation
 * ("Based on <full name> guidance April 2026") and in the /api/assess payload, but reads
 * badly mid-sentence. Beckham rendered:
 *     "Your Spain Agencia Estatal de Administracion Tributaria (AEAT) position"
 *
 * RULE: if the authority ends in a parenthetical ACRONYM, use the acronym; otherwise return
 * it unchanged. Measured across all 48 configs (2026-09-21): 16 end in an acronym
 * (CRA x5, IRD x5, ATO x2, HMRC x2, IRS x1, AEAT x1) and 32 do not, so this is a no-op for
 * two thirds of the estate.
 *
 * The acronym pattern deliberately allows NO spaces and NO slashes, which is what keeps
 * "National tax authorities (CRA / ATO / HMRC / IRD NZ / IRS)" intact — that trailing
 * parenthesis is a LIST, not an acronym, and collapsing it would destroy the meaning.
 *
 * APPLIED IN PROSE SLOTS ONLY. The /api/assess payload and the footer citation keep the
 * full legal name; see the call sites.
 */
function authorityProse(config: ProductConfig): string {
  const a = (config.authority ?? "").trim();
  const m = a.match(/[(]([A-Z][A-Za-z0-9.-]{1,12})[)]$/);
  return m ? m[1] : a;
}

function marketProse(config: ProductConfig): string {
  return (config.market ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim() || config.market;
}

/**
 * D3 — sources that may appear in CUSTOMER-FACING copy.
 *
 * config.sources carries both real authority citations and an internal machine surface:
 * 31 of 48 configs list { title: "Machine-readable JSON rules", url: "/api/rules/<id>" }.
 * That is estate plumbing — an answer-engine affordance for the public gate page — and it was
 * being rendered verbatim into the paid success PDF's footer and into every delivered file
 * page, where it reads as a broken promise to a buyer who cannot use it.
 *
 * Filtered by URL, not by title, so a retitled entry cannot slip through: anything whose href
 * is site-internal (/api/...) is plumbing. Filtered BEFORE the slice, so a product whose
 * second source is the JSON route surfaces its next REAL citation instead of losing a slot.
 * The gate page is deliberately NOT changed — there the link is intentional.
 */
function customerSources(config: ProductConfig) {
  return (config.sources ?? []).filter((s) => !/^\/api\//.test(s.url ?? ""));
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
    ? `      // Bind to the user's REAL engine answers — the keys EngineCalculator actually wrote,
      // which are keyed by the ROUTE TAIL (engineSessionKey), NOT by config.id: the two differ
      // on day-183-rule and spain-beckham, and passing config.id missed every read (DECISION-A).
      // (<slug-tail>_answers + <slug-tail>_qualification) — via the SAME composer the webhook uses
      // (F5 contract). The legacy per-field keys are never written by an engine-native
      // calculator, so reading them would always fall back to defaults → a generic,
      // corpus-contradicting assessment.
      const inputs = buildComposerInputsFromSession("${engineSessionKey(config)}");`
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

  // STEP7-JUNE15 — DOES THIS PRODUCT'S DATE COME FROM ITS RULE?
  //
  // Same predicate the gate and files generators use, so the three surfaces cannot disagree about
  // which mode a product is in. True only for a fixed rule WITH an empty deadline.isoDate, which is
  // why every other product's page is emitted byte-identically to before.
  const RULE_PATH = resolvesFromRule(config);
  // The names the emitted page uses. On the rule path they are page-local consts filled at render;
  // otherwise they stay the baked strings they have always been.
  const DISPLAY_EXPR = RULE_PATH ? "{DEADLINE_DISPLAY}" : config.deadline.display;
  const SHORT_EXPR   = RULE_PATH ? "{DEADLINE_SHORT}"   : config.deadline.short;
  // The alert text, composed here: a `${...}` inside a nested plain string in the page template is
  // never interpolated, and the first version of this line emitted the literal characters
  // ${config.deadline.isoDate} into the generated page.
  const TEMPORAL_ALERT_WHAT = RULE_PATH ? "fixed rule did not resolve" : "expired deadline suppressed";
  // STEP8 — "Due today" at the strip and the closing line.
  const STRIP_COUNTDOWN = RULE_PATH
    ? '{DEADLINE_PHRASE} {daysToDeadline === 0 ? "\u2014" : "to"} {DEADLINE_DISPLAY}'
    : `{daysToDeadline} days to ${config.deadline.display}`;
  const CTA_COUNTDOWN = RULE_PATH
    ? '{deadlineLive ? `${DEADLINE_PHRASE}${daysToDeadline === 0 ? " \u2014 " : " to "}${DEADLINE_DISPLAY}.` : ""}'
    : "{deadlineLive ? `${daysToDeadline} days to " + config.deadline.display + ".` : \"\"}";
  const TEMPORAL_ALERT_EXTRA = RULE_PATH ? "" : `, deadlineIso: ${JSON.stringify(config.deadline.isoDate)}`;

  // STEP7-JUNE15 — the emitted countdown preamble. Built here rather than inline because the page
  // template is a template literal and this block contains its own; three levels of nesting is how
  // a generated file gets silently truncated.
  const COUNTDOWN_BLOCK = RULE_PATH
    ? [
        `  // The date is this product's RULE, resolved on every render by lib/temporal-display.ts —`,
        `  // the same arithmetic lib/temporal-resolver.ts gives the email scheduler, so the`,
        `  // countdown on this page and the reminder in the inbox cannot drift apart.`,
        `  //`,
        `  // No date is stored anywhere in this file. The version that stored one showed a stale`,
        `  // label and logged an expired-deadline error on every load once it passed.`,
        `  const _deadline = resolvedDeadlineFor(${JSON.stringify(config.site)}, ${JSON.stringify(config.id)});`,
        `  const daysToDeadline: number | null = _deadline ? _deadline.daysAway : null;`,
        `  const DEADLINE_DISPLAY = _deadline?.display ?? "";`,
        `  const DEADLINE_SHORT   = _deadline?.short ?? "";`,
    `  // "0 days" is not a sentence anyone says; the due date gets its own words. Only a resolved`,
    `  // rule can land on today — the stored-date path returned null for anything not in the future.`,
    `  const DEADLINE_PHRASE = daysToDeadline === 0 ? "Due today" : \`\${daysToDeadline} days\`;`,
      ].join("\n")
    : [
        `  // TEMPORAL v1 Phase 0 — fail-closed on time: days remaining, or null when the fixed`,
        `  // deadline is absent / unparseable / already passed. null suppresses the countdown entirely`,
        `  // (never "0 days", never a negative, never a stale label).`,
        `  const daysToDeadline: number | null = (() => {`,
        `    const end = new Date(${JSON.stringify(config.deadline.isoDate)}).getTime();`,
        `    if (Number.isNaN(end)) return null;`,
        `    const d = Math.floor((end - Date.now()) / 86_400_000);`,
        `    return d > 0 ? d : null;`,
        `  })();`,
      ].join("\n")
  ;


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
  //
  // STEP7-JUNE15 adds the third case. A rule-declared product has an EMPTY display, so the old
  // branch would have emitted " — before " with nothing after it, in a heading and in the prompt
  // sent to the model. It also must not embed a resolved DATE here: both slots render outside the
  // deadlineLive gate and one of them is prompt text, where a date frozen at generate time is
  // exactly how "before 15 June 2027" would still be asked of the model in 2028. `temporal.label`
  // is the anchor's NAME — documented as "Human label used in customer-facing copy" — and it does
  // not rot.
  const anchorName = config.temporal?.label ?? "";
  const beforeAnchor = deadlineDeclaredAbsent || RULE_PATH
    ? (anchorName ? ` — before ${anchorName}` : "")
    : ` — before ${config.deadline.display}`;
  const beforeAnchorQ = deadlineDeclaredAbsent || RULE_PATH
    ? (anchorName ? ` before ${anchorName}` : " now")
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
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { renderPack, hasFrozenPack, type RenderedPack } from "@/lib/render-pack";
import { getAssessmentFields } from "@/lib/assessment-fields";${engineNative ? `\nimport { buildComposerInputsFromSession } from "@/lib/composer-inputs";` : ""}${RULE_PATH ? `\nimport { resolvedDeadlineFor } from "@/lib/temporal-display";` : ""}

const FILES = ${JSON.stringify(visibleFiles.map(f => ({
    num: f.num, slug: f.slug, name: f.name, desc: f.desc, tier: f.tier,
  })), null, 2)};

interface Action { title: string; deadline: string; steps: string[]; }
// FREEZE — the identity the ASSESSMENTS TABLE is keyed by, i.e. the webhook's
// DELIVERY_MAP productId, which is the route tail (and what lib/assessment-fields.ts is
// keyed on). NOT config.id: the two differ on day-183-rule and spain-beckham. Used only as
// a fallback — the heal path prefers the product id the stored row itself carries.
const PRODUCT_REGISTRY_ID = ${JSON.stringify(engineSessionKey(config))};
const TIER = ${isTier2 ? 147 : 67};

type Assessment = Record<string, unknown> & {
  accountantQuestions?: string[];
  actions?: Action[];
};

export default function Success${isTier2 ? "Plan" : "Assess"}() {
  const [firstName,  setFirstName]  = useState("there");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  // FREEZE — the PACK is what this page renders. Either the stored row already carries it
  // (bought after the freeze landed) or we heal it on view from the raw keys, below.
  const [pack, setPack] = useState<RenderedPack | null>(null);
  // One freeze POST per mount. Without this the heal would re-post on every effect re-run
  // and the route would answer "already frozen" forever — correct, but a request per view.
  const frozePosted = useRef(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  // How long we have been waiting for the webhook's row, so the holding copy can say so rather
  // than spinning silently for a minute and a half.
  const [waitedMs,   setWaitedMs]   = useState(0);
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

  useEffect(() => { init(); }, []);` : `${COUNTDOWN_BLOCK}
  const deadlineLive = daysToDeadline !== null;

  useEffect(() => { init(); }, []);

  // Suppress + alert (TEMPORAL v1 Phase 0): a deadline this product DOES claim, which has
  // expired or will not parse, is a real defect — surface it so it is never silent.
  // Phase 5 replaces this with real alerting.
  useEffect(() => {
    if (!deadlineLive) console.error("[TEMPORAL] ${TEMPORAL_ALERT_WHAT} on success page", { product: "${config.id}"${TEMPORAL_ALERT_EXTRA} });
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
    await loadAssessment(name);
  }

  /**
   * Load the buyer's pack. IT IS NEVER GENERATED HERE.
   *
   * F41 RULING. This function used to end in a client POST /api/assess whenever the stored row was
   * not there yet, and that fallback was the problem, not the safety net:
   *
   *   - it produced a SECOND, different pack for the same purchase. The webhook writes one and
   *     emails it; the browser generated another from whatever was in sessionStorage. Two documents,
   *     one sale, and the buyer saw whichever raced first.
   *   - on an engine-native product the inputs it sent were the per-field sessionStorage keys that
   *     nothing writes, so it fell back to hardcoded defaults and produced a confident,
   *     personalised-LOOKING assessment built from numbers the customer never supplied.
   *   - it spent the buyer's money twice: a second model call per refresh, uncapped.
   *
   * So the page WAITS instead. The webhook is the only writer; this polls for up to 90 seconds and,
   * if the row still is not there, says so plainly and points at the email — which is a real
   * delivery channel, already sent by the same webhook, and does not require the buyer to sit on
   * this tab. Nothing is invented on the client.
   */
  async function loadAssessment(name: string) {
    setLoading(true);
    setError("");
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    // No session id means we cannot identify the purchase at all — there is nothing to poll for,
    // and polling 30 times to say so would just be a slower version of the same answer.
    if (!sessionId) { showHolding(name, "nosession"); return; }

    const WINDOW_MS = 90_000;   // the F41 ruling's ceiling
    const EVERY_MS  = 3_000;
    const startedAt = Date.now();

    try {
      for (;;) {
        const r = await fetch(\`/api/get-assessment?session_id=\${sessionId}\`);
        if (r.ok) {
          const d = await r.json();
          if (d.assessment) { adoptStored(d, name); return; }
        }
        // Stop BEFORE a sleep that would take us past the window, so 90s is a ceiling on the wait
        // and not on the last attempt's start.
        if (Date.now() - startedAt + EVERY_MS >= WINDOW_MS) break;
        setWaitedMs(Date.now() - startedAt);
        await new Promise((res) => setTimeout(res, EVERY_MS));
      }
      showHolding(name, "timeout");
    } catch {
      // A network failure is not evidence that the pack does not exist, so the copy is the same:
      // it is in the email either way.
      showHolding(name, "timeout");
    } finally {
      setLoading(false);
    }
  }

  /** Adopt the stored row: the frozen pack verbatim when there is one, else heal it on view. */
  function adoptStored(d: { assessment?: unknown; customerName?: unknown; productId?: unknown }, name: string) {
    // D — NAME FALLBACK. The greeting comes from /api/get-session, which returns "there" whenever
    // the Stripe session carries no customer_details.name. The stored row already holds the buyer
    // name and /api/get-assessment already returns it — the page simply never looked. A name that
    // DID arrive from get-session always wins.
    if (name === "there" && typeof d.customerName === "string" && d.customerName.trim() !== "") {
      setFirstName(d.customerName);
    }
    setAssessment(d.assessment as Assessment);
    // FREEZE: adopt the stored document verbatim when it exists.
    if (hasFrozenPack(d.assessment)) {
      setPack((d.assessment as Record<string, unknown>).rendered as RenderedPack);
    } else {
      // HEAL ON VIEW — a row written before the freeze. Render it exactly as the writer would have,
      // show that, and post it so the SECOND view reads a frozen copy. Keyed on the row's OWN
      // product id (the identity the webhook stored it under) so a heal can never re-key a row.
      const healId = typeof d.productId === "string" && d.productId ? d.productId : PRODUCT_REGISTRY_ID;
      const healed = renderPack(d.assessment as Record<string, unknown>, {
        productId:    healId,
        tier:         TIER,
        customerName: typeof d.customerName === "string" ? d.customerName : name,
        fieldList:    getAssessmentFields(healId, TIER),
      });
      setPack(healed);
      const sessionId = new URLSearchParams(window.location.search).get("session_id");
      if (sessionId && !frozePosted.current) {
        frozePosted.current = true;
        fetch("/api/freeze-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, rendered: healed }),
        }).catch(() => { /* non-fatal: the buyer already has their pack on screen */ });
      }
    }
    setLoading(false);
  }

  /**
   * The pack is not here yet. Say that, and do not fake one.
   *
   * The holding text is rendered through renderPack so the page below still has its shape — files,
   * calendar, the accountant questions — instead of an empty column. It is NEVER posted to
   * /api/freeze-pack: freezing "is being prepared" would store that as the buyer's document
   * forever, which is the one outcome worse than waiting.
   */
  function showHolding(name: string, why: "timeout" | "nosession") {
    setError(why);
    const placeholder = {
      ${assessFields.filter(f => f !== "accountantQuestions" && f !== "actions" && f !== "weekPlan").map(f => `${f}: "Your personalised ${f.replace(/_/g," ")} is on its way by email.",`).join("\n      ")}
      accountantQuestions: [
        "What is my exact ${authorityProse(config)} position based on my answers?",
        "What is the single most important action I should take${beforeAnchorQ}?",
        "Are there any planning opportunities specific to my situation?",
      ],
      ${isTier2 ? 'actions: [],' : ''}
    } as unknown as Assessment;
    setAssessment(placeholder);
    setPack(renderPack(placeholder as Record<string, unknown>, {
      productId:    PRODUCT_REGISTRY_ID,
      tier:         TIER,
      customerName: name === "there" ? "" : name,
      fieldList:    getAssessmentFields(PRODUCT_REGISTRY_ID, TIER),
    }));
    setLoading(false);
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
    if (!pack?.accountantQuestions.length) return;
    const text = pack.accountantQuestions
      .map((q,i) => \`\${i+1}. "\${q}"\`).join("\\n");
    await navigator.clipboard.writeText(
      \`${packName} — questions for my accountant:\\n\\n\${text}\\n\\nTaxCheckNow · taxchecknow.com\`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  // D4 — NORMALISE THE NAME AT RENDER. /api/get-session returns whatever the buyer typed at
  // checkout; a lowercase "general" rendered "general, here is your ...". Trim, collapse inner
  // whitespace, and upper-case the first letter only — never the rest, because "McLeod" and
  // "O'Brien" must survive. A whitespace-only value collapses to "" and falls back to the
  // unnamed branch, which also closes the residual the beckham HOLD flagged.
  // FREEZE — the pack carries the name it was rendered with, so a frozen pack greets the
  // buyer identically forever. get-session / get-assessment stay the fallbacks for a row
  // that was rendered before a name was known.
  const rawName = (pack?.name ?? "").trim() !== "" ? (pack as RenderedPack).name : firstName;
  const displayName = rawName.trim().replace(/\\s+/g, " ").replace(/^./, (c) => c.toUpperCase());
  const named = displayName !== "" && rawName !== "there";
  const hi = named ? displayName : "there";
  const greeting = named ? displayName : "you";

  // FREEZE — the reader no longer derives anything. The per-product key array and the
  // generic degrade moved INTO lib/render-pack.ts, which runs at write time (webhook) or,
  // for a pre-freeze row, once in the heal path above. A page that re-derives is a page
  // that can disagree with its writer; this one cannot.
  const sections = pack?.sections ?? [];

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
            <span className="text-sm font-bold text-white">🔴 ${STRIP_COUNTDOWN}</span>
            <span className="font-mono text-sm font-bold text-white">${SHORT_EXPR}</span>
          </div>
          )}`}
        </div>

        {/* ── LOADING ── */}
        {loading && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            <p className="text-sm font-semibold text-neutral-700">Preparing your pack…</p>
            <p className="mt-1 text-xs text-neutral-400">
              {waitedMs < 12_000
                ? "Your assessment is being written against ${authorityProse(config)} rules."
                : \`Still working — \${Math.round(waitedMs / 1000)}s. This page updates itself; you do not need to refresh.\`}
            </p>
          </div>
        )}

        {/* ── STILL BEING WRITTEN (F41) ──
            Not an error, and not worded as one. The pack is generated and emailed by the webhook,
            so a page that got here has simply arrived first — the buyer has not lost anything and
            there is nothing for them to fix. The old copy said "Assessment generation issue" about
            a purchase that had completed perfectly. */}
        {error && !loading && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-semibold">Your pack is still being written.</p>
            <p className="mt-1">
              {error === "nosession"
                ? "This page was opened without its purchase link, so we cannot match it to your order. Your pack is in the email we sent to the address you paid with — open it from the link in there."
                : "It is taking longer than usual. We have emailed it to the address you paid with, so you do not need to wait here — and your files and calendar are ready below."}
            </p>
            {error === "timeout" ? (
              <button onClick={() => loadAssessment(firstName)}
                className="no-print mt-2 underline font-semibold">Check again →</button>
            ) : null}
          </div>
        )}

        {/* ── ASSESSMENT ── */}
        {!loading && assessment && (
          <>

            {/* YOUR POSITION — key verdict fields */}
            <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Your ${marketProse(config)} ${authorityProse(config)} position
              </p>
              <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">
                What this means for {greeting}
              </h2>
              <div className="space-y-3">
                {sections.map((sec) => (
                  <div key={sec.key} className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-4">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                      {sec.heading}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-900">{sec.text}</p>
                  </div>
                ))}
              </div>
            </div>

${isTier2 ? `
            {/* ACTIONS CHECKLIST — tier 2 */}
            {(pack?.actions.length ?? 0) > 0 && (
              <div className="print-section rounded-2xl border border-neutral-200 bg-white p-6">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                  Your action checklist
                </p>
                <h2 className="mb-4 font-serif text-xl font-bold text-neutral-950">
                  What to do — in order${beforeAnchor}
                </h2>
                <div className="space-y-4">
                  {pack!.actions.map((action, i) => (
                    <div key={i} className={\`rounded-xl border p-5 transition \${checked[i] ? "border-emerald-200 bg-emerald-50" : "border-neutral-200 bg-neutral-50"}\`}>
                      <div className="flex items-start gap-3 mb-3">
                        <button onClick={() => setChecked(p => ({ ...p, [i]: !p[i] }))}
                          className={\`no-print mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition \${checked[i] ? "border-emerald-500 bg-emerald-500" : "border-neutral-300 bg-white hover:border-neutral-950"}\`}>
                          {checked[i] && <span className="text-xs font-bold text-white">✓</span>}
                        </button>
                        <div className="flex-1">
                          {/* URGENCY LABEL — do not "tidy" these classes back to a bare
                              shrink-0 span. action.deadline is model-generated and unbounded
                              ("within 6 months of Spanish Social Security registration"),
                              and shrink-0 alone is an instruction NOT to give way, so a long
                              string pushed straight out of the card (measured on the live
                              beckham tier-2 checklist). shrink-0 is kept — the label must not
                              be squeezed to nothing — but it is now bounded by max-w and
                              allowed to wrap inside itself, and the row may drop it below the
                              title when the line is too tight. No truncate: this block is a
                              print-section, and an ellipsis would silently cut the deadline
                              out of the buyer's PDF. min-w-0 on the title is what lets it
                              shrink at all (flex items default to min-width:auto). */}
                          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                            <p className={\`min-w-0 flex-1 font-bold \${checked[i] ? "text-neutral-400 line-through" : "text-neutral-950"}\`}>
                              {i + 1}. {action.title}
                            </p>
                            <span className="max-w-full shrink-0 whitespace-normal break-words rounded-lg bg-red-100 px-2 py-0.5 text-right font-mono text-[10px] font-bold text-red-700 sm:max-w-[45%]">
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
            {pack?.firstAction && (
              <div className="print-section rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                  Your first action
                </p>
                <p className="text-lg font-bold leading-relaxed text-white">
                  {pack.firstAction}
                </p>
              </div>
            )}`}

            {/* ACCOUNTANT QUESTIONS */}
            {(pack?.accountantQuestions.length ?? 0) > 0 && (
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
                  {pack!.accountantQuestions.map((q, i) => (
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
                Each document is built around your specific ${authorityProse(config)} position.
                File 02 is the worksheet that computes your exact numbers.
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
                Open File 02 and run your numbers through it.
                Forward File 05 to your accountant.
                ${isTier2 ? "Work through the checklist above." : ""}
                ${qualitative ? qualitative.cta : CTA_COUNTDOWN}
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
            Always consult a qualified ${marketProse(config)} tax adviser before making financial decisions.
            Based on ${config.authority} guidance ${config.lastVerified}.{" "}
            ${customerSources(config).slice(0,2).map(s =>
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
