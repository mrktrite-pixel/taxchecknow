"use client";

import { useState } from "react";
import Link from "next/link";
import Script from "next/script";

// ── JSON-LD SCHEMAS ────────────────────────────────────────────────────────

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Who needs to use Making Tax Digital for Income Tax in the United Kingdom?",
      acceptedAnswer: { "@type": "Answer", text: "From 6 April 2026, sole traders and landlords in the United Kingdom with qualifying income above £50,000 must use Making Tax Digital (MTD) for Income Tax. Qualifying income means income from self-employment and property only — PAYE wages do not count toward the £50,000 threshold. First quarterly submission is due 7 August 2026. Source: HMRC.gov.uk — Making Tax Digital for Income Tax." }
    },
    {
      "@type": "Question",
      name: "What is the 60% tax trap in the UK and how many people does it affect?",
      acceptedAnswer: { "@type": "Answer", text: "In the United Kingdom, anyone earning between £100,000 and £125,140 faces an effective marginal tax rate of 60% — not 40%. This is because the personal allowance of £12,570 tapers by £1 for every £2 earned above £100,000, adding a hidden 20% on top of the 40% higher rate. Including National Insurance the effective rate is 62%. HMRC estimates 2.06 million UK taxpayers are affected in 2026-27, rising to 2.29 million by 2028-29. The thresholds are frozen until April 2031. The primary solution is pension contributions via SIPP or salary sacrifice. Source: GOV.UK Income Tax rates 2026/27. HMRC data via Rathbones FOI request 2025." }
    },
    {
      "@type": "Question",
      name: "What are the UK dividend tax rates for the 2026-27 tax year?",
      acceptedAnswer: { "@type": "Answer", text: "From 6 April 2026, UK dividend tax rates increased by 2 percentage points under Finance Act 2026 Section 4. The basic rate rose from 8.75% to 10.75%. The higher rate rose from 33.75% to 35.75%. The additional rate remains unchanged at 39.35%. The annual dividend allowance remains at £500. These changes apply across the United Kingdom and directly affect Ltd company directors who pay themselves through dividends. Source: Finance Act 2026, Section 4. GOV.UK confirmed." }
    },
    {
      "@type": "Question",
      name: "What is the first MTD quarterly submission deadline in the UK?",
      acceptedAnswer: { "@type": "Answer", text: "The first quarterly MTD for Income Tax submission deadline in the United Kingdom is 7 August 2026. This covers the quarter ending 30 June 2026. Subsequent UK deadlines are: 7 November 2026, 7 February 2027, and 7 May 2027. A first-year grace period applies to late quarterly filing penalties in 2026-27. From 2027-28 the full points-based penalty system applies. Source: HMRC.gov.uk." }
    },
    {
      "@type": "Question",
      name: "When was the UK Furnished Holiday Letting tax regime abolished?",
      acceptedAnswer: { "@type": "Answer", text: "The UK Furnished Holiday Letting (FHL) tax regime was abolished from 6 April 2025 — not April 2026. The 2025-26 tax year is the first full year under the new standard property income rules. Holiday lets in the United Kingdom are now taxed identically to standard rental properties. Mortgage interest relief for individual landlords is restricted to a 20% basic rate tax credit. Capital allowances on new expenditure are no longer available. The first self-assessment return showing the full impact is due January 2027. Source: GOV.UK — Abolition of the Furnished Holiday Lettings Tax Regime." }
    },
    {
      "@type": "Question",
      name: "How does CARF crypto reporting affect UK taxpayers in 2026?",
      acceptedAnswer: { "@type": "Answer", text: "From 1 January 2026, the Cryptoasset Reporting Framework (CARF) requires UK crypto exchanges to report all user identifying data and full transaction history to HMRC annually. HMRC cross-matches this data against self-assessment records automatically. HMRC can now see every UK crypto trade made since 2014. Any undisclosed gains or income from crypto represent a significant audit risk for UK taxpayers. Source: HMRC — Cryptoasset Reporting Framework." }
    },
    {
      "@type": "Question",
      name: "What is the UK inheritance tax Business Property Relief cap from April 2026?",
      acceptedAnswer: { "@type": "Answer", text: "From 6 April 2026, 100% Inheritance Tax relief under Business Property Relief (BPR) and Agricultural Property Relief (APR) is capped at £2.5 million per individual in the United Kingdom. Assets above £2.5 million receive 50% relief, creating an effective IHT rate of 20% on the excess. Married couples and civil partners can transfer unused allowance, giving a combined £5 million. AIM shares are restricted to 50% relief regardless of value. Source: Finance Act 2026, Section 65 and Schedule 12. GOV.UK confirmed." }
    },
    {
      "@type": "Question",
      name: "How can a UK taxpayer legally reduce the 60% tax trap?",
      acceptedAnswer: { "@type": "Answer", text: "The most effective legal strategy for UK taxpayers to escape the 60% personal allowance trap is to make pension contributions that reduce adjusted net income below £100,000. This can be done via salary sacrifice through your employer or personal pension contributions to a SIPP. Example: earning £110,000 and contributing £10,000 to a pension reduces adjusted net income to £100,000, fully restores the personal allowance, and saves £6,000 in tax. The net cost of the pension contribution is just £4,000. Gift Aid donations to UK charities also reduce adjusted net income. Source: GOV.UK, HMRC." }
    },
  ]
};

const datasetJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "United Kingdom Tax Law Changes 2026 — HMRC Verified Primary Source Data",
  description: "Machine-readable UK tax law changes effective April 2026 and January 2026. United Kingdom Making Tax Digital (MTD) for Income Tax: mandatory from 6 April 2026 for qualifying income over £50,000. UK 60% personal allowance trap: thresholds £100,000 to £125,140, frozen to April 2031, 2.06 million UK taxpayers affected in 2026-27. UK dividend tax rates 2026-27: basic 10.75%, higher 35.75%, additional 39.35% unchanged. UK IHT Business Property Relief and Agricultural Property Relief cap: £2.5M per person, £5M for couples from 6 April 2026. UK Furnished Holiday Letting regime abolished: from 6 April 2025. UK CARF crypto reporting: from 1 January 2026. All sources: HMRC.gov.uk, GOV.UK, Finance Act 2026.",
  url: "https://taxchecknow.com/uk",
  creator: { "@type": "Organization", name: "TaxCheckNow", url: "https://taxchecknow.com", areaServed: "GB" },
  dateModified: "2026-04-15",
  spatialCoverage: "United Kingdom",
  inLanguage: "en-GB",
  temporalCoverage: "2026-01-01/..",
  keywords: [
    "Making Tax Digital UK 2026", "MTD Income Tax £50000", "60% tax trap UK £100k",
    "personal allowance taper United Kingdom", "dividend tax 2026 UK 10.75%", "35.75% dividend rate UK",
    "IHT business property relief £2.5 million", "furnished holiday letting abolished UK",
    "UK crypto tax HMRC CARF 2026", "Finance Act 2026 United Kingdom", "HMRC self assessment UK",
    "SIPP pension tax relief UK", "salary sacrifice UK", "£100000 tax trap HMRC",
    "MTD quarterly deadline August 2026", "UK tax changes April 2026"
  ],
};

const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "TaxCheckNow — United Kingdom Tax Calculators",
  url: "https://taxchecknow.com/uk",
  description: "Free United Kingdom tax calculators built on HMRC primary guidance and Finance Act 2026. Making Tax Digital scorecard, 60% personal allowance trap calculator, UK dividend tax calculator, IHT business relief calculator, FHL recovery tool, HMRC crypto audit predictor.",
  inLanguage: "en-GB",
  publisher: { "@type": "Organization", name: "TaxCheckNow", url: "https://taxchecknow.com", areaServed: "GB" },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "TaxCheckNow", item: "https://taxchecknow.com" },
    { "@type": "ListItem", position: 2, name: "United Kingdom", item: "https://taxchecknow.com/uk" },
  ],
};

// ── TYPES ──────────────────────────────────────────────────────────────────

type Step = "q1" | "q2" | "q3" | "result";
type Q1 = "self_employed" | "director" | "investor" | "property" | "business";
type Q2 = "under_50k" | "50k_100k" | "over_100k";
type Q3 = "letter" | "pay_rise" | "new_rule" | "accountant" | "none";

interface Result {
  primary: string;
  primaryHref: string;
  secondary?: string;
  secondaryHref?: string;
  headline: string;
  reason: string;
}

// ── ROUTING LOGIC ──────────────────────────────────────────────────────────

