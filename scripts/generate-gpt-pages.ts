// One-shot generator: emits 37 hardcoded page.tsx files under app/gpt/<slug>/
// Reads cole/config/<product>.ts to pull answerBody, mistakes, aiCorrections,
// lawBarBadges, market, authority, lastVerified.
//
// Run: npx ts-node --project cole/tsconfig.json scripts/generate-gpt-pages.ts

import * as fs from "node:fs";
import * as path from "node:path";

interface PageMeta {
  gpt:    string;
  config:  string;
  calc:     string;
  prompt:    string;
  related:    [string, string];
}

const PAGES: PageMeta[] = [
  // ── AU (13) ─────────────────────────────────────────────────────────────
  { gpt: "au-cgt-main-residence-trap",       config: "au-01-cgt-main-residence-trap",       calc: "/au/check/cgt-main-residence-trap",       prompt: "I rented my property before selling — does that affect my CGT exemption?",   related: ["au-division-7a-loan-trap","au-cgt-discount-timing-sniper"] },
  { gpt: "au-division-7a-loan-trap",          config: "au-02-division-7a-loan-trap",          calc: "/au/check/division-7a-loan-trap",          prompt: "I took money out of my company — is that taxable?",                            related: ["au-fbt-hidden-exposure","au-small-business-cgt-concessions"] },
  { gpt: "au-fbt-hidden-exposure",             config: "au-03-fbt-hidden-exposure",             calc: "/au/check/fbt-hidden-exposure",             prompt: "Is a company car or employee benefit taxable in Australia?",                     related: ["au-division-7a-loan-trap","au-gst-registration-trap"] },
  { gpt: "au-cgt-discount-timing-sniper",       config: "au-04-cgt-discount-timing-sniper",       calc: "/au/check/cgt-discount-timing-sniper",       prompt: "Does the 12-month CGT rule depend on contract or settlement?",                    related: ["au-cgt-main-residence-trap","nz-bright-line-auditor"] },
  { gpt: "au-negative-gearing-illusion",          config: "au-05-negative-gearing-illusion",          calc: "/au/check/negative-gearing-illusion",          prompt: "Is my negatively geared property actually saving me money?",                       related: ["au-rental-property-deduction-audit","nz-interest-reinstatement-engine"] },
  { gpt: "au-small-business-cgt-concessions",      config: "au-06-small-business-cgt-concessions",      calc: "/au/check/small-business-cgt-concessions",      prompt: "Can I sell my business and avoid CGT in Australia?",                                related: ["au-cgt-main-residence-trap","can-eot-exit-optimizer"] },
  { gpt: "au-instant-asset-write-off",                config: "au-07-instant-asset-write-off",                calc: "/au/check/instant-asset-write-off",                prompt: "Does this purchase qualify for instant asset write-off?",                              related: ["au-gst-registration-trap","nz-investment-boost-auditor"] },
  { gpt: "au-gst-registration-trap",                    config: "au-08-gst-registration-trap",                    calc: "/au/check/gst-registration-trap",                    prompt: "Do I need to register for GST if I just crossed $75k?",                                  related: ["nz-app-tax-gst-sniper","au-instant-asset-write-off"] },
  { gpt: "au-rental-property-deduction-audit",            config: "au-09-rental-property-deduction-audit",            calc: "/au/check/rental-property-deduction-audit",            prompt: "Can I claim all my rental property expenses?",                                            related: ["au-negative-gearing-illusion","nz-interest-reinstatement-engine"] },
  { gpt: "au-medicare-levy-surcharge-trap",                config: "au-10-medicare-levy-surcharge-trap",                calc: "/au/check/medicare-levy-surcharge-trap",                prompt: "Do I need private health insurance to avoid extra tax?",                                    related: ["au-div296-wealth-eraser","au-transfer-balance-cap"] },
  { gpt: "au-bring-forward-window",                          config: "au-11-bring-forward-window",                          calc: "/au/check/bring-forward-window",                          prompt: "Did I exceed my super contribution cap?",                                                      related: ["au-div296-wealth-eraser","au-transfer-balance-cap"] },
  { gpt: "au-div296-wealth-eraser",                            config: "au-13-div296-wealth-eraser",                            calc: "/au/check/div296-wealth-eraser",                            prompt: "Will I be taxed on unrealised gains in my super?",                                              related: ["au-transfer-balance-cap","au-bring-forward-window"] },
  { gpt: "au-transfer-balance-cap",                              config: "au-15-transfer-balance-cap",                              calc: "/au/check/transfer-balance-cap",                              prompt: "Have I exceeded the pension transfer balance cap?",                                              related: ["au-div296-wealth-eraser","au-bring-forward-window"] },

  // ── NOMAD (8) ───────────────────────────────────────────────────────────
  { gpt: "nomad-residency-risk-index",                              config: "nomad-01-residency-risk-index",                              calc: "/nomad",                                                              prompt: "Can I be a tax resident in two countries at once?",                                            related: ["nomad-tax-treaty-navigator","nomad-183-day-rule"] },
  { gpt: "nomad-tax-treaty-navigator",                                 config: "nomad-02-tax-treaty-navigator",                                 calc: "/nomad/check/tax-treaty-navigator",                                       prompt: "Can I end up paying tax in two countries?",                                                      related: ["nomad-residency-risk-index","nomad-exit-tax-trap"] },
  { gpt: "nomad-183-day-rule",                                          config: "nomad-03-183-day-rule",                                          calc: "/nomad/check/183-day-rule",                                                  prompt: "If I stay under 183 days, do I avoid tax completely?",                                            related: ["nomad-uk-residency","nomad-residency-risk-index"] },
  { gpt: "nomad-exit-tax-trap",                                            config: "nomad-04-exit-tax-trap",                                            calc: "/nomad/check/exit-tax-trap",                                                    prompt: "If I leave a country, do I still owe tax there?",                                                  related: ["can-departure-tax-trap","nomad-tax-treaty-navigator"] },
  { gpt: "nomad-uk-residency",                                              config: "nomad-05-uk-residency",                                              calc: "/nomad/check/uk-residency",                                                       prompt: "When do I stop being a UK tax resident?",                                                            related: ["nomad-183-day-rule","uk-allowance-sniper"] },
  { gpt: "nomad-au-expat-cgt",                                                config: "nomad-07-au-expat-cgt",                                                calc: "/nomad/check/au-expat-cgt",                                                            prompt: "Do I pay CGT if I sell Australian assets while overseas?",                                            related: ["au-cgt-main-residence-trap","nomad-exit-tax-trap"] },
  { gpt: "nomad-us-expat-tax",                                                  config: "nomad-08-us-expat-tax",                                                  calc: "/nomad/check/us-expat-tax",                                                              prompt: "Do I still have to file US taxes if I live abroad?",                                                    related: ["us-feie-nomad-auditor","nomad-183-day-rule"] },
  { gpt: "nomad-spain-beckham-eligibility",                                       config: "nomad-10-spain-beckham-eligibility",                                       calc: "/nomad/check/spain-beckham-eligibility",                                                    prompt: "Can I reduce tax using Spain's Beckham Law?",                                                            related: ["nomad-residency-risk-index","nomad-183-day-rule"] },

  // ── US (4) ──────────────────────────────────────────────────────────────
  { gpt: "us-section-174-auditor",                                                  config: "us-01-section-174-auditor",                                                  calc: "/us/check/section-174-auditor",                                                              prompt: "Do I now have to capitalise my R&D costs under Section 174?",                                              related: ["us-qsbs-exit-auditor","us-iso-amt-sniper"] },
  { gpt: "us-feie-nomad-auditor",                                                     config: "us-02-feie-nomad-auditor",                                                     calc: "/us/check/feie-nomad-auditor",                                                                  prompt: "Do I still have to file US taxes if I live abroad?",                                                          related: ["nomad-us-expat-tax","us-iso-amt-sniper"] },
  { gpt: "us-qsbs-exit-auditor",                                                        config: "us-03-qsbs-exit-auditor",                                                        calc: "/us/check/qsbs-exit-auditor",                                                                      prompt: "Can I sell my shares tax-free under QSBS?",                                                                    related: ["us-iso-amt-sniper","us-section-174-auditor"] },
  { gpt: "us-iso-amt-sniper",                                                              config: "us-04-iso-amt-sniper",                                                              calc: "/us/check/iso-amt-sniper",                                                                            prompt: "Will I owe tax on stock options even if I didn't sell?",                                                          related: ["us-qsbs-exit-auditor","us-feie-nomad-auditor"] },

  // ── CAN (4) ─────────────────────────────────────────────────────────────
  { gpt: "can-departure-tax-trap",                                                            config: "can-01-departure-tax-trap",                                                            calc: "/can/check/departure-tax-trap",                                                                          prompt: "If I leave Canada, do I pay tax on everything I own?",                                                              related: ["nomad-exit-tax-trap","can-property-flipping-tax-trap"] },
  { gpt: "can-non-resident-landlord-withholding",                                               config: "can-02-non-resident-landlord-withholding",                                               calc: "/can/check/non-resident-landlord-withholding",                                                              prompt: "Are my rental deductions going to be denied by the CRA?",                                                              related: ["can-departure-tax-trap","can-amt-shock-auditor"] },
  { gpt: "can-property-flipping-tax-trap",                                                        config: "can-03-property-flipping-tax-trap",                                                        calc: "/can/check/property-flipping-tax-trap",                                                                        prompt: "Will my property sale be treated as flipping income?",                                                                  related: ["can-departure-tax-trap","nz-bright-line-auditor"] },
  { gpt: "can-amt-shock-auditor",                                                                    config: "can-04-amt-shock-auditor",                                                                    calc: "/can/check/amt-shock-auditor",                                                                                    prompt: "Is my home sale actually tax-free in Canada?",                                                                            related: ["can-departure-tax-trap","can-property-flipping-tax-trap"] },

  // ── UK (5) ──────────────────────────────────────────────────────────────
  { gpt: "uk-mtd-scorecard",                                                                            config: "uk-01-mtd-scorecard",                                                                            calc: "/uk/check/mtd-scorecard",                                                                                                prompt: "Do I need to comply with Making Tax Digital yet?",                                                                          related: ["uk-side-hustle-checker","uk-dividend-trap"] },
  { gpt: "uk-allowance-sniper",                                                                            config: "uk-02-allowance-sniper",                                                                            calc: "/uk/check/allowance-sniper",                                                                                                  prompt: "Am I taking dividends the right way in the UK?",                                                                              related: ["uk-dividend-trap","uk-pension-iht-trap"] },
  { gpt: "uk-side-hustle-checker",                                                                            config: "uk-04-side-hustle-checker",                                                                            calc: "/uk/check/side-hustle-checker",                                                                                                  prompt: "Do I need to declare my side hustle income in the UK?",                                                                          related: ["uk-mtd-scorecard","au-gst-registration-trap"] },
  { gpt: "uk-dividend-trap",                                                                                    config: "uk-05-dividend-trap",                                                                                    calc: "/uk/check/dividend-trap",                                                                                                          prompt: "Am I taking dividends the right way in the UK?",                                                                                  related: ["uk-allowance-sniper","uk-pension-iht-trap"] },
  { gpt: "uk-pension-iht-trap",                                                                                     config: "uk-06-pension-iht-trap",                                                                                     calc: "/uk/check/pension-iht-trap",                                                                                                          prompt: "Will my pension be taxed under new UK inheritance rules?",                                                                          related: ["uk-dividend-trap","uk-allowance-sniper"] },

  // ── NZ (3) ──────────────────────────────────────────────────────────────
  { gpt: "nz-bright-line-auditor",                                                                                      config: "nz-01-bright-line-auditor",                                                                                      calc: "/nz/check/bright-line-auditor",                                                                                                          prompt: "Do I have to pay tax on my property sale under NZ rules?",                                                                            related: ["au-cgt-main-residence-trap","can-property-flipping-tax-trap"] },
  { gpt: "nz-app-tax-gst-sniper",                                                                                          config: "nz-02-app-tax-gst-sniper",                                                                                          calc: "/nz/check/app-tax-gst-sniper",                                                                                                              prompt: "Do I need to register for GST in New Zealand?",                                                                                              related: ["au-gst-registration-trap","nz-bright-line-auditor"] },
  { gpt: "nz-interest-reinstatement-engine",                                                                                 config: "nz-03-interest-reinstatement-engine",                                                                                 calc: "/nz/check/interest-reinstatement-engine",                                                                                                       prompt: "Can I still claim rental losses in New Zealand?",                                                                                                related: ["au-rental-property-deduction-audit","nz-bright-line-auditor"] },
];

