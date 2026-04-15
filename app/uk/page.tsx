import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "UK Tax Law Changes 2026 — Free Calculators | TaxCheckNow",
  description:
    "Six free calculators for the UK's biggest tax changes of 2026. Making Tax Digital, the 60% personal allowance trap, dividend tax hike, crypto reporting, FHL abolition, and IHT business relief cap. Built on Finance Act 2026 and HMRC primary guidance.",
  alternates: {
    canonical: "https://taxchecknow.com/uk",
  },
  openGraph: {
    title: "UK Tax Law Changes 2026 — Free Calculators",
    description:
      "Six tax law changes. Six free calculators. Built on enacted legislation — not what AI is still citing from 2024.",
    url: "https://taxchecknow.com/uk",
    siteName: "TaxCheckNow",
    type: "website",
  },
};

const UK_GATES = [
  {
    number: "UK-01",
    status: "LIVE",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
    border: "hover:border-blue-300",
    href: "/uk/check/mtd-scorecard",
    urgent: true,
    urgency: "First deadline August 7, 2026",
    headline: "From April 6, quarterly tax filing is mandatory if you earn over £50,000 from self-employment or property.",
    desc: "MTD for Income Tax is live. Most sole traders and landlords do not know their first quarterly deadline is August 7 — not January. Get your readiness score in 60 seconds.",
    audience: "Sole traders · Landlords · Contractors",
    price: "From £27",
    cta: "Get my MTD readiness score →",
    lawRef: "HMRC — Making Tax Digital for Income Tax · April 6, 2026",
  },
  {
    number: "UK-02",
    status: "LIVE",
    badge: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
    border: "hover:border-red-300",
    href: "/uk/check/allowance-sniper",
    urgent: true,
    urgency: "2.06 million people affected in 2026-27",
    headline: "If your income just crossed £100,000, you are paying 60% tax on that slice — not 40%.",
    desc: "The personal allowance tapers away between £100,000 and £125,140 creating an effective 60% rate. A single SIPP contribution can buy it back entirely. Calculate your exact break-even point.",
    audience: "Senior managers · Doctors · IT contractors · Professionals",
    price: "From £47",
    cta: "Calculate my 60% trap →",
    lawRef: "GOV.UK — Income Tax rates 2026/27 · Thresholds frozen to April 2031",
  },
  {
    number: "UK-03",
    status: "LIVE",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    border: "hover:border-amber-300",
    href: "/uk/check/dividend-trap",
    urgent: false,
    urgency: "In effect from April 6, 2026",
    headline: "The dividend tax hike is here. For every £10,000 you take from your Ltd company, you just lost an extra £200.",
    desc: "Basic rate rises to 10.75%. Higher rate rises to 35.75%. The dividend allowance stays at £500. Calculate exactly what your current draw strategy costs in 2026-27 vs last year.",
    audience: "Ltd company directors · Business owners · Investors",
    price: "From £47",
    cta: "Calculate my dividend cost →",
    lawRef: "Finance Act 2026, Section 4 · GOV.UK confirmed",
  },
  {
    number: "UK-04",
    status: "LIVE",
    badge: "border-purple-200 bg-purple-50 text-purple-700",
    dot: "bg-purple-500",
    border: "hover:border-purple-300",
    href: "/uk/check/crypto-predictor",
    urgent: false,
    urgency: "HMRC data access live from January 1, 2026",
    headline: "HMRC can now see every crypto trade you have made since 2014. Are your self-assessment records accurate?",
    desc: "From January 1, 2026, UK crypto exchanges report all user data to HMRC under CARF. HMRC is auto-matching against self-assessment. Check your audit risk level before they find you.",
    audience: "Crypto holders · Investors · Self-assessment filers",
    price: "From £47",
    cta: "Check my audit risk →",
    lawRef: "HMRC — Cryptoasset Reporting Framework · January 1, 2026",
  },
  {
    number: "UK-05",
    status: "LIVE",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    border: "hover:border-emerald-300",
    href: "/uk/check/fhl-recovery",
    urgent: false,
    urgency: "First full year under new rules — Jan 2027 tax bill",
    headline: "The FHL tax break ended in April 2025. Your January 2027 self-assessment will be the first to show the full impact.",
    desc: "Holiday lets are now taxed as standard rental properties. Mortgage interest relief is capped at 20%. Capital allowances on new expenditure are gone. Calculate your 2025-26 tax year impact.",
    audience: "Holiday let owners · Cornwall · Lakes · Scotland",
    price: "From £47",
    cta: "Calculate my FHL impact →",
    lawRef: "GOV.UK — Abolition of the FHL Tax Regime · April 6, 2025",
  },
  {
    number: "UK-06",
    status: "LIVE",
    badge: "border-neutral-200 bg-neutral-50 text-neutral-700",
    dot: "bg-neutral-500",
    border: "hover:border-neutral-300",
    href: "/uk/check/iht-buster",
    urgent: false,
    urgency: "In effect from April 6, 2026",
    headline: "The 100% inheritance tax relief on your family business is now capped at £2.5 million.",
    desc: "Agricultural Property Relief and Business Property Relief are no longer unlimited. Assets above £2.5M face a 20% effective IHT rate. Calculate your estate's new exposure.",
    audience: "Family business owners · Farmers · High-net-worth estates",
    price: "From £197",
    cta: "Calculate my IHT exposure →",
    lawRef: "Finance Act 2026, Section 65 + Schedule 12 · GOV.UK confirmed",
  },
];

