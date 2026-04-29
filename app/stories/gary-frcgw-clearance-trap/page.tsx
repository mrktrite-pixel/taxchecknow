// Real story — Gary Mitchell, Bibra Lake property sale, FRCGW withholding trap.
// Server component. Static HTML. Crawlable.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Gary's $135,000 Withholding Trap — The Rule Change Nobody Told Him About | TaxCheckNow",
  description: "Gary, 64, was selling his Bibra Lake investment property for $900,000. His accountant called: the ATO is withholding $135,000 unless he gets a certificate first. The rule changed on 1 January 2025.",
  alternates: { canonical: "https://www.taxchecknow.com/stories/gary-frcgw-clearance-trap" },
  openGraph: {
    title: "Gary's $135,000 Withholding Trap — The Rule Change Nobody Told Him About",
    description: "Settlement was 3 weeks away. The certificate takes 4 weeks minimum. The accountant had just given him the number: $135,000.",
    url: "https://www.taxchecknow.com/stories/gary-frcgw-clearance-trap",
    type: "article",
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Foreign Resident Capital Gains Withholding (FRCGW) and when did it change?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "From 1 January 2025, the ATO withholds 15% of the sale price on the disposal of any Australian property (threshold dropped from $750,000 to $0). The rate increased from 12.5% to 15%. The seller must obtain an ATO clearance certificate to prevent withholding. Processing takes 1–4 weeks. The certificate must be issued and provided to the buyer's solicitor BEFORE settlement.",
      },
    },
    {
      "@type": "Question",
      "name": "Who needs the clearance certificate?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Every seller of an Australian property from 1 January 2025 onwards needs a clearance certificate or the buyer will withhold 15%. Australian tax residents apply for a standard certificate (1–4 weeks). Foreign residents must apply for a variation certificate (longer, conditional). Even if you owe no CGT (main residence exemption), you still need the certificate to prevent withholding.",
      },
    },
    {
      "@type": "Question",
      "name": "What happens if the certificate does not arrive before settlement?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "If the certificate has not been delivered to the buyer's solicitor by 9 am on settlement day, the buyer's solicitor is legally required to withhold 15% from the seller's proceeds. The money is held pending ATO refund (6–18 months later). This is cash-flow disruption you can avoid by applying early — 4 to 6 weeks before settlement.",
      },
    },
  ],
};

const ARTICLE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "Gary's $135,000 Withholding Trap — The Rule Change Nobody Told Him About",
  "description": "A retired Perth electrician was selling his Bibra Lake property for $900,000 when his accountant called with news: the ATO is withholding $135,000 at settlement unless he files a form.",
  "datePublished": "2026-04-29",
  "dateModified": "2026-04-29",
  "author": { "@type": "Organization", "name": "TaxCheckNow" },
  "publisher": { "@type": "Organization", "name": "TaxCheckNow" },
  "url": "https://www.taxchecknow.com/stories/gary-frcgw-clearance-trap",
};

