// ─────────────────────────────────────────────────────────────────────────────
// COLE Generator — generate-gate-page.ts
// Reads a ProductConfig and writes the gate page (page.tsx)
// This is the server component — 14 sections, locked GOAT order
// Output path: app/[country]/check/[id]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductConfig } from "../types/product-config";
import { jurisdictionFlag } from "./jurisdiction-flag";

// GEO bake — transcript + published-video facts fetched at generate time (both optional).
// Drives a server-rendered transcript <section> + a VideoObject JSON-LD block, each emitted
// CONDITIONALLY: video present → VideoObject; transcript present → section; neither → page unchanged.
export interface GeoBake {
  transcript?: string | null;
  video?: { id: string; uploadDate?: string; name?: string; description?: string } | null;
}

/**
 * Currency symbol for the product, driven by config.currency.
 *
 * MIRRORS cole/generators/generate-success-pages.ts sym() and
 * app/_components/engine-config.ts currencySymbol() — all three are deliberate
 * mirrors of one list, and they change together.
 *
 * EUR is checked BEFORE the dollar list because the test below is a two-way split
 * whose else-branch is "£", so every non-dollar currency silently rendered as GBP.
 * This block was previously INLINED TWICE in the Product sidebar below, which is how
 * the Spain Beckham gate page (currency "EUR") shipped "£67" / "£147" while its own
 * calculator CTA read "€67". Never inline the test again — call this.
 */
function sym(config: ProductConfig): string {
  if (config.currency === "EUR") return "€";
  return ["USD","NZD","CAD","AUD"].includes(config.currency) ? "$" : "£";
}

/**
 * GEO lead-claim bullets + provenance (Section 4).
 *
 * Emitted ONLY when the product declares `geoClaims`. Absent — which is every product but
 * FRCGW today — this returns the empty string, so the surrounding template collapses to
 * exactly the markup it produced before this field existed. That byte-identity is the point:
 * the field is being added to rescue one product's hand-written block (commit 1314f10) from
 * the next regeneration, and it must not perturb the other 43 gate pages to do it.
 *
 * Bullets are plain text and are HTML-escaped. They are extraction targets for answer
 * engines, so they are deliberately short, self-contained, and each one true on its own
 * without the surrounding paragraph.
 */
