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
      lastModified:      now,
      changeFrequency:   "weekly" as const,
      priority:          0.9,
    })),
  ];
}