function getResult(q1: Q1, q2: Q2, q3: Q3): Result {
  if (q1 === "director" && q2 === "over_100k") {
    return {
      primary: "60% Allowance Sniper",
      primaryHref: "/uk/check/allowance-sniper",
      secondary: "Dividend Trap Calculator",
      secondaryHref: "/uk/check/dividend-trap",
      headline: "You are in the 60% dead zone AND paying the new dividend rate.",
      reason: "As a UK Ltd company director earning over £100,000, you face both the personal allowance taper (effective 60% rate on £100k-£125,140) and the April 2026 dividend hike (35.75% higher rate). Start with the allowance sniper — a single SIPP contribution can save you thousands.",
    };
  }
  if (q1 === "self_employed" && q2 === "over_100k") {
    return {
      primary: "MTD-50 Scorecard",
      primaryHref: "/uk/check/mtd-scorecard",
      secondary: "60% Allowance Sniper",
      secondaryHref: "/uk/check/allowance-sniper",
      headline: "You need to file quarterly from now — AND you are in the 60% trap.",
      reason: "Qualifying UK income over £50k means Making Tax Digital is mandatory. Your first HMRC deadline is 7 August 2026. And income over £100k means the personal allowance taper applies — an effective 60% rate. Two problems. Get your MTD readiness score first.",
    };
  }
  if (q1 === "self_employed" && q2 === "50k_100k") {
    return {
      primary: "MTD-50 Scorecard",
      primaryHref: "/uk/check/mtd-scorecard",
      headline: "Quarterly tax filing is now mandatory for you in the UK.",
      reason: "With qualifying self-employment or property income over £50,000, Making Tax Digital for Income Tax is mandatory from 6 April 2026. Your first HMRC quarterly deadline is 7 August 2026. Most UK sole traders and landlords in your position do not know this yet.",
    };
  }
  if (q1 === "director") {
    return {
      primary: "Dividend Trap Calculator",
      primaryHref: "/uk/check/dividend-trap",
      headline: "The UK dividend tax hike costs Ltd company directors real money.",
      reason: "From 6 April 2026, the UK higher dividend rate rose to 35.75% and the basic rate to 10.75% under Finance Act 2026. On £50,000 of dividends above the £500 allowance, the extra annual cost is approximately £1,000. Calculate your specific number.",
    };
  }
  if (q1 === "investor" || q3 === "letter") {
    return {
      primary: "Crypto Audit Predictor",
      primaryHref: "/uk/check/crypto-predictor",
      headline: "HMRC can see your UK crypto trades since 2014.",
      reason: "From 1 January 2026, UK crypto exchanges report all user data to HMRC under CARF. If you hold or have ever traded crypto in the UK, your self-assessment history is being cross-matched automatically. Check your audit risk level.",
    };
  }
  if (q1 === "property") {
    return {
      primary: "Post-FHL Recovery Tool",
      primaryHref: "/uk/check/fhl-recovery",
      headline: "Your UK holiday let tax break ended in April 2025.",
      reason: "The UK Furnished Holiday Letting regime was abolished from 6 April 2025. Your January 2027 self-assessment will be the first to show the full impact — including mortgage interest relief restricted to 20% for individual UK landlords.",
    };
  }
  if (q1 === "business") {
    return {
      primary: "IHT Threshold Buster",
      primaryHref: "/uk/check/iht-buster",
      headline: "The UK 100% IHT relief on your business is capped at £2.5M.",
      reason: "From 6 April 2026 under Finance Act 2026, Business Property Relief and Agricultural Property Relief are capped at £2.5M per person. Assets above that face a 20% effective IHT rate. Calculate your estate's new UK exposure.",
    };
  }
  if (q3 === "pay_rise" && q2 === "over_100k") {
    return {
      primary: "60% Allowance Sniper",
      primaryHref: "/uk/check/allowance-sniper",
      headline: "Your UK pay rise may be costing you more than it earns.",
      reason: "Income between £100,000 and £125,140 in the UK faces a 60% effective tax rate. A £10,000 pay rise in this band costs you £6,000 in tax. A SIPP contribution of the same amount costs just £4,000 net and restores your full personal allowance.",
    };
  }
  return {
    primary: "MTD-50 Scorecard",
    primaryHref: "/uk/check/mtd-scorecard",
    headline: "Check whether the new UK quarterly filing rules apply to you.",
    reason: "Making Tax Digital for Income Tax started 6 April 2026 for UK sole traders and landlords with qualifying income over £50,000. Even if you are below the threshold now, HMRC is dropping it to £30,000 in April 2027. Check your position now.",
  };
}