// Map gpt slug → product name (for the Related box). Filled after first pass.
const TITLES_BY_SLUG: Record<string, string> = {};

interface Config {
  name:           string;
  market?:         string;
  authority?:       string;
  lastVerified?:     string;
  answerBody:          string[];
  mistakes:             string[];
  aiCorrections?:        { wrong: string; correct: string }[];
  lawBarBadges?:           string[];
}

function loadConfig(name: string): Config {
  const file = path.resolve(`cole/config/${name}.ts`);
  // Use require with ts-node hook (the runner is invoked via ts-node)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(file);
  return mod.PRODUCT_CONFIG as Config;
}

function authorityShort(a: string | undefined): string {
  if (!a) return "regulator";
  if (a.match(/Australian Taxation Office|ATO/i))            return "ATO";
  if (a.match(/HM Revenue|HMRC/i))                              return "HMRC";
  if (a.match(/Internal Revenue Service|IRS/i))                  return "IRS";
  if (a.match(/Canada Revenue Agency|CRA/i))                       return "CRA";
  if (a.match(/Inland Revenue|IRD/i))                                return "IRD";
  if (a.match(/Agencia|AEAT/i))                                        return "AEAT";
  if (a.match(/OECD/i))                                                  return "OECD";
  return a.split(" ")[0];
}

