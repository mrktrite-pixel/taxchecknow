// scripts/generate-blog-pages.ts
// ─────────────────────────────────────────────────────────────────────────────
// BLOG ENGINE P1 — THE PAGE GENERATOR. Emits STATIC pages from approved posts.
//
//   npx ts-node --project cole/tsconfig.json scripts/generate-blog-pages.ts
//     --dry-run   emit nothing, write nothing; print exactly what would happen
//     --ping      submit THIS RUN's newly published URLs to IndexNow. DEFAULT OFF.
//     --ping-published --since YYYY-MM-DD | --urls <comma list>
//                 submit already-published URLs. REFUSES without a bound — see B2.
//
// WHY STATIC DIRECTORIES AND NOT /blog/[cluster]/[slug]. RULED. This storefront
// has essentially no dynamic content routes — every product, gpt, story and
// question page is a generated literal directory, and the ONLY dynamic segment
// in the whole app tree is app/api/decision-sessions/[id]. A dynamic blog route
// would be the first of its kind here, and it would also put a database read on
// the request path of a page whose entire purpose is to be a fast static
// document. So the database is read at BUILD time, by this file, exactly as
// scripts/generate-gpt-pages.ts reads cole/config at build time.
//
// WHAT "IDEMPOTENT" MEANS HERE. The generator reads BOTH 'approved' and
// 'published' rows and rewrites every page from scratch each run. Re-running
// changes nothing except files whose content actually changed; it never
// duplicates a page, and it never resurrects a row the operator rejected. Only
// rows that were 'approved' on entry are flipped to 'published' — a second run
// has nothing left to flip.
//
// IT WILL NOT INVENT A CTA. The calculator URL is carried in the row
// (gate_result.cta_url, resolved by the bee from products.slug via
// buildCalculatorUrl, which refuses rather than guesses). A row without one is
// SKIPPED with a named reason, because seven live published posts once carried a
// 404 calculator link and that is the failure this whole chain exists to avoid.
//
// product_questions IS NOT TOUCHED. content_performance IS NOT TOUCHED.
// distributionBee() IS NOT CALLED. The only writes are to blog_posts, and only
// the three publish columns.
// ─────────────────────────────────────────────────────────────────────────────
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { bodyMdToJsx, stampOf, answerOf, linksOf, lit } from "./blog-md-to-jsx";
import { pingIndexNow } from "../lib/blog/ping-indexnow";

/* ── ENV, bee-s's search order adapted to this repo's depth ────────────────
   First hit wins per key, and an already-set process.env ALWAYS wins so a shell
   export can override a file. It loads, it never prints a value. The extra
   ../../cole-marketing candidate is this repo's own depth: taxchecknow sits at
   CitationGap/cluster-worldwide/taxchecknow, so the estate's shared .env.local
   is two levels up, not one. */
const ENV_FILES_READ: string[] = [];
function loadEnv(): void {
  const candidates = [
    process.env.BLOG_ENV_FILE,
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", "cole-marketing", ".env.local"),
    path.resolve(process.cwd(), "..", "..", "cole-marketing", ".env.local"),
  ].filter((p): p is string => !!p);
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    ENV_FILES_READ.push(file);
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (process.env[k] === undefined && v !== "") process.env[k] = v;
    }
  }
}
loadEnv();

const argv = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null;
};
const DRY = argv.includes("--dry-run");
const PING = argv.includes("--ping");
/* ── B2 — THE CAPPED PING ─────────────────────────────────────────────────
   --ping submits only what THIS RUN published, which is correct and also means
   it submits nothing when there is nothing new. The gap that leaves is a post
   published before the key existed, with no way to submit it.
   --ping-published fills that gap, and it is DELIBERATELY NOT USABBLE BARE.
   An unbounded "resubmit everything published" is one keystroke away from
   firing the entire corpus at IndexNow on every regeneration — irrevocable,
   rate-limited, and indistinguishable from spam at scale. So it REFUSES
   without a bound: either --since YYYY-MM-DD (published on or after) or
   --urls <comma list> (exactly these, and they must be published). */
const PING_PUBLISHED = argv.includes("--ping-published");
const PING_SINCE = flag("--since");
const PING_URLS = flag("--urls");
const SITE = "taxchecknow";
const ORIGIN = "https://www.taxchecknow.com";
const BYLINE = "TaxCheckNow Research Team";
const LASTMOD_FILE = path.join("app", "blog-lastmod.json");

