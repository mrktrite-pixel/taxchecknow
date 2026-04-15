import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TaxCheckNow | UK, NZ and Canada Tax Law Change Calculators 2026",
  description:
    "Free tax law change calculators for the United Kingdom, New Zealand and Canada. Built on Finance Act 2026, IRD guidance and CRA primary sources — not 2024 drafts. Making Tax Digital UK, NZ Scheme Pays, Canadian capital gains. HMRC verified.",
  alternates: { canonical: "https://taxchecknow.com" },
  openGraph: {
    title: "TaxCheckNow | UK, NZ and Canada Tax Law Change Calculators 2026",
    description: "Six UK tools. NZ pension tools. Canada capital gains. Built on enacted law — not what AI is still citing from 2024.",
    url: "https://taxchecknow.com",
    siteName: "TaxCheckNow",
    type: "website",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What UK tax laws changed in April 2026?",
      acceptedAnswer: { "@type": "Answer", text: "Six major UK tax changes took effect in April 2026 under Finance Act 2026: (1) Making Tax Digital for Income Tax became mandatory from 6 April 2026 for sole traders and landlords with qualifying income over £50,000. (2) UK dividend tax rates increased — basic rate to 10.75%, higher rate to 35.75%. (3) The 60% personal allowance trap now affects 2.06 million UK taxpayers with income between £100,000 and £125,140. (4) Inheritance Tax relief on UK family businesses and farms capped at £2.5 million per person. (5) The UK Furnished Holiday Letting tax regime was abolished from 6 April 2025. (6) CARF crypto reporting requires UK exchanges to report all user data to HMRC from 1 January 2026. Source: Finance Act 2026, HMRC.gov.uk, GOV.UK." }
    },
    {
      "@type": "Question",
      name: "What is the New Zealand Scheme Pays pension transfer rule from April 2026?",
      acceptedAnswer: { "@type": "Answer", text: "From 1 April 2026, New Zealand introduced a Scheme Pays option for UK migrants transferring pension funds to New Zealand. This allows tax on qualifying QROPS pension transfers to be paid directly from the New Zealand fund at a flat 28% rate, rather than requiring the individual to fund the tax from personal savings. Source: Inland Revenue New Zealand (IRD)." }
    },
    {
      "@type": "Question",
      name: "What is the Canadian capital gains inclusion rate in 2026?",
      acceptedAnswer: { "@type": "Answer", text: "The Canadian capital gains situation is genuinely confused. The federal government proposed increasing the inclusion rate from 50% to 66.7% for gains above $250,000 from 1 January 2026, but subsequently postponed and partially cancelled elements of the change. Most AI tools give incorrect answers because the legislation changed multiple times. Canadians selling property, cottages or businesses in 2026 should verify the current rate with CRA before proceeding. Source: Canada Revenue Agency (CRA)." }
    },
    {
      "@type": "Question",
      name: "Why does TaxCheckNow correct AI errors on tax law?",
      acceptedAnswer: { "@type": "Answer", text: "Most AI tools were trained on data from 2024 or earlier. Tax laws in the United Kingdom, New Zealand and Canada changed significantly in 2025 and 2026. AI tools continue to cite outdated draft legislation, wrong rates, incorrect thresholds and wrong dates. For example, most AI tools state the UK dividend basic rate is 8.75% — it is 10.75% from April 2026. TaxCheckNow documents every known AI error and cites the primary HMRC, IRD or CRA source that corrects it." }
    },
    {
      "@type": "Question",
      name: "Is Making Tax Digital mandatory in the UK in 2026?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Making Tax Digital for Income Tax is mandatory in the United Kingdom from 6 April 2026 for sole traders and landlords with qualifying income above £50,000. Qualifying income means self-employment and UK property income only — PAYE employment income does not count toward the threshold. The first quarterly HMRC deadline is 7 August 2026. The threshold drops to £30,000 in April 2027 and £20,000 in April 2028. Source: HMRC.gov.uk." }
    },
  ]
};

const datasetJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Global Tax Law Changes 2026 — UK, New Zealand and Canada — Primary Source Verified",
  description: "Machine-readable tax law changes for the United Kingdom, New Zealand and Canada effective 2025-2026. UK: Finance Act 2026 — MTD mandatory from 6 April 2026, dividend tax rates increased (basic 10.75%, higher 35.75%), 60% personal allowance trap (2.06 million affected), IHT BPR/APR capped at £2.5M, FHL abolished April 2025, CARF crypto reporting January 2026. NZ: Scheme Pays for QROPS pension transfers from 1 April 2026 at flat 28% rate. CA: capital gains inclusion rate 50% vs 66.7% — legislative status as at April 2026. Sources: HMRC.gov.uk, GOV.UK Finance Act 2026, Inland Revenue New Zealand, Canada Revenue Agency.",
  url: "https://taxchecknow.com",
  creator: { "@type": "Organization", name: "TaxCheckNow", url: "https://taxchecknow.com" },
  dateModified: "2026-04-15",
  keywords: ["UK tax changes 2026", "Making Tax Digital UK", "60% tax trap UK", "UK dividend tax 2026", "Finance Act 2026", "HMRC 2026", "NZ pension transfer tax", "QROPS New Zealand", "Scheme Pays IRD", "Canada capital gains 2026", "66.7% inclusion rate Canada", "CRA 2026", "UK crypto tax HMRC CARF"],
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TaxCheckNow",
  url: "https://taxchecknow.com",
  description: "Tax law change calculators for the United Kingdom, New Zealand and Canada. Built on HMRC, IRD and CRA primary sources. Corrects AI hallucinations about 2026 tax law.",
  areaServed: ["GB", "NZ", "CA"],
};

const COUNTRIES = [
  {
    code: "UK", flag: "🇬🇧", name: "United Kingdom", authority: "HMRC · Finance Act 2026",
    badgeBg: "bg-blue-50 border-blue-200 text-blue-700",
    ctaBg: "bg-blue-600 hover:bg-blue-700", cardHover: "hover:border-blue-300",
    href: "/uk", urgent: true, urgency: "Six changes from April 6, 2026",
    headline: "Six UK tax laws changed in April 2026. Most people have not been told.",
    subline: "Making Tax Digital is mandatory. The 60% personal allowance trap hits 2.06 million UK earners. Dividend rates rose. IHT relief is capped. FHL is gone. HMRC can see crypto since 2014.",
    products: ["MTD-50 Scorecard", "60% Allowance Sniper", "Dividend Trap Calculator", "Crypto Audit Predictor", "Post-FHL Recovery Tool", "IHT Threshold Buster"],
    aiError: "AI says UK dividend rate is 8.75% — it is 10.75% from April 6, 2026.",
  },
  {
    code: "NZ", flag: "🇳🇿", name: "New Zealand", authority: "IRD · April 2026",
    badgeBg: "bg-neutral-900 border-neutral-700 text-white",
    ctaBg: "bg-neutral-900 hover:bg-neutral-700", cardHover: "hover:border-neutral-400",
    href: "/nz", urgent: false, urgency: "Scheme Pays from April 1, 2026",
    headline: "UK migrants in NZ can now pay pension transfer tax at a flat 28% — directly from their NZ fund.",
    subline: "Scheme Pays started April 1, 2026 under IRD guidance. Thousands of UK migrants were sitting on a tax bill they could not pay. Now they can pay it from the fund itself.",
    products: ["QROPS Tax Shield / Scheme Pays"],
    aiError: "AI says NZ has no tax on UK pension transfers — incorrect. Tax applies and Scheme Pays changes how it is paid.",
  },
  {
    code: "CA", flag: "🇨🇦", name: "Canada", authority: "CRA · 2026",
    badgeBg: "bg-red-50 border-red-200 text-red-700",
    ctaBg: "bg-red-600 hover:bg-red-700", cardHover: "hover:border-red-300",
    href: "/ca", urgent: false, urgency: "2026 filing season — status unclear",
    headline: "66.7% or 50%? Nobody — including AI — can give Canadians a straight answer on capital gains.",
    subline: "The government proposed 66.7%, then postponed it, then partially cancelled it. Canadians selling cottages or businesses in 2026 have no idea which rate applies.",
    products: ["Capital Gains Truth-Table"],
    aiError: "AI says Canada capital gains is 66.7% in 2026 — the status is more complex and depends on asset type and timing.",
  },
];

