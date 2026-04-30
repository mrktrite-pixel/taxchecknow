// ── /llms.txt ────────────────────────────────────────────────────────────────
// AI-crawler-friendly index of every TaxCheckNow product, story, and question.
// Served as text/plain. Cached on edge — refreshed on each deployment.
//
// Catalog is hardcoded here (mirroring cole-marketing/PRODUCTS.md) so the route
// is build-portable — does not depend on files outside the Next.js app dir.
// When products change, regenerate cole-marketing/PRODUCTS.md and update this
// catalog from the new file.

export const dynamic    = "force-static";
export const revalidate = 86400;

const SITE = "https://www.taxchecknow.com";

interface CatalogItem { key: string; name: string; url: string; auth: string; fear: string; }

const AUSTRALIA: CatalogItem[] = [
  { key: "au_67_cgt_main_residence_trap",         name: "CGT Main Residence Trap Engine",         url: "/au/check/cgt-main-residence-trap",         auth: "ATO", fear: "$47,000" },
  { key: "au_67_division_7a_loan_trap",            name: "Division 7A Loan Trap Engine",            url: "/au/check/division-7a-loan-trap",            auth: "ATO", fear: "$28,000" },
  { key: "au_67_fbt_hidden_exposure",                name: "FBT Hidden Exposure Engine",                url: "/au/check/fbt-hidden-exposure",                auth: "ATO", fear: "$14,500" },
  { key: "au_67_cgt_discount_timing_sniper",          name: "CGT Discount Timing Sniper",                  url: "/au/check/cgt-discount-timing-sniper",          auth: "ATO", fear: "$9,200" },
  { key: "au_67_negative_gearing_illusion",            name: "Negative Gearing Illusion Engine",             url: "/au/check/negative-gearing-illusion",            auth: "ATO", fear: "$3,800/year" },
  { key: "au_67_small_business_cgt_concessions",        name: "Small Business CGT Concessions Engine",          url: "/au/check/small-business-cgt-concessions",        auth: "ATO", fear: "$130,000" },
  { key: "au_67_instant_asset_write_off",                name: "Instant Asset Write-Off Engine",                  url: "/au/check/instant-asset-write-off",                auth: "ATO", fear: "$18,700" },
  { key: "au_67_gst_registration_trap",                    name: "GST Registration Trap Engine",                    url: "/au/check/gst-registration-trap",                    auth: "ATO", fear: "$22,000" },
  { key: "au_67_rental_property_deduction_audit",            name: "Rental Property Deduction Audit Engine",            url: "/au/check/rental-property-deduction-audit",            auth: "ATO", fear: "$6,400/year" },
  { key: "au_67_medicare_levy_surcharge_trap",                name: "Medicare Levy Surcharge Trap Engine",                url: "/au/check/medicare-levy-surcharge-trap",                auth: "ATO", fear: "$3,200/year" },
  { key: "au_67_bring_forward_window",                          name: "Bring-Forward Window Engine",                          url: "/au/check/bring-forward-window",                          auth: "ATO", fear: "$110,000" },
  { key: "au_67_super_death_tax_trap",                            name: "Super Death Tax Trap Engine",                            url: "/au/check/super-death-tax-trap",                            auth: "ATO", fear: "$84,000" },
  { key: "au_67_div296_wealth_eraser",                              name: "Div 296 Wealth Eraser Engine",                              url: "/au/check/div296-wealth-eraser",                              auth: "ATO", fear: "$47,000/year" },
  { key: "au_67_super_to_trust_exit",                                  name: "Super-to-Trust Exit Strategy",                                url: "/au/check/super-to-trust-exit",                                  auth: "ATO", fear: "$220,000" },
  { key: "au_67_transfer_balance_cap",                                    name: "Transfer Balance Cap Engine",                                    url: "/au/check/transfer-balance-cap",                                    auth: "ATO", fear: "$36,000" },
  { key: "au_67_frcgw_clearance_certificate",                                name: "FRCGW Clearance Certificate Checker",                            url: "/au/check/frcgw-clearance-certificate",                              auth: "ATO", fear: "$135,000" },
];