export default function UKHubPage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="font-serif text-lg font-bold text-neutral-950">TaxCheckNow</Link>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-lg">🇬🇧</span>
              <span className="font-mono text-xs font-bold text-blue-600">United Kingdom</span>
            </div>
            <Link href="/" className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">← All countries</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-12 space-y-12">

        {/* HERO */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
              <span className="text-sm">🇬🇧</span>
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-blue-700">
                United Kingdom · Finance Act 2026
              </span>
            </div>
            <span className="font-mono text-xs text-neutral-400">HMRC verified · April 2026</span>
          </div>

          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
            Six UK tax laws changed in April 2026.{" "}
            <span className="font-light text-neutral-400">Most people have not been told.</span>
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-neutral-500">
            Free calculators built on HMRC primary guidance and Finance Act 2026.
            Not blog posts. Not AI guesses. Not what was true in 2024.
            Pick the one that applies to you.
          </p>

          {/* Two urgent alerts */}
          <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-blue-700 mb-1">MTD — Act now</p>
              <p className="text-sm text-blue-900">If you earn over £50k self-employed or from property — your first quarterly filing is <strong>August 7.</strong></p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-red-700 mb-1">60% trap — Check now</p>
              <p className="text-sm text-red-900">Income between £100k and £125,140? You are paying <strong>60% tax</strong> on that slice — not 40%.</p>
            </div>
          </div>
        </section>

        {/* GATE CARDS */}
        <section className="space-y-4">
          {UK_GATES.map((gate) => (
            <Link key={gate.number} href={gate.href}
              className={`group flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 transition ${gate.border} hover:shadow-sm sm:flex-row sm:items-start`}>

              {/* Left */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest ${gate.badge}`}>
                    {gate.number}
                  </span>
                  {gate.urgent && (
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-red-700">
                      Act now
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-neutral-400">{gate.audience}</span>
                </div>

                <h2 className="font-serif text-lg font-bold text-neutral-950 mb-2 leading-snug group-hover:text-neutral-700">
                  {gate.headline}
                </h2>

                <p className="text-sm text-neutral-500 mb-3 leading-relaxed">{gate.desc}</p>

                <div className="flex flex-wrap items-center gap-4">
                  <p className="font-mono text-[10px] text-neutral-400">{gate.lawRef}</p>
                </div>
              </div>

              {/* Right */}
              <div className="flex shrink-0 flex-col items-end gap-3 sm:items-end">
                <span className="font-mono text-xs font-bold text-neutral-400">{gate.urgency}</span>
                <div className="rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-bold text-white transition group-hover:bg-neutral-700 whitespace-nowrap">
                  {gate.cta}
                </div>
                <span className="font-mono text-[10px] text-neutral-400">{gate.price} · Free calculator</span>
              </div>
            </Link>
          ))}
        </section>

        {/* TRUST BAR */}
        <section className="rounded-2xl border border-neutral-100 bg-neutral-50 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-1">
                What makes this different
              </p>
              <p className="text-sm text-neutral-600 max-w-xl">
                Every number on this site is verified against HMRC.gov.uk and Finance Act 2026 primary sources.
                Where AI tools have the wrong rate, wrong date, or wrong threshold —
                we document the correction and cite the source.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["HMRC verified", "Finance Act 2026", "Primary sources only", "Free tools"].map((tag) => (
                <span key={tag} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-600">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* AU CROSSLINK */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Also from the same team</p>
          <h2 className="font-serif text-xl font-bold text-white mb-2">
            Australian SMSF trustees — Division 296 is now law.
          </h2>
          <p className="text-sm text-neutral-400 mb-4">
            Five free calculators for the new super tax. June 30 deadline.
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
          <Link href="/" className="font-serif font-bold text-neutral-950">TaxCheckNow</Link>
          <div className="flex gap-5">
            {[
              { label: "All countries", href: "/" },
              { label: "NZ", href: "/nz" },
              { label: "CA", href: "/ca" },
              { label: "About", href: "/about" },
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
            ].map((link) => (
              <Link key={link.label} href={link.href}
                className="font-mono text-xs text-neutral-400 transition hover:text-neutral-700">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