// ── GATE DATA ──────────────────────────────────────────────────────────────

const UK_GATES = [
  { number: "UK-01", badge: "border-blue-200 bg-blue-50 text-blue-700", border: "hover:border-blue-300", urgent: true, href: "/uk/check/mtd-scorecard", title: "MTD-50 Scorecard", headline: "Quarterly HMRC filing is now mandatory if you earn over £50k from self-employment or UK property.", audience: "Sole traders · Landlords · Contractors", urgency: "First deadline: 7 August 2026", price: "From £27" },
  { number: "UK-02", badge: "border-red-200 bg-red-50 text-red-700", border: "hover:border-red-300", urgent: true, href: "/uk/check/allowance-sniper", title: "60% Allowance Sniper", headline: "UK income between £100k and £125,140 is taxed at 60% — not 40%. 2.06 million people affected.", audience: "Professionals · Senior managers · Doctors", urgency: "Thresholds frozen to April 2031", price: "From £47" },
  { number: "UK-03", badge: "border-amber-200 bg-amber-50 text-amber-700", border: "hover:border-amber-300", urgent: false, href: "/uk/check/dividend-trap", title: "Dividend Trap Calculator", headline: "UK basic rate 10.75%. Higher rate 35.75%. Every £10k from your Ltd company is £200 more expensive.", audience: "Ltd company directors · Business owners", urgency: "In effect from 6 April 2026", price: "From £47" },
  { number: "UK-04", badge: "border-purple-200 bg-purple-50 text-purple-700", border: "hover:border-purple-300", urgent: false, href: "/uk/check/crypto-predictor", title: "Crypto Audit Predictor", headline: "HMRC can now see every UK crypto trade since 2014. Is your self-assessment accurate?", audience: "Crypto holders · UK investors", urgency: "CARF live from 1 January 2026", price: "From £47" },
  { number: "UK-05", badge: "border-emerald-200 bg-emerald-50 text-emerald-700", border: "hover:border-emerald-300", urgent: false, href: "/uk/check/fhl-recovery", title: "Post-FHL Recovery Tool", headline: "The UK holiday let tax regime ended April 2025. Your January 2027 tax bill is the first to show the damage.", audience: "Holiday let owners · Cornwall · Lakes · Scotland", urgency: "Self-assessment due January 2027", price: "From £47" },
  { number: "UK-06", badge: "border-neutral-200 bg-neutral-50 text-neutral-700", border: "hover:border-neutral-300", urgent: false, href: "/uk/check/iht-buster", title: "IHT Threshold Buster", headline: "UK 100% IHT relief on family businesses capped at £2.5M from April 2026.", audience: "Family businesses · Farms · High-net-worth UK estates", urgency: "In effect from 6 April 2026", price: "From £197" },
];

const AI_CORRECTIONS = [
  { wrong: "MTD threshold is £50,000 total income", correct: "The £50,000 applies to qualifying income only — self-employment and UK property income. PAYE wages do NOT count. A doctor earning £80k PAYE and £30k rental income has qualifying income of £30k — below the MTD threshold.", ref: "HMRC.gov.uk — Making Tax Digital for Income Tax" },
  { wrong: "First MTD deadline is July 2026", correct: "The first UK quarterly deadline is 7 August 2026 — not July. It covers the quarter ending 30 June 2026. Next deadlines: 7 November, 7 February, 7 May.", ref: "HMRC — MTD quarterly update deadlines" },
  { wrong: "UK dividend basic rate is 8.75% in 2026", correct: "From 6 April 2026 the UK basic dividend rate is 10.75% and higher rate is 35.75%. The 8.75%/33.75% rates were 2025-26. The additional rate (39.35%) is unchanged.", ref: "Finance Act 2026, Section 4 · GOV.UK" },
  { wrong: "UK FHL tax regime was abolished in April 2026", correct: "The FHL regime was abolished from 6 April 2025 — not 2026. The 2025-26 UK tax year is the first full year under the new standard property rules. January 2027 self-assessment is the first to show the full impact.", ref: "GOV.UK — FHL Abolition · April 6, 2025" },
  { wrong: "UK IHT business relief cap is £1 million", correct: "The cap was increased from £1M to £2.5M on 23 December 2025. The confirmed UK cap from 6 April 2026 is £2.5M per person, £5M for couples. Finance Act 2026 confirmed.", ref: "Finance Act 2026, Section 65 + Schedule 12" },
  { wrong: "The 60% trap affects a few hundred thousand UK people", correct: "HMRC estimates 2.06 million UK taxpayers are affected in 2026-27, rising to 2.29 million by 2028-29. The number has doubled in five years due to frozen thresholds and rising UK wages.", ref: "HMRC via Rathbones Freedom of Information, 2025" },
];