function countryDescriptor(market: string | undefined): string {
  if (!market) return "global";
  if (market === "Australia")        return "Australian";
  if (market === "United Kingdom")    return "UK";
  if (market === "United States")      return "US";
  if (market === "Canada")              return "Canadian";
  if (market === "New Zealand")          return "New Zealand";
  if (market === "Spain")                  return "Spanish";
  return "global nomad";
}

function countryLabel(market: string | undefined, gpt: string): string {
  if (gpt.startsWith("nomad-")) return "Global / Nomad";
  if (market === "United Kingdom") return "United Kingdom";
  if (market === "United States")    return "United States";
  if (market === "New Zealand")        return "New Zealand";
  if (market === "Australia")            return "Australia";
  if (market === "Canada")                 return "Canada";
  return market ?? "Global";
}

function pageTitle(name: string): string {
  return `${name} — Free Calculator | TaxCheckNow`;
}

function pageDescription(prompt: string): string {
  return `${prompt} Find out with TaxCheckNow's free calculator.`;
}

function escTs(s: string): string {
  // Wrap as TS string literal via JSON.stringify (handles all escaping safely)
  return JSON.stringify(s);
}

function relatedTitle(slug: string): string {
  return TITLES_BY_SLUG[slug] ?? slug;
}

function buildPageTsx(meta: PageMeta, cfg: Config): string {
  const ruleParas: [string, string] = [
    cfg.answerBody[0] ?? "",
    cfg.answerBody[1] ?? cfg.answerBody[0] ?? "",
  ];
  const mistakes: [string, string] = [
    cfg.mistakes?.[0] ?? "",
    cfg.mistakes?.[1] ?? cfg.mistakes?.[0] ?? "",
  ];
  const aiWrong   = cfg.aiCorrections?.[0]?.wrong   ?? "";
  const aiReality = cfg.aiCorrections?.[0]?.correct ?? "";
  const badges    = (cfg.lawBarBadges ?? []).slice(0, 6);

  return `// AUTO-GENERATED by scripts/generate-gpt-pages.ts — content hardcoded for SEO.
// Source config: cole/config/${meta.config}.ts
import type { Metadata } from "next";
import GptPageTemplate from "../_GptPageTemplate";

export const metadata: Metadata = {
  title:        ${escTs(pageTitle(cfg.name))},
  description:  ${escTs(pageDescription(meta.prompt))},
  alternates:   { canonical: ${escTs(`https://www.taxchecknow.com/gpt/${meta.gpt}`)} },
  openGraph:    {
    title:       ${escTs(pageTitle(cfg.name))},
    description: ${escTs(pageDescription(meta.prompt))},
    url:          ${escTs(`https://www.taxchecknow.com/gpt/${meta.gpt}`)},
    type:          "article",
  },
};

