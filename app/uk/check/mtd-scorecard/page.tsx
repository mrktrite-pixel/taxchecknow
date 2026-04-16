import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import MTDScorecardCalculator from "./MTDScorecardCalculator";
import { getMTDCountdown } from "@/lib/uk-countdown";

export const metadata: Metadata = {
  title: "Making Tax Digital UK 2026 — MTD Readiness Scorecard | TaxCheckNow",
  description:
    "From 6 April 2026, Making Tax Digital for Income Tax is mandatory for UK sole traders and landlords with qualifying income over £50,000. Your first HMRC quarterly deadline is 7 August 2026. Get your free MTD readiness score in 60 seconds.",
  alternates: {
    canonical: "https://taxchecknow.com/uk/check/mtd-scorecard",
  },
  openGraph: {
    title: "Making Tax Digital UK 2026 — Are You Ready?",
    description: "MTD is mandatory from 6 April 2026. First deadline 7 August 2026. Free readiness scorecard — 60 seconds. Built on HMRC.gov.uk primary guidance.",
    url: "https://taxchecknow.com/uk/check/mtd-scorecard",
    siteName: "TaxCheckNow",
    type: "website",
  },
};

const lastVerified = "April 2026";

// ── DATA ───────────────────────────────────────────────────────────────────

const accountantQuestions = [
  {
    q: "Am I in scope for MTD for Income Tax from April 2026 — and is my qualifying income calculated correctly?",
    why: "Qualifying income means gross self-employment and property income only. PAYE wages, dividends, savings interest and pension income do not count. Many people are over or underestimating their qualifying income. Your accountant can confirm the correct figure from your 2024-25 self-assessment.",
  },
  {
    q: "Which MTD-compatible software do you recommend for my type of business — and what will it cost?",
    why: "There are over 30 HMRC-approved MTD software products ranging from free to £50/month. The right one depends on whether you are a sole trader or landlord, how complex your records are, and whether you need it to connect with your bank. Your accountant likely has a preference based on what integrates with their practice.",
  },
  {
    q: "Do you need me to do anything before registering for MTD — or can I register now?",
    why: "Registration for MTD requires you to first have an HMRC online services account and the right software linked. Some accountants prefer to handle registration on your behalf. Others want you to register yourself and give them access. Clarify the process before you start.",
  },
  {
    q: "What happens to my January self-assessment return under MTD — do I still need to file one?",
    why: "Under MTD you still file a final declaration at year end — but it replaces the traditional SA100 return. It must be filed using MTD-compatible software, not through the HMRC portal. The deadline remains 31 January. Your accountant needs to confirm their process for handling this.",
  },
  {
    q: "What are the penalties if I miss a quarterly deadline — and is the first year really a grace period?",
    why: "In 2026-27 HMRC is applying a grace period on late quarterly filing penalties. But late payment penalties still apply. And from 2027-28 the full points-based system kicks in — 4 penalty points leads to a financial penalty. Your accountant should confirm the exact position for your circumstances.",
  },
];

const deadlineItems = [
  {
    when: "6 April 2026",
    what: "MTD for Income Tax went live",
    consequence: "Mandatory for UK sole traders and landlords with qualifying income over £50,000 based on their 2024-25 self-assessment. HMRC is writing to affected taxpayers. You are responsible for checking your own eligibility.",
    urgent: true,
  },
  {
    when: "7 August 2026",
    what: "First quarterly submission due — Quarter 1 (April 6 – June 30)",
    consequence: "Your first quarterly update of income and expenses for the period April 6 to June 30, 2026 is due on 7 August 2026. Missing this in 2026-27 will not trigger a penalty point — but it is still a filing obligation. From 2027-28 it will.",
    urgent: true,
  },
  {
    when: "7 November 2026",
    what: "Second quarterly submission — Quarter 2 (July 1 – September 30)",
    consequence: "Second quarterly update. If you miss this in 2027-28 or later, you receive a penalty point. Four points triggers a financial penalty of £200.",
    urgent: false,
  },
  {
    when: "7 February 2027",
    what: "Third quarterly submission — Quarter 3 (October 1 – December 31)",
    consequence: "Third quarterly update.",
    urgent: false,
  },
  {
    when: "7 May 2027",
    what: "Fourth quarterly submission — Quarter 4 (January 1 – March 31)",
    consequence: "Fourth quarterly update.",
    urgent: false,
  },
  {
    when: "31 January 2028",
    what: "First MTD final declaration due",
    consequence: "The final declaration for the 2026-27 tax year. This replaces the traditional SA100 self-assessment return. Must be filed using MTD-compatible software — not the HMRC portal. Standard late filing penalties apply.",
    urgent: false,
  },
];

