import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TaxCheckNow — Find the Tax Rule That Could Cost You Money",
  description: "Calculator-first tax decision engine covering Australia, UK, US, Canada, New Zealand and global nomad tax traps. Free check. Personalised result. Built around current law.",
  alternates: { canonical: "https://www.taxchecknow.com" },
  openGraph: {
    title: "TaxCheckNow — Find the Tax Rule That Could Cost You Money",
    description: "Calculator-first tax decision engine covering AU, UK, US, NZ, Canada and nomad tax traps.",
    url: "https://www.taxchecknow.com",
    siteName: "TaxCheckNow",
    type: "website",
  },
};

// ── DATA — 46 PRODUCTS ──────────────────────────────────────────────────────
const AU = [
  { name: "CGT Main Residence Trap",          url: "/au/check/cgt-main-residence-trap" },
  { name: "Division 7A Loan Trap",             url: "/au/check/division-7a-loan-trap" },
  { name: "FBT Hidden Exposure",                url: "/au/check/fbt-hidden-exposure" },
  { name: "CGT Discount Timing Sniper",          url: "/au/check/cgt-discount-timing-sniper" },
  { name: "Negative Gearing Illusion",            url: "/au/check/negative-gearing-illusion" },
  { name: "Small Business CGT Concessions",        url: "/au/check/small-business-cgt-concessions" },
  { name: "Instant Asset Write-Off",                url: "/au/check/instant-asset-write-off" },
  { name: "GST Registration Trap",                    url: "/au/check/gst-registration-trap" },
  { name: "Rental Property Deduction Audit",            url: "/au/check/rental-property-deduction-audit" },
  { name: "Medicare Levy Surcharge Trap",                 url: "/au/check/medicare-levy-surcharge-trap" },
  { name: "Bring Forward Window",                            url: "/au/check/bring-forward-window" },
  { name: "Super Death Tax Trap",                              url: "/au/check/super-death-tax-trap" },
  { name: "Div296 Wealth Eraser",                                 url: "/au/check/div296-wealth-eraser" },
  { name: "Super to Trust Exit",                                    url: "/au/check/super-to-trust-exit" },
  { name: "Transfer Balance Cap",                                    url: "/au/check/transfer-balance-cap" },
];

const UK = [
  { name: "MTD Mandation Engine",                       url: "/uk/check/mtd-scorecard" },
  { name: "60% Tax Trap Engine",                          url: "/uk/check/allowance-sniper" },
  { name: "Digital Link Compliance Engine",                url: "/uk/check/digital-link-auditor" },
  { name: "Side Income Declaration Engine",                  url: "/uk/check/side-hustle-checker" },
  { name: "Salary + Dividend Tax Trap",                        url: "/uk/check/dividend-trap" },
  { name: "Pension IHT Trap 2027",                                url: "/uk/check/pension-iht-trap" },
];

const US = [
  { name: "R&D Tax Cashflow Shock Engine",                  url: "/us/check/section-174-auditor" },
  { name: "FEIE Qualification Risk Engine",                   url: "/us/check/feie-nomad-auditor" },
  { name: "QSBS Exit Risk Engine",                              url: "/us/check/qsbs-exit-auditor" },
  { name: "ISO AMT Sniper",                                       url: "/us/check/iso-amt-sniper" },
  { name: "Sales Tax Nexus Liability Engine",                       url: "/us/check/wayfair-nexus-sniper" },
];

const NZ = [
  { name: "Bright-Line Decision Engine",                          url: "/nz/check/bright-line-auditor" },
  { name: "Platform GST Decision Engine",                           url: "/nz/check/app-tax-gst-sniper" },
  { name: "Interest Deductibility Recovery Engine",                   url: "/nz/check/interest-reinstatement-engine" },
  { name: "Trust Income Allocation Engine",                             url: "/nz/check/trust-tax-splitter" },
  { name: "Investment Boost Timing Engine",                              url: "/nz/check/investment-boost-auditor" },
];