interface PostRow {
  id: string;
  site: string;
  product_key: string;
  cluster: string;
  slug: string;
  title: string;
  meta_description: string | null;
  body_md: string;
  status: string;
  verification_date: string | null;
  published_at: string | null;
  published_url: string | null;
  citations: unknown;
  gate_result: unknown;
  created_at: string;
  updated_at: string;
  /** B1 — joined from v_live_catalogue, never derived from product_key. */
  country?: string;
  product_name?: string;
}

interface Citation { title?: string; url?: string; is_primary?: boolean }

/**
 * JSON-LD, safe to drop inside a <script> tag.
 *
 * The existing question/story pages hardcode their schema objects, so a literal
 * "</script>" could never appear in them. THIS generator builds schema from
 * DATABASE CONTENT — a post title or answer is operator-approved but it is still
 * not a constant — and a value containing "</script>" would close the tag early
 * and turn the rest of the page into markup. Escaping < > & as unicode leaves the
 * JSON semantically identical and makes that impossible.
 */
function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/** Repo-relative, forward-slashed, for logs. blogPath() returns absolute paths. */
function rel(file: string): string {
  return path.relative(process.cwd(), file).split(path.sep).join("/");
}

/* ── B1 — COUNTRY CHROME, TAKEN FROM THE HOMEPAGE ─────────────────────────
   app/page.tsx is the reference for a directory surface on this storefront, and
   two things about it are load-bearing rather than cosmetic:

   1. ITS FILTER PILLS ARE ANCHOR LINKS, NOT A JS TOGGLE. INDEX_PILLS renders
      <a href="#all-checks-au"> against sections carrying scroll-mt-24, and
      app/page.tsx has no "use client". So the whole 46-check directory is static
      HTML that a crawler reads in one pass. A client toggle would hide every
      filtered section behind JS on a page whose entire purpose is to be
      crawlable, so the blog hub follows the anchor pattern exactly.
   2. Its emoji + label pairs are the estate's country vocabulary. Reused
      verbatim below, including 🌍 for nomad, so /blog and / agree.

   Countries are read from v_live_catalogue, never derived from the product_key.
   MEASURED: the catalogue uses au | can | nomad | nz | uk | us. */
const COUNTRY_CHROME: Record<string, { label: string; emoji: string }> = {
  au:    { label: "Australia",   emoji: "🇦🇺" },
  uk:    { label: "UK",          emoji: "🇬🇧" },
  us:    { label: "US",          emoji: "🇺🇸" },
  nz:    { label: "New Zealand", emoji: "🇳🇿" },
  can:   { label: "Canada",      emoji: "🇨🇦" },
  nomad: { label: "Nomad",       emoji: "🌍" },
};
/** Homepage pill order. Anything unknown sorts last, alphabetically. */
const COUNTRY_ORDER = ["au", "uk", "us", "nz", "can", "nomad"];

function countryChrome(code: string): { label: string; emoji: string } {
  return COUNTRY_CHROME[code] ?? { label: code.toUpperCase(), emoji: "" };
}

/**
 * The verification date, read OUT of the post body.
 *
 * blog_posts.verification_date is deliberately null — the corpus carries the date
 * as display text ("21 April 2026") and parsing a localised date into a DATE
 * column was left for a ruling. The stamp line in the body is therefore the only
 * place the date exists, so the card reads it from there rather than inventing a
 * second source. No stamp, no date on the card — never a guess from published_at,
 * which is when WE published, not when the figures were checked.
 */
function verificationDateOf(bodyMd: string): string | null {
  const stamp = stampOf(bodyMd);
  if (!stamp) return null;
  const m = /\bon\s+(\d{1,2}\s+\p{L}+\s+\d{4})\s*\.?$/u.exec(stamp.trim());
  return m ? m[1] : null;
}

function clusterLabel(cluster: string): string {
  return cluster.split("-").map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}

function postPath(cluster: string, slug: string): string {
  return `/blog/${cluster}/${slug}`;
}

/**
 * Is `u` genuinely a URL on this storefront?
 *
 * startsWith(ORIGIN) IS NOT THAT TEST, and the difference is an open redirect:
 * "https://www.taxchecknow.com.evil.example/au/check/x" passes startsWith and is
 * a different host. The CTA becomes a link on a published tax page, so a crafted
 * value would be a phishing link wearing our own copy. Parsing and comparing the
 * HOST is the only check that means what it says.
 */
function isOwnOrigin(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" && parsed.host === new URL(ORIGIN).host;
  } catch {
    return false;
  }
}