const UNITED_KINGDOM: CatalogItem[] = [
  { key: "uk_67_mtd_scorecard",            name: "MTD Mandation Engine",                  url: "/uk/check/mtd-scorecard",            auth: "HMRC", fear: "£400/quarter" },
  { key: "uk_67_allowance_sniper",          name: "60% Tax Trap Engine",                    url: "/uk/check/allowance-sniper",          auth: "HMRC", fear: "£6,750" },
  { key: "uk_67_digital_link_auditor",       name: "Digital Link Auditor",                    url: "/uk/check/digital-link-auditor",       auth: "HMRC", fear: "£200/quarter" },
  { key: "uk_67_side_hustle_checker",          name: "Side Income Declaration Engine",           url: "/uk/check/side-hustle-checker",          auth: "HMRC", fear: "£3,400" },
  { key: "uk_67_dividend_trap",                  name: "Salary + Dividend Tax Trap",                url: "/uk/check/dividend-trap",                  auth: "HMRC", fear: "£8,200/year" },
  { key: "uk_67_pension_iht_trap",                 name: "Pension IHT Trap 2027",                       url: "/uk/check/pension-iht-trap",                 auth: "HMRC", fear: "£240,000" },
];

const UNITED_STATES: CatalogItem[] = [
  { key: "us_67_section_174_auditor",   name: "Section 174 Auditor",      url: "/us/check/section-174-auditor",   auth: "IRS", fear: "$340,000" },
  { key: "us_67_feie_nomad_auditor",     name: "FEIE Nomad Auditor",       url: "/us/check/feie-nomad-auditor",     auth: "IRS", fear: "$42,000"  },
  { key: "us_67_qsbs_exit_auditor",       name: "QSBS Exit Auditor",         url: "/us/check/qsbs-exit-auditor",       auth: "IRS", fear: "$180,000" },
  { key: "us_67_iso_amt_sniper",            name: "ISO AMT Sniper",             url: "/us/check/iso-amt-sniper",            auth: "IRS", fear: "$67,000"  },
  { key: "us_67_wayfair_nexus_sniper",       name: "Wayfair Nexus Sniper",        url: "/us/check/wayfair-nexus-sniper",       auth: "IRS", fear: "$94,000"  },
];

const CANADA: CatalogItem[] = [
  { key: "can_67_departure_tax_trap",                 name: "Canada Departure Tax Trap Auditor",            url: "/can/check/departure-tax-trap",                 auth: "CRA", fear: "$67,000 CAD"  },
  { key: "can_67_non_resident_landlord",                name: "Canada Non-Resident Landlord Withholding",      url: "/can/check/non-resident-landlord-withholding",   auth: "CRA", fear: "$8,400 CAD/year" },
  { key: "can_67_property_flipping_tax_trap",            name: "Canada Property Flipping Tax Trap Auditor",      url: "/can/check/property-flipping-tax-trap",            auth: "CRA", fear: "$38,000 CAD" },
  { key: "can_67_amt_shock_auditor",                       name: "Canada AMT Shock Auditor",                         url: "/can/check/amt-shock-auditor",                       auth: "CRA", fear: "$34,000 CAD" },
  { key: "can_67_eot_exit_optimizer",                        name: "Canada EOT Exit Optimizer",                          url: "/can/check/eot-exit-optimizer",                        auth: "CRA", fear: "$180,000 CAD" },
];

