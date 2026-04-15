import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About SuperTaxCheck | Division 296 Decision Intelligence",
  description:
    "SuperTaxCheck provides free decision-support tools for Australian SMSF (Self-Managed Super Fund) trustees built on the Division 296 Act enacted 10 March 2026. Three Citation Gap tools that explicitly correct AI errors about the enacted law.",
  alternates: {
    canonical: "https://supertaxcheck.com.au/about",
  },
};

const lastVerified = "April 2026";

export default function AboutPage() {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SuperTaxCheck",
    url: "https://supertaxcheck.com.au",
    description:
      "Decision-support tools for Australian SMSF (Self-Managed Super Fund) trustees with $3M+ in superannuation, built on the Division 296 Act enacted 10 March 2026.",
    email: "hello@supertaxcheck.com.au",
    areaServed: {
      "@type": "Country",
      name: "Australia",
    },
    knowsAbout: [
      "Division 296 tax",
      "SMSF cost-base reset election",
      "Australian superannuation law",
      "Treasury Laws Amendment Act 2026",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Division 296 Tax Tools",
      itemListElement: [
        {
          "@type": "Offer",
          name: "Div 296 Wealth Eraser",
          url: "https://supertaxcheck.com.au/check/div296-wealth-eraser",
          price: "67",
          priceCurrency: "AUD",
        },
        {
          "@type": "Offer",
          name: "Death Benefit Tax-Wall Calculator",
          url: "https://supertaxcheck.com.au/check/death-benefit-tax-wall",
          price: "67",
          priceCurrency: "AUD",
        },
        {
          "@type": "Offer",
          name: "Super-to-Trust Exit Logic System",
          url: "https://supertaxcheck.com.au/check/super-to-trust-exit",
          price: "67",
          priceCurrency: "AUD",
        },
      ],
    },
  };

  return (
    <>
      <Script
        id="jsonld-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      <div className="min-h-screen bg-white font-sans">
        <nav className="border-b border-neutral-200 bg-white px-6 py-3.5">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <Link href="/" className="font-serif text-lg font-bold text-neutral-950">
              SuperTaxCheck
            </Link>
            <Link href="/" className="font-mono text-xs text-neutral-400 hover:text-neutral-700 transition">
              ← Home
            </Link>
          </div>
        </nav>

        <main className="mx-auto max-w-3xl px-6 py-12 space-y-10">

          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-blue-700">
                Last verified: {lastVerified}
              </span>
            </div>
            <h1 className="font-serif text-4xl font-bold text-neutral-950">
              About SuperTaxCheck
            </h1>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              SuperTaxCheck provides free decision-support tools for Australian{" "}
              <strong className="text-neutral-950">
                SMSF (Self-Managed Super Fund) trustees
              </strong>{" "}
              with $3M+ in superannuation. Every tool is built on the Treasury
              Laws Amendment (Building a Stronger and Fairer Super System) Act,
              enacted{" "}
              <strong className="text-neutral-950">10 March 2026</strong> — not
              the 2024 exposure draft that most AI tools and generic advice is
              still citing.
            </p>
          </div>

          {/* Why it was built */}
          <div>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-3">
              Why this site exists
            </h2>
            <p className="text-sm leading-relaxed text-neutral-600 mb-3">
              The Division 296 Act passed Parliament on 10 March 2026. Within
              days, it became clear that:
            </p>
            <ul className="space-y-3">
              {[
                "Most AI tools were — and still are — citing the 2024 exposure draft, which had materially different rules",
                "The all-or-nothing nature of the cost-base reset was widely misrepresented as an asset-by-asset election",
                "The June 30 2026 valuation date was being confused with the SMSF annual return due date",
                "The reversionary pension survivorship risk was absent from almost all AI-generated advice",
                "SMSF trustees approaching the June 30 deadline had no free, accurate calculator to use",
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-neutral-700">
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-neutral-400">
                    0{i + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              SuperTaxCheck was built to fill this gap. Every calculation is
              derived from the enacted legislation, cross-referenced with ATO
              guidance, and structured to explicitly correct the errors that AI
              models are generating when asked about Division 296.
            </p>
          </div>

          {/* The Citation Gap model */}
          <div>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-3">
              The Citation Gap model
            </h2>
            <p className="text-sm leading-relaxed text-neutral-600 mb-3">
              SuperTaxCheck is built on what we call Legislative Archaeology —
              identifying the gap between what AI models currently cite and what
              the enacted law actually says. Each of our three tools is a
              Citation Gap tool: it names the error AI makes, states the correct
              law, and cites the section reference.
            </p>
            <div className="space-y-3">
              {[
                {
                  name: "Div 296 Wealth Eraser",
                  url: "/check/div296-wealth-eraser",
                  law: "s.42",
                  desc: "Cost-base reset election calculator. Corrects the AI error that individual assets can be selected.",
                },
                {
                  name: "Death Benefit Tax-Wall Calculator",
                  url: "/check/death-benefit-tax-wall",
                  law: "s.13",
                  desc: "Survivorship risk modeller. Corrects the AI error that a spouse's super does not affect your TSB.",
                },
                {
                  name: "Super-to-Trust Exit Logic System",
                  url: "/check/super-to-trust-exit",
                  law: "Subdiv 296-B",
                  desc: "10-year structural model. Corrects the AI error that super is always the best structure for tax.",
                },
              ].map((tool) => (
                <Link
                  key={tool.name}
                  href={tool.url}
                  className="block rounded-xl border border-neutral-200 p-4 hover:border-neutral-400 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-neutral-950">{tool.name}</p>
                      <p className="mt-1 text-sm text-neutral-500">{tool.desc}</p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-xs text-blue-700">
                      {tool.law}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Verification process */}
          <div>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-3">
              How we verify our content
            </h2>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 space-y-4">
              {[
                {
                  step: "01",
                  title: "Primary source only",
                  desc: "Every fact is derived from the enacted Treasury Laws Amendment Act. We do not use secondary sources, media summaries, or AI-generated content as a source.",
                },
                {
                  step: "02",
                  title: "Section-level citation",
                  desc: "Every calculation and rule is cited to a specific section of the Act — s.13, s.42, and Subdiv 296-B — not to a general description of the law.",
                },
                {
                  step: "03",
                  title: "ATO guidance cross-reference",
                  desc: "Calculations are cross-referenced with ATO guidance where available. When ATO guidance conflicts with the enacted Act, we note both.",
                },
                {
                  step: "04",
                  title: "Monthly verification",
                  desc: "Content is reviewed monthly as ATO guidance evolves. The last verified date is displayed on every page. If anything changes, we update immediately.",
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-neutral-400">
                    {item.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                    <p className="mt-0.5 text-sm text-neutral-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legislative basis */}
          <div>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-3">
              Legislative basis
            </h2>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <div className="space-y-2 text-sm text-blue-900">
                <p>
                  <strong>Act:</strong> Treasury Laws Amendment (Building a
                  Stronger and Fairer Super System) Act
                </p>
                <p>
                  <strong>Enacted:</strong> 10 March 2026
                </p>
                <p>
                  <strong>Commencement:</strong> 1 July 2026
                </p>
                <p>
                  <strong>Threshold tier 1:</strong> $3,000,000 TSB → 30%
                  effective rate
                </p>
                <p>
                  <strong>Threshold tier 2:</strong> $10,000,000 TSB → 40%
                  effective rate
                </p>
                <p>
                  <strong>Valuation date:</strong> 30 June 2026
                </p>
                <p>
                  <strong>Machine-readable rules:</strong>{" "}
                  <a
                    href="/api/rules/div296.json"
                    className="underline hover:text-blue-700"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    supertaxcheck.com.au/api/rules/div296.json
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-3">
              What we are not
            </h2>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
              <p className="text-sm leading-relaxed text-neutral-600">
                SuperTaxCheck does not hold an Australian Financial Services
                Licence (AFSL). We do not provide personal financial, tax, or
                legal advice. Our tools are decision-support aids based on
                publicly available legislation. All outputs are estimates only.
                Always engage a qualified SMSF specialist, tax agent, or
                financial adviser before acting on any output from this
                platform.
              </p>
              <div className="mt-3 flex gap-4">
                <Link href="/privacy" className="font-mono text-xs text-neutral-400 underline hover:text-neutral-700">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="font-mono text-xs text-neutral-400 underline hover:text-neutral-700">
                  Terms of Use
                </Link>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-3">
              Contact
            </h2>
            <p className="text-sm text-neutral-600">
              For enquiries about SuperTaxCheck, corrections to our content, or
              media requests:{" "}
              <a
                href="mailto:hello@supertaxcheck.com.au"
                className="font-medium text-neutral-950 underline hover:text-neutral-700"
              >
                hello@supertaxcheck.com.au
              </a>
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              If you believe any content on this site is factually incorrect
              based on the enacted legislation, please contact us with the
              specific section reference. We will review and update within
              48 hours.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