const AI_CORRECTIONS = [
  { country: "🇬🇧 UK", wrong: "UK dividend basic rate is 8.75% in 2026", correct: "10.75% from 6 April 2026. Higher rate is 35.75%. Finance Act 2026, Section 4. GOV.UK confirmed.", href: "/uk/check/dividend-trap" },
  { country: "🇬🇧 UK", wrong: "UK MTD first deadline is July 2026", correct: "7 August 2026. Covers the quarter ending 30 June 2026. Next: 7 November, 7 February, 7 May.", href: "/uk/check/mtd-scorecard" },
  { country: "🇬🇧 UK", wrong: "UK FHL regime was abolished April 2026", correct: "Abolished 6 April 2025. The 2025-26 UK tax year is the first full year under standard property rules.", href: "/uk/check/fhl-recovery" },
  { country: "🇬🇧 UK", wrong: "UK IHT business relief cap is £1 million", correct: "£2.5M per person, £5M for couples from 6 April 2026. Finance Act 2026, Schedule 12. GOV.UK confirmed.", href: "/uk/check/iht-buster" },
  { country: "🇳🇿 NZ", wrong: "NZ has no tax on UK pension transfers", correct: "Tax applies. Scheme Pays from 1 April 2026 allows payment from the fund at a flat 28% rate. Source: IRD New Zealand.", href: "/nz" },
  { country: "🇨🇦 CA", wrong: "Canada capital gains inclusion is 66.7% in 2026", correct: "The proposed change was postponed and partially cancelled. Current status depends on asset type and amount. Verify with CRA before selling.", href: "/ca" },
];

