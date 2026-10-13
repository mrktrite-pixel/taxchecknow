import type { MetadataRoute } from "next";

// All 37 GPT slugs (mirror app/gpt/<slug>/page.tsx).
const GPT_SLUGS = [
  // AU (13)
  "au-cgt-main-residence-trap",
  "au-division-7a-loan-trap",
  "au-fbt-hidden-exposure",
  "au-cgt-discount-timing-sniper",
  "au-negative-gearing-illusion",
  "au-small-business-cgt-concessions",
  "au-instant-asset-write-off",
  "au-gst-registration-trap",
  "au-rental-property-deduction-audit",
  "au-medicare-levy-surcharge-trap",
  "au-bring-forward-window",
  "au-div296-wealth-eraser",
  "au-transfer-balance-cap",
  // NOMAD (8)
  "nomad-residency-risk-index",
  "nomad-tax-treaty-navigator",
  "nomad-183-day-rule",
  "nomad-exit-tax-trap",
  "nomad-uk-residency",
  "nomad-au-expat-cgt",
  "nomad-us-expat-tax",
  "nomad-spain-beckham-eligibility",
  // US (4)
  "us-section-174-auditor",
  "us-feie-nomad-auditor",
  "us-qsbs-exit-auditor",
  "us-iso-amt-sniper",
  // CAN (4)
  "can-departure-tax-trap",
  "can-non-resident-landlord-withholding",
  "can-property-flipping-tax-trap",
  "can-amt-shock-auditor",
  // UK (5)
  "uk-mtd-scorecard",
  "uk-allowance-sniper",
  "uk-side-hustle-checker",
  "uk-dividend-trap",
  "uk-pension-iht-trap",
  // NZ (3)
  "nz-bright-line-auditor",
  "nz-app-tax-gst-sniper",
  "nz-interest-reinstatement-engine",
];

// All 46 product gate-page paths (the calculators that GPT pages link into).
const PRODUCT_PATHS = [
  // AU
  "/au/check/cgt-main-residence-trap",
  "/au/check/division-7a-loan-trap",
  "/au/check/fbt-hidden-exposure",
  "/au/check/cgt-discount-timing-sniper",
  "/au/check/negative-gearing-illusion",
  "/au/check/small-business-cgt-concessions",
  "/au/check/instant-asset-write-off",
  "/au/check/gst-registration-trap",
  "/au/check/rental-property-deduction-audit",
  "/au/check/medicare-levy-surcharge-trap",
  "/au/check/bring-forward-window",
  "/au/check/super-death-tax-trap",
  "/au/check/div296-wealth-eraser",
  "/au/check/super-to-trust-exit",
  "/au/check/transfer-balance-cap",
  "/au/check/frcgw-clearance-certificate",
  // UK
  "/uk/check/mtd-scorecard",
  "/uk/check/allowance-sniper",
  "/uk/check/digital-link-auditor",
  "/uk/check/side-hustle-checker",
  "/uk/check/dividend-trap",
  "/uk/check/pension-iht-trap",
  // US
  "/us/check/section-174-auditor",
  "/us/check/feie-nomad-auditor",
  "/us/check/qsbs-exit-auditor",
  "/us/check/iso-amt-sniper",
  "/us/check/wayfair-nexus-sniper",
  // NZ
  "/nz/check/bright-line-auditor",
  "/nz/check/app-tax-gst-sniper",
  "/nz/check/interest-reinstatement-engine",
  "/nz/check/trust-tax-splitter",
  "/nz/check/investment-boost-auditor",
  // CAN
  "/can/check/departure-tax-trap",
  "/can/check/non-resident-landlord-withholding",
  "/can/check/property-flipping-tax-trap",
  "/can/check/amt-shock-auditor",
  "/can/check/eot-exit-optimizer",
  // NOMAD
  "/nomad",
  "/nomad/check/tax-treaty-navigator",
  "/nomad/check/183-day-rule",
  "/nomad/check/exit-tax-trap",
  "/nomad/check/uk-residency",
  "/nomad/check/uk-nrls",
  "/nomad/check/au-expat-cgt",
  "/nomad/check/us-expat-tax",
  "/nomad/check/australia-smsf-residency",
  "/nomad/check/spain-beckham-eligibility",
];

// Story slugs (mirror app/stories/<slug>/page.tsx)
const STORY_SLUGS = [
  "gary-cgt-main-residence-trap",
];

// Question slugs (mirror app/questions/<slug>/page.tsx)
const QUESTION_SLUGS = [
  "does-renting-affect-cgt-exemption-australia",
  "do-i-need-an-ato-clearance-certificate-if-im-an-australian-resident-selling-my",
  "what-happens-if-i-dont-have-a-clearance-certificate-at-settlement-in-australia",
  "how-long-does-it-take-the-ato-to-issue-a-clearance-certificate",
  "is-the-frcgw-threshold-really-0-from-1-january-2025",
  "does-the-15-withholding-apply-to-the-sale-price-or-the-capital-gain",
];