/** gate_result.cta_url, or a body link to this storefront's own /check/ path. */
function ctaUrlFor(row: PostRow): string | null {
  const gr = row.gate_result as { cta_url?: unknown } | null;
  if (gr && typeof gr.cta_url === "string" && isOwnOrigin(gr.cta_url) && new URL(gr.cta_url).pathname.includes("/check/")) {
    return gr.cta_url;
  }
  const fromBody = linksOf(row.body_md).find((u) => isOwnOrigin(u) && new URL(u).pathname.includes("/check/"));
  return fromBody ?? null;
}

/**
 * A cluster or slug segment that is safe to use as a DIRECTORY NAME.
 *
 * The generator builds paths out of database values. blog_posts rows are shared
 * state: the bee writes them, the operator edits status, and nothing structurally
 * prevents a slug of "../../../app/api" from being stored. path.join would then
 * resolve OUTSIDE app/blog and this script would overwrite real source files.
 * The bee's own slug derivation strips everything but letters, digits and
 * hyphens, so this refuses nothing it produces — it simply declines to trust a
 * value it did not create.
 */
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]{0,99}$/;
function segmentFault(cluster: string, slug: string): string | null {
  if (!SAFE_SEGMENT.test(cluster)) return `cluster ${JSON.stringify(cluster)} is not a safe path segment (lowercase letters, digits and hyphens only)`;
  if (!SAFE_SEGMENT.test(slug)) return `slug ${JSON.stringify(slug)} is not a safe path segment (lowercase letters, digits and hyphens only)`;
  return null;
}

/**
 * Resolve a path under app/blog and PROVE it stayed there.
 *
 * The segment check above should make this unreachable. It is here anyway because
 * "should" is not a guarantee, and the cost of being wrong is this script writing
 * over app/api or app/layout.tsx.
 */
function blogPath(...segments: string[]): string {
  const root = path.resolve("app", "blog");
  const full = path.resolve(root, ...segments);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error(`generate-blog-pages: refusing to write outside app/blog — resolved ${full}`);
  }
  return full;
}

function citationsOf(row: PostRow): Citation[] {
  return Array.isArray(row.citations) ? (row.citations as Citation[]) : [];
}

/* ── THE POST PAGE ───────────────────────────────────────────────────────── */

function buildPostPage(row: PostRow, siblings: PostRow[], ctaUrl: string): string {
  const url = `${ORIGIN}${postPath(row.cluster, row.slug)}`;
  const answer = answerOf(row.body_md) ?? row.meta_description ?? row.title;
  const description = (row.meta_description ?? answer).slice(0, 300);
  const stamp = stampOf(row.body_md);
  const blocks = bodyMdToJsx(row.body_md);
  const published = (row.published_at ?? row.created_at).slice(0, 10);
  const modified = row.updated_at.slice(0, 10);
  const cites = citationsOf(row).filter((c) => typeof c.url === "string");

  const ORG = { "@type": "Organization", name: "TaxCheckNow", url: ORIGIN };

  const ARTICLE = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: row.title,
    description,
    datePublished: published,
    dateModified: modified,
    author: ORG,
    publisher: ORG,
    url,
    inLanguage: "en",
    isAccessibleForFree: true,
    // The authority pages this post draws on. citation is the correct property for
    // "this work references that work", and it is the machine-readable half of the
    // claim the body makes in prose.
    citation: cites.map((c) => ({ "@type": "WebPage", name: c.title ?? c.url, url: c.url })),
  };

  // FAQPage, with the post's own question as the entity — the same shape
  // app/questions/<slug>/page.tsx uses. The title IS a question here, so this is
  // not a schema bolted onto unrelated prose.
  const FAQ = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [{
      "@type": "Question",
      name: row.title,
      acceptedAnswer: { "@type": "Answer", text: answer },
    }],
  };

  const siblingLinks = siblings
    .filter((s) => s.id !== row.id)
    .slice(0, 5)
    .map((s) => `            <li><Link href={${lit(postPath(s.cluster, s.slug))}} className="underline decoration-neutral-400 underline-offset-2 hover:text-neutral-950">{${lit(s.title)}}</Link></li>`)
    .join("\n");

  return `// AUTO-GENERATED by scripts/generate-blog-pages.ts — do not edit by hand.
// Source: public.blog_posts id ${row.id} (product ${row.product_key}, cluster ${row.cluster})
// Regenerate: npx ts-node --project cole/tsconfig.json scripts/generate-blog-pages.ts
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:        ${lit(`${row.title} | TaxCheckNow`)},
  description:  ${lit(description)},
  alternates:   { canonical: ${lit(url)} },
  openGraph:    {
    title:       ${lit(row.title)},
    description: ${lit(description)},
    url:          ${lit(url)},
    type:          "article",
  },
};

const ARTICLE_SCHEMA_JSON = ${lit(safeJsonLd(ARTICLE))};
const FAQ_SCHEMA_JSON = ${lit(safeJsonLd(FAQ))};

export default function Page() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">

      <section className="bg-neutral-950 px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
            <Link href="/blog" className="hover:text-white">Blog</Link>
            <span className="mx-2 text-neutral-600">/</span>
            <Link href={${lit(`/blog/${row.cluster}`)}} className="hover:text-white">{${lit(clusterLabel(row.cluster))}}</Link>
          </p>
          <h1 className="mt-5 font-serif text-2xl sm:text-3xl font-bold leading-tight text-white">
            {${lit(row.title)}}
          </h1>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
            {${lit(BYLINE)}}
          </p>
        </div>
      </section>

      <article className="bg-white px-6 py-12 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-6 text-[17px] leading-[1.75] text-neutral-800">
${blocks.map((b) => `          ${b}`).join("\n")}

          <div className="!mt-10 rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Check your own position</p>
            <p className="mt-2">
              <Link href={${lit(ctaUrl)}} className="underline decoration-neutral-400 underline-offset-2 hover:text-neutral-950">
                Open the calculator for this topic
              </Link>
            </p>
          </div>
${siblingLinks ? `
          <div className="!mt-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">More in {${lit(clusterLabel(row.cluster))}}</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-[16px]">
