"use client";

import { useState, useEffect, useRef } from "react";

interface CountryOption { code: string; emoji: string; label: string; }
interface Situation {
  id:        string;
  emoji:      string;
  label:       string;
  countries:    CountryOption[];
}
interface Product { name: string; url: string; description: string; }

const SITUATIONS: Situation[] = [
  {
    id: "selling-property",   emoji: "🏠", label: "Selling Property",
    countries: [
      { code: "au",     emoji: "🇦🇺", label: "Australia" },
      { code: "nz",     emoji: "🇳🇿", label: "New Zealand" },
      { code: "can",    emoji: "🇨🇦", label: "Canada" },
      { code: "expat",  emoji: "🌍",  label: "Expat / Overseas" },
    ],
  },
  {
    id: "moving-overseas",     emoji: "✈️", label: "Moving Overseas",
    countries: [
      { code: "nomad",  emoji: "🌍",  label: "Nomad / Global" },
      { code: "uk",     emoji: "🇬🇧", label: "UK" },
      { code: "au",     emoji: "🇦🇺", label: "Australia" },
      { code: "can",    emoji: "🇨🇦", label: "Canada" },
    ],
  },
  {
    id: "running-business",      emoji: "💼", label: "Running a Business",
    countries: [
      { code: "au",     emoji: "🇦🇺", label: "Australia" },
      { code: "uk",     emoji: "🇬🇧", label: "UK" },
      { code: "us",     emoji: "🇺🇸", label: "United States" },
      { code: "can",    emoji: "🇨🇦", label: "Canada" },
    ],
  },
  {
    id: "side-income",             emoji: "💰", label: "Earning Side Income",
    countries: [
      { code: "uk",     emoji: "🇬🇧", label: "UK" },
      { code: "au",     emoji: "🇦🇺", label: "Australia" },
      { code: "nz",     emoji: "🇳🇿", label: "New Zealand" },
      { code: "us",     emoji: "🇺🇸", label: "United States" },
    ],
  },
  {
    id: "company-director",          emoji: "🏢", label: "Company / Director",
    countries: [
      { code: "au",     emoji: "🇦🇺", label: "Australia" },
      { code: "uk",     emoji: "🇬🇧", label: "UK" },
      { code: "can",    emoji: "🇨🇦", label: "Canada" },
    ],
  },
  {
    id: "retirement",                  emoji: "🏦", label: "Retirement / Super / Pension",
    countries: [
      { code: "au",     emoji: "🇦🇺", label: "Australia" },
      { code: "uk",     emoji: "🇬🇧", label: "UK" },
      { code: "expat",  emoji: "🌍",  label: "Expat" },
    ],
  },
  {
    id: "living-abroad",                 emoji: "🌍", label: "Living Abroad / Expat",
    countries: [
      { code: "nomad",  emoji: "🌍",  label: "Nomad / Global" },
      { code: "us",     emoji: "🇺🇸", label: "United States" },
      { code: "au",     emoji: "🇦🇺", label: "Australia" },
      { code: "uk",     emoji: "🇬🇧", label: "UK" },
    ],
  },
  {
    id: "property-investment",             emoji: "🏘️", label: "Property Investment",
    countries: [
      { code: "au",     emoji: "🇦🇺", label: "Australia" },
      { code: "nz",     emoji: "🇳🇿", label: "New Zealand" },
      { code: "can",    emoji: "🇨🇦", label: "Canada" },
      { code: "uk",     emoji: "🇬🇧", label: "UK" },
    ],
  },
];

