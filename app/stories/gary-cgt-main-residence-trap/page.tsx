// Real story — Gary Mitchell, Mandurah, AU CGT main residence trap.
// Server component. Static HTML. Crawlable.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:        "Gary Sold His Mandurah House — And Got a Tax Bill He Never Saw Coming | TaxCheckNow",
  description:  "Gary, 64, sold his Mandurah investment property after living in it. He thought the main residence exemption applied. The ATO disagreed. The bill: $47,000.",
  alternates:   { canonical: "https://www.taxchecknow.com/stories/gary-cgt-main-residence-trap" },
  openGraph:    {
    title:       "Gary Sold His Mandurah House — And Got a Tax Bill He Never Saw Coming",
    description: "He thought once he lived there it was his home. The ATO counts every year back to the day he bought it. The bill: $47,000.",
    url:          "https://www.taxchecknow.com/stories/gary-cgt-main-residence-trap",
    type:          "article",
  },
};

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type":     "FAQPage",
  "mainEntity": [
    {
      "@type":     "Question",
      "name":      "Does renting my property before moving in affect the main residence CGT exemption in Australia?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text":  "Yes. Under ITAA 1997 s118-185, the main residence CGT exemption is reduced proportionally for any period the property was not your main residence — including time it was rented out. The exempt fraction equals the days you actually lived there as your main residence divided by total days of ownership. If you rented it for 8 of 11 years before moving in, only 3/11 of the gain is exempt and 8/11 is taxable.",
      },
    },
  ],
};

const ARTICLE_SCHEMA = {
  "@context":  "https://schema.org",
  "@type":      "NewsArticle",
  "headline":   "Gary Sold His Mandurah House and Got a Tax Bill He Never Expected",
  "description": "A retired Perth electrician thought his main residence exemption was complete. The ATO calculated 8/11 of the gain was taxable.",
  "datePublished": "2026-04-29",
  "dateModified":   "2026-04-29",
  "author":          { "@type": "Organization", "name": "TaxCheckNow" },
  "publisher":         { "@type": "Organization", "name": "TaxCheckNow" },
  "url":                 "https://www.taxchecknow.com/stories/gary-cgt-main-residence-trap",
};

