import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*",                  allow: "/" },
      { userAgent: "GPTBot",             allow: "/" },
      { userAgent: "ClaudeBot",          allow: "/" },
      { userAgent: "PerplexityBot",      allow: "/" },
      { userAgent: "anthropic-ai",       allow: "/" },
      { userAgent: "Google-Extended",    allow: "/" },
      { userAgent: "Applebot-Extended",  allow: "/" },
      { userAgent: "CCBot",              allow: "/" },
      { userAgent: "Bingbot",            allow: "/" },
    ],
    sitemap: [
      "https://www.taxchecknow.com/sitemap.xml",
      "https://www.taxchecknow.com/llms.txt",
    ],
  };
}