export default function GaryFRCGWStoryPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">

      <section className="bg-neutral-950 px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
            <Link href="/stories" className="hover:text-white">Stories</Link>
            <span className="mx-2 text-neutral-600">/</span>
            <span className="text-neutral-300">Australia · FRCGW Clearance</span>
          </p>
          <h1 className="mt-5 font-serif text-3xl sm:text-4xl font-bold leading-tight text-white">
            Gary's $135,000 Withholding Trap — The Rule Change Nobody Told Him About
          </h1>
          <div className="mt-6 inline-flex items-baseline gap-3 rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Withholding</span>
            <span className="font-serif text-2xl font-bold text-rose-200">$135,000</span>
          </div>
        </div>
      </section>

      <article className="bg-white px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-6 text-[17px] leading-[1.75] text-neutral-800">

          <p>
            Gary Mitchell is sixty-four. Retired electrician. Lives in Mandurah, Western Australia. Wife Deborah, semi-retired bookkeeper. Three grandkids. And until mid-2025, Gary had a Bibra Lake investment property worth $900,000 that was about to become his biggest tax headache.
          </p>

          <p>
            Settlement was booked for late April 2025. The buyer was ready. The contracts were signed. Then, on a Friday afternoon in mid-February, Gary's accountant called with news that made Gary's stomach drop: "Gary, the ATO is withholding $135,000 at your settlement unless you file a clearance certificate form first. The rule changed on New Year's Day. Processing takes up to four weeks. We need to apply today."
          </p>

          <p>
            $135,000 was two years of Gary's rental income. It was the difference between deploying the capital when he wanted to and waiting six to eighteen months for a refund. Gary had never heard of this rule. Neither had his accountant until January 2025.
          </p>

          <h2 className="!mt-12 font-serif text-2xl font-bold text-neutral-950">The rule that changed on New Year's Day 2025</h2>

          <p>
            From 1 January 2025, the ATO changed the Foreign Resident Capital Gains Withholding rules dramatically. The threshold dropped from $750,000 to $0 — meaning every Australian property sale, from a $300,000 apartment to a $5 million farm, is now in scope. The withholding rate jumped from 12.5% to 15%. On a $900,000 sale, that is $135,000 withheld at settlement, unless the seller produces an ATO clearance certificate before the buyer's solicitor closes the transaction.
          </p>

          <p>
            The clearance certificate is free. The ATO issues it to confirm the seller is either an Australian resident (automatically exempt from withholding) or qualifies for an exemption under variation provisions. Processing time is 1 to 4 weeks. The certificate must be handed to the buyer's solicitor BEFORE settlement — not after. This is the hard deadline. Settlement date is locked into the contract. You cannot delay it to wait for the certificate. If the certificate has not arrived by 9 am on settlement morning, the buyer's solicitor is legally required to withhold 15% from your sale proceeds. That money is then held in the buyer's solicitor's trust account pending the ATO refund through the tax system — a 6 to 18 month wait. Gary had 46 days until settlement. Processing the certificate would take 1 to 4 weeks if he applied immediately. The math was tight.
          </p>

          <p>
            The legislation: Taxation Administration Act 1953 Schedule 1 Subdivision 14-D, enacted by the Treasury Laws Amendment (Foreign Resident Capital Gains Withholding) Act 2024, effective 1 January 2025.
          </p>

          <h2 className="!mt-12 font-serif text-2xl font-bold text-neutral-950">What Gary got wrong — and what most people get wrong</h2>

          <p>
            Gary assumed this rule only applied to foreign residents. Wrong. Every property seller needs the certificate — Australian residents included. Without it, the buyer must withhold. The ATO refunds the money at tax-return time if you are Australian, but your cash is locked up for months.
          </p>

          <p>
            Gary also assumed the old rule (12.5% threshold $750,000) still applied. Wrong. As of 1 January 2025, it is 15% on every sale. Many accountants trained on pre-2025 data still quote the old numbers. This happened to Gary — his accountant did not flag it until mid-February, two months after the rule changed.
          </p>

          <p>
            The third mistake people make: assuming you can apply for the certificate at settlement or shortly after. Wrong. Processing takes 1–4 weeks. Settlement happens on a date locked in the contract. If the certificate has not arrived by settlement morning, the withholding happens automatically. Gary's accountant understood this, which is why he called on a Friday afternoon instead of waiting until Monday morning.
          </p>

          <h2 className="!mt-12 font-serif text-2xl font-bold text-neutral-950">What Gary did next</h2>

          <p>
            Gary ran the FRCGW clearance-certificate check the same day his accountant called. He entered: $900,000 sale price, Australian resident status (he had lived in Australia his entire life, paid tax here every year), no certificate yet, 46 days to settlement. The calculator showed: $135,000 withholding at risk, but 46 days was enough margin. Apply now. Get the certificate before settlement. Hand it to the solicitor. No withholding. No cash disruption.
          </p>

          <p>
            Gary's accountant lodged the ATO application within 48 hours with complete residency evidence. The ATO issued the certificate in eighteen days. Gary's accountant sent it to the buyer's solicitor three weeks before settlement. Settlement completed on time. Gary received the full $900,000. No withholding. No cash locked up. The only cost was the couple of hours Gary spent understanding the rule and the ATO spent processing the certificate. By acting immediately on the Friday call, Gary avoided $135,000 of cash-flow disruption.
          </p>

          <div className="my-8">
            <Link
              href="/au/check/frcgw-clearance-certificate?utm_source=story&utm_medium=article&utm_campaign=au-19-frcgw-clearance-certificate"
              className="inline-block rounded-xl bg-neutral-950 px-7 py-4 font-serif text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-black"
            >
              Check your withholding exposure free →
            </Link>
            <p className="mt-3 text-sm text-neutral-500">
              Anonymous. Takes about 90 seconds.
            </p>
          </div>

          <h2 className="!mt-12 font-serif text-2xl font-bold text-neutral-950">FAQ</h2>

          <h3 className="font-serif text-lg font-bold text-neutral-950">What is Foreign Resident Capital Gains Withholding (FRCGW)?</h3>
          <p>
            From 1 January 2025, the ATO withholds 15% of the sale price on the disposal of any Australian property. The threshold is $0 — every property sale applies. The seller must obtain a clearance certificate to prevent withholding. Processing takes 1–4 weeks. The certificate must be issued and provided to the buyer's solicitor BEFORE settlement.
          </p>

          <h3 className="font-serif text-lg font-bold text-neutral-950">Who needs the clearance certificate?</h3>
          <p>
            Every seller of an Australian property from 1 January 2025 onwards. Australian tax residents apply for a standard certificate (1–4 weeks). Foreign residents must apply for a variation certificate (longer, conditional). Even if you owe no CGT (main residence exemption), you still need the certificate to prevent withholding.
          </p>

          <h3 className="font-serif text-lg font-bold text-neutral-950">What happens if the certificate does not arrive before settlement?</h3>
          <p>
            The buyer's solicitor is legally required to withhold 15% from your proceeds. That money is held pending ATO refund (6–18 months later). You can avoid this by applying early — 4 to 6 weeks before settlement, not 1 week before.
          </p>

        </div>
      </article>

      <section className="border-t border-neutral-200 bg-neutral-50 px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Related reading</p>
          <ul className="mt-4 space-y-2">
            <li>
              <Link href="/au/check/div296-wealth-eraser?utm_source=story&utm_medium=article&utm_campaign=au-19-frcgw-clearance-certificate" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Also check your Division 296 super tax position →
              </Link>
            </li>
            <li>
              <Link href="/gpt/frcgw-clearance-certificate?utm_source=story&utm_medium=article&utm_campaign=au-19-frcgw-clearance-certificate" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Full FRCGW rule explained →
              </Link>
            </li>
            <li>
              <Link href="/questions/what-is-frcgw-clearance-certificate?utm_source=story&utm_medium=article&utm_campaign=au-19-frcgw-clearance-certificate" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Can I delay settlement to wait for the certificate? →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TaxCheckNow</p>
          <p className="mt-2 text-xs text-neutral-500">
            Source: ATO — Foreign Resident Capital Gains Withholding · TAA 1953 Schedule 1 Subdivision 14-D · Treasury Laws Amendment (Foreign Resident Capital Gains Withholding) Act 2024 · Effective 1 January 2025 · Last verified: April 2026
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
