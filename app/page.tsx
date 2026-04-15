import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TaxCheckNow | Tax Law Change Calculators — UK, NZ and Canada",
  description:
    "Free tax law change calculators for the United Kingdom, New Zealand and Canada. Built on enacted legislation — not drafts. HMRC nudge letters, NZ pension transfers, Canadian capital gains. Verified facts only.",
  alternates: {
    canonical: "https://taxchecknow.com",
  },
  openGraph: {
    title: "TaxCheckNow | Tax Law Change Calculators — UK, NZ and Canada",
    description:
      "Free calculators built on the enacted law. Not the draft AI is still citing.",
    url: "https://taxchecknow.com",
    siteName: "TaxCheckNow",
    type: "website",
  },
};

const COUNTRIES = [
  {
    code: "UK",
    flag: "🇬🇧",
    name: "United Kingdom",
    colour: "blue",
    badgeBg: "bg-blue-50 border-blue-200 text-blue-700",
    dotBg: "bg-blue-500",
    cardHover: "hover:border-blue-300",
    ctaBg: "bg-blue-600 hover:bg-blue-700",
    href: "/uk",
    headline: "HMRC can now see every crypto trade since 2014.",
    subline: "5 million nudge letters being sent. Most people are calculating their gains using the wrong CGT rates.",
    products: ["HMRC Nudge Letter Defender"],
    authority: "HMRC",
    urgency: "Nudge letters arriving now",
    urgentBadge: true,
  },
  {
    code: "NZ",
    flag: "🇳🇿",
    name: "New Zealand",
    colour: "black",
    badgeBg: "bg-neutral-900 border-neutral-700 text-white",
    dotBg: "bg-white",
    cardHover: "hover:border-neutral-400",
    ctaBg: "bg-neutral-900 hover:bg-neutral-700",
    href: "/nz",
    headline: "UK migrants in NZ now have a way to pay pension transfer tax at a flat 28%.",
    subline: "Scheme Pays started April 1, 2026. Thousands of UK migrants had no idea this option existed.",
    products: ["QROPS Tax Shield"],
    authority: "IRD",
    urgency: "Started April 1, 2026",
    urgentBadge: false,
  },
  {
    code: "CA",
    flag: "🇨🇦",
    name: "Canada",
    colour: "red",
    badgeBg: "bg-red-50 border-red-200 text-red-700",
    dotBg: "bg-red-500",
    cardHover: "hover:border-red-300",
    ctaBg: "bg-red-600 hover:bg-red-700",
    href: "/ca",
    headline: "66.7% or 50%? Nobody — including AI — can give you a straight answer.",
    subline: "Canada's capital gains inclusion rate flip-flopped. People selling cottages or businesses in 2026 have no idea which rate applies.",
    products: ["Capital Gains Truth-Table"],
    authority: "CRA",
    urgency: "2026 filing season",
    urgentBadge: false,
  },
];

export default function GlobalHomePage() {
  return (
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
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-neutral-600">
              Built on enacted law — not drafts
            </span>
          </div>
          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-neutral-950 sm:text-5xl">
            Tax law just changed in three countries.{" "}
            <span className="font-light text-neutral-400">Most people have not heard yet.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-neutral-500">
            Free calculators built on the enacted legislation — not the 2024 drafts AI is still citing.
            Pick your country below.
          </p>
        </section>

        {/* COUNTRY CARDS */}
        <section className="grid gap-6 sm:grid-cols-3">
          {COUNTRIES.map((country) => (
            <Link key={country.code} href={country.href}
              className={`group flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 transition ${country.cardHover} hover:shadow-md`}>

              {/* Flag + badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{country.flag}</span>
                {country.urgentBadge && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-red-700">
                    Urgent
                  </span>
                )}
              </div>

              {/* Country + authority */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-1.5 w-1.5 rounded-full ${country.dotBg} ${country.code === "NZ" ? "border border-neutral-400" : ""}`} />
                <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                  {country.name} · {country.authority}
                </p>
              </div>

              {/* Headline */}
              <h2 className="font-serif text-lg font-bold text-neutral-950 mb-2 leading-snug">
                {country.headline}
              </h2>

              {/* Subline */}
              <p className="text-sm text-neutral-500 mb-4 leading-relaxed flex-1">
                {country.subline}
              </p>

              {/* Products */}
              <div className="mb-4 space-y-1">
                {country.products.map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <span className="text-emerald-500 text-xs">✓</span>
                    <span className="font-mono text-[10px] text-neutral-600">{p}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-neutral-300 text-xs">✓</span>
                  <span className="font-mono text-[10px] text-neutral-300">More coming</span>
                </div>
              </div>

              {/* Urgency */}
              <p className="font-mono text-[10px] text-neutral-400 mb-4">{country.urgency}</p>

              {/* CTA */}
              <div className={`w-full rounded-xl ${country.ctaBg} px-4 py-2.5 text-center text-sm font-bold text-white transition`}>
                Go to {country.name} tools →
              </div>
            </Link>
          ))}
        </section>

        {/* TRUST BAR */}
        <section className="rounded-2xl border border-neutral-100 bg-neutral-50 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-1">
                How this works
              </p>
              <p className="text-sm text-neutral-600 max-w-xl">
                Every calculator on this site is built on the enacted law —
                verified against HMRC, IRD, and CRA primary sources.
                Not blog posts. Not AI guesses. Not 2024 drafts.
                Free to use. No account required.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["HMRC verified", "IRD verified", "CRA verified", "Free tools"].map((tag) => (
                <span key={tag} className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-600">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ALSO IN AU */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">
            Also from the same team
          </p>
          <h2 className="font-serif text-xl font-bold text-white mb-2">
            Australian SMSF trustees — Division 296 is now law.
          </h2>
          <p className="text-sm text-neutral-400 mb-4">
            Five free calculators for the new super tax. June 30 deadline.
            Built on the Treasury Laws Amendment Act enacted 10 March 2026.
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
            {[
              { label: "UK", href: "/uk" },
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