${siblingLinks}
            </ul>
          </div>
` : ""}        </div>
      </article>

      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TaxCheckNow</p>
${stamp ? `          <p className="mt-2 text-xs text-neutral-500">{${lit(stamp)}}</p>\n` : ""}          <p className="mt-2 text-xs text-neutral-500">
            Information is general in nature and not financial advice. Always consult a qualified adviser before acting.
          </p>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ARTICLE_SCHEMA_JSON }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_SCHEMA_JSON }} />
    </main>
  );
}
`;
}

/* ── HUBS ────────────────────────────────────────────────────────────────── */

function buildClusterHub(cluster: string, rows: PostRow[]): string {
  const url = `${ORIGIN}/blog/${cluster}`;
  const label = clusterLabel(cluster);
  const items = rows.map((r) => {
    const vdate = verificationDateOf(r.body_md);
    const cc = r.country ? countryChrome(r.country) : null;
    return `            <li>
              <Link href={${lit(postPath(r.cluster, r.slug))}} className="group block">
                <p className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
${cc ? `                  <span className="inline-flex items-center gap-1"><span aria-hidden>{${lit(cc.emoji)}}</span>{${lit(cc.label)}}</span>\n                  <span aria-hidden className="text-neutral-300">·</span>\n` : ""}                  <span>{${lit(label)}}</span>
${vdate ? `                  <span aria-hidden className="text-neutral-300">·</span>\n                  <span>{${lit(`Verified ${vdate}`)}}</span>\n` : ""}                </p>
                <p className="font-serif text-xl font-bold text-neutral-950 group-hover:underline">{${lit(r.title)}}</p>
                <p className="mt-1 text-[15px] text-neutral-600">{${lit((r.meta_description ?? "").slice(0, 200))}}</p>
              </Link>
            </li>`;
  }).join("\n");

  /* ── B1 — THE CALCULATOR RAIL, ABOVE THE POSTS ────────────────────────────
     Every post in a cluster answers a question about ONE product, so the
     cluster hub's most useful element is that product's own check. It sits ABOVE
     the list because a reader who already knows their question wants the tool,
     not three more articles.
     THE URL IS THE ONE THE POST CARRIES — gate_result.cta_url, resolved by the
     bee from products.slug. The rail is omitted entirely when no post in the
     cluster has one, rather than linking a guessed path. */
  const railRow = rows.find((r) => !!ctaUrlFor(r));
  const railUrl = railRow ? (ctaUrlFor(railRow) as string) : null;
  const railName = railRow?.product_name ?? null;
  const rail = railUrl
    ? `
          <Link
            href={${lit(railUrl)}}
            className="group mb-10 block rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-5 transition hover:border-neutral-400"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">The check behind these notes</p>
            <p className="mt-2 font-serif text-xl font-bold text-neutral-950">{${lit(railName ?? label)}}</p>
            <p className="mt-1 text-[15px] text-neutral-600">Free, no sign-up. Answer the gates and see which outcome applies to you.</p>
            <p className="mt-3 text-sm font-bold text-neutral-950 group-hover:underline">Run the free check →</p>
          </Link>`
    : "";

  return `// AUTO-GENERATED by scripts/generate-blog-pages.ts — do not edit by hand.
// Cluster hub: ${cluster} (${rows.length} post(s))
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:        ${lit(`${label} — Tax Research | TaxCheckNow`)},
  description:  ${lit(`Research notes on ${label.toLowerCase()}, each one citing the authority it draws on.`)},
  alternates:   { canonical: ${lit(url)} },
  openGraph:    { title: ${lit(label)}, description: ${lit(`Research notes on ${label.toLowerCase()}.`)}, url: ${lit(url)}, type: "website" },
};

export default function Page() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">
      <section className="bg-neutral-950 px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">
            <Link href="/blog" className="hover:text-white">Blog</Link>
          </p>
          <h1 className="mt-5 font-serif text-2xl sm:text-3xl font-bold leading-tight text-white">{${lit(label)}}</h1>
          <p className="mt-3 text-[15px] text-neutral-300">{${lit(`${rows.length} research note${rows.length === 1 ? "" : "s"}, each citing its source.`)}}</p>
        </div>
      </section>
      <section className="bg-white px-6 py-12 sm:py-14">
        <div className="mx-auto max-w-3xl">${rail}
          <ul className="space-y-8">
${items}
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
    </main>
  );
}
`;
}

