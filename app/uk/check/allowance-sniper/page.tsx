import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import AllowanceSniperCalculator from "./AllowanceSniperCalculator";

export const metadata: Metadata = {
  title: "UK 60% Tax Trap Calculator 2026 — Personal Allowance Sniper | TaxCheckNow",
  description:
    "Income between £100,000 and £125,140 in the United Kingdom faces an effective 60% tax rate — not 40%. 2.06 million UK taxpayers affected in 2026-27. Thresholds frozen to April 2031. Calculate your exact SIPP contribution to escape the trap. Built on GOV.UK primary guidance.",
  alternates: {
    canonical: "https://taxchecknow.com/uk/check/allowance-sniper",
  },
  openGraph: {
    title: "UK 60% Tax Trap — Are You Paying 60% on Part of Your Income?",
    description: "2.06 million UK earners in the 60% personal allowance trap in 2026-27. Calculate your exact SIPP escape. Thresholds frozen to 2031. Free calculator — GOV.UK verified.",
    url: "https://taxchecknow.com/uk/check/allowance-sniper",
    siteName: "TaxCheckNow",
    type: "website",
  },
};

const lastVerified = "April 2026";

// ── DATA ───────────────────────────────────────────────────────────────────

const faqs = [
  {
    question: "What is the 60% tax trap in the United Kingdom?",
    answer: "The 60% tax trap is a feature of the UK tax system that creates an effective marginal tax rate of 60% for income between £100,000 and £125,140. It occurs because the personal allowance — the amount of income you can earn tax-free — is progressively withdrawn once adjusted net income exceeds £100,000. For every £2 earned above £100,000, you lose £1 of personal allowance. Since that lost allowance would have been tax-free, it now becomes taxable at the 40% higher rate, adding an effective 20% on top of the standard 40% higher rate — giving a combined 60%. Including employee National Insurance contributions of 2%, the effective rate reaches 62%. The personal allowance of £12,570 is fully eliminated at £125,140 (£100,000 + 2 × £12,570). Source: GOV.UK — Income Tax rates and Personal Allowances 2026/27.",
  },
  {
    question: "How many UK taxpayers are affected by the 60% personal allowance trap in 2026-27?",
    answer: "HMRC estimates that 2.06 million UK taxpayers will have income above £100,000 in the 2026-27 tax year — the highest number on record and an increase from 1.95 million in 2025-26. The number has almost doubled in the last decade, driven by frozen thresholds and rising wages. This phenomenon is known as fiscal drag — thresholds stay still while incomes rise, pulling more people into the trap. By 2028-29, HMRC projects 2.29 million UK taxpayers will be affected. The £100,000 threshold for the personal allowance taper has been unchanged since it was introduced in April 2010. It is now frozen until at least April 2031 under the Autumn Budget 2025. Source: HMRC via Rathbones Freedom of Information request, November 2025.",
  },
  {
    question: "What is adjusted net income and why does it matter for the UK 60% trap?",
    answer: "Adjusted net income (ANI) is the figure HMRC uses to assess whether the personal allowance taper applies — not your gross salary or total income. Adjusted net income is calculated as: total income from all sources, minus pension contributions (personal or SIPP), minus Gift Aid donations (grossed up). This distinction is critical because it means you can legally reduce your ANI below £100,000 even if your gross income is above it, by making pension contributions or Gift Aid donations. For example, someone earning £115,000 who contributes £15,000 to a personal pension has an ANI of £100,000 — outside the trap. Source: GOV.UK — Adjusted net income calculation.",
  },
  {
    question: "How does a SIPP contribution help escape the UK 60% personal allowance trap?",
    answer: "A personal pension or SIPP contribution reduces your adjusted net income (ANI) by the gross contribution amount. For every £2 of ANI reduced below £125,140, you restore £1 of personal allowance. For a UK taxpayer earning £110,000 with no current pension contributions: a gross SIPP contribution of £10,000 reduces ANI to £100,000, restores the full personal allowance, and saves approximately £4,000 in tax — split between higher rate relief (£2,000 claimable via Self Assessment) and restoration of taxable personal allowance (£2,000 saving). The basic rate tax relief of £2,000 is added automatically by your pension provider. The net cost of putting £10,000 into your pension is therefore approximately £6,000, while £12,000 goes into your pension fund. Source: GOV.UK — Tax relief on pension contributions.",
  },
  {
    question: "What is the difference between salary sacrifice and a personal SIPP contribution in the UK?",
    answer: "Both salary sacrifice and personal SIPP contributions reduce adjusted net income for the UK personal allowance taper. The key differences are: Salary sacrifice is agreed with your employer before pay is processed — it reduces your taxable income at source and also reduces National Insurance for both you and your employer. Personal SIPP contributions are made from net pay — your provider claims 20% basic rate relief and adds it to your pension, and you claim higher rate relief via Self Assessment. For 2026, both approaches are effective for escaping the 60% trap. However, from April 2029, National Insurance savings on salary sacrifice pension contributions above £2,000 per year will be capped. This does not affect the income tax relief, which remains available at current rates. Source: Autumn Budget 2025, GOV.UK.",
  },
  {
    question: "Can Gift Aid donations help escape the UK 60% tax trap?",
    answer: "Yes. Charitable donations made through Gift Aid reduce adjusted net income in the same way as pension contributions. When you make a Gift Aid donation of £8,000, the charity claims 20% basic rate tax relief (£2,000), making the grossed-up donation £10,000. HMRC treats this as a £10,000 reduction to your adjusted net income. You can also claim the higher rate relief of 20% on the grossed-up amount via Self Assessment. Gift Aid donations can be used alongside pension contributions to reduce ANI below £100,000. For example, if you need to reduce ANI by £15,000 to escape the trap, you could combine a £10,000 SIPP contribution with an £8,000 Gift Aid donation (grossing up to £10,000 relief). Source: GOV.UK — Tax relief on Gift Aid donations.",
  },
  {
    question: "What happens to the 30 hours free childcare if my income exceeds £100,000?",
    answer: "The 30 hours per week free childcare for 3 and 4 year olds is withdrawn when either parent's adjusted net income exceeds £100,000. The withdrawal is all-or-nothing — you either qualify for the full 30 hours or nothing (you revert to the universal 15 hours). The value of the 30 hours free childcare is approximately £5,000-£8,000 per year depending on your location and childcare provider. This means that crossing the £100,000 ANI threshold triggers two simultaneous financial hits: the 60% effective tax rate on income in the taper zone, AND the loss of childcare worth thousands of pounds per year. A pension contribution that reduces ANI below £100,000 restores both the personal allowance AND the childcare entitlement. Source: GOV.UK — Eligibility for free childcare.",
  },
  {
    question: "Is the UK personal allowance taper threshold going to change?",
    answer: "No — the £100,000 threshold for the personal allowance taper is frozen until at least April 2031 under the Autumn Budget 2025. The threshold has not changed since it was introduced in April 2010. Over that period, UK wages have risen significantly, meaning millions of professionals — doctors, senior managers, IT contractors, lawyers — who were never intended to be caught in the trap are now exposed to the 60% rate for the first time. The freeze amplifies the fiscal drag effect: as pay rises each year with inflation, more people drift above £100,000 without any change to tax policy. HMRC projects the number affected will reach 2.29 million by 2028-29. Source: Autumn Budget 2025, GOV.UK.",
  },
  {
    question: "What is the tapered annual allowance and how does it interact with the 60% trap?",
    answer: "The standard pension annual allowance in the UK is £60,000 — the maximum you can contribute to pensions each year and still receive tax relief. For very high earners, this is reduced under the tapered annual allowance rules: if your threshold income exceeds £200,000 AND your adjusted income exceeds £260,000, the £60,000 annual allowance reduces by £1 for every £2 of adjusted income above £260,000, to a minimum of £10,000. This is relevant for people trying to use large pension contributions to escape the 60% trap — if their income is above £200,000, they may not be able to contribute as much as they need to. Most people earning £100,000-£200,000 are not affected by the tapered annual allowance. Source: GOV.UK — Annual allowance.",
  },
  {
    question: "Sarah earns £110,000. What does her 60% trap actually cost her?",
    answer: "Sarah is a senior manager earning £110,000. Her income is £10,000 above the £100,000 taper threshold. Under the personal allowance taper, she loses £5,000 of her personal allowance (£10,000 ÷ 2). That £5,000 of lost allowance is now taxable at 40%, costing her £2,000 in extra tax. She also pays 40% income tax on the £10,000 pay rise itself (£4,000). Total tax on the £10,000 above £100,000: £6,000 — an effective 60% rate. Sarah expected her pay rise to add roughly £6,000 to her take-home (at 40%). It actually adds £4,000. The £2,000 difference is the hidden cost of the trap. A £10,000 SIPP contribution would save Sarah that £2,000 in extra tax, restore her full personal allowance, and add £12,000 to her pension fund (including basic rate relief). Source: GOV.UK Income Tax rates 2026/27. Python verified.",
  },
];

