// scripts/generate-blog-pages.ts
// ─────────────────────────────────────────────────────────────────────────────
// BLOG ENGINE P1 — THE PAGE GENERATOR. Emits STATIC pages from approved posts.
//
//   npx ts-node --project cole/tsconfig.json scripts/generate-blog-pages.ts
//     --dry-run   emit nothing, write nothing; print exactly what would happen
//     --ping      submit the emitted URLs to IndexNow. DEFAULT OFF.
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
const DRY = argv.includes("--dry-run");
const PING = argv.includes("--ping");
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

function clusterLabel(cluster: string): string {
  return cluster.split("-").map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}

function postPath(cluster: string, slug: string): string {
  return `/blog/${cluster}/${slug}`;
}

/** gate_result.cta_url, or a body link to this storefront's own /check/ path. */
function ctaUrlFor(row: PostRow): string | null {
  const gr = row.gate_result as { cta_url?: unknown } | null;
  if (gr && typeof gr.cta_url === "string" && gr.cta_url.startsWith(ORIGIN)) return gr.cta_url;
  const fromBody = linksOf(row.body_md).find((u) => u.startsWith(ORIGIN) && u.includes("/check/"));
  return fromBody ?? null;
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
  const items = rows.map((r) =>
    `            <li>
              <Link href={${lit(postPath(r.cluster, r.slug))}} className="group block">
                <p className="font-serif text-xl font-bold text-neutral-950 group-hover:underline">{${lit(r.title)}}</p>
                <p className="mt-1 text-[15px] text-neutral-600">{${lit((r.meta_description ?? "").slice(0, 200))}}</p>
              </Link>
            </li>`).join("\n");

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
        <div className="mx-auto max-w-3xl">
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

function buildBlogHub(byCluster: Map<string, PostRow[]>): string {
  const url = `${ORIGIN}/blog`;
  const total = [...byCluster.values()].reduce((n, r) => n + r.length, 0);
  const sections = [...byCluster.entries()].map(([cluster, rows]) =>
    `          <section>
            <h2 className="font-serif text-2xl font-bold text-neutral-950">
              <Link href={${lit(`/blog/${cluster}`)}} className="hover:underline">{${lit(clusterLabel(cluster))}}</Link>
            </h2>
            <ul className="mt-4 space-y-5">
${rows.map((r) => `              <li>
                <Link href={${lit(postPath(r.cluster, r.slug))}} className="group block">
                  <p className="font-serif text-lg font-bold text-neutral-950 group-hover:underline">{${lit(r.title)}}</p>
                  <p className="mt-1 text-[15px] text-neutral-600">{${lit((r.meta_description ?? "").slice(0, 180))}}</p>
                </Link>
              </li>`).join("\n")}
            </ul>
          </section>`).join("\n");

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
      <section className="bg-white px-6 py-12 sm:py-14">
        <div className="mx-auto max-w-3xl space-y-12">
${sections}
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

  console.log(`\nBLOG PAGE GENERATOR${DRY ? "   [DRY RUN — nothing written]" : ""}${PING ? "   [--ping ON]" : "   [ping off]"}`);
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
    const cta = ctaUrlFor(r);
    if (!cta) { skipped.push({ row: r, reason: "no calculator URL in gate_result.cta_url and none in the body — refusing to publish a post with no CTA rather than invent one" }); continue; }
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
      const file = path.join("app", "blog", cluster, r.slug, "page.tsx");
      const res = writeIfChanged(file, buildPostPage(r, rows, cta));
      (res === "written" ? emitted : unchanged).push(file);
      lastmod[postPath(cluster, r.slug)] = new Date(r.updated_at).toISOString();
    }
    const hubFile = path.join("app", "blog", cluster, "page.tsx");
    const res = writeIfChanged(hubFile, buildClusterHub(cluster, rows));
    (res === "written" ? emitted : unchanged).push(hubFile);
  }

  const blogHub = path.join("app", "blog", "page.tsx");
  const hubRes = writeIfChanged(blogHub, buildBlogHub(byCluster));
  (hubRes === "written" ? emitted : unchanged).push(blogHub);

  if (!DRY) {
    fs.mkdirSync(path.dirname(LASTMOD_FILE), { recursive: true });
    fs.writeFileSync(LASTMOD_FILE, `${JSON.stringify(lastmod, null, 2)}\n`, "utf8");
  }

  console.log(`\nEMITTED ${emitted.length} file(s):`);
  for (const f of emitted) console.log(`  + ${f.split(path.sep).join("/")}`);
  if (unchanged.length) {
    console.log(`unchanged ${unchanged.length} file(s):`);
    for (const f of unchanged) console.log(`  = ${f.split(path.sep).join("/")}`);
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
  if (!PING) {
    console.log(`\nindexnow: not pinged (--ping is off by default; pass --ping to submit)`);
    return;
  }
  const urls = toPublish.map((r) => `${ORIGIN}${postPath(r.cluster, r.slug)}`);
  if (DRY) {
    console.log(`\nindexnow: would submit ${urls.length} URL(s) (dry run — not sent)`);
    return;
  }
  const res = await pingIndexNow(urls);
  console.log(`\nindexnow: ${res.accepted ? "ACCEPTED" : "NOT ACCEPTED"} — ${res.detail}`);
  if (res.keyLocation) console.log(`indexnow: keyLocation ${res.keyLocation}`);
}

main().catch((err) => {
  console.error(`\nGENERATOR FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