export default function Page() {
  return (
    <GptPageTemplate
      title={${escTs(cfg.name)}}
      oneLiner={${escTs(`What this check identifies — and why getting the answer wrong can cost you under ${authorityShort(cfg.authority)} rules.`)}}
      countryLabel={${escTs(countryLabel(cfg.market, meta.gpt))}}
      productLabel={${escTs(cfg.name)}}
      calcUrl={${escTs(meta.calc)}}
      prompt={${escTs(meta.prompt)}}
      countryDescriptor={${escTs(countryDescriptor(cfg.market))}}
      authorityShort={${escTs(authorityShort(cfg.authority))}}
      lastVerified={${escTs((cfg.lastVerified ?? "April 2026").replace(/^\\w+ /, ""))}}
      ruleParagraphs={[
        ${escTs(ruleParas[0])},
        ${escTs(ruleParas[1])},
      ]}
      mistakes={[
        ${escTs(mistakes[0])},
        ${escTs(mistakes[1])},
      ]}
      aiWrong={${escTs(aiWrong)}}
      aiReality={${escTs(aiReality)}}
      badges={${JSON.stringify(badges)}}
      related={[
        { slug: ${escTs(meta.related[0])}, title: ${escTs(relatedTitle(meta.related[0]))} },
        { slug: ${escTs(meta.related[1])}, title: ${escTs(relatedTitle(meta.related[1]))} },
      ]}
    />
  );
}
`;
}

function main(): void {
  // First pass: load all configs, populate TITLES_BY_SLUG
  const loaded: { meta: PageMeta; cfg: Config }[] = [];
  for (const meta of PAGES) {
    const cfg = loadConfig(meta.config);
    loaded.push({ meta, cfg });
    TITLES_BY_SLUG[meta.gpt] = cfg.name;
  }

  // Second pass: emit page.tsx files
  let count = 0;
  for (const { meta, cfg } of loaded) {
    const dir = path.resolve(`app/gpt/${meta.gpt}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "page.tsx"), buildPageTsx(meta, cfg), "utf8");
    count++;
    console.log(`  ✓ app/gpt/${meta.gpt}/page.tsx`);
  }
  console.log(`\n✅ Emitted ${count} GPT pages.`);
}

main();