const PRODUCTS: Record<string, Product[]> = {
  // Selling Property
  "selling-property__au":    [
    { name: "CGT Main Residence Trap",      url: "/au/check/cgt-main-residence-trap",       description: "Is your exemption full, partial or at risk?" },
    { name: "CGT Discount Timing Sniper",     url: "/au/check/cgt-discount-timing-sniper",   description: "Did you hold for 12 months? Date matters." },
  ],
  "selling-property__nz":    [
    { name: "Bright-Line Decision Engine",     url: "/nz/check/bright-line-auditor",          description: "Agreement date — not settlement — determines tax." },
  ],
  "selling-property__can":   [
    { name: "Property Flipping Tax Trap",       url: "/can/check/property-flipping-tax-trap", description: "Under 365 days? It may be business income." },
  ],
  "selling-property__expat": [
    { name: "Australian Expat CGT Trap",         url: "/nomad/check/au-expat-cgt",              description: "Non-resident at contract date = no exemption." },
  ],

  // Moving Overseas
  "moving-overseas__nomad":  [
    { name: "183-Day Rule Reality Check",          url: "/nomad/check/183-day-rule",              description: "183 days does not make you non-resident." },
    { name: "Tax Treaty Navigator",                  url: "/nomad/check/tax-treaty-navigator",      description: "Which country actually taxes your income?" },
  ],
  "moving-overseas__uk":     [
    { name: "UK SRT Auditor",                          url: "/nomad/check/uk-residency",              description: "Ties matter more than days in the UK." },
  ],
  "moving-overseas__au":     [
    { name: "Australian Expat CGT Trap",                 url: "/nomad/check/au-expat-cgt",              description: "Selling your home after leaving costs more." },
  ],
  "moving-overseas__can":    [
    { name: "Departure Tax Trap",                          url: "/can/check/departure-tax-trap",          description: "Deemed disposed on the day you leave." },
  ],

  // Running a Business
  "running-business__au":    [
    { name: "GST Registration Trap",                          url: "/au/check/gst-registration-trap",        description: "Crossed $75k? You may already be late." },
    { name: "Instant Asset Write-Off",                          url: "/au/check/instant-asset-write-off",      description: "Ready for use by June 30 — not just purchased." },
  ],
  "running-business__uk":    [
    { name: "MTD Mandation Engine",                                url: "/uk/check/mtd-scorecard",                description: "Are you mandated from April 2026?" },
    { name: "Side Income Declaration Engine",                        url: "/uk/check/side-hustle-checker",          description: "HMRC already has your platform data." },
  ],
  "running-business__us":    [
    { name: "R&D Tax Cashflow Shock Engine",                            url: "/us/check/section-174-auditor",          description: "2022 change front-loaded your tax bill." },
    { name: "Sales Tax Nexus Liability Engine",                          url: "/us/check/wayfair-nexus-sniper",         description: "Sold into a state? You may already owe tax." },
  ],
  "running-business__can":   [
    { name: "AMT Shock Auditor",                                            url: "/can/check/amt-shock-auditor",          description: "A second tax system may override your return." },
  ],

  // Earning Side Income
  "side-income__uk":         [
    { name: "Side Income Declaration Engine",                                  url: "/uk/check/side-hustle-checker",          description: "eBay, Etsy, Airbnb report to HMRC since 2024." },
  ],
  "side-income__au":         [
    { name: "GST Registration Trap",                                              url: "/au/check/gst-registration-trap",        description: "Side income counts toward the $75k threshold." },
  ],
  "side-income__nz":         [
    { name: "Platform GST Decision Engine",                                          url: "/nz/check/app-tax-gst-sniper",           description: "Platform collects 15% — you only get 8.5%." },
  ],
  "side-income__us":         [
    { name: "Sales Tax Nexus Liability Engine",                                         url: "/us/check/wayfair-nexus-sniper",         description: "200 transactions can trigger nexus." },
  ],

  // Company / Director
  "company-director__au":    [
    { name: "Division 7A Loan Trap",                                                       url: "/au/check/division-7a-loan-trap",       description: "Company loan to you = deemed dividend." },
    { name: "FBT Hidden Exposure",                                                           url: "/au/check/fbt-hidden-exposure",         description: "Car, phone, entertainment — all count." },
  ],
  "company-director__uk":    [
    { name: "Salary + Dividend Tax Trap",                                                      url: "/uk/check/dividend-trap",                description: "Wrong split costs thousands every year." },
    { name: "60% Tax Trap Engine",                                                              url: "/uk/check/allowance-sniper",             description: "£100k-£125k: you keep 40p per £1 earned." },
  ],
  "company-director__can":   [
    { name: "EOT Exit Optimizer",                                                                  url: "/can/check/eot-exit-optimizer",          description: "Sell to employees — shelter up to $10M gain." },
  ],

  // Retirement / Super / Pension
  "retirement__au":          [
    { name: "Div296 Wealth Eraser",                                                                  url: "/au/check/div296-wealth-eraser",         description: "Over $3M super? Extra 15% tax from July 2025." },
    { name: "Transfer Balance Cap",                                                                    url: "/au/check/transfer-balance-cap",         description: "Breaching the cap triggers penalty tax." },
    { name: "Bring Forward Window",                                                                      url: "/au/check/bring-forward-window",         description: "June 30 deadline for 3-year contributions." },
  ],
  "retirement__uk":          [
    { name: "Pension IHT Trap 2027",                                                                       url: "/uk/check/pension-iht-trap",              description: "Pensions may enter your estate from April 2027." },
  ],
  "retirement__expat":       [
    { name: "SMSF Residency Kill-Switch",                                                                    url: "/nomad/check/australia-smsf-residency",  description: "Leave Australia = 45% tax on entire fund." },
  ],

  // Living Abroad / Expat
  "living-abroad__nomad":    [
    { name: "Nomad Residency Risk Index",                                                                       url: "/nomad",                                description: "Are you resident nowhere — or everywhere?" },
    { name: "Exit Tax Trap Auditor",                                                                              url: "/nomad/check/exit-tax-trap",            description: "Leaving can trigger tax on assets not sold." },
  ],
  "living-abroad__us":       [
    { name: "US Citizen Abroad Optimizer",                                                                          url: "/nomad/check/us-expat-tax",             description: "FEIE vs FTC — wrong choice costs thousands." },
    { name: "FEIE Qualification Risk Engine",                                                                        url: "/us/check/feie-nomad-auditor",          description: "330 days — all or nothing. 329 = full tax." },
  ],
  "living-abroad__au":       [
    { name: "Australian Expat CGT Trap",                                                                                url: "/nomad/check/au-expat-cgt",             description: "Non-resident at contract date loses exemption." },
    { name: "SMSF Residency Kill-Switch",                                                                                 url: "/nomad/check/australia-smsf-residency", description: "Control from overseas = 45% on fund value." },
  ],
  "living-abroad__uk":       [
    { name: "UK Non-Resident Landlord Scheme",                                                                              url: "/nomad/check/uk-nrls",                  description: "20% withheld before you receive rent." },
    { name: "UK SRT Auditor",                                                                                                  url: "/nomad/check/uk-residency",             description: "16 days can make you UK resident." },
  ],

  // Property Investment
  "property-investment__au":  [
    { name: "Negative Gearing Illusion",                                                                                          url: "/au/check/negative-gearing-illusion",     description: "Real cashflow vs tax saving — do the maths." },
    { name: "Rental Property Deduction Audit",                                                                                      url: "/au/check/rental-property-deduction-audit", description: "Repairs vs capital — ATO treats them differently." },
  ],
  "property-investment__nz":  [
    { name: "Interest Deductibility Recovery Engine",                                                                                 url: "/nz/check/interest-reinstatement-engine", description: "100% deductible from April 2025 — recalculate." },
  ],
  "property-investment__can": [
    { name: "Non-Resident Landlord Withholding",                                                                                         url: "/can/check/non-resident-landlord-withholding", description: "25% withheld on gross — not net profit." },
  ],
  "property-investment__uk":  [
    { name: "Salary + Dividend Tax Trap",                                                                                                  url: "/uk/check/dividend-trap",                 description: "Rental income stacks on top of salary." },
  ],
};

