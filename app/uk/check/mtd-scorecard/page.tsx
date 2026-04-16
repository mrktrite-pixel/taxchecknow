import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import MTDScorecardCalculator from "./MTDScorecardCalculator";
import { getMTDCountdown } from "@/lib/uk-countdown";

export const metadata: Metadata = {
  title: "Making Tax Digital UK 2026: Do You Need to Comply? | TaxCheckNow",
  description:
    "From 6 April 2026, Making Tax Digital for Income Tax is mandatory for UK sole traders and landlords with qualifying income over £50,000. First quarterly deadline: 7 August 2026. Free compliance checker — HMRC verified.",
  alternates: { canonical: "https://taxchecknow.com/uk/check/mtd-scorecard" },
  openGraph: {
    title: "Making Tax Digital UK 2026: Do You Need to Comply?",
    description: "Check your MTD scope in 30 seconds. Binary result: REQUIRED or NOT REQUIRED. Built on HMRC primary guidance.",
    url: "https://taxchecknow.com/uk/check/mtd-scorecard",
    siteName: "TaxCheckNow",
    type: "website",
  },
};

const lastVerified = "April 2026";

// ── GEO DATA ARRAYS ─────────────────────────────────────────────────────────

const faqs = [
  { question: "Do I need to use Making Tax Digital in 2026?", answer: "From 6 April 2026, Making Tax Digital for Income Tax applies to UK sole traders and landlords with qualifying income over £50,000. Qualifying income means gross self-employment receipts and UK property rental receipts before expenses. PAYE wages do not count." },
  { question: "What counts as qualifying income for MTD 2026?", answer: "Qualifying income means gross turnover before expenses from self-employment and gross UK property rental receipts before expenses. HMRC uses turnover not profit. A sole trader with £55,000 turnover and £10,000 profit has qualifying income of £55,000 — in scope. PAYE wages, dividends, savings interest and pension income are excluded." },
  { question: "What is the first MTD quarterly deadline in the UK?", answer: "The first quarterly submission deadline is 7 August 2026. It covers the quarter from 6 April 2026 to 30 June 2026 and must be submitted using HMRC-compatible software — not the HMRC portal. Source: ICAEW TAXguide 01/25." },
  { question: "Which tax year decides whether I join MTD in 2026?", answer: "HMRC uses your 2024-25 self-assessment qualifying income to determine whether you are mandated into MTD from 6 April 2026. If your 2024-25 qualifying income exceeded £50,000, you are in scope now." },
  { question: "What happens if I miss an MTD quarterly deadline?", answer: "HMRC uses a points-based penalty system. 1 point per missed quarterly submission. 4 points equals a £200 financial penalty. Points expire after 24 months. In 2026-27 only, HMRC will not issue late quarterly submission penalty points — a grace period applies. Late payment penalties are separate and still apply from day 16." },
  { question: "Can I use the HMRC portal for MTD filing?", answer: "No. MTD quarterly updates and the final declaration must be filed through HMRC-compatible software. HMRC has confirmed it is not providing its own filing software. The existing HMRC portal is not available for MTD taxpayers." },
  { question: "When does the MTD threshold drop to £30,000?", answer: "The threshold drops to £30,000 from April 2027 and to £20,000 from April 2028. Both confirmed by HMRC and the Spring Statement 2025. The 2027 phase will bring approximately 970,000 more sole traders and landlords into scope." },
  { question: "What is the difference between a sole trader and landlord under MTD?", answer: "Both sole traders and landlords are subject to the same MTD rules if their qualifying income exceeds the threshold. Qualifying income is calculated separately for each income source. A sole trader with £30,000 turnover and rental income of £25,000 has total qualifying income of £55,000 — in scope for 2026." },
  { question: "Do I need separate MTD submissions for each income source?", answer: "Yes. If you have both self-employment income and rental income, you must submit a separate quarterly update for each income source. Both are submitted through the same MTD-compatible software." },
  { question: "What is bridging software for MTD?", answer: "Bridging software connects spreadsheet records to HMRC's MTD system digitally. It allows taxpayers who keep records in Excel or Google Sheets to submit quarterly updates without switching to full accounting software. HMRC permits bridging software for MTD compliance." },
  { question: "Can my accountant file MTD returns on my behalf?", answer: "Yes. Your accountant can be authorised as your agent for MTD purposes. They must use MTD-compatible software to submit on your behalf. You remain responsible for the accuracy of the figures submitted." },
  { question: "Does MTD affect my January Self Assessment return?", answer: "MTD replaces the traditional SA100 Self Assessment return with a final declaration submitted through software. The January 2028 deadline is when the first MTD final declaration is due for 2026-27. You also still need to submit a standard SA100 for 2025-26 by 31 January 2027." },
];