export default function GaryStoryPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">

      <section className="bg-neutral-950 px-6 py-14 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
            <Link href="/stories" className="hover:text-white">Stories</Link>
            <span className="mx-2 text-neutral-600">/</span>
            <span className="text-neutral-300">Australia · CGT Main Residence</span>
          </p>
          <h1 className="mt-5 font-serif text-3xl sm:text-4xl font-bold leading-tight text-white">
            Gary Sold His Mandurah House and Got a Tax Bill He Never Expected
          </h1>
          <div className="mt-6 inline-flex items-baseline gap-3 rounded-lg border border-rose-900/60 bg-rose-950/30 px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Tax bill</span>
            <span className="font-serif text-2xl font-bold text-rose-200">$47,000</span>
          </div>
        </div>
      </section>

      <article className="bg-white px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-6 text-[17px] leading-[1.75] text-neutral-800">

          <p>
            Gary Mitchell is sixty-four. Retired electrician. Lives in Perth. Three grandkids, a paid-off house in Bull Creek, and — until eighteen months ago — an investment property in Mandurah that had been the cornerstone of his retirement plan.
          </p>

          <p>
            He bought the Mandurah place in 2013. For the first eight years he rented it out. Decent yield, decent tenants, a small mortgage he chipped away at. In 2021 the last tenant moved out and Gary made the call he had been thinking about for years: he and his wife would move in, do it up slowly, and then sell when the market was right. They lived there for three years. New kitchen. Repainted the lot. Built a deck. By early 2024 the house had nearly doubled in value from when he bought it, and the agent told him the timing was as good as it was ever going to get.
          </p>

          <p>
            They sold in March 2024 for a number Gary still describes as &ldquo;life-changing.&rdquo; He cleared the mortgage, paid out a small builder&rsquo;s lien, and tucked the rest into a term deposit while he and his wife worked out what to do next. As far as Gary was concerned, the gain was tax-free. It had been their home when he sold it. He&rsquo;d been told — repeatedly, by mates, by an old podcast, by a quick search online — that the main residence exemption meant your home was not taxed.
          </p>

          <p>
            The letter from the ATO arrived eighteen months later.
          </p>

          <p className="border-l-4 border-neutral-950 pl-5 italic text-neutral-700">
            &ldquo;I thought once I lived there it was my home. I didn&rsquo;t know the ATO counts every year back to when you first bought it.&rdquo;
          </p>

          <p>
            The bill was forty-seven thousand dollars. Plus interest. Gary read it three times before he believed it.
          </p>

          <h2 className="!mt-12 font-serif text-2xl font-bold text-neutral-950">The rule, in the simplest possible words</h2>

          <p>
            The main residence CGT exemption in Australia is not all-or-nothing. It is proportional. The ATO looks at the entire period you owned the property and works out what fraction of those days the property was actually your main residence. That fraction of the gain is tax-free. The rest is taxable.
          </p>

          <p>
            Gary owned the Mandurah house for roughly eleven years. He lived in it for three. The other eight, it was rented out. The ATO&rsquo;s calculation was the one mandated by ITAA 1997 s118-185: eight elevenths of the gain — the rented years — was taxable. Three elevenths was exempt. The exempt fraction did not stretch backwards just because he eventually moved in.
          </p>

          <p>
            The 50% CGT discount applied to the taxable portion (he had owned it more than twelve months), and a small market-value cost-base reset under s118-192 helped at the margin. But none of that erased the core problem: the day he started renting it out in 2013, he started a clock that the move-in in 2021 could not unwind.
          </p>

          <h2 className="!mt-12 font-serif text-2xl font-bold text-neutral-950">What Gary should have done differently</h2>

          <p>
            There were three points where a different decision would have changed the outcome.
          </p>

          <p>
            <strong>2013, when he bought it.</strong> If Gary had moved in immediately and established it as his main residence first — even for a short period — the &ldquo;6-year absence rule&rdquo; under s118-145 could have applied later. That rule lets you treat a property as your main residence for up to six years while you rent it out, provided you established it as your home first. Gary missed that. By renting it from day one, the absence rule was permanently unavailable to him on this property.
          </p>

          <p>
            <strong>2021, when he moved in.</strong> An accountant should have run the numbers at this point. The market-value cost-base reset (s118-192) was triggered the moment he moved in for the first time. Gary did not get a valuation. The ATO accepted the purchase price as the cost base because no contemporaneous valuation existed. A formal valuation that day would likely have lifted the cost base by tens of thousands and reduced the taxable gain accordingly.
          </p>

          <p>
            <strong>Before signing the contract in 2024.</strong> A pre-sale CGT check — even a free one — would have surfaced the eight-elevenths problem before the auction. Gary could have negotiated, timed the sale differently, or at minimum put aside the right amount of money. Instead he was blindsided by a bill arriving long after he had spent some of the proceeds.
          </p>

          <h2 className="!mt-12 font-serif text-2xl font-bold text-neutral-950">If this sounds like you — or anyone you know</h2>

          <p>
            The trap Gary fell into is the most common CGT mistake we see in Australia. People assume the exemption protects the home they live in. It only protects the days they lived there. If you rented your property at any point before, after, or during ownership, your exemption is partial. The only question is what fraction.
          </p>

          <p>
            We built a free check that calculates that fraction in about ninety seconds. It uses the same method the ATO uses. It doesn&rsquo;t need your tax file number. It tells you the answer before you sign anything.
          </p>

          <div className="my-8">
            <Link
              href="/au/check/cgt-main-residence-trap"
              className="inline-block rounded-xl bg-neutral-950 px-7 py-4 font-serif text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-black"
            >
              Check your CGT position free →
            </Link>
            <p className="mt-3 text-sm text-neutral-500">
              Free. Anonymous. Takes about a minute.
            </p>
          </div>

        </div>
      </article>

      <section className="border-t border-neutral-200 bg-neutral-50 px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Related reading</p>
          <ul className="mt-4 space-y-2">
            <li>
              <Link href="/gpt/au-cgt-main-residence-trap" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                The full rule explained — CGT Main Residence Trap →
              </Link>
            </li>
            <li>
              <Link href="/questions/does-renting-affect-cgt-exemption-australia" className="font-serif text-base font-bold text-neutral-950 underline-offset-4 hover:underline">
                Does renting my property affect the CGT main residence exemption in Australia? →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TaxCheckNow</p>
          <p className="mt-2 text-xs text-neutral-500">
            Story based on a real situation. Names and identifying details have been changed. Not financial advice. Always consult a qualified adviser.
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