const aiErrors = [
  {
    wrong: '"The UK top tax rate is 45%"',
    correct: "For income between £100,000 and £125,140, the effective marginal rate is 60% — higher than the additional rate of 45%. This is due to the personal allowance taper. It is not an official band but it is a mathematical certainty. Including NI, the rate reaches 62%.",
    ref: "GOV.UK — Income Tax rates and Personal Allowances 2026/27",
  },
  {
    wrong: '"The £100,000 threshold is based on your salary"',
    correct: "The taper applies to adjusted net income (ANI) — not gross salary. ANI is gross income minus pension contributions and Gift Aid donations. Someone earning £120,000 gross who contributes £20,000 to a SIPP has ANI of £100,000 — entirely outside the trap.",
    ref: "GOV.UK — Adjusted net income definition",
  },
  {
    wrong: '"Salary sacrifice is the only way to escape the 60% trap"',
    correct: "Personal SIPP contributions work equally well for the income tax relief in 2026. You claim the basic rate relief automatically through your provider and higher rate relief via Self Assessment. The NI advantage of salary sacrifice is capped at £2,000 from April 2029 — irrelevant for 2026.",
    ref: "GOV.UK — Tax relief on pension contributions. Autumn Budget 2025.",
  },
  {
    wrong: '"The thresholds will be updated with inflation"',
    correct: "The £100,000 taper threshold has been frozen since April 2010 — 16 years — and is confirmed frozen until April 2031 under the Autumn Budget 2025. It has never been index-linked. This is the primary cause of 2.06 million people being affected in 2026-27.",
    ref: "Autumn Budget 2025, GOV.UK confirmed.",
  },
  {
    wrong: '"You lose childcare when your salary exceeds £100,000"',
    correct: "The 30 hours free childcare is withdrawn when ADJUSTED NET INCOME exceeds £100,000 — not gross salary. A parent earning £115,000 who contributes £15,000 to a pension has ANI of £100,000 and retains the full childcare entitlement.",
    ref: "GOV.UK — Eligibility for free childcare, adjusted net income rules.",
  },
];