/** One post card: country badge, cluster label, title, verification date. */
function postCard(r: PostRow, indent: string): string {
  const vdate = verificationDateOf(r.body_md);
  const cc = r.country ? countryChrome(r.country) : null;
  const i = indent;
  return `${i}<li>
${i}  <Link href={${lit(postPath(r.cluster, r.slug))}} className="group block rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-400">
${i}    <p className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
${cc ? `${i}      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5"><span aria-hidden>{${lit(cc.emoji)}}</span>{${lit(cc.label)}}</span>\n` : ""}${i}      <span>{${lit(clusterLabel(r.cluster))}}</span>
${vdate ? `${i}      <span aria-hidden className="text-neutral-300">·</span>\n${i}      <span>{${lit(`Verified ${vdate}`)}}</span>\n` : ""}${i}    </p>
${i}    <p className="font-serif text-lg font-bold leading-snug text-neutral-950 group-hover:underline">{${lit(r.title)}}</p>
${i}    <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-600">{${lit((r.meta_description ?? "").slice(0, 180))}}</p>
${i}  </Link>
${i}</li>`;
}

function buildBlogHub(byCluster: Map<string, PostRow[]>): string {
  const url = `${ORIGIN}/blog`;
  const posts = [...byCluster.values()].flat();
  const total = posts.length;

  /* ── B1 — GROUPED BY COUNTRY, FILTERED BY ANCHORS ─────────────────────────
     Follows app/page.tsx's INDEX_PILLS exactly: the pills are <a href="#id">
     against sections carrying scroll-mt-24, and the page stays a server
     component. Nothing is hidden behind JS, so every post is in the HTML a
     crawler reads on the first pass — which is the whole point of a blog whose
     value is being cited.
     ONLY COUNTRIES PRESENT GET A PILL. A chip for an empty country would be a
     link to nothing. */
  const byCountry = new Map<string, PostRow[]>();
  for (const r of posts) {
    const k = r.country ?? "other";
    const arr = byCountry.get(k) ?? [];
    arr.push(r);
    byCountry.set(k, arr);
  }
  const countries = [...byCountry.keys()].sort((a, b) => {
    const ia = COUNTRY_ORDER.indexOf(a), ib = COUNTRY_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });

  const pills = [
    `            <li><a href="#blog-index" className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-4 py-1.5 text-xs font-bold text-white whitespace-nowrap">All</a></li>`,
    ...countries.map((c) => {
      const cc = c === "other" ? { label: "Other", emoji: "" } : countryChrome(c);
      return `            <li><a href={${lit(`#blog-${c}`)}} className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-950 whitespace-nowrap">${cc.emoji ? `<span aria-hidden>{${lit(cc.emoji)}}</span>` : ""}{${lit(cc.label)}}</a></li>`;
    }),
  ].join("\n");

  const sections = countries.map((c) => {
    const rows = byCountry.get(c) ?? [];
    const cc = c === "other" ? { label: "Other", emoji: "" } : countryChrome(c);
    const clustersHere = [...new Set(rows.map((r) => r.cluster))];
    return `          <div id={${lit(`blog-${c}`)}} className="scroll-mt-24">
            <h2 className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">
              ${cc.emoji ? `<span aria-hidden className="mr-1.5">{${lit(cc.emoji)}}</span>` : ""}{${lit(`${cc.label} — ${rows.length} note${rows.length === 1 ? "" : "s"}`)}}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
${rows.map((r) => postCard(r, "              ")).join("\n")}
            </ul>
            <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
${clustersHere.map((cl) => `              <Link href={${lit(`/blog/${cl}`)}} className="hover:text-neutral-950 hover:underline">{${lit(`All ${clusterLabel(cl)} →`)}}</Link>`).join("\n")}
            </p>
          </div>`;
  }).join("\n");

  return `// AUTO-GENERATED by scripts/generate-blog-pages.ts — do not edit by hand.
// Blog hub: ${byCluster.size} cluster(s), ${total} post(s)
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:        "Tax Research — Figures, Sources and Dates | TaxCheckNow",
  description:  "Research notes on tax positions across Australia, the UK, the US, Canada and New Zealand. Every figure is traceable to the authority it came from, with the date it was verified.",
  alternates:   { canonical: ${lit(url)} },
  openGraph:    {
    title:       "Tax Research — Figures, Sources and Dates",
    description: "Every figure traceable to the authority it came from, with the date it was verified.",
    url:          ${lit(url)},
    type:          "website",
  },
};

export default function Page() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 font-sans">
      <section className="bg-neutral-950 px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-widest text-neutral-400">TaxCheckNow</p>
          <h1 className="mt-5 font-serif text-2xl sm:text-3xl font-bold leading-tight text-white">Tax research</h1>
          <p className="mt-4 text-[15px] leading-[1.7] text-neutral-300">
            Each note answers one question, states the figure, names the authority it came from and the date it was
            checked. We publish what the regulator publishes; we do not give advice.
          </p>
        </div>
      </section>
      <section id="blog-index" className="scroll-mt-24 bg-neutral-50 px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 text-center">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-neutral-950">{${lit(`${total} research note${total === 1 ? "" : "s"}`)}}</h2>
            <p className="mt-2 text-sm text-neutral-600">Grouped by jurisdiction · static HTML · every link crawlable</p>
          </header>

          {/* Filter pills — anchor links, exactly as app/page.tsx does it. No client JS. */}
          <div className="mb-10 overflow-x-auto">
            <ul className="flex min-w-max items-center gap-2">
${pills}
            </ul>
          </div>

          <div className="space-y-12">
${sections}
          </div>
        </div>
      </section>
      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">TaxCheckNow</p>
          <p className="mt-2 text-xs text-neutral-500">
            Information is general in nature and not financial advice. Always consult a qualified adviser before acting.
          </p>
        </div>
      </footer>
    </main>
  );
}
`;
}

