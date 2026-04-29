// Direct-answer question — AU FRCGW withholding consequences at settlement.
// Server component. Static HTML. Crawlable.

import type { Metadata } from "next";
import Link from "next/link";

const SHORT_ANSWER =
  "The buyer's solicitor withholds 15% of the sale price at settlement. On a $900,000 sale, $135,000 is held by the buyer pending ATO refund. You receive 85% of the proceeds on settlement day. The withheld amount is locked up for 6–18 months until the refund flows through the tax system. This is why the certificate must arrive before settlement morning — there is no recovery option once settlement closes.";

export const metadata: Metadata = {
  title: "What happens if I don't have a clearance certificate at settlement in Australia? | TaxCheckNow",
  description: SHORT_ANSWER,
  alternates: { canonical: "https://www.taxchecknow.com/questions/what-happens-if-i-dont-have-a-clearance-certificate-at-settlement-in-australia" },
  openGraph: {
    title: "What happens if I don't have a clearance certificate at settlement in Australia?",
    description: SHORT_ANSWER,
    url: "https://www.taxchecknow.com/questions/what-happens-if-i-dont-have-a-clearance-certificate-at-settlement-in-australia",
    type: "article",
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What happens if I don't have a clearance certificate at settlement in Australia?",
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
  "headline": "What happens if I don't have a clearance certificate at settlement in Australia?",
  "description": SHORT_ANSWER,
  "datePublished": "2026-04-29",
  "dateModified": "2026-04-29",
  "author": { "@type": "Organization", "name": "TaxCheckNow" },
  "publisher": { "@type": "Organization", "name": "TaxCheckNow" },
  "url": "https://www.taxchecknow.com/questions/what-happens-if-i-dont-have-a-clearance-certificate-at-settlement-in-australia",
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
            What happens if I don't have a clearance certificate at settlement in Australia?
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
            From 1 January 2025, the ATO withholds 15% on all Australian property sales unless the seller produces an ATO clearance certificate before settlement. The withholding happens at settlement — the moment the contracts close and the buyer's solicitor receives the sale proceeds. If the clearance certificate has not arrived by 9 am on settlement day, the buyer's solicitor is legally required to withhold. There is no discretion. The buyer's solicitor does not get to choose. Under TAA 1953 Schedule 1 Subdivision 14-D, the withholding is mandatory if the certificate is not present.
          </p>
          <p>
            Once settlement closes, the withholding is locked in. The buyer's solicitor holds the $135,000 (on a $900,000 sale) in their trust account pending ATO refund. You receive $765,000 on settlement day. The $135,000 is released after the ATO processes your tax return and issues the refund — typically 6–18 months later. You cannot recover the money faster. You cannot dispute it. You cannot get the buyer to release it. The clock has already started, and you have lost the cash for months.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">What most people get wrong</h2>
          <p>
            Many sellers think they can apply for the certificate after settlement if the buyer withholds. Wrong. The certificate must be applied for and approved before settlement. Applying after settlement does not get the buyer to release the withheld funds — it only validates the refund claim for tax purposes. The damage is done: the cash is locked up. Sellers also assume the buyer will be flexible about release — wrong again. The buyer's solicitor is bound by law. They cannot release the funds without an ATO directive, which does not happen unless you lodge the certificate application before settlement and the ATO issues the certificate before settlement.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Worked example</h2>
          <p>
            Property sale price $900,000, settlement date 30 April 2025, no clearance certificate applied for. 9 am on 30 April, the buyer's solicitor receives the sale proceeds ($900,000) and the clearance certificate is not in their inbox. The solicitor withholds 15% ($135,000) and pays the seller $765,000. The $135,000 goes into the buyer's solicitor's trust account. The seller files a tax return in July 2025 claiming the withheld amount. The ATO processes the return and issues a refund cheque in November 2025 (7 months later). The seller's cash position is damaged for seven months on a $900,000 sale.
          </p>

          <h2 className="!mt-10 font-serif text-2xl font-bold text-neutral-950">Run your check</h2>
          <p>
            The free FRCGW clearance certificate calculator shows you the exact withholding amount, how urgent your application is, and whether you have enough time before settlement. Takes 90 seconds.
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
              <Link href="/questions/how-long-does-it-take-the-ato-to-issue-a-clearance-certificate" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                How long does it take the ATO to issue a clearance certificate? →
              </Link>
            </li>
            <li>
              <Link href="/questions/does-the-15-withholding-apply-to-the-sale-price-or-the-capital-gain" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Does the 15% withholding apply to the sale price or the capital gain? →
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