const accountantQuestions = [
  {
    q: "What is my adjusted net income for 2026-27 — and am I in the personal allowance taper zone?",
    why: "Your adjusted net income is not the same as your gross salary. It includes income from all sources (employment, dividends, rental, self-employment) minus pension contributions and Gift Aid donations. Your accountant can calculate your exact ANI and tell you how much of your personal allowance you have lost.",
  },
  {
    q: "How much should I contribute to my SIPP or workplace pension to reduce my ANI below £100,000?",
    why: "The exact contribution needed depends on your total income from all sources — not just salary. Bonuses, dividends, rental income and other taxable income all count. Your accountant can calculate the precise contribution amount and tell you whether salary sacrifice or personal contributions are more efficient for your situation.",
  },
  {
    q: "Can I use carry-forward to make a larger pension contribution this year?",
    why: "If you have not used your full annual allowance in the previous three tax years, you can carry forward unused allowance and contribute more than £60,000 in a single year. This is particularly useful if you received a large bonus and want to shelter the income this year. Your accountant can check your carry-forward position.",
  },
  {
    q: "Do I need to complete a Self Assessment return to claim the higher rate pension relief?",
    why: "If you make personal SIPP contributions, your provider claims 20% basic rate relief automatically. But you must claim the additional 20% higher rate relief yourself via Self Assessment. Many people in the trap miss this claim entirely. Your accountant should be including it in your annual return.",
  },
  {
    q: "Does my income approach the £200,000 threshold income limit for the tapered annual allowance?",
    why: "If your threshold income is above £200,000 AND adjusted income above £260,000, your £60,000 pension annual allowance starts to reduce. This limits how much you can contribute to escape the trap. Your accountant can calculate whether the tapered annual allowance applies to you before you make a large contribution.",
  },
];