/* ── MAIN ────────────────────────────────────────────────────────────────── */

function writeIfChanged(file: string, content: string): "written" | "unchanged" {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return "unchanged";
  if (DRY) return "written";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  return "written";
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");

  console.log(`\nBLOG PAGE GENERATOR${DRY ? "   [DRY RUN — nothing written]" : ""}${PING ? "   [--ping ON]" : PING_PUBLISHED ? "   [--ping-published]" : "   [ping off]"}`);
  console.log(`env files read: ${ENV_FILES_READ.join(", ") || "(none)"}`);

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb
    .from("blog_posts")
    .select("id, site, product_key, cluster, slug, title, meta_description, body_md, status, verification_date, published_at, published_url, citations, gate_result, created_at, updated_at")
    .eq("site", SITE)
    .in("status", ["approved", "published"])
    .order("cluster", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`blog_posts read failed: ${error.message}`);

  const all = (data ?? []) as PostRow[];

  /* ── B1 — JOIN THE CATALOGUE FOR country AND name ──────────────────────────
     blog_posts has no country column, and deriving one from the product_key
     prefix would be the guess-from-the-key habit that put a 404 calculator link
     on seven live posts. v_live_catalogue is the same source the bee enrolled
     from, so the hub's country badges cannot disagree with the roster.
     FAIL-SOFT: an unreadable catalogue leaves country undefined, the post lands
     in the "Other" section, and the page still builds. A missing badge is a
     cosmetic loss; a wrong badge is a factual claim about jurisdiction. */
  if (all.length > 0) {
    const keys = [...new Set(all.map((r) => r.product_key))];
    const { data: cat, error: cErr } = await sb
      .from("v_live_catalogue")
      .select("product_id, country, name")
      .eq("site", SITE)
      .in("product_id", keys);
    if (cErr) {
      console.log(`  ⓘ  v_live_catalogue unreadable (${cErr.message}) — country badges and calculator names will be omitted`);
    } else {
      const byKey = new Map(((cat ?? []) as Array<{ product_id: string; country: string | null; name: string | null }>)
        .map((c) => [c.product_id, c]));
      let missing = 0;
      for (const r of all) {
        const c = byKey.get(r.product_key);
        if (!c) { missing++; continue; }
        r.country = (c.country ?? "").toLowerCase() || undefined;
        r.product_name = c.name ?? undefined;
      }
      console.log(`catalogue join: ${byKey.size} of ${keys.length} product(s) resolved${missing ? ` · ${missing} post(s) have no catalogue row (badge omitted)` : ""}`);
    }
  }

  const newlyApproved = all.filter((r) => r.status === "approved");
  console.log(`rows: ${all.length} emittable (${newlyApproved.length} approved -> will publish, ${all.length - newlyApproved.length} already published)`);
  if (all.length === 0) {
    console.log("\nnothing approved. No pages emitted, no hubs rewritten, blog-lastmod.json left alone.");
    return;
  }

  // A row with no resolvable calculator URL is SKIPPED, loudly. It is not
  // published, so nothing downstream can serve a post with a dead CTA.
  const skipped: Array<{ row: PostRow; reason: string }> = [];
  const emittable: PostRow[] = [];
  for (const r of all) {
    // The path check runs FIRST. A row whose cluster or slug is not a safe
    // directory name is refused before anything is resolved from it.
    const fault = segmentFault(r.cluster, r.slug);
    if (fault) { skipped.push({ row: r, reason: `unsafe path segment — ${fault}` }); continue; }
    const cta = ctaUrlFor(r);
    if (!cta) { skipped.push({ row: r, reason: "no calculator URL on this origin in gate_result.cta_url and none in the body — refusing to publish a post with no CTA rather than invent one" }); continue; }
    if (!r.body_md.trim()) { skipped.push({ row: r, reason: "body_md is empty (a recorded refusal row, not a post)" }); continue; }
    emittable.push(r);
  }

  const byCluster = new Map<string, PostRow[]>();
  for (const r of emittable) {
    const arr = byCluster.get(r.cluster) ?? [];
    arr.push(r);
    byCluster.set(r.cluster, arr);
  }

  const emitted: string[] = [];
  const unchanged: string[] = [];
  const lastmod: Record<string, string> = fs.existsSync(LASTMOD_FILE)
    ? (JSON.parse(fs.readFileSync(LASTMOD_FILE, "utf8")) as Record<string, string>)
    : {};

  for (const [cluster, rows] of byCluster) {
    for (const r of rows) {
      const cta = ctaUrlFor(r) as string;
      const file = blogPath(cluster, r.slug, "page.tsx");
      const res = writeIfChanged(file, buildPostPage(r, rows, cta));
      (res === "written" ? emitted : unchanged).push(file);
      lastmod[postPath(cluster, r.slug)] = new Date(r.updated_at).toISOString();
    }
    const hubFile = blogPath(cluster, "page.tsx");
    const res = writeIfChanged(hubFile, buildClusterHub(cluster, rows));
    (res === "written" ? emitted : unchanged).push(hubFile);
  }

  const blogHub = blogPath("page.tsx");
  const hubRes = writeIfChanged(blogHub, buildBlogHub(byCluster));
  (hubRes === "written" ? emitted : unchanged).push(blogHub);

  if (!DRY) {
    fs.mkdirSync(path.dirname(LASTMOD_FILE), { recursive: true });
    fs.writeFileSync(LASTMOD_FILE, `${JSON.stringify(lastmod, null, 2)}\n`, "utf8");
  }

  console.log(`\nEMITTED ${emitted.length} file(s):`);
  for (const f of emitted) console.log(`  + ${rel(f)}`);
  if (unchanged.length) {
    console.log(`unchanged ${unchanged.length} file(s):`);
    for (const f of unchanged) console.log(`  = ${rel(f)}`);
  }
  console.log(`\n${LASTMOD_FILE.split(path.sep).join("/")}: ${Object.keys(lastmod).length} entr(y|ies)`);
  for (const [k, v] of Object.entries(lastmod)) console.log(`  ${k}  ${v}`);

  if (skipped.length) {
    console.log(`\nSKIPPED ${skipped.length} row(s) — NOT published:`);
    for (const s of skipped) console.log(`  ${s.row.id.slice(0, 8)} ${s.row.slug}: ${s.reason}`);
  }

  /* ── PUBLISH: only rows that entered this run as 'approved'. ─────────────
     Done AFTER the files exist, so a generator that died mid-write cannot leave
     a row marked published with no page behind it. */
  const toPublish = emittable.filter((r) => r.status === "approved");
  if (toPublish.length === 0) {
    console.log(`\nno rows to flip (every emittable row was already 'published')`);
  } else if (DRY) {
    console.log(`\nwould flip ${toPublish.length} row(s) to 'published' (dry run — not done)`);
    for (const r of toPublish) console.log(`  ${r.id} -> ${ORIGIN}${postPath(r.cluster, r.slug)}`);
  } else {
    const now = new Date().toISOString();
    for (const r of toPublish) {
      const publishedUrl = `${ORIGIN}${postPath(r.cluster, r.slug)}`;
      const { error: uErr } = await sb.from("blog_posts")
        .update({ status: "published", published_at: now, published_url: publishedUrl, updated_at: now })
        .eq("id", r.id);
      if (uErr) console.log(`  ⓘ  ${r.id} NOT flipped: ${uErr.message}`);
      else console.log(`\npublished ${r.id} -> ${publishedUrl}`);
    }
  }

  /* ── INDEXNOW — opt-in only. ─────────────────────────────────────────────
     Default OFF so a routine regeneration cannot fire an irrevocable submission
     at search engines. */
  if (!PING && !PING_PUBLISHED) {
    console.log(`\nindexnow: not pinged (no --ping / --ping-published; both are off by default)`);
    return;
  }

  // THE BOUND IS CHECKED BEFORE ANYTHING IS SELECTED, so a bare
  // --ping-published cannot even compute a URL list, let alone send one.
  let urls: string[];
  if (PING_PUBLISHED) {
    if (!PING_SINCE && !PING_URLS) {
      console.log(`\nindexnow: REFUSED — --ping-published requires a bound.`);
      console.log(`  Pass ONE of:`);
      console.log(`    --since YYYY-MM-DD      submit posts published on or after that date`);
      console.log(`    --urls <comma list>     submit exactly these published URLs`);
      console.log(`  WHY: unbounded, this flag resubmits every published post on every run.`);
      console.log(`  An IndexNow submission cannot be recalled, so the bound is mandatory rather than advisory.`);
      process.exitCode = 1;
      return;
    }
    if (PING_SINCE && !/^\d{4}-\d{2}-\d{2}$/.test(PING_SINCE)) {
      console.log(`\nindexnow: REFUSED — --since must be YYYY-MM-DD, got ${JSON.stringify(PING_SINCE)}`);
      process.exitCode = 1;
      return;
    }
    // Published rows only. An approved-but-unpublished post has no live URL, and
    // submitting one would point a crawler at a 404.
    const livePosts = emittable.filter((r) => r.status === "published" || toPublish.includes(r));
    const liveUrls = new Map(livePosts.map((r) => [`${ORIGIN}${postPath(r.cluster, r.slug)}`, r]));

    if (PING_URLS) {
      const asked = PING_URLS.split(",").map((u) => u.trim()).filter(Boolean);
      const unknown = asked.filter((u) => !liveUrls.has(u));
      if (unknown.length > 0) {
        console.log(`\nindexnow: REFUSED — ${unknown.length} of ${asked.length} URL(s) are not published posts of this site:`);
        for (const u of unknown.slice(0, 5)) console.log(`    ${u}`);
        console.log(`  Only a URL this generator has published may be submitted; otherwise the ping is a claim we cannot back.`);
        process.exitCode = 1;
        return;
      }
      urls = asked;
      console.log(`\nindexnow: --urls bound — ${urls.length} URL(s), all verified as published posts`);
    } else {
      const since = `${PING_SINCE}T00:00:00.000Z`;
      urls = [...liveUrls.entries()]
        .filter(([, r]) => (r.published_at ?? r.updated_at) >= since)
        .map(([u]) => u);
      console.log(`\nindexnow: --since ${PING_SINCE} bound — ${urls.length} of ${liveUrls.size} published post(s) qualify`);
    }
  } else {
    urls = toPublish.map((r) => `${ORIGIN}${postPath(r.cluster, r.slug)}`);
  }

  if (urls.length === 0) {
    console.log(`indexnow: nothing to submit under that bound — no ping sent`);
    return;
  }
  if (DRY) {
    console.log(`indexnow: would submit ${urls.length} URL(s) (dry run — not sent):`);
    for (const u of urls) console.log(`    ${u}`);
    return;
  }
  const res = await pingIndexNow(urls);
  console.log(`indexnow: ${res.accepted ? "ACCEPTED" : "NOT ACCEPTED"} — ${res.detail}`);
  if (res.keyLocation) console.log(`indexnow: keyLocation ${res.keyLocation}`);
}

main().catch((err) => {
  console.error(`\nGENERATOR FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