// ── RULING GA-3.3 — PER-PRODUCT lastmod ─────────────────────────────────────────────────
//
// Every entry in this file used to carry `lastModified: now` — a single generation-time
// timestamp. That is not wrong so much as EMPTY: it told crawlers every one of ~60 URLs changed
// at the same instant on every build, which is the same as telling them nothing, and it left
// the publish gate's "bump lastmod on update" with nothing to bump.
//
// A product's real last-modified date is when its CONFIG last changed — the config is what the
// page is generated from. So the dates are stamped at BUILD time from git and read from a
// generated map here, because app/sitemap.ts runs in the Next runtime where there is no git and
// no cole/ directory.
//
// FAIL-SOFT, and this matters more than the feature: a product with no entry in the map falls
// back to `now`, which is exactly today's behaviour. A missing or stale map degrades the sitemap
// to what it already was and can never drop a URL.
import PRODUCT_LASTMOD from "./sitemap-lastmod.json";

function lastmodFor(route: string, fallback: Date): Date {
  const iso = (PRODUCT_LASTMOD as Record<string, string>)[route];
  if (!iso) return fallback;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

// ── BLOG ENGINE P1 — the /blog block ────────────────────────────────────────────────────
//
// THE PATHS ARE DERIVED, NOT HAND-LISTED. Every other array in this file is maintained by
// hand and each one carries a comment telling you to mirror a directory — which works while
// a class holds 37 pages that change on a release. The blog is different in kind: the ramp
// in the spec is 3/wk rising to 6-7/wk, so a hand-maintained BLOG_SLUGS array would be
// stale within days and the staleness would be INVISIBLE (a missing sitemap entry looks
// exactly like a page that was never written).
//
// So the source is app/blog-lastmod.json, which scripts/generate-blog-pages.ts rewrites in
// the same run that emits the pages. One writer, one truth: a post cannot be published
// without appearing here, and a path cannot appear here without a page having been emitted.
//
// FAIL-SOFT, like the product map above: an empty or absent map yields NO blog URLs, which
// is exactly correct before the first post is published. It can never invent a URL, and it
// can never drop a non-blog URL.
import BLOG_LASTMOD from "./blog-lastmod.json";

const BLOG_PATHS: string[] = Object.keys(BLOG_LASTMOD as Record<string, string>)
  .filter((p) => /^\/blog\/[^/]+\/[^/]+$/.test(p))
  .sort();

/** The cluster hubs, derived from the posts that exist. No post, no hub. */
const BLOG_CLUSTER_PATHS: string[] = Array.from(
  new Set(BLOG_PATHS.map((p) => p.split("/").slice(0, 3).join("/"))),
).sort();

/** Same fail-soft read as lastmodFor, against the blog map. */
function blogLastmodFor(route: string, fallback: Date): Date {
  const iso = (BLOG_LASTMOD as Record<string, string>)[route];
  if (!iso) return fallback;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.taxchecknow.com";
  const now = new Date();

  return [
    // Global
    { url: base,                lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/about`,     lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`,   lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/terms`,     lastModified: now, changeFrequency: "yearly",  priority: 0.2 },

    // GPT index + 37 GPT pages
    { url: `${base}/gpt`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...GPT_SLUGS.map(slug => ({
      url:              `${base}/gpt/${slug}`,
      lastModified:      now,
      changeFrequency:   "weekly" as const,
      priority:          0.8,
    })),

    // Stories index + story pages
    { url: `${base}/stories`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...STORY_SLUGS.map(slug => ({
      url:              `${base}/stories/${slug}`,
      lastModified:      now,
      changeFrequency:   "monthly" as const,
      priority:          0.7,
    })),

    // Questions index + question pages
    { url: `${base}/questions`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...QUESTION_SLUGS.map(slug => ({
      url:              `${base}/questions/${slug}`,
      lastModified:      now,
      changeFrequency:   "monthly" as const,
      priority:          0.7,
    })),

    // 46 product calculator gates
    ...PRODUCT_PATHS.map(p => ({
      url:              `${base}${p}`,
      // GA-3.3: the product's own config-change date, falling back to `now` when unmapped.
      lastModified:      lastmodFor(p, now),
      changeFrequency:   "weekly" as const,
      priority:          0.9,
    })),

    // ── BLOG (derived from app/blog-lastmod.json — see the note above) ──
    // The hub and the cluster hubs are emitted only when posts exist, so they are listed
    // only when posts exist. The whole block collapses to nothing on an empty map.
    ...(BLOG_PATHS.length > 0
      ? [{ url: `${base}/blog`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 }]
      : []),
    ...BLOG_CLUSTER_PATHS.map(p => ({
      url:              `${base}${p}`,
      lastModified:      now,
      changeFrequency:   "weekly" as const,
      priority:          0.7,
    })),
    ...BLOG_PATHS.map(p => ({
      url:              `${base}${p}`,
      // The post's own updated_at, stamped by the generator. Falls back to `now`.
      lastModified:      blogLastmodFor(p, now),
      changeFrequency:   "monthly" as const,
      priority:          0.7,
    })),
  ];
}
