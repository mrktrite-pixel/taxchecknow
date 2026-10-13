import type { MetadataRoute } from "next";

// The estate is deliberately open to AI crawlers — that is the whole citation-gap
// strategy, and every allow below is load-bearing.
//
// /files/ IS THE ONE EXCEPTION. Those are the paid deliverables (5 files at $67,
// 8 at $147). They are served as static pages with no entitlement check, so until
// that gate exists the only thing standing between a paid file and a search result
// is this line plus the noindex in app/files/layout.tsx. robots.txt asks a crawler
// not to FETCH; the meta tag asks it not to INDEX what it did fetch. Neither is
// access control and neither is a substitute for the gate — they are the stopgap
// that keeps bought work out of the index while it is being built.
//
// Disallow is repeated in EVERY block on purpose: a robots.txt group applies only
// to the agent it names, so an agent matching a later block never reads the "*"
// rules. Omitting it from one block would exempt exactly that crawler.
const DISALLOW_PAID_FILES = "/files/";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*",                  allow: "/", disallow: DISALLOW_PAID_FILES },
      { userAgent: "GPTBot",             allow: "/", disallow: DISALLOW_PAID_FILES },
      { userAgent: "ClaudeBot",          allow: "/", disallow: DISALLOW_PAID_FILES },
      { userAgent: "PerplexityBot",      allow: "/", disallow: DISALLOW_PAID_FILES },
      { userAgent: "anthropic-ai",       allow: "/", disallow: DISALLOW_PAID_FILES },
      { userAgent: "Google-Extended",    allow: "/", disallow: DISALLOW_PAID_FILES },
      { userAgent: "Applebot-Extended",  allow: "/", disallow: DISALLOW_PAID_FILES },
      { userAgent: "CCBot",              allow: "/", disallow: DISALLOW_PAID_FILES },
      { userAgent: "Bingbot",            allow: "/", disallow: DISALLOW_PAID_FILES },
    ],
    sitemap: [
      "https://www.taxchecknow.com/sitemap.xml",
      "https://www.taxchecknow.com/llms.txt",
    ],
  };
}