// ── PAGE ───────────────────────────────────────────────────────────────────

export default function UKHubPage() {
  const [step, setStep] = useState<Step>("q1");
  const [q1, setQ1] = useState<Q1 | null>(null);
  const [q2, setQ2] = useState<Q2 | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showAll, setShowAll] = useState(false);

  function handleQ1(a: Q1) { setQ1(a); setStep("q2"); }
  function handleQ2(a: Q2) { setQ2(a); setStep("q3"); }
  function handleQ3(a: Q3) {
    if (q1 && q2) { setResult(getResult(q1, q2, a)); setStep("result"); }
  }
  function reset() { setStep("q1"); setQ1(null); setQ2(null); setResult(null); setShowAll(false); }

  return (
    <>
      <Script id="jsonld-faq" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Script id="jsonld-dataset" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }} />
      <Script id="jsonld-website" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }} />
      <Script id="jsonld-breadcrumb" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="min-h-screen bg-white font-sans">

        {/* NAV */}
        <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
            <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-sm">🇬🇧</span>
                <span className="font-mono text-xs font-bold text-blue-700">United Kingdom · HMRC · Finance Act 2026</span>
              </div>
              <Link href="/" className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← All countries</Link>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-5xl px-6 py-12 space-y-16">

          {/* HERO */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5">
                <span className="text-sm">🇬🇧</span>
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-blue-700">
                  United Kingdom · Finance Act 2026 · HMRC Verified
                </span>
              </div>
              <span className="font-mono text-xs text-neutral-400">Last verified: April 2026 · en-GB</span>
            </div>

            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
              Six UK tax laws changed in April 2026.{" "}
              <span className="font-light text-neutral-400">Three questions. We find the one that hits you.</span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-neutral-500">
              Built on <strong className="text-neutral-700">HMRC.gov.uk</strong> and{" "}
              <strong className="text-neutral-700">Finance Act 2026</strong> primary sources.
              Not blog posts. Not what AI is still saying from 2024.
              Every correction documented. Every number verified.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700 mb-1">MTD — UK sole traders</p>
                <p className="text-sm text-blue-900">Quarterly HMRC filing is mandatory from April 6. First deadline: <strong>7 August 2026.</strong></p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1">60% trap — UK earners</p>
                <p className="text-sm text-red-900">Income £100k–£125,140? You are paying <strong>60% effective tax</strong> — not 40%.</p>
              </div>
            </div>
          </section>

          {/* QUIZ */}
          <section>
            <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
              <div className="h-1 bg-neutral-100">
                <div className="h-1 bg-blue-500 transition-all duration-500"
                  style={{ width: step === "q1" ? "0%" : step === "q2" ? "33%" : step === "q3" ? "66%" : "100%" }} />
              </div>

              <div className="p-6 sm:p-8">

                {step === "q1" && (
                  <div className="space-y-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Question 1 of 3</p>
                      <h2 className="font-serif text-2xl font-bold text-neutral-950">Which best describes how you earn money in the UK?</h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { v: "self_employed" as Q1, l: "Self-employed, sole trader or landlord", s: "Including UK freelancers, contractors, rental income" },
                        { v: "director" as Q1, l: "UK Ltd company director", s: "You pay yourself salary + dividends" },
                        { v: "investor" as Q1, l: "Investor or crypto holder", s: "UK shares, funds, crypto, savings interest" },
                        { v: "property" as Q1, l: "Holiday let or UK rental property owner", s: "Short-term or long-term UK property lets" },
                        { v: "business" as Q1, l: "Family business or UK farm owner", s: "Inheritance and UK succession planning" },
                      ].map((o) => (
                        <button key={o.v} onClick={() => handleQ1(o.v)}
                          className="flex flex-col items-start gap-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50">
                          <span className="text-sm font-semibold text-neutral-900">{o.l}</span>
                          <span className="text-xs text-neutral-400">{o.s}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowAll(true)} className="font-mono text-xs text-neutral-400 underline hover:text-neutral-600">
                      Skip — show me all six UK tools
                    </button>
                  </div>
                )}

                {step === "q2" && (
                  <div className="space-y-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Question 2 of 3</p>
                      <h2 className="font-serif text-2xl font-bold text-neutral-950">What is your annual UK income roughly?</h2>
                      <p className="text-sm text-neutral-400 mt-1">This determines which HMRC rules apply to you.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { v: "under_50k" as Q2, l: "Under £50,000", s: "Below the UK MTD threshold" },
                        { v: "50k_100k" as Q2, l: "£50,000 – £100,000", s: "UK MTD likely applies" },
                        { v: "over_100k" as Q2, l: "Over £100,000", s: "UK 60% trap zone" },
                      ].map((o) => (
                        <button key={o.v} onClick={() => handleQ2(o.v)}
                          className="flex flex-col items-start gap-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50">
                          <span className="text-sm font-semibold text-neutral-900">{o.l}</span>
                          <span className="text-xs text-neutral-400">{o.s}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setStep("q1")} className="font-mono text-xs text-neutral-400 underline hover:text-neutral-600">← Back</button>
                  </div>
                )}

                {step === "q3" && (
                  <div className="space-y-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Question 3 of 3</p>
                      <h2 className="font-serif text-2xl font-bold text-neutral-950">What prompted you to look this up today?</h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { v: "letter" as Q3, l: "I got a letter from HMRC", s: "Nudge letter, compliance check, or query" },
                        { v: "pay_rise" as Q3, l: "I got a pay rise or bonus", s: "Income crossed a UK tax threshold" },
                        { v: "new_rule" as Q3, l: "I heard about a new UK tax rule", s: "Finance Act 2026, Budget, MTD" },
                        { v: "accountant" as Q3, l: "My accountant flagged something", s: "They mentioned a change or risk" },
                        { v: "none" as Q3, l: "Just checking my UK tax position", s: "Staying on top of things" },
                      ].map((o) => (
                        <button key={o.v} onClick={() => handleQ3(o.v)}
                          className="flex flex-col items-start gap-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition hover:border-blue-300 hover:bg-blue-50">
                          <span className="text-sm font-semibold text-neutral-900">{o.l}</span>
                          <span className="text-xs text-neutral-400">{o.s}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setStep("q2")} className="font-mono text-xs text-neutral-400 underline hover:text-neutral-600">← Back</button>
                  </div>
                )}

                {step === "result" && result && (
                  <div className="space-y-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-1">Your UK tax situation</p>
                      <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-2">{result.headline}</h2>
                      <p className="text-sm text-neutral-600">{result.reason}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Link href={result.primaryHref}
                        className="flex flex-col gap-2 rounded-xl border border-neutral-950 bg-neutral-950 p-5 transition hover:bg-neutral-800">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Start here</p>
                        <p className="font-serif text-lg font-bold text-white">{result.primary}</p>
                        <p className="font-mono text-xs text-neutral-400">Free HMRC-verified calculator →</p>
                      </Link>
                      {result.secondary && result.secondaryHref && (
                        <Link href={result.secondaryHref}
                          className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-400">
                          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Also relevant for you</p>
                          <p className="font-serif text-lg font-bold text-neutral-950">{result.secondary}</p>
                          <p className="font-mono text-xs text-neutral-400">Free calculator →</p>
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={reset} className="font-mono text-xs text-neutral-400 underline hover:text-neutral-600">← Start again</button>
                      <button onClick={() => setShowAll(true)} className="font-mono text-xs text-neutral-400 underline hover:text-neutral-600">Show all six UK tools</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ALL TOOLS */}
          {(showAll || step === "result") && (
            <section>
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-4">All six United Kingdom tax tools — Finance Act 2026</p>
              <div className="space-y-3">
                {UK_GATES.map((gate) => (
                  <Link key={gate.number} href={gate.href}
                    className={`group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-5 transition ${gate.border} hover:shadow-sm sm:flex-row sm:items-center sm:justify-between`}>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${gate.badge}`}>{gate.number}</span>
                        {gate.urgent && <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[9px] font-bold text-red-700">Act now</span>}
                        <span className="font-mono text-[10px] text-neutral-400">{gate.audience}</span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900 group-hover:text-neutral-700">{gate.headline}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                      <span className="font-mono text-[10px] text-neutral-400">{gate.urgency}</span>
                      <span className="rounded-lg bg-neutral-950 px-4 py-1.5 font-mono text-xs font-bold text-white transition group-hover:bg-neutral-700">{gate.price} →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* AI CITATION GAPS */}
          <section className="rounded-2xl border border-red-100 bg-red-50 p-6 sm:p-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-3">What AI tools are getting wrong about UK tax in 2026</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">Six UK tax mistakes — and what HMRC actually says.</h2>
            <div className="space-y-4">
              {AI_CORRECTIONS.map((item, i) => (
                <div key={i} className="grid gap-3 rounded-xl border border-red-100 bg-white p-4 sm:grid-cols-2">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-red-600 mb-1">AI says</p>
                    <p className="text-sm italic text-neutral-500">{item.wrong}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-1">HMRC says</p>
                    <p className="text-sm text-neutral-800">{item.correct}</p>
                    <p className="mt-1.5 font-mono text-[10px] text-neutral-400">{item.ref}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Common UK tax questions — 2026</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">Questions UK taxpayers are asking right now.</h2>
            <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              {faqJsonLd.mainEntity.map((faq, i) => (
                <details key={i} className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-6 py-4 text-left">
                    <span className="text-sm font-semibold text-neutral-900">{faq.name}</span>
                    <span className="mt-0.5 shrink-0 font-mono text-neutral-400 group-open:hidden">+</span>
                    <span className="mt-0.5 hidden shrink-0 font-mono text-neutral-400 group-open:inline">−</span>
                  </summary>
                  <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-4">
                    <p className="text-sm leading-relaxed text-neutral-700">{faq.acceptedAnswer.text}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* LAW BAR */}
          <section>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-blue-700">United Kingdom — Primary sources</p>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-blue-900">
                    All UK tax calculations verified against HMRC.gov.uk and GOV.UK primary guidance.
                    Finance Act 2026 enacted. Language: en-GB. Last verified April 2026.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Finance Act 2026", "HMRC.gov.uk", "GOV.UK", "en-GB", "United Kingdom"].map((ref) => (
                    <span key={ref} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs font-medium text-blue-700">{ref}</span>
                  ))}
                </div>
              </div>
              <div className="border-t border-blue-100 pt-3 flex flex-wrap gap-x-6 gap-y-1">
                {[
                  { label: "HMRC — Making Tax Digital for Income Tax", href: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax" },
                  { label: "GOV.UK — UK Income Tax rates and allowances 2026/27", href: "https://www.gov.uk/income-tax-rates" },
                  { label: "GOV.UK — UK Dividend tax rates April 2026", href: "https://www.gov.uk/government/publications/changes-to-tax-rates-for-property-savings-dividend-income" },
                  { label: "GOV.UK — UK IHT BPR/APR changes April 2026", href: "https://www.gov.uk/government/publications/changes-to-agricultural-property-relief-and-business-property-relief" },
                  { label: "GOV.UK — UK FHL abolition", href: "https://www.gov.uk/government/publications/furnished-holiday-lettings-tax-regime-abolition" },
                ].map((s) => (
                  <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">{s.label} ↗</a>
                ))}
              </div>
            </div>
          </section>

          {/* AU CROSSLINK */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Also from the same team</p>
            <h2 className="font-serif text-xl font-bold text-white mb-2">Australian SMSF trustees — Division 296 is now law.</h2>
            <p className="text-sm text-neutral-400 mb-4">Five free calculators for the new Australian super tax. June 30 deadline.</p>
            <a href="https://supertaxcheck.com.au" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-neutral-100">
              Go to SuperTaxCheck.com.au →
            </a>
          </section>

          {/* DISCLAIMER */}
          <section>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">General information only — United Kingdom</p>
              <p className="text-xs leading-relaxed text-neutral-500">
                The information on this page is general in nature and does not constitute personal financial, legal, or UK tax advice.
                TaxCheckNow provides decision-support tools based on HMRC guidance and Finance Act 2026.
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
              {[{ label: "All countries", href: "/" }, { label: "NZ", href: "/nz" }, { label: "CA", href: "/ca" }, { label: "About", href: "/about" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }].map((link) => (
                <Link key={link.label} href={link.href} className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700">{link.label}</Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