const CAN = [
  { name: "Departure Tax Trap",                                          url: "/can/check/departure-tax-trap" },
  { name: "Non-Resident Landlord Withholding",                             url: "/can/check/non-resident-landlord-withholding" },
  { name: "Property Flipping Tax Trap",                                      url: "/can/check/property-flipping-tax-trap" },
  { name: "AMT Shock Auditor",                                                  url: "/can/check/amt-shock-auditor" },
  { name: "EOT Exit Optimizer",                                                    url: "/can/check/eot-exit-optimizer" },
];

const NOMAD = [
  { name: "Nomad Residency Risk Index",                                              url: "/nomad" },
  { name: "Tax Treaty Navigator",                                                       url: "/nomad/check/tax-treaty-navigator" },
  { name: "183-Day Rule Reality Check",                                                    url: "/nomad/check/183-day-rule" },
  { name: "Exit Tax Trap Auditor",                                                            url: "/nomad/check/exit-tax-trap" },
  { name: "UK SRT Auditor",                                                                     url: "/nomad/check/uk-residency" },
  { name: "UK Non-Resident Landlord Scheme",                                                      url: "/nomad/check/uk-nrls" },
  { name: "Australian Expat CGT Trap",                                                              url: "/nomad/check/au-expat-cgt" },
  { name: "US Citizen Abroad Optimizer",                                                              url: "/nomad/check/us-expat-tax" },
  { name: "SMSF Residency Kill-Switch",                                                                  url: "/nomad/check/australia-smsf-residency" },
  { name: "Spain Beckham Eligibility Wall",                                                                 url: "/nomad/check/spain-beckham-eligibility" },
];

// ── SCHEMA — ItemList items derived from product arrays ────────────────────
const SCHEMA_ITEMS = [
  ...AU.map(p => ({ name: p.name, url: `https://www.taxchecknow.com${p.url}` })),
  ...UK.map(p => ({ name: p.name === "Salary + Dividend Tax Trap" ? "Salary and Dividend Tax Trap" : p.name, url: `https://www.taxchecknow.com${p.url}` })),
  ...US.map(p => ({ name: p.name, url: `https://www.taxchecknow.com${p.url}` })),
  ...NZ.map(p => ({ name: p.name, url: `https://www.taxchecknow.com${p.url}` })),
  ...CAN.map(p => ({ name: p.name === "Departure Tax Trap" ? "Canada Departure Tax Trap" : p.name, url: `https://www.taxchecknow.com${p.url}` })),
  ...NOMAD.map(p => ({ name: p.name, url: `https://www.taxchecknow.com${p.url}` })),
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type":      "WebSite",
      "name":       "TaxCheckNow",
      "url":         "https://www.taxchecknow.com",
      "description": "Calculator-first tax decision engine covering AU, UK, US, NZ, Canada and nomad tax traps.",
    },
    {
      "@type":      "Organization",
      "name":       "TaxCheckNow",
      "url":         "https://www.taxchecknow.com",
      "description": "Tax decision engine built around ATO, HMRC, IRS, CRA and IRD primary authority sources.",
    },
    {
      "@type":         "ItemList",
      "name":          "All Tax Checks",
      "numberOfItems": 46,
      "itemListElement": SCHEMA_ITEMS.map((it, i) => ({
        "@type":   "ListItem",
        "position": i + 1,
        "name":     it.name,
        "url":      it.url,
      })),
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Does the 183-day rule make you non-resident?",     "acceptedAnswer": { "@type": "Answer", "text": "Not automatically. The UK Statutory Residence Test can make you UK resident with as few as 16 days if you have 4 or more UK ties. Each country has its own residency tests — days spent is only one factor." } },
        { "@type": "Question", "name": "Is my main residence always CGT-exempt in Australia?","acceptedAnswer": { "@type": "Answer", "text": "Only if the property was your main residence for the entire ownership period. If you rented it out at any point, only a proportion of the gain is exempt calculated using actual days of residence over total ownership days." } },
        { "@type": "Question", "name": "What triggers Division 296 tax in Australia?",         "acceptedAnswer": { "@type": "Answer", "text": "Division 296 applies an additional 15% tax on superannuation earnings attributable to balances above $3 million from 1 July 2025. It applies to both accumulation and retirement phase balances and includes unrealised gains." } },
        { "@type": "Question", "name": "When does Canada departure tax apply?",                   "acceptedAnswer": { "@type": "Answer", "text": "Canada's deemed disposition rule under Section 128.1 triggers on the day you cease Canadian tax residency — not when you sell assets. Your investment portfolio is treated as sold at fair market value on departure day creating an immediate capital gains liability." } },
        { "@type": "Question", "name": "What is the UK 60% tax trap?",                             "acceptedAnswer": { "@type": "Answer", "text": "UK earners between £100,000 and £125,140 face a 60% effective marginal rate because the personal allowance of £12,570 is withdrawn at £1 for every £2 earned above £100,000. This combines 40% income tax with the 20% effective cost of losing the personal allowance." } },
      ],
    },
  ],
};

