// Direct-answer question — AU FRCGW clearance certificate requirement for Australian residents.
// Server component. Static HTML. Crawlable.

import type { Metadata } from "next";
import Link from "next/link";

const SHORT_ANSWER =
  "Yes. Even if you are an Australian resident, you need an ATO clearance certificate to prevent the buyer from withholding 15% of the sale price at settlement. Without the certificate, $135,000 is withheld on a $900,000 sale. The certificate is free, takes 1–4 weeks, and must arrive before settlement.";

export const metadata: Metadata = {
  title: "Do I need an ATO clearance certificate if I'm an Australian resident selling my own house? | TaxCheckNow",
  description: SHORT_ANSWER,
  alternates: { canonical: "https://www.taxchecknow.com/questions/do-i-need-an-ato-clearance-certificate-if-im-an-australian-resident-selling-my" },
  openGraph: {
    title: "Do I need an ATO clearance certificate if I'm an Australian resident selling my own house?",
    description: SHORT_ANSWER,
    url: "https://www.taxchecknow.com/questions/do-i-need-an-ato-clearance-certificate-if-im-an-australian-resident-selling-my",
    type: "article",
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need an ATO clearance certificate if I'm an Australian resident selling my own house?",
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
  "headline": "Do I need an ATO clearance certificate if I'm an Australian resident selling my own house?",
  "description": SHORT_ANSWER,
  "datePublished": "2026-04-29",
  "dateModified": "2026-04-29",
  "author": { "@type": "Organization", "name": "TaxCheckNow" },
  "publisher": { "@type": "Organization", "name": "TaxCheckNow" },
  "url": "https://www.taxchecknow.com/questions/do-i-need-an-ato-clearance-certificate-if-im-an-australian-resident-selling-my",
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
            Do I need an ATO clearance certificate if I'm an Australian resident selling my own house?
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
            From 1 January 2025, the ATO withholds 15% of the sale price on every Australian property sale. The threshold is $0 — all property sales apply, not just sales over $750,000. The clearance certificate exempts Australian tax residents from the withholding. Without the certificate, the buyer's solicitor must withhold 15% at settlement. On a $900,000 sale, that is $135,000 locked up with the buyer pending ATO refund (6–18 months). The rule is set out in TAA 1953 Schedule 1 Subdivision 14-D (Foreign Resident Capital Gains Withholding), which came into effect 1 January 2025.
          </p>
          <p>
            The certificate is free and available to Australian tax residents. Processing takes 1–4 weeks. Your accountant lodges the application with the ATO. The ATO issues the certificate in your name. Your accountant forwards it to the buyer's solicitor before settlement. One document prevents $135,000 of cash disruption. The issue is timing — the certificate must arrive before settlement morning, not after. Settlement dates are locked into the contract and non-negotiable.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">What most people get wrong</h2>
          <p>
            Most Australian residents assume their residency status protects them. Wrong. The ATO requires the certificate regardless of whether you have been an Australian tax resident for fifty years. Without the certificate, the buyer withholds 15% automatically. The exemption requires the certificate — the residency status alone does not prevent withholding. Many sellers do not find out until their accountant calls weeks before settlement with bad news: processing takes up to four weeks, settlement is locked in, and you need to apply immediately.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Worked example</h2>
          <p>
            $900,000 property sale, Australian resident, no certificate applied yet. Withholding exposure: $135,000 at settlement if no certificate. Apply now (4–6 weeks before settlement), ATO issues certificate in 2–3 weeks, accountant delivers certificate to buyer's solicitor 2 weeks before settlement, settlement closes with full payment. Zero withholding. Versus: do nothing, buyer withholds $135,000 at settlement, you receive $765,000 on the day, the $135,000 sits with buyer's solicitor for 6–18 months pending ATO refund through the tax system.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Run your check</h2>
          <p>
            The free FRCGW clearance certificate calculator confirms whether you need the certificate, how much withholding is at risk, and how urgent your application is. Takes 90 seconds.
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
              <Link href="/questions/what-happens-if-i-dont-have-a-clearance-certificate-at-settlement-in-australia" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                What happens if I don't have a clearance certificate at settlement in Australia? →
              </Link>
            </li>
            <li>
              <Link href="/questions/how-long-does-it-take-the-ato-to-issue-a-clearance-certificate" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                How long does it take the ATO to issue a clearance certificate? →
              </Link>
            </li>
            <li>
              <Link href="/questions/is-the-frcgw-threshold-really-0-from-1-january-2025" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Is the FRCGW threshold really $0 from 1 January 2025? →
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