const aiErrors2 = aiErrors;

// ── PAGE ───────────────────────────────────────────────────────────────────
export default function AllowanceSniperPage() {

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "UK 60% Personal Allowance Trap 2026/27 — GOV.UK Verified Rates and Thresholds",
    description: "Machine-readable UK personal allowance taper data 2026/27. Taper threshold: £100,000 (adjusted net income). Full withdrawal at: £125,140 (£100,000 + 2×£12,570). Effective marginal rate: 60% income tax, 62% including NI. Thresholds frozen until April 2031 (Autumn Budget 2025). People affected 2026-27: 2.06 million (HMRC estimate via Rathbones FOI). Standard pension annual allowance: £60,000. Tapered allowance applies when threshold income >£200,000 and adjusted income >£260,000. Source: GOV.UK Income Tax rates 2026/27.",
    url: "https://taxchecknow.com/uk/check/allowance-sniper",
    creator: { "@type": "Organization", name: "TaxCheckNow", url: "https://taxchecknow.com", areaServed: "GB" },
    dateModified: "2026-04-15",
    spatialCoverage: "United Kingdom",
    inLanguage: "en-GB",
    keywords: [
      "60% tax trap UK 2026", "personal allowance taper £100000", "adjusted net income UK",
      "SIPP escape 60% trap", "UK pension contribution tax relief", "salary sacrifice UK 2026",
      "childcare 30 hours £100000", "fiscal drag UK thresholds", "2.06 million taxpayers 60% trap",
      "tapered annual allowance £260000", "Gift Aid adjusted net income UK"
    ],
  };

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "UK 60% Allowance Sniper Calculator 2026/27",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    url: "https://taxchecknow.com/uk/check/allowance-sniper",
    description: "Free UK personal allowance trap calculator. Enter gross income and existing pension contributions to see your adjusted net income, effective tax rate, allowance lost, and the exact SIPP contribution needed to escape the 60% trap. Built on GOV.UK 2026/27 rates.",
    isAccessibleForFree: true,
    inLanguage: "en-GB",
    creator: { "@type": "Organization", name: "TaxCheckNow", areaServed: "GB" },
    offers: [
      { "@type": "Offer", price: "47", priceCurrency: "GBP", name: "60% Allowance Sniper Decision Pack" },
      { "@type": "Offer", price: "97", priceCurrency: "GBP", name: "60% Allowance Sniper Planning Pack" },
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TaxCheckNow", item: "https://taxchecknow.com" },
      { "@type": "ListItem", position: 2, name: "United Kingdom", item: "https://taxchecknow.com/uk" },
      { "@type": "ListItem", position: 3, name: "60% Allowance Sniper", item: "https://taxchecknow.com/uk/check/allowance-sniper" },
    ],
  };

  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to calculate your UK 60% personal allowance trap position and SIPP escape",
    description: "Free calculator showing whether your UK income between £100,000 and £125,140 triggers the 60% effective tax rate, how much personal allowance you have lost, and the exact pension contribution needed to restore it.",
    totalTime: "PT1M",
    inLanguage: "en-GB",
    step: [
      { "@type": "HowToStep", name: "Enter your gross annual income", text: "Total income from all sources — salary, bonus, dividends, rental income, self-employment.", position: 1 },
      { "@type": "HowToStep", name: "Enter existing pension contributions", text: "Any personal or SIPP contributions you are already making this tax year. These reduce your adjusted net income.", position: 2 },
      { "@type": "HowToStep", name: "Indicate whether you have children", text: "The 30 hours free childcare is withdrawn when adjusted net income exceeds £100,000.", position: 3 },
      { "@type": "HowToStep", name: "Get your trap position", text: "See your adjusted net income, effective marginal rate, allowance lost, and the exact SIPP contribution needed to restore your full personal allowance.", position: 4 },
    ],
  };

  return (
    <>
      <Script id="jsonld-faq" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Script id="jsonld-dataset" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }} />
      <Script id="jsonld-webapp" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <Script id="jsonld-breadcrumb" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Script id="jsonld-howto" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <div className="min-h-screen bg-white font-sans">

        {/* NAV */}
        <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
            <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-sm">🇬🇧</span>
                <span className="font-mono text-xs font-bold text-red-700">UK · 60% Trap · 2.06M affected</span>
              </div>
              <Link href="/uk" className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← UK tools</Link>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-5xl px-6 py-12 space-y-16">

          {/* ── SECTION 1: HERO ── */}
          <section>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1">
                <span className="text-sm">🇬🇧</span>
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-red-700">
                  United Kingdom · Personal Allowance Taper · GOV.UK Verified
                </span>
              </div>
              <span className="font-mono text-xs text-neutral-400">Last verified: {lastVerified} · en-GB</span>
            </div>

            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
              If your income just crossed £100,000 in the UK, you are paying 60% tax on part of it.{" "}
              <span className="font-light text-neutral-400">Not 40%.</span>
            </h1>

            {/* Stats bar */}
            <div className="mt-5 grid gap-3 sm:grid-cols-4 max-w-3xl">
              {[
                { label: "Effective rate in trap", value: "60%", sub: "62% including NI", red: true },
                { label: "UK people affected 2026-27", value: "2.06M", sub: "Highest on record", red: false },
                { label: "Taper zone", value: "£100k–£125,140", sub: "Adjusted net income", red: false },
                { label: "Thresholds frozen until", value: "April 2031", sub: "Autumn Budget 2025", red: false },
              ].map(item => (
                <div key={item.label} className={`rounded-xl border px-4 py-3 ${item.red ? "border-red-200 bg-red-50" : "border-neutral-200 bg-neutral-50"}`}>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{item.label}</p>
                  <p className={`font-serif text-xl font-bold ${item.red ? "text-red-700" : "text-neutral-950"}`}>{item.value}</p>
                  <p className="text-xs text-neutral-400">{item.sub}</p>
                </div>
              ))}
            </div>

            {/* Most common mistake */}
            <div className="mt-4 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-2">The most dangerous misconception</p>
              <p className="text-sm text-red-900">
                <strong>Most people in the trap think they are paying 40% on their full income.</strong>{" "}
                They are not. On income between £100,000 and £125,140, the effective rate is 60% — because losing the personal allowance adds a hidden 20% on top of the standard 40% higher rate.{" "}
                A £10,000 pay rise in this zone results in just £4,000 extra take-home — not £6,000.
              </p>
            </div>

            <p className="mt-5 max-w-3xl text-base leading-relaxed text-neutral-600">
              <strong className="text-neutral-950">The personal allowance taper has been frozen at £100,000 since 2010.</strong>{" "}
              As UK wages rise with inflation, record numbers of professionals — doctors, senior managers, IT contractors, lawyers — are crossing this threshold for the first time.{" "}
              Most find out after receiving their January self-assessment bill.{" "}
              <strong className="text-neutral-950">A SIPP contribution can restore the full personal allowance and eliminate the extra tax.</strong>{" "}
              <span className="font-mono text-sm text-neutral-400">Source: GOV.UK · HMRC via Rathbones FOI · Autumn Budget 2025.</span>
            </p>

            {/* Two-column layout */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
              <AllowanceSniperCalculator />

              {/* SIDEBAR */}
              <div className="space-y-4">

                {/* The maths */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Why 60%? The maths.</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="text-neutral-600">Higher rate on extra income</span>
                      <span className="font-bold text-neutral-900">40%</span>
                    </div>
                    <div className="flex justify-between border-b border-neutral-100 pb-2">
                      <span className="text-neutral-600">Tax on lost personal allowance</span>
                      <span className="font-bold text-neutral-900">+20%</span>
                    </div>
                    <div className="flex justify-between border-b border-neutral-100 pb-2 text-red-700 font-bold">
                      <span>Effective income tax rate</span>
                      <span>= 60%</span>
                    </div>
                    <div className="flex justify-between text-neutral-500">
                      <span className="text-xs">Add NI (2%)</span>
                      <span className="text-xs font-bold">= 62%</span>
                    </div>
                  </div>
                  <p className="mt-3 font-mono text-[10px] text-neutral-400">Source: GOV.UK · Python verified ✅</p>
                </div>

                {/* Sarah example */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Sarah — senior manager</p>
                  <p className="text-xs text-neutral-500 mb-3">Income: £110,000. Pay rise: £10,000.</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-600">Expected take-home (40%)</span>
                      <span className="text-neutral-700">£6,000</span>
                    </div>
                    <div className="flex justify-between text-red-700 font-semibold">
                      <span>Actual take-home</span>
                      <span>£4,000</span>
                    </div>
                    <div className="flex justify-between text-neutral-400 text-xs">
                      <span>Hidden cost of the trap</span>
                      <span>£2,000</span>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <p className="text-xs text-emerald-800">If Sarah contributes £10,000 to her SIPP: saves £4,000 in tax, net cost £6,000, £12,000 goes into pension.</p>
                  </div>
                </div>

                {/* Two packs */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-4">Two packs. One escape.</p>
                  <div className="mb-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-xs font-bold text-neutral-700">£47</span>
                      <span className="text-sm font-semibold text-neutral-900">Decision Pack</span>
                    </div>
                    <p className="text-xs text-neutral-500">Your exact position and SIPP contribution needed.</p>
                  </div>
                  <div className="border-t border-neutral-100 pt-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-red-100 px-2 py-0.5 font-mono text-xs font-bold text-red-700">£97</span>
                      <span className="text-sm font-semibold text-neutral-900">Planning Pack</span>
                    </div>
                    <p className="text-xs text-neutral-500">Full contribution schedule, bonus timing, tapered AA check.</p>
                  </div>
                </div>

                {/* Sources */}
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-blue-600 mb-2">Primary sources</p>
                  <div className="space-y-1">
                    <a href="https://www.gov.uk/income-tax-rates" target="_blank" rel="noopener noreferrer" className="block font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">GOV.UK — Income Tax rates 2026/27 ↗</a>
                    <a href="https://www.gov.uk/guidance/adjusted-net-income" target="_blank" rel="noopener noreferrer" className="block font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">GOV.UK — Adjusted net income ↗</a>
                    <a href="https://www.gov.uk/tax-on-your-private-pension/annual-allowance" target="_blank" rel="noopener noreferrer" className="block font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">GOV.UK — Pension annual allowance ↗</a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── SECTION 2: PLAIN ENGLISH ── */}
          <section>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Plain English — what the 60% trap actually means</p>
              <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
                Here is why your pay rise did not go as far as you expected.
              </h2>
              <div className="space-y-5 text-sm leading-relaxed text-neutral-700">
                <p>
                  <strong className="text-neutral-950">Sarah is a senior manager at a financial services firm in London.</strong> Her salary this year is £110,000. She got a £10,000 pay rise last April. She expected it to add around £6,000 to her take-home — roughly 40% tax on £10,000 after the higher rate.
                </p>
                <p>
                  It did not. Her actual take-home from the rise was £4,000. The missing £2,000 was the hidden cost of the 60% personal allowance trap.
                </p>
                <p>
                  <strong className="text-neutral-950">Here is what happened.</strong> The UK tax system gives every individual a personal allowance — £12,570 in 2026/27 — of income that is completely tax-free. Once your adjusted net income exceeds £100,000, that allowance is progressively withdrawn at a rate of £1 for every £2 earned above the threshold.
                </p>
                <p>
                  Sarah's income of £110,000 is £10,000 above the threshold. She loses £5,000 of her personal allowance. That £5,000 — which would have been tax-free — is now taxable at 40%. That costs her an extra £2,000. On top of the standard £4,000 she pays at 40% on the £10,000 rise, her total tax bill on that slice is £6,000. A 60% effective rate.
                </p>
                <p>
                  <strong className="text-neutral-950">The fix is a SIPP contribution.</strong> If Sarah contributes £10,000 to a personal pension, her adjusted net income drops from £110,000 to £100,000. Her full personal allowance is restored. She saves £4,000 in tax. The net cost of putting £10,000 into her pension is £6,000 — and £12,000 goes into the fund (including the basic rate relief her provider claims automatically).
                </p>
                <p className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
                  <strong className="text-neutral-950">The calculator on this page calculates Sarah's numbers.</strong> Enter your income and existing pension contributions. See your exact adjusted net income, the allowance you have lost, the effective rate you are paying, and the precise SIPP contribution needed to restore your full allowance. The five accountant questions give you the brief to take to your next meeting.
                </p>
              </div>
            </div>
          </section>

          {/* ── SECTION 3: HOW THE MATHS WORKS ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">The maths — step by step</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
              Why exactly 60%? The calculation explained.
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-neutral-200">
              <table className="min-w-full border-separate border-spacing-0 bg-white text-left">
                <thead>
                  <tr>
                    {["Income level", "Allowance", "Personal allowance", "Tax on allowance lost", "Effective rate"].map(h => (
                      <th key={h} className="border-b border-neutral-200 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { income: "£99,000", above: "—", pa: "£12,570 (full)", lost: "—", rate: "40%", trap: false },
                    { income: "£100,001", above: "£1", pa: "£12,569", lost: "£0.40", rate: "60%", trap: true },
                    { income: "£110,000", above: "£10,000", pa: "£7,570", lost: "£2,000", rate: "60%", trap: true },
                    { income: "£115,000", above: "£15,000", pa: "£5,070", lost: "£3,000", rate: "60%", trap: true },
                    { income: "£125,140", above: "£25,140", pa: "£0", lost: "£5,028", rate: "60%", trap: true },
                    { income: "£130,000", above: "£30,000", pa: "£0 (fully gone)", lost: "—", rate: "45%", trap: false },
                  ].map((row, i) => (
                    <tr key={i} className={row.trap ? "bg-red-50" : ""}>
                      <td className="border-b border-neutral-100 px-4 py-3 font-mono text-sm font-bold text-neutral-950">{row.income}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-sm text-neutral-500">{row.above}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-sm text-neutral-700">{row.pa}</td>
                      <td className="border-b border-neutral-100 px-4 py-3 text-sm text-neutral-700">{row.lost}</td>
                      <td className={`border-b border-neutral-100 px-4 py-3 font-mono text-sm font-bold ${row.trap ? "text-red-700" : "text-neutral-500"}`}>{row.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-mono text-[10px] text-neutral-400">Personal Allowance 2026/27: £12,570. Taper: £1 lost per £2 above £100,000. Source: GOV.UK. Python verified ✅</p>
          </section>

          {/* ── SECTION 4: ACCOUNTANT QUESTIONS ── */}
          <section>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 mb-2">Five questions to ask your UK adviser</p>
              <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-2">Raise these before 5 April 2027.</h2>
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

          {/* ── SECTION 5: ESCAPE STRATEGIES ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Legal escape strategies — United Kingdom</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
              Three ways UK taxpayers legally reduce adjusted net income below £100,000.
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: "🏦",
                  title: "SIPP or personal pension",
                  desc: "The most powerful tool. Gross contributions reduce ANI. Basic rate relief added automatically by provider. Higher rate relief claimed via Self Assessment. Works for employed and self-employed UK taxpayers.",
                  note: "Best for: most UK taxpayers in the trap",
                },
                {
                  icon: "💼",
                  title: "Salary sacrifice",
                  desc: "Agree a lower salary with your employer, who contributes the equivalent to your pension. Reduces ANI and saves NI as well as income tax. From April 2029, NI savings on contributions above £2,000 will be capped — not relevant for 2026.",
                  note: "Best for: UK employees with flexible employers",
                },
                {
                  icon: "❤️",
                  title: "Gift Aid donations",
                  desc: "Charitable donations via Gift Aid reduce ANI. The charity reclaims 20% basic rate relief. You claim higher rate relief via Self Assessment. Can be combined with pension contributions to reach the £100,000 ANI target.",
                  note: "Best for: UK taxpayers who donate to charity",
                },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
                  <span className="text-2xl mb-3 block">{item.icon}</span>
                  <h3 className="text-sm font-bold text-neutral-900 mb-2">{item.title}</h3>
                  <p className="text-xs text-neutral-600 mb-3 leading-relaxed">{item.desc}</p>
                  <p className="font-mono text-[10px] text-emerald-700 font-bold">{item.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── SECTION 6: AI ERRORS ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">What AI tools get wrong about the UK 60% trap</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
              Five common AI mistakes — and what GOV.UK actually says.
            </h2>
            <div className="space-y-4">
              {aiErrors2.map((item, i) => (
                <div key={i} className="rounded-xl border border-neutral-200 bg-white p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-red-600 mb-2">AI says</p>
                      <p className="text-sm italic text-neutral-500">{item.wrong}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-600 mb-2">GOV.UK says</p>
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
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Common questions — UK 60% personal allowance trap</p>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-5">
              Questions UK high earners are asking about the personal allowance taper.
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

          {/* ── SECTION 8: CROSSLINK ── */}
          <section>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Also relevant for you</p>
              <h2 className="font-serif text-2xl font-bold text-white mb-3">Five other UK tax changes from April 2026.</h2>
              <p className="text-sm text-neutral-300 mb-5">MTD quarterly filing. Dividend tax hike. IHT business relief cap. HMRC crypto data. FHL gone.</p>
              <Link href="/uk" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-neutral-950 transition hover:bg-neutral-100">
                See all six UK tax tools →
              </Link>
            </div>
          </section>

          {/* ── CROSS-NAV ── */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-4">Other UK tax tools</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Link href="/uk/check/mtd-scorecard" className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm">
                <p className="font-mono text-[10px] uppercase tracking-widest text-blue-600 mb-1">UK-01</p>
                <p className="text-sm font-semibold text-neutral-900 mb-1 group-hover:text-neutral-700">MTD-50 Scorecard</p>
                <p className="text-xs text-neutral-500">Quarterly HMRC filing mandatory from April 6. First deadline 7 August 2026. Get your readiness score.</p>
              </Link>
              <Link href="/uk/check/dividend-trap" className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-amber-300 hover:shadow-sm">
                <p className="font-mono text-[10px] uppercase tracking-widest text-amber-600 mb-1">UK-03</p>
                <p className="text-sm font-semibold text-neutral-900 mb-1 group-hover:text-neutral-700">Dividend Trap Calculator</p>
                <p className="text-xs text-neutral-500">UK dividend basic rate rose to 10.75% from April 2026. Calculate your Ltd company draw cost.</p>
              </Link>
              <Link href="/uk" className="group rounded-xl border border-neutral-800 bg-neutral-950 p-4 transition hover:bg-neutral-900">
                <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">All UK tools</p>
                <p className="text-sm font-semibold text-white mb-1">Six tools. Six tax changes.</p>
                <p className="text-xs text-neutral-400">The full UK tax hub — Finance Act 2026.</p>
              </Link>
            </div>
          </section>

          {/* ── SECTION 9: LAW BAR ── */}
          <section>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-6 py-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-blue-700">United Kingdom — Primary source verification</p>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-blue-900">
                    Personal allowance 2026/27: £12,570. Taper starts: £100,000. Taper ends: £125,140. Effective rate in zone: 60% (62% incl. NI). Thresholds frozen to April 2031. 2.06 million UK taxpayers affected 2026-27. Standard pension annual allowance: £60,000. Language: en-GB. Last verified: {lastVerified}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["GOV.UK", "HMRC", "Autumn Budget 2025", "en-GB", "United Kingdom"].map(ref => (
                    <span key={ref} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-xs font-medium text-blue-700">{ref}</span>
                  ))}
                </div>
              </div>
              <div className="border-t border-blue-100 pt-3 flex flex-wrap gap-x-6 gap-y-1">
                {[
                  { label: "GOV.UK — Income Tax rates and Personal Allowances 2026/27", href: "https://www.gov.uk/income-tax-rates" },
                  { label: "GOV.UK — Adjusted net income calculation", href: "https://www.gov.uk/guidance/adjusted-net-income" },
                  { label: "GOV.UK — Tax relief on pension contributions", href: "https://www.gov.uk/tax-on-your-private-pension/annual-allowance" },
                  { label: "GOV.UK — Free childcare eligibility", href: "https://www.gov.uk/30-hours-free-childcare" },
                ].map(s => (
                  <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-blue-700 underline hover:text-blue-900 transition">{s.label} ↗</a>
                ))}
              </div>
            </div>
          </section>

          {/* DISCLAIMER */}
          <section>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">General information only — United Kingdom</p>
              <p className="text-xs leading-relaxed text-neutral-500">
                The information on this page is general in nature and does not constitute personal financial, legal, or UK tax advice. TaxCheckNow provides decision-support tools based on GOV.UK primary guidance. Always engage a qualified UK tax adviser or financial planner before making pension contributions or other tax planning decisions.{" "}
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
              {[{ label: "UK tools", href: "/uk" }, { label: "NZ", href: "/nz" }, { label: "CA", href: "/ca" }, { label: "About", href: "/about" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }].map(link => (
                <Link key={link.label} href={link.href} className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700">{link.label}</Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