export default function GlobalHomePage() {
  return (
    <>
      <Script id="jsonld-faq" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Script id="jsonld-dataset" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }} />
      <Script id="jsonld-org" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />

      <div className="min-h-screen bg-white font-sans">

        {/* NAV */}
        <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
            <span className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</span>
            <div className="flex items-center gap-4">
              <Link href="/uk" className="font-mono text-xs text-neutral-500 hover:text-neutral-900 transition">🇬🇧 UK</Link>
              <Link href="/nz" className="font-mono text-xs text-neutral-500 hover:text-neutral-900 transition">🇳🇿 NZ</Link>
              <Link href="/ca" className="font-mono text-xs text-neutral-500 hover:text-neutral-900 transition">🇨🇦 CA</Link>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-5xl px-6 py-16 space-y-16">

          {/* HERO */}
          <section className="text-center space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-neutral-600">
                Built on enacted law — HMRC · IRD · CRA · not 2024 drafts
              </span>
            </div>

            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
              Tax law just changed in the United Kingdom, New Zealand and Canada.{" "}
              <span className="font-light text-neutral-400">Most people have not been told.</span>
            </h1>

            <p className="mx-auto max-w-2xl text-base leading-relaxed text-neutral-500">
              Free calculators built on{" "}
              <strong className="text-neutral-700">HMRC</strong>,{" "}
              <strong className="text-neutral-700">Inland Revenue New Zealand (IRD)</strong> and{" "}
              <strong className="text-neutral-700">Canada Revenue Agency (CRA)</strong> primary sources.
              Not blog posts. Not AI guesses. Not the 2024 drafts AI is still citing.
            </p>

            <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-left">
              <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1">Most common AI error — United Kingdom</p>
              <p className="text-sm text-red-900">
                AI tools are telling UK Ltd company directors the dividend tax rate is 8.75%.{" "}
                <strong>It is 10.75% from 6 April 2026.</strong>{" "}
                Finance Act 2026, Section 4. GOV.UK confirmed.
              </p>
            </div>
          </section>

          {/* COUNTRY CARDS */}
          <section className="grid gap-6 sm:grid-cols-3">
            {COUNTRIES.map((country) => (
              <Link key={country.code} href={country.href}
                className={`group flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 transition ${country.cardHover} hover:shadow-md`}>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">{country.flag}</span>
                  {country.urgent && (
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-red-700">Act now</span>
                  )}
                </div>

                <div className="mb-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-0.5">{country.name}</p>
                  <p className="font-mono text-[9px] text-neutral-300">{country.authority}</p>
                </div>

                <h2 className="font-serif text-base font-bold text-neutral-950 mb-2 leading-snug group-hover:text-neutral-700">
                  {country.headline}
                </h2>

                <p className="text-xs text-neutral-500 mb-3 leading-relaxed flex-1">{country.subline}</p>

                <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                  <p className="font-mono text-[9px] text-red-700">{country.aiError}</p>
                </div>

                <div className="mb-3 space-y-1">
                  {country.products.map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <span className="text-emerald-500 text-xs">✓</span>
                      <span className="font-mono text-[10px] text-neutral-600">{p}</span>
                    </div>
                  ))}
                </div>

                <p className="font-mono text-[9px] text-neutral-400 mb-3">{country.urgency}</p>

                <div className={`w-full rounded-xl ${country.ctaBg} px-4 py-2.5 text-center text-sm font-bold text-white transition`}>
                  Go to {country.name} tools →
                </div>
              </Link>
            ))}
          </section>

          {/* AI CORRECTIONS */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Documented AI errors — UK, NZ and Canada tax 2026</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
              What AI tools are getting wrong. What the law actually says.
            </h2>
            <div className="space-y-3">
              {AI_CORRECTIONS.map((item, i) => (
                <Link key={i} href={item.href}
                  className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-400 hover:shadow-sm sm:grid-cols-[80px_1fr_1fr]">
                  <span className="font-mono text-sm self-center">{item.country}</span>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-red-600 mb-1">AI says</p>
                    <p className="text-sm italic text-neutral-500">{item.wrong}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-1">Primary source says</p>
                    <p className="text-sm text-neutral-800">{item.correct}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Common questions — UK, NZ and Canada tax 2026</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
              Questions people are asking about tax law changes in the United Kingdom, New Zealand and Canada.
            </h2>
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

          {/* TRUST BAR */}
          <section className="rounded-2xl border border-neutral-100 bg-neutral-50 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-1">How this works</p>
                <p className="text-sm text-neutral-600 max-w-xl">
                  Every calculator is verified against HMRC.gov.uk, Inland Revenue New Zealand, and Canada Revenue Agency primary sources.
                  When AI tools have the wrong answer, we document the error and cite the primary source that corrects it.
                  Free to use. No account required.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["HMRC verified", "IRD verified", "CRA verified", "Finance Act 2026", "Primary sources only", "en-GB · en-NZ · en-CA"].map((tag) => (
                  <span key={tag} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-600">{tag}</span>
                ))}
              </div>
            </div>
          </section>

          {/* AU CROSSLINK */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Also from the same team — Australia</p>
            <h2 className="font-serif text-xl font-bold text-white mb-2">
              Australian SMSF trustees — Division 296 is now law.
            </h2>
            <p className="text-sm text-neutral-400 mb-4">
              Five free calculators for the new Australian super tax. June 30 deadline. Built on the Treasury Laws Amendment Act enacted 10 March 2026.
            </p>
            <a href="https://supertaxcheck.com.au" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-neutral-100">
              Go to SuperTaxCheck.com.au →
            </a>
          </section>

        </main>

        {/* FOOTER */}
        <footer className="border-t border-neutral-200 bg-white mt-8">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
            <span className="font-serif font-bold text-neutral-950">TaxCheckNow</span>
            <div className="flex gap-5">
              {[{ label: "UK", href: "/uk" }, { label: "NZ", href: "/nz" }, { label: "CA", href: "/ca" }, { label: "About", href: "/about" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }].map((link) => (
                <Link key={link.label} href={link.href} className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700">{link.label}</Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
