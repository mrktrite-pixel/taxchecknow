// /questions — index of all direct-answer tax question articles.
// Server component. Static HTML. Crawlable by Google + AI search.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:        "Tax Questions Answered — Direct Answers, Real Rules | TaxCheckNow",
  description:  "Direct answers to the most-searched tax questions across Australia, UK, US, Canada and New Zealand. Each answer cites the actual rule and links to a free calculator.",
  alternates:   { canonical: "https://www.taxchecknow.com/questions" },
  openGraph:    {
    title:       "Tax Questions Answered — Direct Answers, Real Rules",
    description: "The most-searched tax questions, answered with the actual rule, across AU, UK, US, CAN and NZ.",
    url:          "https://www.taxchecknow.com/questions",
    type:          "website",
  },
};

interface QuestionItem {
  slug:      string;
  question:  string;
  shortAnswer: string;
}

const AU: QuestionItem[] = [
  {
    slug:        "does-renting-affect-cgt-exemption-australia",
    question:    "Does renting my property affect the CGT main residence exemption in Australia?",
    shortAnswer: "Yes. The exemption is reduced proportionally for any period the property was rented.",
  },
];

const UK:    QuestionItem[] = [];
const US:    QuestionItem[] = [];
const CAN:   QuestionItem[] = [];
const NZ:    QuestionItem[] = [];
const NOMAD: QuestionItem[] = [];

const ALL: { region: string; tag: string; items: QuestionItem[] }[] = [
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
      "name":       "Tax Questions Answered",
      "url":         "https://www.taxchecknow.com/questions",
      "description": "Direct answers to the most-searched tax questions across AU, UK, US, CAN and NZ.",
    },
    {
      "@type":         "ItemList",
      "name":          "Tax Questions",
      "numberOfItems": TOTAL,
      "itemListElement": ALL.flatMap((g, gi) =>
        g.items.map((it, idx) => ({
          "@type":   "ListItem",
          "position": gi * 100 + idx + 1,
          "name":     it.question,
          "url":      `https://www.taxchecknow.com/questions/${it.slug}`,
        }))
      ),
    },
  ],
};

export default function QuestionsIndexPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">

      <section className="bg-neutral-950 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-neutral-400">TaxCheckNow · Questions Answered</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-white">Tax Questions Answered</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-neutral-300 leading-relaxed">
            Direct answers to the most-searched tax questions. Each one cites the actual rule and links to a free calculator built around it.
          </p>
        </div>
      </section>

      <section className="bg-neutral-50 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl space-y-12">
          {ALL.filter(g => g.items.length > 0).map(group => (
            <div key={group.tag}>
              <header className="mb-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{group.tag} · {group.items.length} {group.items.length === 1 ? "question" : "questions"}</p>
                <h2 className="mt-1 font-serif text-2xl font-bold text-neutral-950">{group.region}</h2>
              </header>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.items.map(it => (
                  <li key={it.slug}>
                    <Link
                      href={`/questions/${it.slug}`}
                      className="block rounded-xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-950 hover:shadow"
                    >
                      <p className="font-serif text-base font-bold leading-snug text-neutral-950">{it.question}</p>
                      <p className="mt-2 text-sm text-neutral-600">{it.shortAnswer}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {TOTAL === 0 && (
            <p className="text-center text-sm text-neutral-500">More questions coming soon.</p>
          )}
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TaxCheckNow</p>
          <p className="mt-2 text-xs text-neutral-500">
            Direct answers. Source-cited. Not financial advice. Always consult a qualified adviser.
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