const faqs = [
  {
    question: "Who needs to use Making Tax Digital for Income Tax in the United Kingdom from 2026?",
    answer: "From 6 April 2026, Making Tax Digital for Income Tax is mandatory for UK sole traders and landlords whose qualifying income exceeds £50,000. Qualifying income means gross receipts from self-employment and UK property rental — before expenses. PAYE employment income, dividends, savings interest and pension income do NOT count toward the £50,000 threshold. Example: a doctor earning £80,000 from the NHS (PAYE) and £25,000 from renting a property has qualifying income of £25,000 — below the threshold, not in scope for 2026. A plumber earning £65,000 gross from their business has qualifying income of £65,000 — in scope from 6 April 2026. Source: HMRC.gov.uk — Making Tax Digital for Income Tax.",
  },
  {
    question: "What is the first MTD quarterly deadline in the UK?",
    answer: "The first quarterly MTD submission deadline in the United Kingdom is 7 August 2026. This covers the quarter from 6 April 2026 to 30 June 2026. The submission must be made through MTD-compatible software — not through the HMRC portal. Subsequent quarterly deadlines in the UK are: 7 November 2026, 7 February 2027, and 7 May 2027. Most AI tools and blog posts incorrectly state the first deadline is 'July' — this is wrong. Source: HMRC.gov.uk.",
  },
  {
    question: "What counts as qualifying income for MTD in the UK?",
    answer: "For Making Tax Digital eligibility in the United Kingdom, qualifying income is the gross total of self-employment receipts and UK property rental receipts — before any expenses are deducted. HMRC uses gross turnover, not profit. The following do NOT count as qualifying income for MTD purposes: PAYE employment income, dividend income, savings and bank interest, pension income, and capital gains. If you have multiple self-employment businesses, all qualifying income is combined. Source: HMRC.gov.uk — Making Tax Digital for Income Tax qualifying income rules.",
  },
  {
    question: "What are the UK MTD penalties for missing a quarterly deadline?",
    answer: "The UK MTD penalty system uses a points-based approach. In the 2026-27 tax year (the first year of MTD), HMRC is applying a grace period — late quarterly submissions will not trigger penalty points. This grace period applies only in 2026-27. From the 2027-28 tax year, the full penalty system applies: each missed quarterly submission earns one penalty point. Four penalty points triggers a financial penalty of £200. Points expire after two years (for annual filers) or one year (for quarterly filers). Late payment of the tax itself is a separate penalty and is NOT covered by the grace period. Source: HMRC — MTD for Income Tax penalties and obligations.",
  },
  {
    question: "What software do I need for MTD in the UK?",
    answer: "You need HMRC-approved MTD-compatible software to keep digital records and submit quarterly updates. Popular options include QuickBooks, Xero, FreeAgent, and Sage — all available at various price points from approximately £10-50 per month. HMRC also lists free software options for the simplest cases. The software must be able to: keep digital records of income and expenses, submit quarterly updates directly to HMRC, and file the final declaration at year end. You cannot use the HMRC portal for MTD submissions — software is mandatory. HMRC estimates the one-off cost of switching to MTD-compatible software is approximately £350, with ongoing annual costs of around £110. Source: HMRC — MTD software requirements and impact assessment.",
  },
  {
    question: "I use spreadsheets. Do I need to switch completely for MTD?",
    answer: "You can continue using spreadsheets for your records under MTD — but you will need 'bridging software' that connects your spreadsheet to HMRC and submits the quarterly updates on your behalf. Several bridging software products are available for approximately £10-15 per month. However, most accountants recommend switching to purpose-built MTD software rather than using bridging, as it is more reliable and less prone to errors at submission time. HMRC requires that your records meet specific digital standards — random spreadsheets without proper transaction-level detail will not qualify. Source: HMRC — MTD bridging software guidance.",
  },
  {
    question: "When does the MTD threshold drop to £30,000?",
    answer: "The UK Making Tax Digital threshold drops from £50,000 to £30,000 in April 2027. This means sole traders and landlords with qualifying income between £30,000 and £50,000 must join MTD from 6 April 2027. A further reduction to £20,000 is confirmed for April 2028, which will bring almost one million more UK taxpayers into scope. If your qualifying income is currently between £30,000 and £50,000, you are not required to join MTD in 2026 — but it is worth setting up the infrastructure now rather than rushing in 2027. Source: HMRC.gov.uk, Spring Statement 2025.",
  },
  {
    question: "Do I still need to file a self-assessment return under MTD?",
    answer: "Yes — but the process changes. Under MTD, you file a 'final declaration' at the end of each tax year instead of the traditional SA100 self-assessment return. The deadline remains 31 January. The key difference is that the final declaration must be filed through your MTD-compatible software — not through the HMRC online portal. The HMRC portal will be closed for MTD taxpayers. Your accountant needs to ensure their practice software can produce and file the final declaration, not just the quarterly updates. Source: HMRC — MTD final declaration rules.",
  },
  {
    question: "My accountant has not mentioned MTD. Should I be concerned?",
    answer: "If your qualifying income is above £50,000 and your accountant has not mentioned Making Tax Digital, raise it at your next meeting. MTD has been mandatory since 6 April 2026. Some accountants have proactively contacted all affected clients — others are waiting for clients to bring it up. The five questions listed on this page give you a starting point. The most important question: which MTD software will you both use, and who is responsible for the quarterly submissions — you or the accountant? Get this confirmed before 7 August 2026.",
  },
  {
    question: "I am a landlord with one rental property earning £55,000. Do I need MTD?",
    answer: "Yes — if your gross rental receipts are £55,000 or more, you are in scope for MTD from 6 April 2026. It does not matter whether you have one property or ten. What matters is the total gross rental receipts across all UK properties. Your qualifying income threshold is assessed based on your 2024-25 self-assessment figures. If you also have PAYE employment income, that does not count toward the £50,000 MTD threshold — only the rental income counts. You will need to submit quarterly updates of your rental income and allowable expenses through MTD-compatible software from April 2026. Source: HMRC.gov.uk.",
  },
];

