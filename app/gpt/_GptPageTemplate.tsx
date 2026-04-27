// ── Shared layout for /gpt/[slug] landing pages ──────────────────────────
// Server component. All content is supplied by per-page page.tsx files.
// Each route renders fully-static HTML at build time.

import Link from "next/link";

export interface GptPageProps {
  title:               string;
  oneLiner:             string;
  countryLabel:          string;   // "Australia" / "United Kingdom" / "Global" etc.
  productLabel:           string;   // e.g. "CGT Main Residence Trap"
  calcUrl:                  string;   // e.g. "/au/check/cgt-main-residence-trap"
  prompt:                    string;   // verbatim ChatGPT-style question
  countryDescriptor:           string;   // "Australian" | "UK" | "US" | "Canadian" | "New Zealand" | "global nomad"
  authorityShort:               string;   // "ATO" | "HMRC" | "IRS" | "CRA" | "IRD" | "AEAT/HMRC/etc."
  lastVerified:                  string;   // "2026"
  ruleParagraphs:                  [string, string]; // answerBody[0], answerBody[1]
  mistakes:                          [string, string]; // mistakes[0], mistakes[1]
  aiWrong:                            string;
  aiReality:                           string;
  badges:                                string[];     // 4-6 strings from lawBarBadges
  related:                                  { slug: string; title: string }[];
}

export default function GptPageTemplate(p: GptPageProps) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">

      {/* BREADCRUMB */}
      <p className="font-mono text-xs text-neutral-400 uppercase tracking-widest mb-6">
        TaxCheckNow → GPT Checks → {p.countryLabel} → {p.productLabel}
      </p>

      {/* HERO */}
      <h1 className="font-serif text-3xl font-bold text-neutral-950 mb-4 leading-tight">{p.title}</h1>
      <p className="text-lg text-neutral-600 mb-8">{p.oneLiner}</p>

      {/* PRIMARY CTA — calculator first */}
      <div className="rounded-2xl border-2 border-neutral-950 bg-neutral-950 p-6 mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">
          Free check — personalised result
        </p>
        <p className="text-white font-serif text-xl font-bold mb-4">
          Get your exact position in 2 minutes
        </p>
        <Link href={p.calcUrl} className="inline-block rounded-xl bg-white text-neutral-950 font-bold px-6 py-3 hover:bg-neutral-100 transition">
          Run the free check →
        </Link>
      </div>

      {/* THE PROMPT BLOCK */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-amber-700 mb-3">
          The question this check answers
        </p>
        <p className="font-serif text-xl font-bold text-neutral-950 mb-4 italic">&ldquo;{p.prompt}&rdquo;</p>
        <p className="text-sm text-amber-900 mb-4">
          This is one of the most misunderstood questions in {p.countryDescriptor} tax. Most people assume the answer — and get it wrong.
        </p>
        <a
          href="https://chat.openai.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg border border-amber-300 bg-white text-amber-800 text-sm font-medium px-4 py-2 hover:bg-amber-100 transition"
        >
          Ask ChatGPT this question ↗
        </a>
        <p className="text-xs text-amber-700 mt-2">
          Opens in new tab. ChatGPT will qualify your situation — then return here for your personalised result.
        </p>
      </div>

      {/* THE RULE */}
      <div className="mb-8">
        <h2 className="font-serif text-2xl font-bold text-neutral-950 mb-4">What the rule actually says</h2>
        <p className="text-neutral-700 leading-relaxed mb-3">{p.ruleParagraphs[0]}</p>
        <p className="text-neutral-700 leading-relaxed mb-3">{p.ruleParagraphs[1]}</p>
      </div>

      {/* WHAT PEOPLE GET WRONG */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 mb-8">
        <h2 className="font-serif text-xl font-bold text-neutral-950 mb-4">What most people get wrong</h2>
        <div className="space-y-3">
          <div className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">✗</span>
            <p className="text-sm text-neutral-700">{p.mistakes[0]}</p>
          </div>
          <div className="flex gap-3">
            <span className="text-red-500 font-bold shrink-0">✗</span>
            <p className="text-sm text-neutral-700">{p.mistakes[1]}</p>
          </div>
        </div>
      </div>

      {/* WHAT CHATGPT GETS WRONG */}
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 mb-8">
        <h2 className="font-serif text-xl font-bold text-neutral-950 mb-4">What AI tools get wrong about this</h2>
        <p className="text-sm text-neutral-700 mb-3">
          AI systems including ChatGPT often give outdated or incomplete answers on this topic because tax rules change faster than model training data.
        </p>
        <div className="space-y-3">
          <div>
            <p className="font-mono text-xs text-red-600 uppercase tracking-widest mb-1">AI often says:</p>
            <p className="text-sm text-neutral-700 italic">&ldquo;{p.aiWrong}&rdquo;</p>
          </div>
          <div>
            <p className="font-mono text-xs text-emerald-600 uppercase tracking-widest mb-1">Reality:</p>
            <p className="text-sm text-neutral-700">{p.aiReality}</p>
          </div>
        </div>
      </div>

      {/* AUTHORITY BAR */}
      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Authority sources</p>
        <div className="flex flex-wrap gap-2">
          {p.badges.map(b => (
            <span key={b} className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700">
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* SECONDARY CTA */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">Your personalised answer</p>
        <h3 className="font-serif text-xl font-bold text-neutral-950 mb-2">
          ChatGPT gives a general answer. This gives you your exact position.
        </h3>
        <p className="text-sm text-neutral-600 mb-4">
          Free calculator. Takes 2 minutes. Built around {p.authorityShort} rules confirmed {p.lastVerified}.
        </p>
        <Link href={p.calcUrl} className="inline-block rounded-xl bg-neutral-950 text-white font-bold px-6 py-3 hover:bg-neutral-800 transition">
          Run the free check →
        </Link>
        <p className="text-xs text-neutral-500 mt-2">Free · No account · Personalised result</p>
      </div>

      {/* RELATED GPT PAGES */}
      <div>
        <h3 className="font-serif text-lg font-bold text-neutral-950 mb-4">Related checks</h3>
        <div className="space-y-2">
          {p.related.map(r => (
            <Link
              key={r.slug}
              href={`/gpt/${r.slug}`}
              className="block rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 hover:border-neutral-950 transition"
            >
              {r.title} →
            </Link>
          ))}
        </div>
      </div>

      {/* SCHEMA */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type":     "FAQPage",
            "mainEntity": [{
              "@type":  "Question",
              "name":    p.prompt,
              "acceptedAnswer": {
                "@type": "Answer",
                "text":   p.ruleParagraphs[0],
              },
            }],
          }),
        }}
      />

    </main>
  );
}