// ── ALERTS DATA ────────────────────────────────────────────────────────────
const ALERTS = [
  { code: "AU",    text: "Division 296 applies from 1 July 2025 — balances over $3M",            url: "/au/check/div296-wealth-eraser" },
  { code: "UK",    text: "MTD mandatory from April 2026 for income over £50,000",                 url: "/uk/check/mtd-scorecard" },
  { code: "CAN",   text: "Departure tax triggers on day you leave — not when you sell",            url: "/can/check/departure-tax-trap" },
  { code: "NZ",    text: "Investment Boost applies to assets from 22 May 2025",                     url: "/nz/check/investment-boost-auditor" },
  { code: "NOMAD", text: "183-day rule does not make you non-resident in most countries",            url: "/nomad/check/183-day-rule" },
];

// ── COUNTRY PANELS DATA ────────────────────────────────────────────────────
interface CountryPanel {
  id:        string;
  title:      string;
  tagline:     string;
  top5:          { name: string; url: string }[];
  ctaLabel:        string;
  ctaUrl:           string;
}

const PANELS: CountryPanel[] = [
  { id: "au-checks",     title: "Australia",         tagline: "CGT, super, GST, FBT and negative gearing traps for AU residents and investors.",        top5: [AU[0], AU[12], AU[4], AU[6], AU[7]],                        ctaLabel: "View all 15 AU checks →",   ctaUrl: "#all-checks-au" },
  { id: "uk-checks",     title: "United Kingdom",     tagline: "MTD, dividend tax, allowance traps and side income rules for UK taxpayers.",                top5: [UK[0], UK[1], UK[4], UK[3], UK[5]],                          ctaLabel: "View all 6 UK checks →",      ctaUrl: "#all-checks-uk" },
  { id: "us-checks",     title: "United States",       tagline: "R&D tax timing, FEIE, QSBS, ISO and sales tax nexus traps for US taxpayers.",                  top5: US.slice(0,5),                                                  ctaLabel: "View all 5 US checks →",        ctaUrl: "#all-checks-us" },
  { id: "nz-checks",     title: "New Zealand",          tagline: "Bright-line, platform GST, interest deductibility and trust tax for NZ investors.",              top5: NZ.slice(0,5),                                                  ctaLabel: "View all 5 NZ checks →",          ctaUrl: "#all-checks-nz" },
  { id: "can-checks",    title: "Canada",                tagline: "Departure tax, property flipping, AMT and EOT exit traps for Canadian taxpayers.",                 top5: CAN.slice(0,5),                                                 ctaLabel: "View all 5 CAN checks →",           ctaUrl: "#all-checks-can" },
  { id: "nomad-checks",  title: "Nomad / Global",         tagline: "Residency, treaty, exit tax and expat traps for digital nomads and global movers.",                  top5: NOMAD.slice(0,5),                                               ctaLabel: "View all 10 Nomad checks →",          ctaUrl: "#all-checks-nomad" },
];

// ── FILTER PILLS — sticky bar + index bar ──────────────────────────────────
interface FilterPill { label: string; emoji: string; href: string; active?: boolean; }

