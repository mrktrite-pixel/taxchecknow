// Direct-answer question — AU CGT main residence exemption + rental.
// Server component. Static HTML. Crawlable.

import type { Metadata } from "next";
import Link from "next/link";

const SHORT_ANSWER =
  "Yes. If you rented your property at any point during ownership, the ATO reduces your main residence CGT exemption proportionally. The exempt fraction equals the days you actually lived there divided by total days of ownership.";

export const metadata: Metadata = {
  title:        "Does Renting My Property Affect the CGT Main Residence Exemption in Australia? | TaxCheckNow",
  description:  SHORT_ANSWER,
  alternates:   { canonical: "https://www.taxchecknow.com/questions/does-renting-affect-cgt-exemption-australia" },
  openGraph:    {
    title:       "Does Renting My Property Affect the CGT Main Residence Exemption in Australia?",
    description: SHORT_ANSWER,
    url:          "https://www.taxchecknow.com/questions/does-renting-affect-cgt-exemption-australia",
    type:          "article",
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type":     "FAQPage",
  "mainEntity": [
    {
      "@type":     "Question",
      "name":      "Does renting my property affect the CGT main residence exemption?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":  SHORT_ANSWER,
      },
    },
  ],
};

const ARTICLE_SCHEMA = {
  "@context":     "https://schema.org",
  "@type":         "Article",
  "headline":      "Does renting my property affect the CGT main residence exemption in Australia?",
  "description":    SHORT_ANSWER,
  "datePublished":   "2026-04-29",
  "dateModified":     "2026-04-29",
  "author":             { "@type": "Organization", "name": "TaxCheckNow" },
  "publisher":             { "@type": "Organization", "name": "TaxCheckNow" },
  "url":                       "https://www.taxchecknow.com/questions/does-renting-affect-cgt-exemption-australia",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">

      <section className="bg-neutral-950 px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
            <Link href="/questions" className="hover:text-white">Questions</Link>
            <span className="mx-2 text-neutral-600">/</span>
            <span className="text-neutral-300">Australia · CGT</span>
          </p>
          <h1 className="mt-5 font-serif text-2xl sm:text-3xl font-bold leading-tight text-white">
            Does renting my property affect the CGT main residence exemption in Australia?
          </h1>
        </div>
      </section>

      <article className="bg-white px-6 py-12 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-6 text-[17px] leading-[1.75] text-neutral-800">

          {/* Direct answer — designed to be the AI snippet */}
          <div className="rounded-xl border-l-4 border-neutral-950 bg-neutral-50 px-6 py-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Short answer</p>
            <p className="mt-2 text-[17px] leading-[1.7] text-neutral-900">{SHORT_ANSWER}</p>
          </div>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">The rule — ITAA 1997 s118-185</h2>
          <p>
            The main residence CGT exemption in Australia is set out in Income Tax Assessment Act 1997, section 118-110. Section 118-185 then introduces the partial-exemption rule that applies when the property was your main residence for only part of the ownership period. Together, these sections produce the proportional formula the ATO uses.
          </p>
          <p>
            In plain English: the exemption protects the days the property was actually your main residence. It does not protect the days it was anything else — including the days it was rented to a tenant.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">The proportional calculation</h2>
          <p>
            The ATO uses a simple ratio. The taxable portion of your capital gain is calculated as:
          </p>
          <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-4 font-mono text-sm text-neutral-800">
            Taxable gain = Total capital gain × (Days NOT main residence ÷ Total days owned)
          </p>
          <p>
            The exempt fraction is the inverse. If you owned a property for 4,000 days and lived in it as your main residence for 1,000 of those days, then 1,000 ÷ 4,000 = 25 percent of the gain is exempt and 75 percent is taxable. The 50 percent CGT discount may then apply to the taxable portion if you held the property for more than twelve months.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Worked example — Gary&rsquo;s Mandurah house</h2>
          <p>
            Gary bought a property in 2013 and sold it in 2024 — eleven years of ownership. For the first eight years he rented it out. For the final three years he lived in it as his main residence. The capital gain on sale was, say, $220,000.
          </p>
          <p>
            Three of eleven years was main residence: 3 ÷ 11 = 27 percent. Exempt portion = $60,000. Taxable portion = $160,000. Apply the 50 percent CGT discount: $80,000 added to taxable income. At Gary&rsquo;s marginal rate plus Medicare, the tax bill landed around $47,000.
          </p>
          <p>
            <Link href="/stories/gary-cgt-main-residence-trap" className="font-bold text-neutral-950 underline underline-offset-4 hover:no-underline">
              Read Gary&rsquo;s full story →
            </Link>
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">What triggers the reduction</h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>Renting the property to a tenant at any point during ownership.</li>
            <li>Using a part of the home as a dedicated place of business and claiming occupancy expenses.</li>
            <li>Treating another property as your main residence at the same time (you can only nominate one).</li>
            <li>Being a foreign resident at the time you sign the contract of sale — this can deny the exemption entirely.</li>
            <li>Having first used the property to produce income before moving in. The s118-192 market-value reset rule then sets a new cost base from the day you first moved in.</li>
          </ul>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">What does <em>not</em> trigger the reduction</h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>Temporary absences where the property remained your main residence and was not used to produce income — covered by the absence rule in s118-145 (no time limit).</li>
            <li>Absences where the property was rented out for up to six years — but only if you established it as your main residence first, before renting it. This is the &ldquo;6-year rule.&rdquo;</li>
            <li>Renovations or short vacancies where the property was not lived in by anyone and not earning income.</li>
            <li>Living overseas while the property remained your main residence and unrented.</li>
          </ul>

          <p>
            The most common trap is in that second bullet. The 6-year rule only helps you if you lived there first. Renting from day one — as Gary did — locks you out of the absence rule permanently for that property.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Calculate your position</h2>
          <p>
            We built three free tools that work through these rules with your actual numbers — no tax file number, no signup, about ninety seconds each.
          </p>
          <ul className="space-y-3">
            <li>
              <Link
                href="/au/check/cgt-main-residence-trap"
                className="block rounded-xl border-2 border-neutral-950 bg-neutral-950 px-5 py-4 text-white transition hover:-translate-y-0.5"
              >
                <p className="font-serif text-base font-bold">CGT Main Residence Trap — free check →</p>
                <p className="mt-1 text-sm text-neutral-300">The primary tool for this exact question. Takes ~90 seconds.</p>
              </Link>
            </li>
            <li>
              <Link
                href="/gpt/au-cgt-main-residence-trap"
                className="block rounded-xl border border-neutral-200 bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:border-neutral-950"
              >
                <p className="font-serif text-base font-bold text-neutral-950">The full rule explained →</p>
                <p className="mt-1 text-sm text-neutral-600">Background reading on s118-110 and s118-185.</p>
              </Link>
            </li>
            <li>
              <Link
                href="/au/check/cgt-discount-timing-sniper"
                className="block rounded-xl border border-neutral-200 bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:border-neutral-950"
              >
                <p className="font-serif text-base font-bold text-neutral-950">CGT Discount Timing Sniper →</p>
                <p className="mt-1 text-sm text-neutral-600">Related: when does the 12-month CGT discount start? Contract date or settlement?</p>
              </Link>
            </li>
          </ul>

        </div>
      </article>

      <section className="border-t border-neutral-200 bg-neutral-50 px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Related questions</p>
          <ul className="mt-4 space-y-2">
            <li>
              <Link href="/questions/how-does-six-year-rule-work-cgt-australia" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                How does the 6-year absence rule work for the CGT main residence exemption? →
              </Link>
            </li>
            <li>
              <Link href="/questions/cgt-discount-contract-or-settlement-date-australia" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Does the 12-month CGT discount run from contract date or settlement date? →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TaxCheckNow</p>
          <p className="mt-2 text-xs text-neutral-500">
            Information is general in nature and not financial advice. Always consult a qualified adviser before acting.
          </p>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE_SCHEMA) }}
      />
    </main>
  );
}