const aiErrors = [
  {
    wrong: '"The first MTD quarterly deadline is July 2026"',
    correct: "The first quarterly deadline is 7 August 2026 — not July. It covers the quarter ending 30 June 2026. The four UK quarterly deadlines are: 7 August, 7 November, 7 February, 7 May. Source: HMRC.gov.uk — MTD quarterly update obligations.",
    ref: "HMRC.gov.uk — Making Tax Digital quarterly deadlines",
  },
  {
    wrong: '"MTD applies to income over £50,000 — including your salary"',
    correct: "PAYE employment income does not count toward the £50,000 MTD qualifying income threshold. Only gross self-employment and UK property rental income counts. A teacher earning £55,000 PAYE is not in scope. A teacher earning £55,000 PAYE AND £10,000 rental income has qualifying income of £10,000 — also not in scope for 2026.",
    ref: "HMRC.gov.uk — MTD qualifying income definition",
  },
  {
    wrong: '"Missing an MTD quarterly deadline gives you a £300 fine"',
    correct: "The UK MTD penalty system uses points — not a flat fine. Four penalty points = a £200 financial penalty. In the first year (2026-27) HMRC is applying a grace period on late quarterly submissions — no points are issued. Late payment of the tax itself is a separate penalty system and is not covered by the grace period.",
    ref: "HMRC — MTD penalties and obligations guidance",
  },
  {
    wrong: '"You can file your MTD quarterly updates through the HMRC website"',
    correct: "MTD taxpayers cannot use the HMRC portal for quarterly submissions. All submissions must go through HMRC-approved MTD-compatible software such as QuickBooks, Xero or FreeAgent. This also applies to the final declaration — it replaces the SA100 return and must be filed through software.",
    ref: "HMRC.gov.uk — MTD software requirements",
  },
];