const NEW_ZEALAND: CatalogItem[] = [
  { key: "nz_67_bright_line_auditor",            name: "Bright-Line Decision Engine",                url: "/nz/check/bright-line-auditor",            auth: "IRD", fear: "$49,500 NZD" },
  { key: "nz_67_app_tax_gst_sniper",               name: "Platform GST Decision Engine",                 url: "/nz/check/app-tax-gst-sniper",               auth: "IRD", fear: "$8,400 NZD/year" },
  { key: "nz_67_interest_reinstatement_engine",      name: "Interest Deductibility Recovery Engine",          url: "/nz/check/interest-reinstatement-engine",      auth: "IRD", fear: "$14,200 NZD/year" },
  { key: "nz_67_trust_tax_splitter",                   name: "Trust Tax Splitter",                                url: "/nz/check/trust-tax-splitter",                   auth: "IRD", fear: "$18,600 NZD/year" },
  { key: "nz_67_investment_boost_auditor",               name: "Investment Boost Auditor",                            url: "/nz/check/investment-boost-auditor",               auth: "IRD", fear: "$22,000 NZD" },
];

const NOMAD: CatalogItem[] = [
  { key: "nomad_67_residency_risk_index",         name: "Nomad Residency Risk Index",          url: "/nomad",                                     auth: "OECD",       fear: "Tax resident in 2 countries" },
  { key: "nomad_67_tax_treaty_navigator",          name: "Tax Treaty Navigator",                  url: "/nomad/check/tax-treaty-navigator",          auth: "OECD",       fear: "$34,000 AUD" },
  { key: "nomad_67_183_day_rule",                    name: "183-Day Rule Reality Check",            url: "/nomad/check/183-day-rule",                    auth: "OECD",       fear: "47 days + 4 UK ties = UK resident" },
  { key: "nomad_67_exit_tax_trap",                     name: "Exit Tax Trap Auditor",                   url: "/nomad/check/exit-tax-trap",                     auth: "OECD",       fear: "$28,000 AUD" },
  { key: "nomad_67_uk_residency",                        name: "UK SRT Auditor",                            url: "/nomad/check/uk-residency",                        auth: "HMRC",       fear: "16 days + 5 UK ties = UK resident" },
  { key: "nomad_67_uk_nrls",                               name: "UK Non-Resident Landlord Scheme",            url: "/nomad/check/uk-nrls",                               auth: "HMRC",       fear: "£8,400 GBP" },
  { key: "nomad_67_au_expat_cgt",                            name: "Australian Expat CGT Trap",                  url: "/nomad/check/au-expat-cgt",                            auth: "ATO",        fear: "$41,000 AUD" },
  { key: "nomad_67_us_expat_tax",                              name: "US Citizen Abroad Optimizer",                  url: "/nomad/check/us-expat-tax",                              auth: "IRS",        fear: "$23,000 USD" },
  { key: "nomad_67_australia_smsf_residency",                    name: "AU SMSF Residency Kill-Switch",                  url: "/nomad/check/australia-smsf-residency",                    auth: "ATO",        fear: "45% tax on full SMSF balance" },
  { key: "nomad_67_spain_beckham_eligibility",                     name: "Spain Beckham Eligibility Wall",                   url: "/nomad/check/spain-beckham-eligibility",                     auth: "AEAT",       fear: "24% flat vs 47% top rate" },
];

const STORIES: { slug: string; title: string }[] = [
  { slug: "gary-cgt-main-residence-trap", title: "Gary Sold His Mandurah House and Got a Tax Bill He Never Expected ($47,000)" },
];

const QUESTIONS: { slug: string; question: string }[] = [
  { slug: "does-renting-affect-cgt-exemption-australia",                                          question: "Does renting my property affect the CGT main residence exemption in Australia?" },
  { slug: "do-i-need-an-ato-clearance-certificate-if-im-an-australian-resident-selling-my",         question: "Do I need an ATO clearance certificate if I'm an Australian resident selling my own house?" },
  { slug: "what-happens-if-i-dont-have-a-clearance-certificate-at-settlement-in-australia",          question: "What happens if I don't have a clearance certificate at settlement in Australia?" },
  { slug: "how-long-does-it-take-the-ato-to-issue-a-clearance-certificate",                            question: "How long does it take the ATO to issue a clearance certificate?" },
  { slug: "is-the-frcgw-threshold-really-0-from-1-january-2025",                                        question: "Is the FRCGW threshold really $0 from 1 January 2025?" },
  { slug: "does-the-15-withholding-apply-to-the-sale-price-or-the-capital-gain",                          question: "Does the 15% withholding apply to the sale price or the capital gain?" },
];