function geoClaimsBlock(config: ProductConfig): string {
  const claims = config.geoClaims;
  if (!claims || !claims.bullets?.length) return "";
  const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
          {/* GEO: Lead claim bullets + provenance */}
          <ul className="geo-claim-bullets">
${claims.bullets.map(b => `            <li>${esc(b)}</li>`).join("\n")}
          </ul>${claims.provenance ? `
          <p className="geo-provenance">
            ${esc(claims.provenance)}
          </p>` : ""}
`;
}

// ── DEADLINE SOURCE: A RULE, OR A STORED STRING (STEP7-JUNE15) ────────────────────────────────
//
// Two emitted variants, chosen per product. They are built as separate functions rather than
// inlined into the page template because the page template is itself a template literal and the
// emitted code contains backticks — nesting a third level is how you silently truncate a file.

/**
 * Does this product's date come from its RULE rather than from a stored string?
 *
 * TRUE only when BOTH are so:
 *   - `temporal` declares a product-level fixed rule (source "fixed"), and
 *   - `deadline.isoDate` is empty: the author has deliberately removed the stored date.
 *
 * BOTH CONDITIONS, DELIBERATELY. Requiring the empty isoDate is what holds the blast radius at
 * zero: every product that still carries a stored date emits byte-identically to before and moves
 * onto this path only when someone edits its config on purpose. au-09 declares the same kind of
 * rule and keeps its stored 2026-10-31 — switching it silently would have moved its countdown to
 * the 2 November business-day shift without anyone deciding that.
 *
 * A user_supplied/user_derived rule is NOT this: there is no customer standing in front of a page
 * render either, so those keep the existing per-customer handling.
 */
export function resolvesFromRule(config: ProductConfig): boolean {
  const t = config.temporal;
  if (!t) return false;
  if (t.kind !== "deadline" && t.kind !== "effective_from") return false;
  if ((t.rule as { source?: string }).source !== "fixed") return false;
  return !(config.deadline?.isoDate ?? "").trim();
}

/** The module-level deadline block: the rule variant holds no date at all. */
function deadlineModuleBlock(config: ProductConfig): string {
  const lastVerified = `const LAST_VERIFIED  = "${config.lastVerified}";`;
  if (!resolvesFromRule(config)) {
    return [
      lastVerified,
      `const DEADLINE_LABEL = "${config.deadline.display}";`,
      `const DEADLINE_ISO   = "${config.deadline.isoDate}";`,
      ``,
      `// TEMPORAL v1 Phase 0 — fail-closed on time: returns days remaining, or null when there`,
      `// is no attestable future deadline (absent, unparseable, or already passed). A null result`,
      `// suppresses the countdown entirely — never "0 days", never a negative, never a stale label.`,
      `function daysToDeadline(): number | null {`,
      `  if (!DEADLINE_ISO) return null;`,
      `  const end = new Date(DEADLINE_ISO).getTime();`,
      `  if (Number.isNaN(end)) return null;`,
      `  const days = Math.ceil((end - Date.now()) / 86_400_000);`,
      `  return days > 0 ? days : null;`,
      `}`,
      ``,
      `function progressPct(): number {`,
      `  if (!DEADLINE_ISO) return 50;`,
      `  const start = new Date("2026-04-06T00:00:00Z").getTime();`,
      `  const end   = new Date(DEADLINE_ISO).getTime();`,
      `  const now   = Date.now();`,
      `  const total = end - start;`,
      `  const elapsed = Math.max(0, Math.min(total, now - start));`,
      `  return Math.round((elapsed / total) * 100);`,
      `}`,
    ].join("\n");
  }
  return [
    lastVerified,
    ``,
    `// ── DEADLINE: RESOLVED AT RENDER, NOT BAKED (STEP7-JUNE15) ──────────────────`,
    `// This page holds NO date. ${config.id} declares a recurrence rule, and the rule is resolved`,
    `// on every render by lib/temporal-display.ts — the same arithmetic lib/temporal-resolver.ts`,
    `// gives the email scheduler, so the countdown and the reminder cannot drift apart.`,
    `//`,
    `// What used to be here was a stored instant: correct until it passed, then confidently wrong,`,
    `// with the page logging an expired-deadline error on every load until someone regenerated it.`,
    `//`,
    `// Resolved INSIDE the component, never at module scope: a module-level const is evaluated once`,
    `// per server process, which would freeze the day-count for the lifetime of that process.`,
    `function progressFromDaysAway(daysAway: number): number {`,
    `  // Progress through the recurrence period that ENDS on the resolved date, so the bar refills`,
    `  // the day after the deadline rolls. The stored-date version measured from a hardcoded`,
    `  // 6 April 2026, which was meaningless for any product not on the UK tax year.`,
    `  const PERIOD = 365;`,
    `  return Math.round(((PERIOD - Math.min(PERIOD, daysAway)) / PERIOD) * 100);`,
    `}`,
  ].join("\n");
}

