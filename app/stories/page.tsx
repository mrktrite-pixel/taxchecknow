// /stories — index of all real-world tax stories.
// Server component. Static HTML. Crawlable by Google + AI search.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:        "Real Tax Stories — What Actually Happened | TaxCheckNow",
  description:  "Real people, real tax bills, real lessons. Stories of what went wrong, what it cost, and what they should have done — across Australia, UK, US, Canada and New Zealand.",
  alternates:   { canonical: "https://www.taxchecknow.com/stories" },
  openGraph:    {
    title:       "Real Tax Stories — What Actually Happened",
    description: "Real people, real tax bills, real lessons across AU, UK, US, CAN and NZ.",
    url:          "https://www.taxchecknow.com/stories",
    type:          "website",
  },
};

interface StoryItem {
  slug:      string;
  title:     string;
  hook:      string;
  fearNumber: string;
}

const AU: StoryItem[] = [
  {
    slug:       "gary-cgt-main-residence-trap",
    title:      "Gary Sold His Mandurah House — and Got a Tax Bill He Never Saw Coming",
    hook:       "He thought once he lived there it was his home. The ATO counts every year back to the day he bought it.",
    fearNumber: "$47,000",
  },
];

const UK:    StoryItem[] = [];
const US:    StoryItem[] = [];
const CAN:   StoryItem[] = [];
const NZ:    StoryItem[] = [];
const NOMAD: StoryItem[] = [];

const ALL: { region: string; tag: string; items: StoryItem[] }[] = [
  { region: "Australia",        tag: "AU",    items: AU    },
  { region: "United Kingdom",    tag: "UK",    items: UK    },
  { region: "United States",      tag: "US",    items: US    },
  { region: "Canada",              tag: "CAN",   items: CAN   },
  { region: "New Zealand",          tag: "NZ",    items: NZ    },
  { region: "Nomad / Global",        tag: "NOMAD", items: NOMAD },
];

const TOTAL = ALL.reduce((s, g) => s + g.items.length, 0);

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type":      "WebPage",
      "name":       "Real Tax Stories",
      "url":         "https://www.taxchecknow.com/stories",
      "description": "Real-world tax stories: what went wrong, what it cost, what to do instead.",
    },
    {
      "@type":         "ItemList",
      "name":          "Tax Stories",
      "numberOfItems": TOTAL,
      "itemListElement": ALL.flatMap((g, gi) =>
        g.items.map((it, idx) => ({
          "@type":   "ListItem",
          "position": gi * 100 + idx + 1,
          "name":     it.title,
          "url":      `https://www.taxchecknow.com/stories/${it.slug}`,
        }))
      ),
    },
  ],
};

export default function StoriesIndexPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">

      <section className="bg-neutral-950 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-neutral-400">TaxCheckNow · Real Stories</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-white">Real Tax Stories</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-neutral-300 leading-relaxed">
            Real people. Real tax bills. Real lessons. What went wrong, what it cost, and what they should have done instead.
          </p>
        </div>
      </section>

      <section className="bg-neutral-50 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl space-y-12">
          {ALL.filter(g => g.items.length > 0).map(group => (
            <div key={group.tag}>
              <header className="mb-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{group.tag} · {group.items.length} {group.items.length === 1 ? "story" : "stories"}</p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-neutral-950">{group.region}</h2>
              </header>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.items.map(it => (
                  <li key={it.slug}>
                    <Link
                      href={`/stories/${it.slug}`}
                      className="block rounded-xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow"
                    >
                      <p className="font-mono text-[10px] uppercase tracking-widest text-rose-700">Bill: {it.fearNumber}</p>
                      <p className="mt-2 font-serif text-base font-bold leading-snug text-neutral-950">{it.title}</p>
                      <p className="mt-2 text-sm text-neutral-600 italic">&ldquo;{it.hook}&rdquo;</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {TOTAL === 0 && (
            <p className="text-center text-sm text-neutral-500">More stories coming soon.</p>
          )}
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TaxCheckNow</p>
          <p className="mt-2 text-xs text-neutral-500">
            Stories are based on real situations. Names and identifying details may be changed. Not financial advice. Always consult a qualified adviser.
          </p>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />
    </main>
  );
}