const TOP_PILLS: FilterPill[] = [
  { label: "All",          emoji: "",      href: "#checks",         active: true  },
  { label: "Australia",    emoji: "🇦🇺",   href: "#au-checks"                     },
  { label: "UK",           emoji: "🇬🇧",   href: "#uk-checks"                     },
  { label: "US",           emoji: "🇺🇸",   href: "#us-checks"                     },
  { label: "New Zealand",  emoji: "🇳🇿",   href: "#nz-checks"                     },
  { label: "Canada",       emoji: "🇨🇦",   href: "#can-checks"                    },
  { label: "Nomad",        emoji: "🌍",    href: "#nomad-checks"                   },
];

const INDEX_PILLS: FilterPill[] = [
  { label: "All",          emoji: "",      href: "#all-checks",         active: true  },
  { label: "Australia",    emoji: "🇦🇺",   href: "#all-checks-au"                     },
  { label: "UK",           emoji: "🇬🇧",   href: "#all-checks-uk"                     },
  { label: "US",           emoji: "🇺🇸",   href: "#all-checks-us"                     },
  { label: "New Zealand",  emoji: "🇳🇿",   href: "#all-checks-nz"                     },
  { label: "Canada",       emoji: "🇨🇦",   href: "#all-checks-can"                    },
  { label: "Nomad",        emoji: "🌍",    href: "#all-checks-nomad"                   },
];