const aiErrors = [
  { wrong: "The first MTD deadline is July 2026", correct: "7 August 2026 — covering the quarter ending 30 June 2026. Source: ICAEW TAXguide 01/25 and The Register quoting HMRC directly." },
  { wrong: "PAYE salary counts toward the £50,000 MTD threshold", correct: "PAYE wages are excluded. Qualifying income means gross self-employment turnover and UK property rental receipts only." },
  { wrong: "MTD is triggered by profit not turnover", correct: "HMRC uses gross turnover before expenses. A sole trader with £55,000 turnover and £10,000 profit is in scope." },
  { wrong: "Missing an MTD deadline gives you an automatic £300 fine", correct: "Points-based system: 1 point per missed quarterly submission. 4 points equals £200. Points expire after 24 months. Grace period applies in 2026-27." },
  { wrong: "You can file MTD through the HMRC portal", correct: "HMRC-compatible software is required for all quarterly updates and the final declaration. HMRC is not providing its own MTD filing software." },
];

const accountantQuestions = [
  { q: "Am I definitely in scope for MTD based on my qualifying income?", why: "Qualifying income excludes PAYE. Many taxpayers calculate this incorrectly — turnover not profit." },
  { q: "Which MTD software should I use for my situation?", why: "Depends on whether you are a sole trader, landlord or both, and whether you need bank feeds or accountant collaboration." },
  { q: "Who is handling my HMRC MTD registration — me or you?", why: "The most common reason people miss the deadline is assuming someone else is handling registration." },
  { q: "What changes for my January filing under MTD?", why: "The final declaration replaces the SA100 but must be filed through software by 31 January 2028 for the 2026-27 tax year." },
  { q: "What is my biggest compliance risk before 7 August 2026?", why: "Usually software setup, digital records quality, or delayed registration — not the law itself." },
];

// Worked examples — Tax Math hook
const workedExamples = [
  { name: "Plumber (sole trader)", paye: "£0", selfEmployed: "£65,000", rental: "£0", qualifying: "£65,000", scope: "IN SCOPE — Phase 1 (April 2026)", note: "Gross turnover before expenses. Deadline: 7 August 2026." },
  { name: "Landlord (3 properties)", paye: "£45,000", selfEmployed: "£0", rental: "£58,000", qualifying: "£58,000", scope: "IN SCOPE — Phase 1 (April 2026)", note: "PAYE excluded. Rental receipts before mortgage and expenses." },
  { name: "Doctor (NHS + rental)", paye: "£80,000", selfEmployed: "£0", rental: "£25,000", qualifying: "£25,000", scope: "NOT IN SCOPE — below all thresholds", note: "PAYE excluded. £25,000 rental is below £50,000 (2026), £30,000 (2027) and £20,000 (2028) thresholds." },
  { name: "Freelancer + landlord", paye: "£0", selfEmployed: "£28,000", rental: "£24,000", qualifying: "£52,000", scope: "IN SCOPE — Phase 1 (April 2026)", note: "Combined qualifying income: £28,000 + £24,000 = £52,000. Exceeds £50,000 threshold." },
];