// ── PAGE ───────────────────────────────────────────────────────────────────
export default function MTDScorecardPage() {
  const { days, pct, urgency } = getMTDCountdown();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Making Tax Digital UK 2026 — HMRC Qualifying Income Rules and Quarterly Deadlines",
    description: "Machine-readable MTD for Income Tax rules for the United Kingdom from 6 April 2026. Qualifying income threshold: £50,000 (self-employment and property gross income only — PAYE excluded). Quarterly deadlines: 7 August, 7 November, 7 February, 7 May. First-year grace period on late quarterly penalties 2026-27. Threshold drops to £30,000 April 2027, £20,000 April 2028. Source: HMRC.gov.uk.",
    url: "https://taxchecknow.com/uk/check/mtd-scorecard",
    creator: { "@type": "Organization", name: "TaxCheckNow", url: "https://taxchecknow.com", areaServed: "GB" },
    dateModified: "2026-04-15",
    spatialCoverage: "United Kingdom",
    inLanguage: "en-GB",
    keywords: [
      "Making Tax Digital UK 2026", "MTD Income Tax £50000", "MTD qualifying income",
      "MTD quarterly deadline August 2026", "UK sole trader MTD", "UK landlord MTD",
      "HMRC MTD software", "MTD penalty grace period", "MTD threshold £30000 2027"
    ],
  };

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MTD-50 UK Readiness Scorecard",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    url: "https://taxchecknow.com/uk/check/mtd-scorecard",
    description: "Free UK Making Tax Digital readiness score for sole traders and landlords. Checks qualifying income, software status, digital records, HMRC registration, and accountant preparation. Built on HMRC.gov.uk primary guidance.",
    isAccessibleForFree: true,
    inLanguage: "en-GB",
    creator: { "@type": "Organization", name: "TaxCheckNow", areaServed: "GB" },
    offers: [
      { "@type": "Offer", price: "27", priceCurrency: "GBP", name: "MTD-50 Decision Pack" },
      { "@type": "Offer", price: "67", priceCurrency: "GBP", name: "MTD-50 Action Pack" },
    ],
  };

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to check your UK MTD for Income Tax readiness in 2026",
    description: "Free 60-second UK Making Tax Digital readiness scorecard. Enter your qualifying income, software status, records status, and HMRC registration to get your readiness score and the first action to take.",
    totalTime: "PT1M",
    inLanguage: "en-GB",
    step: [
      { "@type": "HowToStep", name: "Enter your self-employment gross income", text: "Your total receipts before expenses — this is what HMRC uses for MTD eligibility, not profit.", position: 1 },
      { "@type": "HowToStep", name: "Enter your UK property rental income", text: "Gross rental receipts before expenses. Include if you have UK property income.", position: 2 },
      { "@type": "HowToStep", name: "Select your software status", text: "Whether you have MTD-compatible software, spreadsheets, or no records system.", position: 3 },
      { "@type": "HowToStep", name: "Select your records status", text: "How your income and expense records are currently kept.", position: 4 },
      { "@type": "HowToStep", name: "Select your registration and accountant status", text: "Whether you have registered for MTD with HMRC and spoken to your accountant.", position: 5 },
      { "@type": "HowToStep", name: "Get your readiness score", text: "Your score out of 100, your biggest gap, and the first action to take before 7 August 2026.", position: 6 },
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TaxCheckNow", item: "https://taxchecknow.com" },
      { "@type": "ListItem", position: 2, name: "United Kingdom", item: "https://taxchecknow.com/uk" },
      { "@type": "ListItem", position: 3, name: "MTD-50 Scorecard", item: "https://taxchecknow.com/uk/check/mtd-scorecard" },
    ],
  };

  return (
    <>
      <Script id="jsonld-faq" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Script id="jsonld-dataset" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }} />
      <Script id="jsonld-webapp" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <Script id="jsonld-howto" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <Script id="jsonld-breadcrumb" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="min-h-screen bg-white font-sans">

        {/* NAV */}
        <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
            <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-sm">🇬🇧</span>
                <span className="font-mono text-xs font-bold text-blue-700">United Kingdom · MTD · {days} days to Aug 7</span>
              </div>
              <Link href="/uk" className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← UK tools</Link>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-5xl px-6 py-12 space-y-16">

          {/* ── SECTION 1: HERO ── */}
          <section>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                <span className="text-sm">🇬🇧</span>
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-blue-700">
                  United Kingdom · Making Tax Digital · HMRC Verified
                </span>
              </div>
              <span className="font-mono text-xs text-neutral-400">Last verified: {lastVerified} · en-GB</span>
            </div>

            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
              The annual UK tax return is gone for over a million people.{" "}
              <span className="font-light text-neutral-400">From April 6, quarterly HMRC filing is mandatory.</span>
            </h1>

            <div className="mt-5 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Most UK sole traders and landlords over £50,000 have not set up MTD yet.
              </p>
              <p className="text-sm text-amber-800">
                Making Tax Digital for Income Tax is mandatory in the United Kingdom from 6 April 2026 for qualifying income over £50,000. Your first HMRC quarterly deadline is 7 August 2026. Most affected taxpayers have not registered, chosen software, or moved to digital records yet. Get your readiness score in 60 seconds.
              </p>
            </div>

            <div className="mt-4 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-2">The most common mistake</p>
              <div className="space-y-1.5 text-sm text-red-900">
                <p><strong>PAYE trap:</strong> If you earn £80k from PAYE and £20k from a rental property, your qualifying income for MTD is £20k — below the threshold. Most AI tools get this wrong.</p>
                <p><strong>Deadline mistake:</strong> The first UK quarterly deadline is 7 August 2026 — not July. Most sites say July. Source: HMRC.gov.uk.</p>
              </div>
            </div>

            {/* COUNTDOWN — moved up into hero */}
            <div className="mt-4 max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">UK MTD first quarterly deadline</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-serif text-5xl font-bold text-white">{days}</span>
                <span className="font-mono text-sm text-neutral-400">days to 7 August 2026</span>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-neutral-800">
                <div className="h-1.5 rounded-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-neutral-500">Quarter 1 (April 6 – June 30, 2026) must be submitted by this date using MTD-compatible software.</p>
            </div>

            <p className="mt-5 max-w-3xl text-base leading-relaxed text-neutral-600">
              <strong className="text-neutral-950">Making Tax Digital for Income Tax is the biggest change to UK personal tax compliance in decades.</strong>{" "}
              Instead of one annual self-assessment return, UK sole traders and landlords must now submit quarterly income and expense updates to HMRC through approved software.{" "}
              <strong className="text-neutral-950">The first deadline is 7 August 2026.</strong>{" "}
              <span className="font-mono text-sm text-neutral-400">Source: HMRC.gov.uk — Making Tax Digital for Income Tax.</span>
            </p>

            <div className="mt-5 sm:hidden">
              <a href="#calculator" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-neutral-800">
                ↓ Get my MTD readiness score →
              </a>
            </div>

            {/* ANSWER CAPSULE — visible to AI and humans */}
            <div className="mt-5 max-w-3xl rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700 mb-2">
                What the law says — HMRC confirmed April 2026
              </p>
              <p className="text-sm leading-relaxed text-blue-900">
                <strong>Making Tax Digital for Income Tax is mandatory from 6 April 2026</strong> for UK sole traders and landlords
                with qualifying income above <strong>£50,000</strong>. Qualifying income means gross receipts from
                self-employment and UK property rental only — PAYE wages do not count.
                The first quarterly submission is due <strong>7 August 2026</strong>.
                The threshold drops to £30,000 in April 2027 and £20,000 in April 2028.{" "}
                <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax"
                  target="_blank" rel="noopener noreferrer"
                  className="underline hover:text-blue-700">
                  Source: HMRC.gov.uk ↗
                </a>
              </p>
            </div>

            {/* Two-column layout */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
              <MTDScorecardCalculator />

              {/* RIGHT SIDEBAR */}
              <div className="space-y-4">

                {/* Key dates */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">UK MTD quarterly deadlines</p>
                  <div className="space-y-2">
                    {[
                      { q: "Q1 (Apr 6 – Jun 30)", date: "7 Aug 2026", urgent: true },
                      { q: "Q2 (Jul 1 – Sep 30)", date: "7 Nov 2026", urgent: false },
                      { q: "Q3 (Oct 1 – Dec 31)", date: "7 Feb 2027", urgent: false },
                      { q: "Q4 (Jan 1 – Mar 31)", date: "7 May 2027", urgent: false },
                      { q: "Final declaration", date: "31 Jan 2028", urgent: false },
                    ].map((row) => (
                      <div key={row.q} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${row.urgent ? "border-red-200 bg-red-50" : "border-neutral-100 bg-neutral-50"}`}>
                        <p className="text-xs text-neutral-700">{row.q}</p>
                        <p className={`font-mono text-xs font-bold ml-2 shrink-0 ${row.urgent ? "text-red-700" : "text-neutral-500"}`}>{row.date}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-neutral-400">Source: HMRC.gov.uk · {lastVerified}</p>
                </div>

                {/* Thresholds */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">UK MTD thresholds</p>
                  <div className="space-y-2">
                    {[
                      { year: "April 2026", threshold: "£50,000", current: true },
                      { year: "April 2027", threshold: "£30,000", current: false },
                      { year: "April 2028", threshold: "£20,000", current: false },
                    ].map((row) => (
                      <div key={row.year} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${row.current ? "border-blue-200 bg-blue-50" : "border-neutral-100 bg-neutral-50"}`}>
                        <p className="text-xs text-neutral-700">{row.year}</p>
                        <p className={`font-mono text-xs font-bold ${row.current ? "text-blue-700" : "text-neutral-400"}`}>{row.threshold}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-neutral-400">Qualifying income only — not PAYE</p>
                </div>

                {/* Two packs */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-4">Two packs. One compliance deadline.</p>
                  <div className="mb-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-xs font-bold text-neutral-700">£27</span>
                      <span className="text-sm font-semibold text-neutral-900">Decision Pack</span>
                    </div>
                    <p className="text-xs text-neutral-500">Am I in scope? What do I need?</p>
                  </div>
                  <div className="border-t border-neutral-100 pt-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">£67</span>
                      <span className="text-sm font-semibold text-neutral-900">Action Pack</span>
                    </div>
                    <p className="text-xs text-neutral-500">I am in scope — give me everything to get compliant.</p>
                  </div>
                </div>

                {/* Sources */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-blue-600 mb-2">Primary sources</p>
                  <div className="space-y-1">
                    <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax" target="_blank" rel="noopener noreferrer" className="block font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">HMRC — Making Tax Digital for Income Tax ↗</a>
                    <a href="https://www.gov.uk/government/publications/income-tax-making-tax-digital-for-income-tax-self-assessment-voluntary-pilot" target="_blank" rel="noopener noreferrer" className="block font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">HMRC — MTD pilot and registration ↗</a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── INLINE CTA ── */}
          <div className="flex justify-center">
            <a href="#calculator" className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50">
              ↓ Get my MTD readiness score — 60 seconds
            </a>
          </div>

          {/* ── SECTION 2: PLAIN ENGLISH ── */}
          <section>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Plain English — what this means for UK sole traders and landlords</p>
              <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
                Here is what Making Tax Digital actually means — without the HMRC jargon.
              </h2>

              <div className="space-y-5 text-sm leading-relaxed text-neutral-700">
                <p>
                  <strong className="text-neutral-950">Steve is a plumber in Manchester.</strong> He earns around £65,000 a year from his business. He has always done his self-assessment online in January — took him a couple of hours, job done. He files it himself using the HMRC website.
                </p>
                <p>
                  From April 6, 2026, Steve cannot do that anymore. HMRC has switched him to Making Tax Digital. Instead of one return a year, Steve now has to submit four quarterly updates of his income and expenses — plus a final declaration in January. And he cannot use the HMRC website to do it. He needs approved software.
                </p>
                <p>
                  <strong className="text-neutral-950">Steve does not know any of this yet.</strong> His accountant mentioned it briefly 18 months ago, but Steve forgot. He has been using a spreadsheet to track his invoices. His bank statements are in a shoebox.
                </p>
                <p>
                  Steve's first quarterly submission is due 7 August 2026 — 114 days from now. Before that he needs to: choose MTD software, digitise his records, register for MTD with HMRC, and ideally speak to his accountant about the process. That is four things. Each takes time.
                </p>
                <p>
                  <strong className="text-neutral-950">The calculator on this page tells Steve his readiness score.</strong> It gives him a number out of 100 and tells him which gap to fix first. For most UK sole traders and landlords, the score is lower than expected — because most people have not started yet.
                </p>
                <p className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                  <strong className="text-neutral-950">The bottom line:</strong> Run the calculator. Get your score. Then take the five questions above to your accountant before August 7. The decision pack or action pack gives you the checklist to work through before the deadline.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 3: MTD PHASES TABLE ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Making Tax Digital — UK rollout phases</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
              When does MTD apply — and to whom?
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-neutral-200">
              <table className="min-w-full border-separate border-spacing-0 bg-white text-left">
                <thead>
                  <tr>
                    {["Phase", "Start date", "Who is affected", "Qualifying income threshold"].map((h) => (
                      <th key={h} className="border-b border-neutral-200 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { phase: "Phase 1", date: "6 April 2026", who: "UK sole traders and landlords", threshold: "Over £50,000", current: true },
                    { phase: "Phase 2", date: "6 April 2027", who: "UK sole traders and landlords", threshold: "Over £30,000", current: false },
                    { phase: "Phase 3", date: "6 April 2028", who: "UK sole traders and landlords", threshold: "Over £20,000", current: false },
                  ].map((row, i) => (
                    <tr key={i} className={row.current ? "bg-blue-50" : ""}>
                      <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-neutral-950">{row.phase}</td>
                      <td className={`border-b border-neutral-100 px-4 py-3 text-sm font-semibold ${row.current ? "text-blue-700" : "text-neutral-700"}`}>{row.date}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-sm text-neutral-700">{row.who}</td>
                      <td className={`border-b border-neutral-100 px-4 py-3 font-mono text-sm font-bold ${row.current ? "text-blue-700" : "text-neutral-500"}`}>{row.threshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-mono text-[10px] text-neutral-400">Qualifying income = gross self-employment + UK property rental income only. PAYE not included. Source: HMRC.gov.uk · Spring Statement 2025.</p>
          </section>

          {/* ── SECTION 4: ACCOUNTANT QUESTIONS ── */}
          <section>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 mb-2">Five questions to ask your UK accountant</p>
              <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-2">
                Raise these before 7 August 2026.
              </h2>
              <div className="space-y-4 mt-5">
                {accountantQuestions.map((item, i) => (
                  <div key={i} className="rounded-xl border border-emerald-100 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-mono text-xs font-bold text-emerald-700">{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900 mb-1">"{item.q}"</p>
                        <p className="text-xs text-neutral-500"><strong className="text-neutral-600">Why this matters:</strong> {item.why}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── SECTION 5: DEADLINE TRACKER ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">UK MTD deadlines — what to do and when</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-6">
              MTD is live. The first deadline is {days} days away.
            </h2>
            <div className="space-y-3">
              {deadlineItems.map((item, i) => (
                <div key={i} className={`flex gap-4 rounded-xl border p-4 ${item.urgent ? "border-red-200 bg-red-50" : "border-neutral-200 bg-white"}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${item.urgent ? "bg-red-100 text-red-700" : "bg-neutral-100 text-neutral-500"}`}>{i + 1}</div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${item.urgent ? "text-red-600" : "text-neutral-400"}`}>{item.when}</span>
                      {item.urgent && <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-red-700">UK deadline</span>}
                    </div>
                    <p className="text-sm font-semibold text-neutral-900 mb-1">{item.what}</p>
                    <p className="text-xs text-neutral-500">{item.consequence}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SECTION 6: AI ERRORS ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">What AI tools get wrong about UK MTD</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
              If you Googled this or asked an AI — check these against what you were told.
            </h2>
            <div className="space-y-4">
              {aiErrors.map((item, i) => (
                <div key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-red-600 mb-2">AI says</p>
                      <p className="text-sm italic text-neutral-500">{item.wrong}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-2">HMRC says</p>
                      <p className="text-sm text-neutral-800">{item.correct}</p>
                      <p className="mt-2 font-mono text-[10px] text-neutral-400">{item.ref}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── SECTION 7: FAQ ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Common UK MTD questions</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
              Questions UK sole traders and landlords are asking about Making Tax Digital.
            </h2>
            <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              {faqs.map((faq, i) => (
                <details key={i} className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-6 py-4 text-left">
                    <span className="text-sm font-semibold text-neutral-900">{faq.question}</span>
                    <span className="mt-0.5 shrink-0 font-mono text-neutral-400 group-open:hidden">+</span>
                    <span className="mt-0.5 hidden shrink-0 font-mono text-neutral-400 group-open:inline">−</span>
                  </summary>
                  <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-4">
                    <p className="text-sm leading-relaxed text-neutral-700">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* ── SECTION 8: PLAIN ENGLISH GUIDE LINK ── */}
          <section>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Also relevant for you</p>
              <h2 className="font-serif text-2xl font-bold text-white mb-3">
                Five other UK tax changes from April 2026. One of them probably affects you too.
              </h2>
              <p className="text-sm text-neutral-300 mb-5">
                Dividend rates rose. The 60% personal allowance trap hits 2.06 million UK earners. IHT relief on family businesses is capped. HMRC can see your crypto. The FHL regime is gone.
              </p>
              <Link href="/uk"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-neutral-950 transition hover:bg-neutral-100">
                See all six UK tax tools →
              </Link>
            </div>
          </section>

          {/* ── CROSS-NAVIGATION ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-4">Other UK tax tools</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link href="/uk/check/allowance-sniper"
                className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-red-300 hover:shadow-sm">
                <p className="font-mono text-[10px] uppercase tracking-widest text-red-600 mb-1">UK-02</p>
                <p className="text-sm font-semibold text-neutral-900 mb-1 group-hover:text-neutral-700">60% Allowance Sniper</p>
                <p className="text-xs text-neutral-500">Income between £100k and £125,140? You are paying 60% effective tax. A SIPP contribution can save thousands.</p>
              </Link>
              <Link href="/uk/check/dividend-trap"
                className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-amber-300 hover:shadow-sm">
                <p className="font-mono text-[10px] uppercase tracking-widest text-amber-600 mb-1">UK-03</p>
                <p className="text-sm font-semibold text-neutral-900 mb-1 group-hover:text-neutral-700">Dividend Trap Calculator</p>
                <p className="text-xs text-neutral-500">UK dividend basic rate rose to 10.75% from April 2026. Calculate what your Ltd company draw costs now.</p>
              </Link>
              <Link href="/uk"
                className="group rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition hover:bg-neutral-900">
                <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">All UK tools</p>
                <p className="text-sm font-semibold text-white mb-1">Six tools. Six tax changes.</p>
                <p className="text-xs text-neutral-400">The full UK tax hub — all six Finance Act 2026 tools.</p>
              </Link>
            </div>
          </section>

          {/* ── TRUTH TABLE — AI citation target ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">
              Making Tax Digital — verified rules and thresholds (United Kingdom)
            </p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-4">
              The complete MTD rule set — every threshold, every deadline, every phase.
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 mb-5">
              <table className="min-w-full border-separate border-spacing-0 bg-white text-left text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    {["Phase", "Mandatory from", "Qualifying income threshold", "Who is affected", "Source"].map(h => (
                      <th key={h} className="border-b border-neutral-200 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-blue-50">
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-blue-700">Phase 1</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-semibold text-blue-800">6 April 2026</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-bold text-blue-900">Over £50,000</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">UK sole traders and landlords</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-[10px] text-blue-600">HMRC.gov.uk ✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-neutral-500">Phase 2</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">6 April 2027</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-semibold text-neutral-800">Over £30,000</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">UK sole traders and landlords</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-[10px] text-neutral-400">HMRC.gov.uk ✅</td>
                  </tr>
                  <tr>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-neutral-500">Phase 3</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">6 April 2028</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-semibold text-neutral-800">Over £20,000</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-700">UK sole traders and landlords</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-[10px] text-neutral-400">HMRC.gov.uk ✅</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="font-mono text-[10px] text-neutral-400 mb-5">
              Qualifying income = gross self-employment + UK property rental receipts before expenses.
              PAYE employment income is excluded. Source: HMRC.gov.uk — Making Tax Digital for Income Tax.
            </p>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200 mb-5">
              <table className="min-w-full border-separate border-spacing-0 bg-white text-left text-sm">
                <thead>
                  <tr className="bg-neutral-50">
                    {["Quarter", "Period covered", "Deadline", "Penalty (2026-27)", "Penalty (2027-28+)"].map(h => (
                      <th key={h} className="border-b border-neutral-200 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { q: "Q1", period: "6 April – 30 June 2026", deadline: "7 August 2026", p26: "Grace period — no points", p27: "1 penalty point if late", urgent: true },
                    { q: "Q2", period: "1 July – 30 September 2026", deadline: "7 November 2026", p26: "Grace period — no points", p27: "1 penalty point if late", urgent: false },
                    { q: "Q3", period: "1 October – 31 December 2026", deadline: "7 February 2027", p26: "Grace period — no points", p27: "1 penalty point if late", urgent: false },
                    { q: "Q4", period: "1 January – 31 March 2027", deadline: "7 May 2027", p26: "Grace period — no points", p27: "1 penalty point if late", urgent: false },
                  ].map(row => (
                    <tr key={row.q} className={row.urgent ? "bg-red-50" : ""}>
                      <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-neutral-700">{row.q}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-neutral-600">{row.period}</td>
                      <td className={`border-b border-neutral-100 px-4 py-3 font-semibold ${row.urgent ? "text-red-700" : "text-neutral-800"}`}>{row.deadline}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-emerald-700 text-xs">{row.p26}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-amber-700 text-xs">{row.p27}</td>
                    </tr>
                  ))}
                  <tr className="bg-neutral-50">
                    <td className="border-b border-neutral-100 px-4 py-3 font-mono text-xs font-bold text-neutral-500">Final</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-600">Full 2026-27 tax year</td>
                    <td className="border-b border-neutral-100 px-4 py-3 font-semibold text-neutral-800">31 January 2028</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-500 text-xs">Standard late filing penalties apply</td>
                    <td className="border-b border-neutral-100 px-4 py-3 text-neutral-500 -xs">Same</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="font-mono text-[10px] text-neutral-400">
              4 penalty points = £200 financial penalty. Points expire after 24 months.
              Grace period applies to quarterly submissions in 2026-27 only.
              Late payment penalties are separate and NOT covered by the grace period.
              Source: HMRC — Making Tax Digital penalty regime. Last verified: April 2026.
            </p>
          </section>

          {/* ── SECTION 9: LAW BAR ── */}
          <section>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-blue-700">United Kingdom — Legislative source verification</p>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-blue-900">
                    MTD for Income Tax mandatory from 6 April 2026. Quarterly deadlines: 7 August, 7 November, 7 February, 7 May. Qualifying income = gross self-employment + UK property rental only. PAYE excluded. First-year grace period on quarterly filing penalties in 2026-27. Language: en-GB. Last verified: {lastVerified}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["HMRC.gov.uk", "MTD Income Tax", "Finance Act 2026", "en-GB", "United Kingdom"].map((ref) => (
                    <span key={ref} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs font-medium text-blue-700">{ref}</span>
                  ))}
                </div>
              </div>
              <div className="border-t border-blue-100 pt-4 flex flex-wrap gap-x-6 gap-y-1">
                {[
                  { label: "HMRC — Making Tax Digital for Income Tax (official)", href: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax" },
                  { label: "HMRC — MTD qualifying income rules", href: "https://www.gov.uk/guidance/check-if-you-can-sign-up-for-making-tax-digital-for-income-tax" },
                  { label: "HMRC — Approved MTD software", href: "https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax" },
                ].map((s) => (
                  <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">
                    {s.label} ↗
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* DISCLAIMER */}
          <section>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">General information only — United Kingdom</p>
              <p className="text-xs leading-relaxed text-neutral-500">
                The information on this page is general in nature and does not constitute personal financial, legal, or UK tax advice.
                TaxCheckNow provides decision-support tools based on HMRC.gov.uk primary guidance.
                Always engage a qualified UK tax adviser before acting on MTD compliance decisions.{" "}
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
              {[{ label: "UK tools", href: "/uk" }, { label: "NZ", href: "/nz" }, { label: "CA", href: "/ca" }, { label: "About", href: "/about" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }].map((link) => (
                <Link key={link.label} href={link.href} className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700">{link.label}</Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