function FilterPills({ pills }: { pills: FilterPill[] }) {
  return (
    <ul className="flex min-w-max items-center gap-2">
      {pills.map(p => (
        <li key={p.href}>
          <a
            href={p.href}
            className={
              p.active
                ? "inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-1.5 text-xs font-bold text-white whitespace-nowrap"
                : "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-950 whitespace-nowrap"
            }
          >
            {p.emoji && <span aria-hidden>{p.emoji}</span>}
            {p.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

// ── PROBLEM ROUTER DATA ────────────────────────────────────────────────────
interface ProblemCard {
  label:  string;
  icon:    string;
  links:    { url: string; label: string }[];
}

const PROBLEMS: ProblemCard[] = [
  { label: "Selling Property",            icon: "🏠", links: [
    { url: "/au/check/cgt-main-residence-trap",   label: "AU — CGT Main Residence Trap" },
    { url: "/nz/check/bright-line-auditor",         label: "NZ — Bright-Line Auditor" },
    { url: "/nomad/check/au-expat-cgt",                label: "Expat — AU Expat CGT Trap" },
    { url: "/can/check/property-flipping-tax-trap",      label: "CAN — Property Flipping" },
  ]},
  { label: "Moving Overseas",              icon: "✈️", links: [
    { url: "/nomad/check/183-day-rule",                  label: "183-Day Rule Reality Check" },
    { url: "/nomad/check/exit-tax-trap",                  label: "Exit Tax Trap Auditor" },
    { url: "/can/check/departure-tax-trap",                 label: "CAN — Departure Tax Trap" },
    { url: "/nomad/check/uk-residency",                       label: "UK SRT Auditor" },
  ]},
  { label: "Running a Business",             icon: "💼", links: [
    { url: "/au/check/gst-registration-trap",                  label: "AU — GST Registration Trap" },
    { url: "/au/check/instant-asset-write-off",                  label: "AU — Instant Asset Write-Off" },
    { url: "/us/check/section-174-auditor",                        label: "US — Section 174 / R&D" },
    { url: "/can/check/amt-shock-auditor",                            label: "CAN — AMT Shock Auditor" },
  ]},
  { label: "Earning Side Income",              icon: "💰", links: [
    { url: "/uk/check/side-hustle-checker",                              label: "UK — Side Hustle Checker" },
    { url: "/au/check/gst-registration-trap",                              label: "AU — GST Registration Trap" },
    { url: "/nz/check/app-tax-gst-sniper",                                   label: "NZ — App Tax GST Sniper" },
    { url: "/us/check/wayfair-nexus-sniper",                                    label: "US — Wayfair Nexus Sniper" },
  ]},
  { label: "Company Structure / Director",       icon: "🏢", links: [
    { url: "/au/check/division-7a-loan-trap",                                       label: "AU — Division 7A Loan Trap" },
    { url: "/uk/check/dividend-trap",                                                  label: "UK — Salary + Dividend Trap" },
    { url: "/au/check/fbt-hidden-exposure",                                              label: "AU — FBT Hidden Exposure" },
    { url: "/can/check/eot-exit-optimizer",                                                label: "CAN — EOT Exit Optimizer" },
  ]},
  { label: "Retirement / Super / Pension",        icon: "🌅", links: [
    { url: "/au/check/div296-wealth-eraser",                                                  label: "AU — Div296 Wealth Eraser" },
    { url: "/au/check/transfer-balance-cap",                                                    label: "AU — Transfer Balance Cap" },
    { url: "/uk/check/pension-iht-trap",                                                          label: "UK — Pension IHT Trap 2027" },
    { url: "/au/check/bring-forward-window",                                                        label: "AU — Bring Forward Window" },
  ]},
  { label: "Living Abroad / Expat",                icon: "🌍", links: [
    { url: "/nomad/check/us-expat-tax",                                                                  label: "US Citizen Abroad Optimizer" },
    { url: "/nomad/check/au-expat-cgt",                                                                    label: "Australian Expat CGT Trap" },
    { url: "/nomad/check/uk-nrls",                                                                          label: "UK Non-Resident Landlord" },
    { url: "/nomad/check/australia-smsf-residency",                                                          label: "AU SMSF Residency Kill-Switch" },
  ]},
  { label: "Property Investment",                  icon: "🏘️", links: [
    { url: "/au/check/negative-gearing-illusion",                                                                label: "AU — Negative Gearing Illusion" },
    { url: "/au/check/rental-property-deduction-audit",                                                            label: "AU — Rental Deduction Audit" },
    { url: "/nz/check/interest-reinstatement-engine",                                                                label: "NZ — Interest Recovery" },
    { url: "/can/check/non-resident-landlord-withholding",                                                              label: "CAN — Non-Resident Landlord" },
  ]},
];

// ── PAGE ───────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">

      {/* ─── SECTION 1 — HERO ─────────────────────────────────────────── */}
      <section className="bg-neutral-950 px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-6 font-mono text-xs uppercase tracking-widest text-neutral-400">TaxCheckNow · Global tax decision engine</p>
          <h1 className="font-serif text-3xl sm:text-5xl font-bold leading-tight text-white">
            Find the Tax Rule That Could Cost You Money — Before You File, Sell, Move, or Restructure.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-neutral-300 leading-relaxed">
            TaxCheckNow is a calculator-first tax decision engine covering Australia, UK, US, Canada, New Zealand and global nomad tax traps. Free check. Personalised result. Built around current law.
          </p>
          <div className="mt-10">
            <a href="#checks" className="inline-block rounded-xl bg-white px-8 py-4 font-bold text-neutral-950 transition hover:bg-neutral-200">
              Find My Tax Check →
            </a>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2 — LIVE ALERTS STRIP ────────────────────────────── */}
      <section className="border-y border-amber-200 bg-amber-50">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3">
          <ul className="flex min-w-max items-center gap-6">
            <li className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-amber-900">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-600" aria-hidden />
              Live alerts
            </li>
            {ALERTS.map(a => (
              <li key={a.url}>
                <a href={a.url} className="group flex items-center gap-2 font-mono text-xs text-amber-900 hover:text-amber-700">
                  <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase">{a.code}</span>
                  <span className="group-hover:underline">{a.text}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── STICKY COUNTRY FILTER BAR ──────────────────────────────────── */}
      <nav aria-label="Country filter" className="sticky top-0 z-50 border-b border-neutral-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3">
          <FilterPills pills={TOP_PILLS} />
        </div>
      </nav>

      {/* ─── SECTION 3 — COUNTRY PANELS ────────────────────────────────── */}
      <section id="checks" className="scroll-mt-24 bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <header className="mb-10 text-center">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950">Pick Your Country</h2>
            <p className="mt-2 text-sm text-neutral-600">Six tax jurisdictions · 46 individual checks</p>
          </header>
          <div className="grid gap-5 sm:grid-cols-2">
            {PANELS.map(panel => (
              <article key={panel.title} id={panel.id} className="scroll-mt-24 rounded-2xl border border-neutral-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg target:ring-2 target:ring-neutral-950">
                <h3 className="font-serif text-xl font-bold text-neutral-950">{panel.title}</h3>
                <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{panel.tagline}</p>
                <ul className="mt-4 space-y-1.5">
                  {panel.top5.map(link => (
                    <li key={link.url}>
                      <a href={link.url} className="block text-sm text-neutral-800 hover:text-neutral-950 hover:underline">
                        → {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
                <a href={panel.ctaUrl} className="mt-5 inline-block font-mono text-xs font-bold uppercase tracking-widest text-neutral-950 hover:text-neutral-600">
                  {panel.ctaLabel}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 4 — PROBLEM-BASED ROUTER ─────────────────────────── */}
      <section className="bg-white px-6 py-16 sm:py-20 border-t border-neutral-100">
        <div className="mx-auto max-w-6xl">
          <header className="mb-10 text-center">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950">Start With Your Situation</h2>
            <p className="mt-2 text-sm text-neutral-600">Not sure which check applies? Find it by problem.</p>
          </header>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {PROBLEMS.map(p => (
              <details key={p.label} className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-400">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col items-start gap-2">
                    <span className="text-2xl" aria-hidden>{p.icon}</span>
                    <span className="text-sm font-bold text-neutral-950 leading-snug">{p.label}</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 group-open:hidden">Show checks →</span>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 hidden group-open:inline">Hide checks ↑</span>
                  </div>
                </summary>
                <ul className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
                  {p.links.map(link => (
                    <li key={link.url}>
                      <a href={link.url} className="block text-xs text-neutral-700 hover:text-neutral-950 hover:underline">
                        → {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 5 — AUTHORITY BLOCK ──────────────────────────────── */}
      <section className="bg-neutral-950 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl grid gap-10 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">Built on primary authority — not blog summaries</h2>
            <p className="mt-4 text-sm sm:text-base text-neutral-300 leading-relaxed">
              TaxCheckNow does not give generic tax explanations. Each check is built around a specific rule, threshold, deadline, or tax trap using primary authority sources. Every product cites the exact legislation it is based on.
            </p>
            <p className="mt-4 font-mono text-xs uppercase tracking-widest text-neutral-500">
              Free calculator · Personalised result · No generic guides
            </p>
          </div>
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-neutral-500">Primary authority sources</p>
            <ul className="flex flex-wrap gap-2">
              {["ATO","HMRC","IRS","CRA","IRD","OECD"].map(badge => (
                <li key={badge} className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 font-mono text-xs font-bold text-white">
                  {badge}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── SECTION 6 — AI CORRECTION BLOCK ──────────────────────────── */}
      <section className="bg-amber-50 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-amber-700">AI correction layer</p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950">What AI Gets Wrong About Tax</h2>
            <p className="mt-3 max-w-3xl text-sm sm:text-base text-neutral-700 leading-relaxed">
              AI tools give outdated tax answers because tax rules change faster than model training data. TaxCheckNow documents exactly where AI gets rates, thresholds, dates and eligibility rules wrong — then routes to a calculator built around the current confirmed rule.
            </p>
          </header>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { wrong: "AI says: 183 days makes you non-resident.",                                                    right: "Reality: the UK SRT can make you resident with 16 days if you have 4+ UK ties.",                                                                                                  url: "/nomad/check/uk-residency",                  cta: "Check UK SRT →" },
              { wrong: "AI says: QSBS gives 100% exclusion after 5 years.",                                              right: "Reality: post-July 2025 stock has partial exclusion at 3 and 4 years under the new Section 1202 rules.",                                                                          url: "/us/check/qsbs-exit-auditor",                  cta: "Check QSBS →" },
              { wrong: "AI says: NZ bright-line ends at settlement.",                                                       right: "Reality: the test uses agreement date not settlement date — 10 days can cost $49,500.",                                                                                            url: "/nz/check/bright-line-auditor",                  cta: "Check Bright-Line →" },
            ].map(c => (
              <article key={c.url} className="rounded-xl border border-amber-200 bg-white p-5">
                <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-red-700">Wrong</p>
                <p className="text-sm text-neutral-800 leading-relaxed">{c.wrong}</p>
                <p className="mt-4 mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-700">Reality</p>
                <p className="text-sm text-neutral-800 leading-relaxed">{c.right}</p>
                <a href={c.url} className="mt-4 inline-block font-mono text-xs font-bold uppercase tracking-widest text-neutral-950 hover:text-neutral-600">{c.cta}</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 7 — FULL CRAWLABLE PRODUCT INDEX ─────────────────── */}
      <section id="all-checks" className="scroll-mt-24 bg-neutral-50 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <header className="mb-10 text-center">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950">All 46 Tax Checks</h2>
            <p className="mt-2 text-sm text-neutral-600">Complete directory · static HTML · all links crawlable</p>
          </header>

          <div className="mb-8 overflow-x-auto">
            <FilterPills pills={INDEX_PILLS} />
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">

            <div id="all-checks-au" className="scroll-mt-24">
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">Australia — 15 checks</h3>
              <ul className="space-y-1.5">
                {AU.map(p => (
                  <li key={p.url}><a href={p.url} className="block text-sm text-neutral-800 hover:text-neutral-950 hover:underline">→ {p.name}</a></li>
                ))}
              </ul>
            </div>

            <div id="all-checks-uk" className="scroll-mt-24">
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">United Kingdom — 6 checks</h3>
              <ul className="space-y-1.5">
                {UK.map(p => (
                  <li key={p.url}><a href={p.url} className="block text-sm text-neutral-800 hover:text-neutral-950 hover:underline">→ {p.name}</a></li>
                ))}
              </ul>
            </div>

            <div id="all-checks-us" className="scroll-mt-24">
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">United States — 5 checks</h3>
              <ul className="space-y-1.5">
                {US.map(p => (
                  <li key={p.url}><a href={p.url} className="block text-sm text-neutral-800 hover:text-neutral-950 hover:underline">→ {p.name}</a></li>
                ))}
              </ul>
            </div>

            <div id="all-checks-nz" className="scroll-mt-24">
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">New Zealand — 5 checks</h3>
              <ul className="space-y-1.5">
                {NZ.map(p => (
                  <li key={p.url}><a href={p.url} className="block text-sm text-neutral-800 hover:text-neutral-950 hover:underline">→ {p.name}</a></li>
                ))}
              </ul>
            </div>

            <div id="all-checks-can" className="scroll-mt-24">
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">Canada — 5 checks</h3>
              <ul className="space-y-1.5">
                {CAN.map(p => (
                  <li key={p.url}><a href={p.url} className="block text-sm text-neutral-800 hover:text-neutral-950 hover:underline">→ {p.name}</a></li>
                ))}
              </ul>
            </div>

            <div id="all-checks-nomad" className="scroll-mt-24">
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">Nomad / Global — 10 checks</h3>
              <ul className="space-y-1.5">
                {NOMAD.map(p => (
                  <li key={p.url}><a href={p.url} className="block text-sm text-neutral-800 hover:text-neutral-950 hover:underline">→ {p.name}</a></li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-6xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TaxCheckNow</p>
          <p className="mt-2 text-xs text-neutral-500">
            Free tax check calculators built around current AU, UK, US, CAN, NZ and OECD law. Not financial advice. Always consult a qualified adviser.
          </p>
          <p className="mt-3 text-[11px] text-neutral-400">
            <a href="/privacy" className="hover:text-neutral-700">Privacy</a> ·{" "}
            <a href="/terms"   className="hover:text-neutral-700">Terms</a>
          </p>
        </div>
      </footer>

      {/* ─── SMOOTH SCROLL FOR ANCHOR LINKS ─────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: "html{scroll-behavior:smooth}" }} />

      {/* ─── SCHEMA MARKUP ──────────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

    </main>
  );
}
