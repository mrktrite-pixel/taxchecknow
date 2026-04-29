// Direct-answer question — AU FRCGW threshold change January 2025.
// Server component. Static HTML. Crawlable.

import type { Metadata } from "next";
import Link from "next/link";

const SHORT_ANSWER =
  "Yes. On 1 January 2025, the FRCGW threshold dropped from $750,000 to $0. Every Australian property sale is now in scope, regardless of sale price. A $300,000 apartment sale triggers the 15% withholding rule unless the seller produces an ATO clearance certificate. This is a fundamental rule change that affects every seller. On a $300,000 sale, $45,000 is withheld. On a $900,000 sale, $135,000 is withheld.";

export const metadata: Metadata = {
  title: "Is the FRCGW threshold really $0 from 1 January 2025? | TaxCheckNow",
  description: SHORT_ANSWER,
  alternates: { canonical: "https://www.taxchecknow.com/questions/is-the-frcgw-threshold-really-0-from-1-january-2025" },
  openGraph: {
    title: "Is the FRCGW threshold really $0 from 1 January 2025?",
    description: SHORT_ANSWER,
    url: "https://www.taxchecknow.com/questions/is-the-frcgw-threshold-really-0-from-1-january-2025",
    type: "article",
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is the FRCGW threshold really $0 from 1 January 2025?",
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
  "headline": "Is the FRCGW threshold really $0 from 1 January 2025?",
  "description": SHORT_ANSWER,
  "datePublished": "2026-04-29",
  "dateModified": "2026-04-29",
  "author": { "@type": "Organization", "name": "TaxCheckNow" },
  "publisher": { "@type": "Organization", "name": "TaxCheckNow" },
  "url": "https://www.taxchecknow.com/questions/is-the-frcgw-threshold-really-0-from-1-january-2025",
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
            Is the FRCGW threshold really $0 from 1 January 2025?
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
            Before 1 January 2025, the Foreign Resident Capital Gains Withholding (FRCGW) rule only applied to property sales above $750,000. Property sales under $750,000 were exempt. From 1 January 2025, the threshold dropped to $0. This means every property sale — from a $300,000 apartment to a $5 million farm — is now subject to the 15% withholding rule. The ATO withholds 15% at settlement unless the seller produces an ATO clearance certificate. This is a fundamental shift in the law. The rule is set out in TAA 1953 Schedule 1 Subdivision 14-D, enacted by the Treasury Laws Amendment (Foreign Resident Capital Gains Withholding) Act 2024, Royal Assent 21 November 2024, effective 1 January 2025.
          </p>
          <p>
            At the same time the threshold dropped, the withholding rate increased from 12.5% to 15%. This is a 20% jump in the withholding amount. On a $900,000 sale, the old rule (pre-1 Jan) would have withheld $112,500 at 12.5%. The new rule withholds $135,000 at 15%. The difference is $22,500 more cash locked up. Combined with the threshold drop to $0, the new rule affects far more sellers and withholds more money from each sale.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">What most people get wrong</h2>
          <p>
            Many accountants trained before 1 January 2025 still tell clients that FRCGW only applies to sales over $750,000. Wrong. The rule changed. Every property sale applies. Many sellers selling a first-home apartment for $400,000 assume they fall below the threshold and do not need to apply for a certificate. Wrong. At $400,000, the withholding is $60,000. If no certificate is provided, the buyer withholds $60,000 at settlement and the seller receives $340,000 on the day. The $60,000 is locked up pending tax refund (6–18 months). AI tools trained on pre-1 January data still quote the old $750,000 threshold and 12.5% rate. Trust the legislation: TAA 1953 Subdivision 14-D, effective 1 January 2025. Threshold $0. Rate 15%.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Worked example</h2>
          <p>
            Property sale price $400,000 (first apartment), Australian resident, settlement 30 May 2025. Under the old rule (pre-1 Jan 2025), FRCGW would not apply because the sale is under $750,000. Under the new rule (from 1 Jan 2025), FRCGW applies. Withholding: $400,000 × 15% = $60,000. Without the clearance certificate, the buyer withholds $60,000 at settlement. The seller receives $340,000 on settlement day. The $60,000 sits with the buyer pending ATO refund (6–18 months). This is a material cash position on a $400,000 sale. Many first-time sellers do not see it coming because they remember the old $750,000 threshold.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Run your check</h2>
          <p>
            The free FRCGW clearance certificate calculator applies the current rule (threshold $0, rate 15%) to your sale price and shows you the exact withholding exposure. Takes 90 seconds.
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
              <Link href="/questions/does-the-15-withholding-apply-to-the-sale-price-or-the-capital-gain" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Does the 15% withholding apply to the sale price or the capital gain? →
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
