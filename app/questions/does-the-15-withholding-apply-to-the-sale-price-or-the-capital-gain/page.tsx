// Direct-answer question — AU FRCGW withholding calculation basis.
// Server component. Static HTML. Crawlable.

import type { Metadata } from "next";
import Link from "next/link";

const SHORT_ANSWER =
  "The 15% withholding applies to the sale price, not the capital gain. On a $900,000 sale, $135,000 is withheld at 15% of the sale price. This happens regardless of whether you made a $200,000 gain, a $50,000 gain, or no gain at all. The withholding is triggered by the sale itself, not by the profit. You may owe capital gains tax separately, but the 15% Foreign Resident Capital Gains Withholding is based on the sale price under TAA 1953 Subdivision 14-D.";

export const metadata: Metadata = {
  title: "Does the 15% withholding apply to the sale price or the capital gain? | TaxCheckNow",
  description: SHORT_ANSWER,
  alternates: { canonical: "https://www.taxchecknow.com/questions/does-the-15-withholding-apply-to-the-sale-price-or-the-capital-gain" },
  openGraph: {
    title: "Does the 15% withholding apply to the sale price or the capital gain?",
    description: SHORT_ANSWER,
    url: "https://www.taxchecknow.com/questions/does-the-15-withholding-apply-to-the-sale-price-or-the-capital-gain",
    type: "article",
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Does the 15% withholding apply to the sale price or the capital gain?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": SHORT_ANSWER,
      },
    },
  ],
};

const ARTICLE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Does the 15% withholding apply to the sale price or the capital gain?",
  "description": SHORT_ANSWER,
  "datePublished": "2026-04-29",
  "dateModified": "2026-04-29",
  "author": { "@type": "Organization", "name": "TaxCheckNow" },
  "publisher": { "@type": "Organization", "name": "TaxCheckNow" },
  "url": "https://www.taxchecknow.com/questions/does-the-15-withholding-apply-to-the-sale-price-or-the-capital-gain",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">

      <section className="bg-neutral-950 px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
            <Link href="/questions" className="hover:text-white">Questions</Link>
            <span className="mx-2 text-neutral-600">/</span>
            <span className="text-neutral-300">Australia · FRCGW</span>
          </p>
          <h1 className="mt-5 font-serif text-2xl sm:text-3xl font-bold leading-tight text-white">
            Does the 15% withholding apply to the sale price or the capital gain?
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

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">The rule explained</h2>
          <p>
            From 1 January 2025, the Foreign Resident Capital Gains Withholding (FRCGW) is calculated as 15% of the sale price. The calculation is simple: Withholding = Sale price × 15%. On a $900,000 property sale, the withholding is $900,000 × 15% = $135,000. This is deducted at settlement by the buyer's solicitor unless the seller provides an ATO clearance certificate. The withholding has nothing to do with the capital gain — it is triggered purely by the fact that a property sale occurred and the sale price exceeded $0 (threshold). The rule does not ask: did you make a gain or a loss? Did you break even? Did you make a $1 gain or a $500,000 gain? The rule only asks: what is the sale price? Calculate 15%. Withhold that amount.
          </p>
          <p>
            This is why sellers sometimes discover they are subject to withholding even though they made little or no capital gain. A seller who bought a property for $900,000 and sold it for $920,000 (gain of $20,000) will have $135,000 withheld on the $900,000 sale price. The gain is not $135,000. The gain is $20,000. But the withholding is based on the sale price, not the gain. The buyer withholds $135,000. The seller gets refunds for the portion that exceeds the actual tax liability through the income tax system in the following year.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">What most people get wrong</h2>
          <p>
            Many sellers and even some accountants assume the withholding is based on the capital gain. If I made a $50,000 gain on a $900,000 sale, surely the withholding is 15% of $50,000? Wrong. The withholding is 15% of the $900,000 sale price: $135,000. The capital gain is a separate issue assessed through the income tax system. FRCGW does not care about the capital gain — it only cares about the sale price. Sellers also assume the withholding is a final tax — money they lose forever. Wrong. If you are an Australian resident and you made little or no gain, you may recover most or all of the withholding through the tax system. But you need to file a tax return and claim it. The refund flows 6–18 months later.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Worked example</h2>
          <p>
            Property A: bought for $500,000, sold for $900,000. Capital gain = $400,000. Sale price = $900,000. FRCGW withholding = 15% of $900,000 = $135,000. Property B: bought for $850,000, sold for $900,000. Capital gain = $50,000. Sale price = $900,000. FRCGW withholding = 15% of $900,000 = $135,000. Same sale price, same withholding, very different gains. The withholding is identical because it is based on the sale price, not the gain. Property C: bought for $950,000, sold for $900,000. Capital loss = $50,000 (no capital gains tax liability). Sale price = $900,000. FRCGW withholding = 15% of $900,000 = $135,000. Even on a loss, the withholding applies because it is based on the sale price.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Run your check</h2>
          <p>
            The free FRCGW clearance certificate calculator shows your exact withholding exposure based on your sale price. The calculator also connects you to the CGT calculator to work out your separate capital gains tax liability. Takes 90 seconds each.
          </p>
          <div className="my-6">
            <Link
              href="/au/check/frcgw-clearance-certificate?utm_source=article&utm_medium=question_page&utm_campaign=au-19-frcgw-clearance-certificate"
              className="inline-block rounded-xl border-2 border-neutral-950 bg-neutral-950 px-6 py-4 text-white transition hover:-translate-y-0.5 font-serif font-bold"
            >
              Run your check →
            </Link>
          </div>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Related questions</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/questions/do-i-need-an-ato-clearance-certificate-if-im-an-australian-resident-selling-my" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Do I need an ATO clearance certificate if I'm an Australian resident selling my own house? →
              </Link>
            </li>
            <li>
              <Link href="/questions/is-the-frcgw-threshold-really-0-from-1-january-2025" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Is the FRCGW threshold really $0 from 1 January 2025? →
              </Link>
            </li>
            <li>
              <Link href="/questions/what-happens-if-i-dont-have-a-clearance-certificate-at-settlement-in-australia" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                What happens if I don't have a clearance certificate at settlement in Australia? →
              </Link>
            </li>
          </ul>

        </div>
      </article>

      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-2 text-center text-sm text-neutral-500">
          <p className="font-mono text-xs uppercase tracking-widest">TaxCheckNow</p>
          <p>Source: Australian Taxation Office (ATO)</p>
          <p>Rule: TAA 1953 Schedule 1 Subdivision 14-D</p>
          <p>Last verified: April 2026</p>
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