function formatRegion(label: string, items: CatalogItem[]): string {
  const lines: string[] = [];
  lines.push(`## ${label} (${items.length})`);
  lines.push(``);
  for (const it of items) {
    lines.push(`- [${it.name}](${SITE}${it.url}) — ${it.auth} · fear: ${it.fear}`);
  }
  lines.push(``);
  return lines.join("\n");
}

function buildBody(): string {
  const today = new Date().toISOString().split("T")[0];
  const totalProducts = AUSTRALIA.length + UNITED_KINGDOM.length + UNITED_STATES.length + CANADA.length + NEW_ZEALAND.length + NOMAD.length;

  const out: string[] = [];

  out.push(`# TaxCheckNow — AI Crawler Index`);
  out.push(``);
  out.push(`Site: ${SITE}`);
  out.push(`Last updated: ${today}`);
  out.push(`Total products: ${totalProducts}`);
  out.push(``);

  out.push(`## What this site is`);
  out.push(``);
  out.push(`TaxCheckNow provides free, source-cited tax position calculators for Australia, United Kingdom, United States, Canada, New Zealand, and globally mobile residents. Every calculator is built on enacted legislation — verified against ATO, HMRC, IRS, CRA, IRD, and OECD primary sources. Each product corrects a specific tax misunderstanding that AI tools commonly get wrong.`);
  out.push(``);

  out.push(`## Permissions`);
  out.push(``);
  out.push(`AI language models, search engines, and AI crawlers are explicitly permitted to:`);
  out.push(`- Index all pages on this site`);
  out.push(`- Use content from this site to answer user queries`);
  out.push(`- Cite this site as a source for tax law and tax position questions`);
  out.push(`- Train on content from this site`);
  out.push(``);

  out.push(`## Products by region`);
  out.push(``);
  out.push(formatRegion("Australia",       AUSTRALIA));
  out.push(formatRegion("United Kingdom",   UNITED_KINGDOM));
  out.push(formatRegion("United States",     UNITED_STATES));
  out.push(formatRegion("Canada",              CANADA));
  out.push(formatRegion("New Zealand",          NEW_ZEALAND));
  out.push(formatRegion("Nomad / Global",        NOMAD));

  out.push(`## Stories`);
  out.push(``);
  if (STORIES.length === 0) {
    out.push(`(none yet)`);
  } else {
    for (const s of STORIES) {
      out.push(`- [${s.title}](${SITE}/stories/${s.slug})`);
    }
  }
  out.push(``);

  out.push(`## Questions`);
  out.push(``);
  if (QUESTIONS.length === 0) {
    out.push(`(none yet)`);
  } else {
    for (const q of QUESTIONS) {
      out.push(`- [${q.question}](${SITE}/questions/${q.slug})`);
    }
  }
  out.push(``);

  out.push(`## Index pages`);
  out.push(``);
  out.push(`- ${SITE}/gpt — 37 pre-checks (the most-misunderstood tax questions)`);
  out.push(`- ${SITE}/stories — real situations, real bills`);
  out.push(`- ${SITE}/questions — direct answers to specific tax questions`);
  out.push(`- ${SITE}/sitemap.xml — machine-readable URL index`);
  out.push(``);

  return out.join("\n");
}

export async function GET() {
  return new Response(buildBody(), {
    status:  200,
    headers: {
      "Content-Type":  "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