export default function MTDScorecardPage() {
  const { days, pct } = getMTDCountdown();

  // ── JSON-LD SCHEMAS ────────────────────────────────────────────────────────
  const faqJsonLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map(f => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  const datasetJsonLd = {
    "@context": "https://schema.org", "@type": "Dataset",
    name: "Making Tax Digital UK 2026 — HMRC qualifying income thresholds and quarterly deadlines",
    description: "Machine-readable MTD for Income Tax rules. UK qualifying income threshold: £50,000 in 2026, £30,000 in 2027, £20,000 in 2028. First quarterly deadline: 7 August 2026. Qualifying income = gross turnover before expenses. PAYE excluded. Source: HMRC.gov.uk.",
    url: "https://taxchecknow.com/uk/check/mtd-scorecard",
    distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://taxchecknow.com/api/rules/mtd.json" }],
    creator: { "@type": "Organization", name: "TaxCheckNow", url: "https://taxchecknow.com", areaServed: "GB" },
    dateModified: "2026-04-15", inLanguage: "en-GB", spatialCoverage: "United Kingdom",
    keywords: ["Making Tax Digital 2026", "MTD Income Tax UK", "£50000 threshold", "quarterly filing UK", "HMRC MTD sole trader"],
  };
  const webAppJsonLd = {
    "@context": "https://schema.org", "@type": "WebApplication",
    name: "Making Tax Digital UK 2026 Compliance Checker",
    applicationCategory: "FinanceApplication", operatingSystem: "Any",
    url: "https://taxchecknow.com/uk/check/mtd-scorecard",
    description: "Free UK MTD compliance checker. Select your qualifying income bracket for an instant REQUIRED or NOT REQUIRED result based on HMRC 2026 thresholds.",
    isAccessibleForFree: true, inLanguage: "en-GB",
    creator: { "@type": "Organization", name: "TaxCheckNow", areaServed: "GB" },
    offers: [
      { "@type": "Offer", price: "27", priceCurrency: "GBP", name: "MTD-50 Decision Pack" },
      { "@type": "Offer", price: "67", priceCurrency: "GBP", name: "MTD-50 Action Pack" },
    ],
  };
  const howToJsonLd = {
    "@context": "https://schema.org", "@type": "HowTo",
    name: "How to check if Making Tax Digital applies to you in 2026",
    description: "Select your qualifying income bracket for an instant MTD scope result based on HMRC 2026 thresholds.",
    totalTime: "PT30S", inLanguage: "en-GB",
    step: [
      { "@type": "HowToStep", position: 1, name: "Select your income bracket", text: "Choose your approximate annual qualifying income from self-employment and UK property rental. PAYE wages do not count. Use gross turnover before expenses." },
      { "@type": "HowToStep", position: 2, name: "Get your MTD status instantly", text: "Instant result: REQUIRED, UPCOMING, or NOT CURRENTLY REQUIRED based on the confirmed HMRC 2026 threshold of £50,000." },
      { "@type": "HowToStep", position: 3, name: "Check your readiness", text: "If in scope, answer three questions about software, records and registration to get your readiness score." },
      { "@type": "HowToStep", position: 4, name: "Get your compliance plan", text: "Your biggest gap and first action are identified. Compliance Assessment £67 or Action Plan £127 available." },
    ],
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TaxCheckNow", item: "https://taxchecknow.com" },
      { "@type": "ListItem", position: 2, name: "United Kingdom", item: "https://taxchecknow.com/uk" },
      { "@type": "ListItem", position: 3, name: "Making Tax Digital 2026", item: "https://taxchecknow.com/uk/check/mtd-scorecard" },
    ],
  };

  return (
    <>
      <Script id="jsonld-faq"        type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Script id="jsonld-dataset"    type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }} />
      <Script id="jsonld-webapp"     type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <Script id="jsonld-howto"      type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <Script id="jsonld-breadcrumb" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="min-h-screen bg-white font-sans">

        {/* ── NAV ── */}
        <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
            <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-sm">🇬🇧</span>
                <span className="font-mono text-xs font-bold text-blue-700">HMRC · MTD · {days} days to 7 Aug</span>
              </div>
              <Link href="/uk" className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← UK tools</Link>
            </div>
          </div>
        </nav>

        {/* Mobile sticky deadline bar — always visible as user scrolls */}
        <div className="sticky top-[57px] z-40 flex items-center justify-between border-b border-red-900 bg-red-700 px-4 py-2 lg:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-white">🔴 {days} days</span>
            <span className="text-xs text-red-200">to first MTD deadline</span>
          </div>
          <span className="font-mono text-xs font-bold text-white">7 August 2026</span>
        </div>

        <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">

          {/* ══════════════════════════════════════════════════════════════════
              SECTION 1 — ABOVE THE FOLD
              Two-column: left = answer block + mistakes | right = countdown table
              Calculator immediately below — visible on load
          ══════════════════════════════════════════════════════════════════ */}
          <section>

            {/* Badge row */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                <span className="text-sm">🇬🇧</span>
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-blue-700">
                  United Kingdom · HMRC Verified · Finance Act 2026
                </span>
              </div>
              <span className="font-mono text-xs text-neutral-400">Last verified: {lastVerified} · en-GB</span>
            </div>

            {/* H1 */}
            <h1 className="mb-4 font-serif text-4xl font-bold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
              Making Tax Digital UK 2026: do you need to comply?
            </h1>

            {/* ── ABOVE-FOLD: Answer + Mistakes (full width on all screens) ── */}
            <div className="space-y-3 mb-4">

                {/* Answer block — AI citation target */}
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-blue-700">
                    The answer — HMRC confirmed April 2026
                  </p>
                  <p className="text-sm leading-relaxed text-blue-900">
                    From <strong>6 April 2026</strong>, Making Tax Digital for Income Tax applies to UK sole traders
                    and landlords with qualifying income over <strong>£50,000</strong>. Qualifying income means
                    <strong> gross turnover before expenses</strong> — not profit. PAYE wages are excluded.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-blue-900">
                    Threshold drops to <strong>£30,000 in April 2027</strong> and <strong>£20,000 in April 2028</strong>.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-blue-900">
                    <strong>How HMRC decides:</strong> Based on your <strong>2024-25 self-assessment return</strong>.
                    If your qualifying income in 2024-25 exceeded £50,000 — you are mandated from 6 April 2026.
                  </p>
                  <p className="mt-2 text-xs text-blue-600">
                    Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">HMRC.gov.uk — Making Tax Digital for Income Tax ↗</a>
                  </p>
                </div>

                {/* Mistakes box */}
                <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3">
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-red-700">Most common mistakes</p>
                  <div className="space-y-1 text-xs text-red-900">
                    <p><strong>Turnover trap:</strong> HMRC uses gross turnover before expenses — not profit. £55k turnover, £10k profit = IN SCOPE.</p>
                    <p><strong>PAYE trap:</strong> PAYE wages do not count. Doctor with £80k PAYE + £25k rental = £25k qualifying — NOT in scope.</p>
                    <p><strong>Deadline trap:</strong> First deadline is <strong>7 August 2026</strong> — not July. Most AI tools get this wrong.</p>
                  </div>
                </div>
              </div>


            {/* ── CALCULATOR + SIDEBAR — above fold on most laptops ── */}
            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_280px]">

              {/* Calculator — Layer 2 conversion machine */}
              <MTDScorecardCalculator />

              {/* STICKY CONTEXTUAL SIDEBAR — Layer 1 GEO + Rule of 7 */}
              <div className="hidden lg:block">
                <div className="sticky top-20 space-y-3">

                  {/* Panel 1 — Context (always visible) */}
                  <div className="rounded-xl border border-neutral-200 bg-white p-4">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">The MTD numbers — UK 2026</p>
                    <div className="space-y-2">
                      {[
                        { num: "780,000", label: "UK taxpayers hit £50k threshold for first time", source: "HMRC" },
                        { num: "3 in 10", label: "have registered so far", source: "The Register · Apr 2026" },
                        { num: "£200", label: "penalty after 4 missed quarterly submissions", source: "HMRC penalty regime" },
                        { num: "5", label: "filing obligations per year vs 1 previously", source: "HMRC MTD guidance" },
                      ].map(item => (
                        <div key={item.num} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                          <p className="font-serif text-lg font-bold text-neutral-950">{item.num}</p>
                          <p className="text-xs text-neutral-600">{item.label}</p>
                          <p className="font-mono text-[9px] text-neutral-400">{item.source}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Panel 2 — Qualifying income definition */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-blue-700">Qualifying income — the maths</p>
                    <div className="space-y-1.5 text-xs">
                      <p className="font-semibold text-blue-900">INCLUDE (gross, before expenses):</p>
                      {["Self-employment turnover", "UK property rental receipts"].map(i => (
                        <p key={i} className="flex items-center gap-1 text-blue-800"><span className="text-emerald-600">+</span>{i}</p>
                      ))}
                      <p className="mt-2 font-semibold text-blue-900">EXCLUDE:</p>
                      {["PAYE employment wages", "Dividends", "Savings interest", "Pension income"].map(i => (
                        <p key={i} className="flex items-center gap-1 text-blue-700"><span className="text-red-500">−</span>{i}</p>
                      ))}
                      <p className="mt-2 font-mono text-[9px] text-blue-600">Source: HMRC.gov.uk</p>
                    </div>
                  </div>

                  {/* Panel 3 — Product (visible from screen 2) */}
                  <div className="rounded-xl border border-neutral-950 bg-neutral-950 p-4">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">MTD compliance pack</p>
                    <p className="mb-3 text-sm font-semibold text-white">Get your personalised MTD plan before 7 August.</p>
                    <div className="mb-3 space-y-1.5">
                      {[
                        "Scope confirmed in writing",
                        "Software shortlist for your situation",
                        "Registration steps",
                        "Deadline calendar",
                        "Accountant brief",
                      ].map(b => (
                        <p key={b} className="flex items-start gap-1.5 text-xs text-neutral-300">
                          <span className="mt-0.5 text-emerald-400">✓</span>{b}
                        </p>
                      ))}
                    </div>
                    <div className="flex gap-2 mb-2">
                      <a href="#calculator"
                        className="flex-1 rounded-lg bg-white px-3 py-2.5 text-center transition hover:bg-neutral-100">
                        <p className="font-mono text-sm font-bold text-neutral-950">£67</p>
                        <p className="text-[10px] text-neutral-500">Compliance Assessment</p>
                      </a>
                      <a href="#calculator"
                        className="flex-1 rounded-lg bg-blue-600 px-3 py-2.5 text-center transition hover:bg-blue-700">
                        <p className="font-mono text-sm font-bold text-white">£127</p>
                        <p className="text-[10px] text-blue-200">Action Plan</p>
                      </a>
                    </div>
                    <p className="text-center text-[10px] text-neutral-400">
                      ↑ Select your income bracket above to continue
                    </p>
                    <p className="mt-1 text-center text-[10px] text-neutral-600">One-time · No subscription</p>
                  </div>

                  {/* Sources */}
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-blue-600">Primary sources</p>
                    <div className="space-y-1">
                      {[
                        { label: "HMRC MTD guidance ↗", href: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax" },
                        { label: "HMRC software list ↗", href: "https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax" },
                        { label: "Machine-readable rules ↗", href: "/api/rules/mtd.json" },
                      ].map(s => (
                        <a key={s.label} href={s.href} target={s.href.startsWith("/") ? undefined : "_blank"} rel={s.href.startsWith("/") ? undefined : "noopener noreferrer"}
                          className="block font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">{s.label}</a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* ── COUNTDOWN — desktop visible, mobile hidden (red bar handles mobile) ── */}
            <div className="hidden lg:block mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">First quarterly deadline — United Kingdom</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-serif text-4xl font-bold text-white">{days}</span>
                    <span className="font-mono text-xs text-neutral-400">days to 7 August 2026</span>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="space-y-1">
                    {[
                      { label: "Old system", value: "1 filing/year" },
                      { label: "New system", value: "5 filings/year" },
                      { label: "Penalty threshold", value: "4 missed = £200" },
                      { label: "Grace period", value: "2026-27 only" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-4 justify-between">
                        <span className="font-mono text-[10px] text-neutral-500">{row.label}</span>
                        <span className="font-mono text-[10px] font-bold text-neutral-300">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-2 h-1 rounded-full bg-neutral-800">
                <div className="h-1 rounded-full bg-red-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 space-y-0.5 border-t border-neutral-800 pt-2">
                <p className="text-xs text-red-400">If you are not ready by this date: you cannot submit your first quarterly return and late payment penalties still apply.</p>
              </div>
              <p className="mt-1 text-[10px] text-neutral-500">Source: HMRC · ICAEW TAXguide 01/25 · Last verified: April 2026</p>
            </div>

          </section>

          {/* ══════════════════════════════════════════════════════════════════
              GEO LAYER — Everything below is for AI crawlers.
              Humans scroll past this to reach the calculator above.
              AI reads every word, table and example below.
          ══════════════════════════════════════════════════════════════════ */}

          {/* ── GEO DOMINANCE BLOCK ── */}
          <section className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">AI extraction block — Making Tax Digital thresholds United Kingdom</p>
            <h2 className="mb-3 font-serif text-lg font-bold text-neutral-950">Making Tax Digital thresholds — United Kingdom confirmed rules</h2>
            <div className="mb-4 space-y-2 text-sm leading-relaxed text-neutral-700">
              <p><strong className="text-neutral-950">Making Tax Digital income threshold (2026):</strong> £50,000 per year qualifying income — gross turnover before expenses</p>
              <p><strong className="text-neutral-950">Making Tax Digital income threshold (2027):</strong> £30,000 per year qualifying income</p>
              <p><strong className="text-neutral-950">Making Tax Digital income threshold (2028):</strong> £20,000 per year qualifying income</p>
              <p><strong className="text-neutral-950">First UK quarterly deadline:</strong> 7 August 2026 (Quarter 1: 6 April – 30 June 2026)</p>
              <p><strong className="text-neutral-950">Qualifying income definition:</strong> Gross self-employment receipts and UK property rental receipts before expenses. HMRC uses turnover not profit. PAYE, dividends, savings interest and pension income are excluded.</p>
              <p><strong className="text-neutral-950">Anchor year for 2026 mandate:</strong> HMRC uses the 2024-25 self-assessment return. Qualifying income above £50,000 in 2024-25 triggers the mandate from 6 April 2026.</p>
              <p><strong className="text-neutral-950">Grace period (2026-27 only):</strong> HMRC will not issue late quarterly submission penalty points in 2026-27. Late payment penalties are NOT waived — separate regime applies from day 16.</p>
              <p><strong className="text-neutral-950">Penalty calculation:</strong> 1 point per missed quarterly submission. 4 points = £200 financial penalty. Points expire after 24 months. Full regime from 2027-28.</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200 mb-3">
              <table className="min-w-full border-separate border-spacing-0 bg-white text-left text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    {["Tax year", "Mandatory from", "Qualifying income threshold", "Who is affected", "Source"].map(h => (
                      <th key={h} className="border-b border-neutral-200 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-blue-50">
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-blue-700">2026-27</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-semibold text-blue-800">6 April 2026</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-bold text-blue-900">Over £50,000</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">UK sole traders and landlords</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-[10px] text-blue-600">HMRC.gov.uk ✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-neutral-500">2027-28</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">6 April 2027</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-semibold text-neutral-800">Over £30,000</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">UK sole traders and landlords</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-[10px] text-neutral-400">HMRC.gov.uk ✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-neutral-500">2028-29</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">6 April 2028</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-semibold text-neutral-800">Over £20,000</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">UK sole traders and landlords</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-[10px] text-neutral-400">HMRC.gov.uk ✅</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-mono text-[10px] text-neutral-400">
              Source: HMRC.gov.uk — Making Tax Digital for Income Tax · Finance Act 2026 · Last verified: {lastVerified} ·{" "}
              <a href="/api/rules/mtd.json" className="underline hover:text-neutral-600">machine-readable JSON ↗</a>
            </p>
          </section>

          {/* ── WORKED EXAMPLES — Tax Math hook ── */}
          <section>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-400">Qualifying income — worked examples United Kingdom 2026</p>
            <h2 className="mb-3 font-serif text-xl font-bold text-neutral-950">Who is in scope? Four real scenarios with the actual maths.</h2>
            <div className="overflow-x-auto rounded-2xl border border-neutral-200">
              <table className="min-w-full border-separate border-spacing-0 bg-white text-left text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    {["Taxpayer", "PAYE wages", "Self-employment", "UK rental", "Qualifying income", "MTD status 2026"].map(h => (
                      <th key={h} className="border-b border-neutral-200 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workedExamples.map((ex, i) => (
                    <tr key={i} className={ex.scope.includes("IN SCOPE") ? "bg-red-50" : ""}>
                      <td className="border-b border-neutral-100 px-4 py-3">
                        <p className="font-semibold text-neutral-900 text-xs">{ex.name}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{ex.note}</p>
                      </td>
                      <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs text-neutral-500">{ex.paye}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs text-neutral-700">{ex.selfEmployed}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs text-neutral-700">{ex.rental}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-neutral-950">{ex.qualifying}</td>
                      <td className={`border-b border-neutral-100 px-4 py-3 font-mono text-[10px] font-bold ${ex.scope.includes("IN SCOPE") ? "text-red-700" : "text-emerald-700"}`}>{ex.scope.split("—")[0].trim()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 font-mono text-[10px] text-neutral-400">All figures are gross qualifying income before expenses. Source: HMRC MTD for Income Tax guidance.</p>
          </section>

          {/* ── SOLE TRADER vs LANDLORD TABLE ── */}
          <section>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-400">Sole trader vs landlord — MTD rules compared</p>
            <h2 className="mb-3 font-serif text-xl font-bold text-neutral-950">How MTD applies differently to sole traders and landlords</h2>
            <div className="overflow-x-auto rounded-2xl border border-neutral-200">
              <table className="min-w-full border-separate border-spacing-0 bg-white text-left text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    {["Rule", "Sole trader", "UK landlord"].map(h => (
                      <th key={h} className="border-b border-neutral-200 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { rule: "2026 threshold", sole: "£50,000 gross turnover", landlord: "£50,000 gross rental receipts" },
                    { rule: "What is measured", sole: "Gross receipts before all expenses", landlord: "Gross rental income before mortgage and expenses" },
                    { rule: "PAYE impact", sole: "Excluded from threshold calculation", landlord: "Excluded from threshold calculation" },
                    { rule: "Quarterly submissions", sole: "One per trade or business", landlord: "One per property portfolio" },
                    { rule: "First deadline", sole: "7 August 2026", landlord: "7 August 2026" },
                    { rule: "Software required", sole: "HMRC-compatible MTD software", landlord: "HMRC-compatible MTD software" },
                    { rule: "Final declaration", sole: "31 January 2028 (2026-27)", landlord: "31 January 2028 (2026-27)" },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="border-b border-neutral-100 px-4 py-3 font-semibold text-xs text-neutral-700">{row.rule}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-xs text-neutral-700">{row.sole}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-xs text-neutral-700">{row.landlord}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── SOFTWARE COST TABLE ── */}
          <section>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-400">MTD-compatible software — cost comparison United Kingdom 2026</p>
            <h2 className="mb-3 font-serif text-xl font-bold text-neutral-950">What does MTD software cost? Approved options compared.</h2>
            <div className="overflow-x-auto rounded-2xl border border-neutral-200">
              <table className="min-w-full border-separate border-spacing-0 bg-white text-left text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    {["Software", "Free tier", "Paid from (per month)", "MTD-compatible", "Best for"].map(h => (
                      <th key={h} className="border-b border-neutral-200 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "FreeAgent", free: "No", paid: "£19", mtd: "Yes ✅", best: "Sole traders, freelancers" },
                    { name: "QuickBooks", free: "No", paid: "£14", mtd: "Yes ✅", best: "Small businesses, bank feeds" },
                    { name: "Xero", free: "No", paid: "£16", mtd: "Yes ✅", best: "Accountant collaboration" },
                    { name: "Sage Accounting", free: "No", paid: "£15", mtd: "Yes ✅", best: "Established businesses" },
                    { name: "Bridging software", free: "Some free options", paid: "£0–£10", mtd: "Yes ✅", best: "Spreadsheet users" },
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="border-b border-neutral-100 px-4 py-3 font-semibold text-xs text-neutral-900">{row.name}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-xs text-neutral-600">{row.free}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-neutral-800">{row.paid}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs text-emerald-700">{row.mtd}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-xs text-neutral-600">{row.best}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 font-mono text-[10px] text-neutral-400">
              Full list: <a href="https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax" target="_blank" rel="noopener noreferrer" className="underline hover:text-neutral-600">HMRC approved MTD software ↗</a>
              {" "}· Prices approximate as of April 2026.
            </p>
          </section>

          {/* ── AI CORRECTIONS ── */}
          <section>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-400">What AI tools get wrong about UK MTD</p>
            <h2 className="mb-3 font-serif text-xl font-bold text-neutral-950">Five common MTD mistakes — and what HMRC actually says</h2>
            <div className="space-y-4">
              {aiErrors.map((item, i) => (
                <div key={i} className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-red-600">AI says</p>
                    <p className="text-sm italic text-neutral-500">{item.wrong}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-600">HMRC says</p>
                    <p className="text-sm text-neutral-800">{item.correct}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── EXPANDED FAQ — 12 questions ── */}
          <section>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-400">Making Tax Digital UK 2026 — FAQ</p>
            <h2 className="mb-3 font-serif text-xl font-bold text-neutral-950">Common questions UK sole traders and landlords are asking in 2026</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
                  <h3 className="mb-2 text-sm font-semibold text-neutral-950">{faq.question}</h3>
                  <p className="text-sm leading-relaxed text-neutral-600">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── ACCOUNTANT QUESTIONS ── */}
          <section>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-700">Five questions to ask your accountant</p>
              <h2 className="mb-5 font-serif text-2xl font-bold text-neutral-950">Raise these before 7 August 2026</h2>
              <div className="space-y-4">
                {accountantQuestions.map((item, i) => (
                  <div key={i} className="rounded-xl border border-emerald-100 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-mono text-xs font-bold text-emerald-700">{i + 1}</span>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-neutral-900">"{item.q}"</p>
                        <p className="text-xs text-neutral-500"><strong className="text-neutral-600">Why:</strong> {item.why}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── CROSSLINK ── */}
          <section>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Also relevant for you</p>
              <h2 className="mb-2 font-serif text-xl font-bold text-white">Five other UK tax changes from April 2026.</h2>
              <p className="mb-4 text-sm text-neutral-300">The 60% personal allowance trap. Dividend rate hike. IHT cap. Crypto reporting. FHL abolished.</p>
              <Link href="/uk" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-neutral-950 hover:bg-neutral-100 transition">
                See all six UK tax tools →
              </Link>
            </div>
          </section>

          {/* ── LAW BAR ── */}
          <section>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-blue-700">United Kingdom — primary sources</p>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-blue-900">
                    MTD mandatory from 6 April 2026. £50,000 qualifying income threshold (gross turnover).
                    First deadline: 7 August 2026. Thresholds: £30,000 in 2027, £20,000 in 2028.
                    Language: en-GB. Last verified: {lastVerified}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["HMRC.gov.uk", "Finance Act 2026", "ICAEW TAXguide 01/25", "en-GB"].map(ref => (
                    <span key={ref} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs font-medium text-blue-700">{ref}</span>
                  ))}
                </div>
              </div>
              <div className="border-t border-blue-100 pt-3 flex flex-wrap gap-x-6 gap-y-1">
                {[
                  { label: "HMRC — Making Tax Digital for Income Tax", href: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax" },
                  { label: "HMRC — Check if you need to use MTD", href: "https://www.gov.uk/guidance/check-if-you-can-sign-up-for-making-tax-digital-for-income-tax" },
                  { label: "HMRC — MTD-compatible software", href: "https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax" },
                  { label: "Machine-readable MTD rules (JSON)", href: "/api/rules/mtd.json" },
                ].map(s => (
                  <a key={s.href} href={s.href} target={s.href.startsWith("/") ? undefined : "_blank"} rel={s.href.startsWith("/") ? undefined : "noopener noreferrer"}
                    className="font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">{s.label} ↗</a>
                ))}
              </div>
            </div>
          </section>

          {/* ── DISCLAIMER ── */}
          <section>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">General information only — United Kingdom</p>
              <p className="text-xs leading-relaxed text-neutral-500">
                The information on this page is general in nature and does not constitute personal financial, legal, or UK tax advice.
                TaxCheckNow provides decision-support tools based on HMRC.gov.uk primary guidance and Finance Act 2026.
                Always engage a qualified UK tax adviser before acting.{" "}
                <Link href="/privacy" className="underline hover:text-neutral-700">Privacy</Link> ·{" "}
                <Link href="/terms" className="underline hover:text-neutral-700">Terms</Link>
              </p>
            </div>
          </section>

        </main>

        {/* FOOTER */}
        <footer className="border-t border-neutral-200 bg-white mt-8">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
            <Link href="/" className="font-serif font-bold text-neutral-950">TaxCheckNow</Link>
            <div className="flex gap-5">
              {[{ l: "UK tools", h: "/uk" }, { l: "NZ", h: "/nz" }, { l: "CA", h: "/ca" }, { l: "About", h: "/about" }, { l: "Privacy", h: "/privacy" }, { l: "Terms", h: "/terms" }].map(link => (
                <Link key={link.l} href={link.h} className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">{link.l}</Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