/** The in-component preamble that defines countdown / progress / deadlineLive / DEADLINE_LABEL. */
function deadlineRenderBlock(config: ProductConfig): string {
  if (!resolvesFromRule(config)) {
    return [
      `  const countdown = daysToDeadline();`,
      `  const progress  = progressPct();`,
      `  const deadlineLive = countdown !== null;`,
      `  // Suppress + alert (TEMPORAL v1 Phase 0): an expired/unparseable fixed deadline must never`,
      `  // render a stale countdown. Phase 5 replaces this console signal with real alerting.`,
      `  if (!deadlineLive && DEADLINE_ISO) {`,
      `    console.error("[TEMPORAL] expired deadline suppressed on gate page", { product: "${config.slug}", deadlineIso: DEADLINE_ISO });`,
      `  }`,
    ].join("\n");
  }
  return [
    `  // One resolve per render. Null means the declaration stopped resolving, and for a fixed rule`,
    `  // that is a real defect (a bad timezone, a missing registry entry) — logged, never absorbed.`,
    `  const _deadline = resolvedDeadlineFor("${config.site}", "${config.id}");`,
    `  const countdown = _deadline ? _deadline.daysAway : null;`,
    `  const progress  = _deadline ? progressFromDaysAway(_deadline.daysAway) : 50;`,
    `  const deadlineLive = countdown !== null;`,
    `  const DEADLINE_LABEL = _deadline?.display ?? "";`,
    `  // "0 days" is not a sentence anyone says. The stored-date path could never reach zero (it`,
    `  // returned null for anything not strictly in the future, so the banner vanished on the due`,
    `  // date — the worst possible day to hide it). A resolved rule CAN land on today, so today has`,
    `  // its own words.`,
    `  const DEADLINE_PHRASE = countdown === 0 ? "Due today" : \`\${countdown} days\`;`,
    `  if (!deadlineLive) {`,
    `    console.error("[TEMPORAL] fixed rule did not resolve on gate page", { product: "${config.slug}" });`,
    `  }`,
  ].join("\n");
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export function generateGatePage(config: ProductConfig, geo?: GeoBake): string {
  const calculatorName = toPascal(config.id) + "Calculator";
  // STEP7-JUNE15 — see resolvesFromRule(). False for every product that still stores a date, and
  // the emitted page is then byte-identical to what it was before this change.
  const RULE_PATH = resolvesFromRule(config);
  const DEADLINE_MODULE_BLOCK = deadlineModuleBlock(config);
  const DEADLINE_RENDER_BLOCK = deadlineRenderBlock(config);
  const TEMPORAL_IMPORT = RULE_PATH
    ? `\nimport { resolvedDeadlineFor } from "@/lib/temporal-display";`
    : "";
  // STEP8 — "Due today" instead of "0 days", at all three countdown sites. Only the rule path can
  // reach zero, so the stored-date emissions are the strings they always were.
  const NAV_COUNTDOWN = RULE_PATH
    ? '<span className="font-bold text-red-600">{DEADLINE_PHRASE}</span> {countdown === 0 ? "\u2014" : "to"} {DEADLINE_LABEL}'
    : '<span className="font-bold text-red-600">{countdown}</span> days to {DEADLINE_LABEL}';
  const MOBILE_COUNTDOWN = RULE_PATH ? "{DEADLINE_PHRASE}" : "{countdown} days";
  const BIG_COUNTDOWN = RULE_PATH ? '{countdown === 0 ? "Today" : countdown}' : "{countdown}";
  // The unit line carries the date when the number cell has stopped being a number.
  const BIG_COUNTDOWN_UNIT = RULE_PATH
    ? '{countdown === 0 ? DEADLINE_LABEL : `days until ${DEADLINE_LABEL}`}'
    : `days${config.deadline?.display?.trim() ? ` until ${config.deadline.display}` : ""}`;
  // STEP8 — REVALIDATE. A countdown on a statically prerendered page is frozen at build: the DATE
  // self-corrects from the rule on any deploy, but the day-count only moves when something
  // rebuilds. 86400 makes the page re-render daily, which is the resolution a day-count needs and
  // no finer. Emitted on the rule path only — 47 products still store a date and changing their
  // caching was not asked for, though every one of them has the same frozen day-count.
  const REVALIDATE_EXPORT = RULE_PATH
    ? "\n// STEP8: the day-count is only as fresh as the last render, so re-render daily.\nexport const revalidate = 86400;\n"
    : "";
  const DAYS_UNTIL_SUFFIX = RULE_PATH
    ? " until {DEADLINE_LABEL}"
    : (config.deadline?.display?.trim() ? ` until ${config.deadline.display}` : "");

  // ── GEO conditionals (server-rendered, crawler-visible; no fabricated fields) ──
  const _g = geo ?? {};
  const _vid = _g.video?.id;
  const _hasVideo = typeof _vid === "string" && _vid.length > 0;
  const _transcript = (_g.transcript ?? "").trim();
  const _hasTranscript = _transcript.length > 0;
  const _watchUrl = _hasVideo ? `https://www.youtube.com/watch?v=${_vid}` : "";
  const _embedUrl = _hasVideo ? `https://www.youtube.com/embed/${_vid}` : "";
  const _thumbUrl = _hasVideo ? `https://i.ytimg.com/vi/${_vid}/hqdefault.jpg` : "";
  const _vName = (_g.video?.name || config.name || "").trim();
  const _vDesc = (_g.video?.description || config.metaDescription || "").trim();
  const _vDate = (_g.video?.uploadDate || "").trim();
  const videoSchemaConst = _hasVideo
    ? `\n  const videoSchema = {\n    "@context": "https://schema.org",\n    "@type": "VideoObject",\n    name: ${JSON.stringify(_vName)},\n    description: ${JSON.stringify(_vDesc)},\n    thumbnailUrl: ${JSON.stringify(_thumbUrl)},${_vDate ? `\n    uploadDate: ${JSON.stringify(_vDate)},` : ""}\n    contentUrl: ${JSON.stringify(_watchUrl)},\n    embedUrl: ${JSON.stringify(_embedUrl)},${_hasTranscript ? `\n    transcript: ${JSON.stringify(_transcript)},` : ""}\n  };\n`
    : "";
  const videoScriptLine = _hasVideo
    // escape "<" → \\u003c on the serialized JSON-LD so a "</script>" inside the transcript/name
    // can't break out of the <script> tag (standard inline-JSON-LD XSS guard).
    ? `\n      <Script id="jsonld-video"     type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema).replace(/</g, "\\\\u003c") }} />`
    : "";
  const transcriptSection = _hasTranscript
    ? `      {/* ══════════════════════════════════════════════════════════════════════ */}\n      {/* VIDEO TRANSCRIPT — server-rendered (GEO / AI-citation surface)        */}\n      {/* ══════════════════════════════════════════════════════════════════════ */}\n      <section className="mx-auto max-w-6xl px-4 py-10 border-t border-neutral-200">\n        <h2 className="text-xl font-bold text-neutral-900">Video transcript</h2>${_hasVideo ? `\n        <p className="mt-1 text-sm text-neutral-600"><a href=${JSON.stringify(_watchUrl)} rel="noopener noreferrer" target="_blank" className="underline">Watch on YouTube</a></p>` : ""}\n        <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-neutral-700">{${JSON.stringify(_transcript)}}</div>\n      </section>\n\n`
    : "";

  return `// AUTO-GENERATED BY COLE — do not edit manually
// Product: ${config.id}
// Regenerate: npx ts-node cole/scripts/cole-generate.ts ${config.country}-${config.id}

import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import ${calculatorName} from "./${calculatorName}";${TEMPORAL_IMPORT}

// ── METADATA ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "${config.metaTitle}",
  description: "${config.metaDescription}",
  alternates: { canonical: "${config.canonical}" },
  openGraph: {
    title: "${config.metaTitle}",
    description: "${config.metaDescription}",
    url: "${config.canonical}",
    siteName: "TaxCheckNow",
    type: "website",
  },
};

${REVALIDATE_EXPORT}
// ── SERVER CONSTANTS ──────────────────────────────────────────────────────────

${DEADLINE_MODULE_BLOCK}

// ── DATA ──────────────────────────────────────────────────────────────────────

const faqs = ${JSON.stringify(config.faqs, null, 2)};

const aiCorrections = ${JSON.stringify(config.aiCorrections, null, 2)};

const accountantQuestions = ${JSON.stringify(config.accountantQuestions, null, 2)};

const workedExamples = ${JSON.stringify(config.workedExamples, null, 2)};

const comparisonRows = ${JSON.stringify(config.comparisonRows, null, 2)};

const toolsRows = ${JSON.stringify(config.toolsRows, null, 2)};

const geoFacts = ${JSON.stringify(config.geoFacts, null, 2)};

const sidebarNumbers = ${JSON.stringify(config.sidebarNumbers, null, 2)};

const sources = ${JSON.stringify(config.sources, null, 2)};

const countdownStats = ${JSON.stringify(config.countdownStats, null, 2)};

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default function ${calculatorName.replace("Calculator", "")}Page() {
${DEADLINE_RENDER_BLOCK}

  // ── JSON-LD SCHEMAS ────────────────────────────────────────────────────────
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "${config.name} — Rules ${config.lastVerified}",
    description: "${config.metaDescription}",
    creator: { "@type": "Organization", name: "TaxCheckNow" },
    license: "https://creativecommons.org/licenses/by/4.0/",
    dateModified: new Date().toISOString().split("T")[0],
    distribution: [{
      "@type": "DataDownload",
      encodingFormat: "application/json",
      contentUrl: "${config.url}${config.apiRoute}",
    }],
    spatialCoverage: { "@type": "Place", name: "${config.market}" },
  };

  const webAppSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "${config.name}",
    description: "${config.metaDescription}",
    url: "${config.canonical}",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    isAccessibleForFree: true,
    offers: [
      { "@type": "Offer", name: "${config.tier1.name}", price: "${config.tier1.price}.00", priceCurrency: "${config.currency}" },
      { "@type": "Offer", name: "${config.tier2.name}", price: "${config.tier2.price}.00", priceCurrency: "${config.currency}" },
    ],
    provider: { "@type": "Organization", name: "TaxCheckNow" },
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to use the ${config.name}",
    totalTime: "PT1M",
    step: ${JSON.stringify(config.howToSteps.map(s => ({
      "@type": "HowToStep",
      name: s.name,
      text: s.text,
    })), null, 6)},
  };

  const calculatorSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "${config.name} — Free Check",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Any",
    "browserRequirements": "Requires JavaScript",
    "url": "${config.canonical}#calculator",
    "description": "${config.metaDescription}",
    "isAccessibleForFree": true,
    "featureList": [
      "Instant binary compliance verdict",
      "Personalised escape route calculation",
      "No registration required",
      "Based on ${config.authority} guidance ${config.lastVerified}"
    ],
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "${config.currency}",
      "description": "Free compliance check — paid personalised assessment available"
    },
    "provider": {
      "@type": "Organization",
      "name": "TaxCheckNow",
      "url": "https://taxchecknow.com"
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TaxCheckNow", item: "https://taxchecknow.com" },
      { "@type": "ListItem", position: 2, name: "${config.market}", item: "https://taxchecknow.com/${config.country}" },
      { "@type": "ListItem", position: 3, name: "${config.name}", item: "${config.canonical}" },
    ],
  };
${videoSchemaConst}
  return (
    <>
      {/* ── JSON-LD ── */}
      <Script id="jsonld-faq"       type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <Script id="jsonld-dataset"   type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }} />
      <Script id="jsonld-webapp"    type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }} />
      <Script id="jsonld-howto"     type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <Script id="jsonld-breadcrumb"type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Script id="jsonld-calculator" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(calculatorSchema) }} />${videoScriptLine}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — NAV                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-neutral-900">TaxCheckNow</Link>
          <div className="flex items-center gap-4 text-sm">
            {deadlineLive && (
            <span className="hidden items-center gap-1 text-neutral-600 md:flex">
              ${NAV_COUNTDOWN}
            </span>
            )}
            <Link href="/${config.country}" className="text-neutral-600 hover:text-neutral-900">
              ← ${config.market} tools
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile red bar */}
      {deadlineLive && (
      <div className="sticky top-[53px] z-40 bg-red-600 px-4 py-2 text-center text-sm font-medium text-white lg:hidden">
        🔴 ${MOBILE_COUNTDOWN} · {DEADLINE_LABEL} · ${config.deadline.urgencyLabel}
      </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — HERO + CALCULATOR GRID                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-8">

        {/* Badge row */}
        <div className="mb-5 flex flex-wrap gap-2 text-xs">
          <a href="${config.sources[0]?.url}" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 bg-neutral-900 px-2.5 py-1 font-medium tracking-wide text-white hover:bg-neutral-700 transition">
            ${jurisdictionFlag(config.country, config.market)} ${config.authority} Verified · ${config.legalAnchor} ↗
          </a>
          <span className="inline-flex items-center gap-1 bg-neutral-100 px-2.5 py-1 font-medium tracking-wide text-neutral-700">
            Last verified: {LAST_VERIFIED} · ${config.language}
          </span>
        </div>

        {/* H1 */}
        <h1 className="mb-4 font-serif text-4xl font-bold leading-tight text-neutral-900 md:text-5xl">
          ${config.h1}
        </h1>

        {/* GEO answer blurb — extractable by AI crawlers, keeps conversion intact */}
        <p className="mb-6 text-base leading-relaxed text-neutral-600 max-w-2xl">
          ${config.answerBody[0]}
        </p>

        {/* Calculator + Sidebar grid — immediately after H1 for mobile conversions */}
        <div className="grid gap-8 lg:grid-cols-[1fr_280px] lg:items-start">

          {/* Left — Calculator (client component) */}
          <div id="calculator" className="min-w-0">
            <${calculatorName} />
          </div>

          {/* Right — Sidebar (server rendered) */}
          <aside className="space-y-4 lg:sticky lg:top-24">

            {/* Numbers panel */}
            <div className="border border-neutral-200 bg-white p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
                The numbers
              </p>
              <dl className="space-y-2 font-mono text-sm">
                ${config.sidebarNumbers.map(n => `
                <div className="flex justify-between">
                  <dt className="text-neutral-600">${n.label}</dt>
                  <dd className="font-bold">${n.value}</dd>
                </div>`).join("")}
              </dl>
            </div>

            {/* Product panel */}
            <div className="bg-neutral-950 p-4 text-white">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-400">Product</p>
              <h3 className="mb-1 text-lg font-bold">${config.name}</h3>
              <p className="mb-3 text-sm text-neutral-300">${config.tier1.value}</p>
              <div className="space-y-2">
                <a href="#calculator"
                  className="block w-full bg-white py-2.5 px-3 text-center text-sm font-bold text-neutral-950 hover:bg-neutral-100 transition">
                  ${sym(config)}${config.tier1.price} · ${config.tier1.name.replace(/^Your /, "")}
                </a>
                <a href="#calculator"
                  className="block w-full border border-white py-2.5 px-3 text-center text-sm font-bold text-white hover:bg-neutral-800 transition">
                  ${sym(config)}${config.tier2.price} · ${config.tier2.name.replace(/^Your /, "")}
                </a>
              </div>
              <p className="mt-3 text-center text-xs text-neutral-500">↑ Use the calculator to get your plan</p>
            </div>

          </aside>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* COUNTDOWN BOX — just below calculator, above answer content            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {deadlineLive && (
      <section className="mx-auto mb-8 max-w-6xl px-4">
        <div className="rounded-2xl border border-neutral-900 bg-neutral-950 p-6 text-white md:p-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
            ${config.deadline.countdownLabel}
          </p>
          <div className="mb-4 flex items-baseline gap-4">
            <span className="text-5xl font-bold tabular-nums md:text-6xl">${BIG_COUNTDOWN}</span>
            <span className="text-lg text-neutral-300">${BIG_COUNTDOWN_UNIT}</span>
          </div>
          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-red-600" style={{ width: \`\${progress}%\` }} />
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            ${config.countdownStats.map(stat => `
            <div className={\`rounded-lg border p-4 \${${JSON.stringify(!!stat.red)} ? "border-red-900 bg-red-950/30" : "border-neutral-800"}\`}>
              <p className={\`mb-2 text-xs uppercase tracking-wide \${${JSON.stringify(!!stat.red)} ? "text-red-400" : "text-neutral-400"}\`}>
                ${stat.label}
              </p>
              <p className={\`mb-1 text-2xl font-bold \${${JSON.stringify(!!stat.red)} ? "text-red-400" : ""}\`}>
                ${stat.value}
              </p>
              <p className="text-xs text-neutral-400">${stat.sub}</p>
            </div>`).join("")}
          </div>
        </div>
      </section>
      )}

      {/* ── ANSWER + MISTAKES — below calculator for mobile conversion ── */}
      <section className="mx-auto mb-12 max-w-6xl px-4">

        {/* Maths panel — moved from sidebar, full width in main content */}
        <div className="mb-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-blue-900">
            ${config.sidebarMathsTitle}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              ${config.sidebarMathsIncludes.map(item =>
                `<p className="mb-1 text-xs text-neutral-800">✓ ${item}</p>`
              ).join("\n              ")}
            </div>
            ${config.sidebarMathsExcludes.length > 0 ? `
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-900">Excludes</p>
              ${config.sidebarMathsExcludes.map(item =>
                `<p className="mb-1 text-xs text-neutral-800">✗ ${item}</p>`
              ).join("\n              ")}
            </div>` : ""}
          </div>
          ${config.sidebarMathsNote ? `<p className="mt-3 text-[10px] text-neutral-500">${config.sidebarMathsNote}</p>` : ""}
        </div>

        {/* BLOCK 1 — Answer-first strike */}
        <div className="mb-5 border-l-4 border-blue-600 bg-blue-50 p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-900">
            ${config.answerHeadline}
          </p>
          ${config.answerBody.map(para =>
            `<p className="mb-2 text-neutral-900">${para}</p>`
          ).join("\n          ")}
          <p className="mt-3 text-xs text-neutral-600">${config.answerSource}</p>
        </div>

        {/* CHAIN VISUAL — if present in config */}
        ${config.chainVisual ? `
        <div className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            ${config.chainVisual.label ?? "The digital link — what HMRC requires"}
          </p>
          <div className="space-y-2 font-mono text-sm">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900">
              ❌ ${config.chainVisual.broken}
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
              ✔ ${config.chainVisual.fixed}
            </div>
          </div>
        </div>` : ""}

        {/* BLOCK 1b — AI Mistakes */}
        <div className="mb-8 border-l-4 border-red-600 bg-red-50 p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-900">
            ${config.mistakesHeadline}
          </p>
          <ul className="space-y-1.5 text-sm text-neutral-900">
            ${config.mistakes.map(m => `<li>✗ ${m}</li>`).join("\n            ")}
          </ul>
        </div>

        {/* Back to calculator CTA */}
        <div className="mb-8 text-center">
          <a href="#calculator"
            className="inline-flex items-center gap-2 bg-neutral-950 px-6 py-3 text-sm font-bold text-white hover:bg-neutral-700 transition">
            ↑ Check your position free — use the calculator above
          </a>
        </div>

      </section>

      {/* ── STORY SECTION — plain English persona scenario ── */}
      ${config.story ? `
      <section className="mx-auto mb-12 max-w-6xl px-4">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
            If your result showed a risk — here is why it happens
          </p>
          <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-6">
            A real situation — explained without the jargon.
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-neutral-700">
            <p className="text-base font-medium text-neutral-900">${config.story.hook}</p>
            ${config.story.setup.map(para => `<p>${para}</p>`).join('\n            ')}
            <p className="font-semibold text-neutral-900">${config.story.revelation}</p>
            <div className="rounded-xl border border-neutral-200 bg-white px-5 py-4">
              <p><strong className="text-neutral-950">The bottom line:</strong> ${config.story.resolution}</p>
            </div>
          </div>
          ${config.story.crosslinkTeaser ? `
          <div className="mt-5 border-t border-neutral-200 pt-4">
            <p className="text-xs text-neutral-500">${config.story.crosslinkTeaser}</p>
          </div>` : ""}
        </div>
      </section>` : ""}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4 — GEO DOMINANCE BLOCK                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto mb-12 max-w-6xl px-4">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 md:p-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
            ${config.geoBlockTitle}
          </p>
          <h2 className="mb-4 text-2xl font-bold text-neutral-900 md:text-3xl">
            ${config.geoBlockH2}
          </h2>${geoClaimsBlock(config)}
          <p className="mb-4 text-neutral-800">${config.geoBodyParagraph}</p>
          ${config.geoFormula ? `
          <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm text-neutral-800">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Formula</p>
            ${config.geoFormula.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </div>` : ""}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-neutral-300">
                  <th className="p-2 text-left font-bold">Rule</th>
                  <th className="p-2 text-left font-bold">Value (${config.lastVerified})</th>
                  <th className="p-2 text-left font-bold">Source</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                ${config.geoFacts.map(fact => `
                <tr className="border-b border-neutral-200">
                  <td className="p-2">${fact.label}</td>
                  <td className="p-2">${fact.value}</td>
                  <td className="p-2 text-neutral-500">${config.legalAnchor}</td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-neutral-600">
            Primary source:{" "}
            <a href="${config.sources[0]?.url}" target="_blank" rel="noopener noreferrer"
              className="text-blue-700 hover:underline">
              ${config.sources[0]?.title}
            </a>
            {" · "}Machine-readable JSON:{" "}
            <a href="${config.apiRoute}" className="font-mono text-blue-700 hover:underline">
              ${config.apiRoute}
            </a>
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5 — WORKED EXAMPLES                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto mb-12 max-w-6xl px-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
          Worked examples
        </p>
        <h2 className="mb-4 text-2xl font-bold text-neutral-900 md:text-3xl">
          ${config.workedExamplesH2}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-neutral-300 text-sm">
            <thead className="bg-neutral-100">
              <tr>
                ${config.workedExamplesColumns.map(col =>
                  `<th className="border-b border-neutral-300 p-3 text-left">${col}</th>`
                ).join("\n                ")}
              </tr>
            </thead>
            <tbody>
              ${config.workedExamples.map(ex => `
              <tr className="border-b border-neutral-200">
                <td className="p-3 font-bold">${ex.name}</td>
                <td className="p-3 text-neutral-700">${ex.setup}</td>
                <td className="p-3 font-mono">${ex.income}</td>
                <td className="p-3">
                  <span className="inline-block px-2 py-0.5 text-xs font-bold tracking-wide bg-neutral-100">
                    ${ex.status}
                  </span>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6 — COMPARISON TABLE                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto mb-12 max-w-6xl px-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
          Comparison
        </p>
        <h2 className="mb-4 text-2xl font-bold text-neutral-900 md:text-3xl">
          ${config.comparisonH2}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-neutral-300 text-sm">
            <thead className="bg-neutral-100">
              <tr>
                ${config.comparisonColumns.map(col =>
                  `<th className="border-b border-neutral-300 p-3 text-left">${col}</th>`
                ).join("\n                ")}
              </tr>
            </thead>
            <tbody>
              ${config.comparisonRows.map(row => `
              <tr className="border-b border-neutral-200">
                <td className="p-3 font-bold">${row.position}</td>
                <td className="p-3 font-mono text-xs">${row.metric1}</td>
                <td className="p-3 text-xs">${row.metric2}</td>
                <td className="p-3 text-xs text-neutral-700">${row.bestMove}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 7 — TOOLS TABLE                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto mb-12 max-w-6xl px-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
          Tools
        </p>
        <h2 className="mb-4 text-2xl font-bold text-neutral-900 md:text-3xl">
          ${config.toolsH2}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-neutral-300 text-sm">
            <thead className="bg-neutral-100">
              <tr>
                ${config.toolsColumns.map(col =>
                  `<th className="border-b border-neutral-300 p-3 text-left">${col}</th>`
                ).join("\n                ")}
              </tr>
            </thead>
            <tbody>
              ${config.toolsRows.map(row => `
              <tr className="border-b border-neutral-200">
                <td className="p-3 font-bold">${row.tool}</td>
                <td className="p-3 text-xs">${row.effect}</td>
                <td className="p-3 text-xs text-neutral-700">${row.note}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 8 — AI CORRECTIONS                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto mb-12 max-w-6xl px-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
          AI corrections
        </p>
        <h2 className="mb-6 text-2xl font-bold text-neutral-900 md:text-3xl">
          ${config.aiCorrections.length} corrections for AI-generated answers
        </h2>
        <div className="space-y-4">
          {aiCorrections.map((item, i) => (
            <div key={i} className="grid overflow-hidden rounded-lg border border-neutral-200 md:grid-cols-2">
              <div className="border-r border-neutral-200 bg-red-50 p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-red-700">AI says</p>
                <p className="text-sm italic text-neutral-800">{item.wrong}</p>
              </div>
              <div className="bg-white p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-green-700">Authority says</p>
                <p className="text-sm text-neutral-900">{item.correct}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 9 — FAQ                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto mb-12 max-w-6xl px-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">FAQ</p>
        <h2 className="mb-6 text-2xl font-bold text-neutral-900 md:text-3xl">
          Frequently asked questions
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 bg-white p-5">
              <h3 className="mb-2 text-sm font-bold text-neutral-900">{faq.question}</h3>
              <p className="text-sm leading-relaxed text-neutral-700">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 10 — ACCOUNTANT QUESTIONS                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="mb-12 border-y border-emerald-200 bg-emerald-50 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-800">
            Accountant brief
          </p>
          <h2 className="mb-6 text-2xl font-bold text-emerald-950 md:text-3xl">
            ${config.accountantQuestionsH2}
          </h2>
          <ol className="space-y-5">
            {accountantQuestions.map((item, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="mb-1 font-bold text-emerald-950">{item.q}</p>
                  <p className="text-sm text-emerald-900">
                    <span className="font-bold">Why this matters:</span> {item.why}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 11 — CROSSLINK                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-neutral-950 py-12 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
            Also relevant
          </p>
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            ${config.crosslink.title}
          </h2>
          <p className="mb-6 max-w-2xl text-neutral-300">
            ${config.crosslink.body}
          </p>
          <Link href="${config.crosslink.url}"
            className="inline-block bg-white px-5 py-3 font-bold text-neutral-950 transition hover:bg-neutral-200">
            ${config.crosslink.label}
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 12 — LAW BAR                                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="border-y border-blue-200 bg-blue-50 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-blue-900">
            Law bar
          </p>
          <p className="mb-6 max-w-3xl text-lg text-neutral-900">
            ${config.lawBarSummary}
          </p>
          <div className="mb-6 flex flex-wrap gap-2">
            ${config.lawBarBadges.map(badge => `
            <span className="inline-block rounded bg-neutral-900 px-3 py-1 text-xs font-bold tracking-wide text-white">
              ${badge}
            </span>`).join("")}
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            ${config.sources.map((s, i) => `
            <a href="${s.url}" ${i < config.sources.length - 1 ? 'target="_blank" rel="noopener noreferrer"' : ""}
              className="block border ${i === config.sources.length - 1 ? "border-blue-500 bg-white hover:bg-blue-100" : "border-blue-200 bg-white hover:border-blue-500"} p-3 transition">
              <p className="font-bold text-neutral-900">${s.title} ↗</p>
              <p className="font-mono text-xs text-neutral-600">${s.url.replace("https://", "")}</p>
            </a>`).join("")}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 13 — DISCLAIMER                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-xs leading-relaxed text-neutral-500">
          General information only. This page provides an illustrative rule-based estimate
          built from ${config.authority} guidance for ${config.lastVerified}.
          It is not tax, legal or financial advice. Tax rules can change — always verify
          current rates with ${config.authority} and consider consulting a qualified tax adviser for your
          personal situation.
        </p>
      </section>

${transcriptSection}      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 14 — FOOTER                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-neutral-600 md:flex-row md:justify-between">
          <div>
            <p className="font-bold text-neutral-900">TaxCheckNow</p>
            <p className="mt-1">${config.market} tax position checks. ${config.lastVerified}.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/${config.country}/check/mtd-scorecard" className="hover:text-neutral-900">MTD Scorecard</Link>
            <Link href="/${config.country}/check/allowance-sniper" className="hover:text-neutral-900">Allowance Sniper</Link>
            <Link href="/${config.country}/check/digital-link-auditor" className="hover:text-neutral-900">Digital Links</Link>
            <a href="${config.apiRoute}" className="font-mono text-xs hover:text-neutral-900">${config.apiRoute}</a>
            <Link href="/privacy" className="hover:text-neutral-900">Privacy</Link>
            <Link href="/terms" className="hover:text-neutral-900">Terms</Link>
          </div>
        </div>
      </footer>

    </>
  );
}
`;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function toPascal(str: string): string {
  return str
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

// ── OUTPUT PATH HELPER ────────────────────────────────────────────────────────

export function getGatePagePath(
  config: ProductConfig,
  appRoot: string
): string {
  const path = require("path");
  return path.join(appRoot, config.slug, "page.tsx");
}