export default function SituationRouter() {
  const [situationId, setSituationId] = useState<string | null>(null);
  const [countryCode,  setCountryCode]  = useState<string | null>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

  const situation = SITUATIONS.find(s => s.id === situationId) ?? null;
  const products = situationId && countryCode ? (PRODUCTS[`${situationId}__${countryCode}`] ?? []) : [];

  useEffect(() => {
    if (situationId && step2Ref.current) {
      const t = setTimeout(() => step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      return () => clearTimeout(t);
    }
  }, [situationId]);

  useEffect(() => {
    if (countryCode && step3Ref.current) {
      const t = setTimeout(() => step3Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      return () => clearTimeout(t);
    }
  }, [countryCode]);

  function selectSituation(id: string) {
    if (id === situationId) {
      setSituationId(null);
      setCountryCode(null);
    } else {
      setSituationId(id);
      setCountryCode(null);
    }
  }

  function selectCountry(code: string) {
    setCountryCode(code === countryCode ? null : code);
  }

  return (
    <section id="router" className="bg-white px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950">Find Your Tax Check</h2>
          <p className="mt-2 text-sm text-neutral-600">Three short steps · 46 checks across 6 jurisdictions</p>
        </header>

        {/* STEP 1 — SITUATION */}
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-neutral-500">Step 1 — Your situation</p>
          <h3 className="mb-6 font-serif text-xl font-bold text-neutral-950">What is your situation?</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SITUATIONS.map(s => {
              const active = situationId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => selectSituation(s.id)}
                  aria-pressed={active}
                  className={
                    active
                      ? "rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-5 text-left text-white shadow-md transition"
                      : "rounded-2xl border-2 border-neutral-200 bg-white p-5 text-left text-neutral-800 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-md"
                  }
                >
                  <span className="mb-3 block text-3xl" aria-hidden>{s.emoji}</span>
                  <span className="block text-sm font-bold leading-snug">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2 — COUNTRY */}
        {situation && (
          <div ref={step2Ref} className="mt-12 scroll-mt-24">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-neutral-500">Step 2 — Where you are based</p>
            <h3 className="mb-6 font-serif text-xl font-bold text-neutral-950">Where are you based?</h3>
            <div className="flex flex-wrap gap-3">
              {situation.countries.map(c => {
                const active = countryCode === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => selectCountry(c.code)}
                    aria-pressed={active}
                    className={
                      active
                        ? "rounded-xl border-2 border-neutral-950 bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition"
                        : "rounded-xl border-2 border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow"
                    }
                  >
                    <span className="mr-2" aria-hidden>{c.emoji}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3 — PRODUCTS */}
        {situationId && countryCode && (
          <div ref={step3Ref} className="mt-12 scroll-mt-24">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-emerald-700">Step 3 — Your check</p>
            <h3 className="mb-6 font-serif text-xl font-bold text-neutral-950">Here is your check</h3>
            {products.length === 0 ? (
              <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                No specific checks configured for this combination yet. Browse the full index below.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.map(p => (
                  <article key={p.url} className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                    <h4 className="font-serif text-lg font-bold text-neutral-950">{p.name}</h4>
                    <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{p.description}</p>
                    <a
                      href={p.url}
                      className="mt-4 inline-block rounded-lg bg-neutral-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-neutral-800"
                    >
                      Run free check →
                    </a>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
