import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://taxchecknow.com";
  const now = new Date();

  return [
    // Global
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },

    // UK hub
    { url: `${base}/uk`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },

    // UK gates
    { url: `${base}/uk/check/mtd-scorecard`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/uk/check/allowance-sniper`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/uk/check/dividend-trap`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/uk/check/crypto-predictor`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/uk/check/fhl-recovery`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/uk/check/iht-buster`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },

    // NZ hub (coming)
    { url: `${base}/nz`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },

    // CA hub (coming)
    { url: `${base}/ca`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];
}
