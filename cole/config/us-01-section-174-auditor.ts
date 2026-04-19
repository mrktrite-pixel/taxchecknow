// ─────────────────────────────────────────────────────────────────────────────
// COLE CONFIG — US-02 FEIE Nomad Auditor
// Citation gap: AI says 330 days abroad = FEIE qualified
// Correct: Must also pass the abode test (IRC §911(d)(3))
// Gap: Self-employment tax (15.3%) still applies even with FEIE
// Note: Connect to theviabilityindex.com nomad visa products
// Legal anchor: IRC Section 911
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductConfig } from "../types/product-config";

export const PRODUCT_CONFIG: ProductConfig = {

  id:       "feie-nomad-auditor",
  name:     "FEIE Nomad Auditor",
  site:     "taxchecknow",
  country:  "us",
  market:   "United States",
  language: "en-US",
  currency: "USD",
  slug:     "us/check/feie-nomad-auditor",
  url:      "https://taxchecknow.com/us/check/feie-nomad-auditor",
  apiRoute: "/api/rules/feie-nomad-auditor",

  authority:    "IRS",
  authorityUrl: "https://www.irs.gov",
  legalAnchor:  "IRC Section 911",
  legislation:  "IRC Section 911 — Foreign Earned Income Exclusion (FEIE)",
  lastVerified: "April 2026",

  tier1: {
    price:       67,
    name:        "Your Proof of Abode Vault",
    tagline:     "Will the IRS deny your $132,900 exclusion — and why?",
    value:       "A personalised FEIE audit built around your travel record, your US ties, and your abode risk — not a generic nomad guide.",
    cta:         "Get My Abode Vault — $67 →",
    productKey:  "us_67_feie_nomad_auditor",
    envVar:      "STRIPE_US_FEIE_67",
    successPath: "assess",
    fileCount:   5,
  },
  tier2: {
    price:       147,
    name:        "Your Totalization Bypass System",
    tagline:     "Full FEIE defence + self-employment tax minimisation",
    value:       "A personalised FEIE audit built around your travel record, your US ties, and your abode risk — not a generic nomad guide.",
    cta:         "Get My Bypass System — $147 →",
    productKey:  "us_147_feie_nomad_auditor",
    envVar:      "STRIPE_US_FEIE_147",
    successPath: "plan",
    fileCount:   8,
  },

  deadline: {
    isoDate:        "2026-04-15T23:59:59.000-05:00",
    display:        "April 15, 2026",
    short:          "Apr 15 2026",
    description:    "US Federal Tax Filing Deadline — Form 2555 due with return",
    urgencyLabel:   "TAX DEADLINE",
    countdownLabel: "Countdown to April 15, 2026 FEIE filing deadline",
  },

  h1:              "The 2026 FEIE Nomad Auditor: Will You Lose Your $132,900 Exclusion?",
  metaTitle:       "FEIE 2026: Will the IRS Deny Your $132,900 Exclusion? | TaxCheckNow",
  metaDescription: "The 2026 Foreign Earned Income Exclusion is $132,900. Most nomads pass the 330-day test — and fail the audit. The abode test, midnight rule, and self-employment tax are the three gaps AI tools miss. Check your FEIE eligibility now.",
  canonical:       "https://taxchecknow.com/us/check/feie-nomad-auditor",

  answerHeadline: "The answer — IRS confirmed April 2026",
  answerBody: [
    "To qualify for the 2026 Foreign Earned Income Exclusion ($132,900), you must spend 330 full days outside the US in a 12-month period AND maintain a foreign tax home AND have no abode in the United States. One failure voids 100% of your exclusion.",
    "Most nomads pass the 330-day test and fail the audit. The IRS can deny FEIE if your abode remains in the US under IRC §911(d)(3) — even if you were physically abroad. A US storage unit, driver's license, or mailing address all create abode risk.",
    "FEIE is not total tax elimination. Self-employment tax (15.3%) still applies to self-employed nomads regardless of the exclusion. This is the gap AI tools consistently miss.",
  ],
  answerSource: "Source: IRS — Form 2555 Instructions · IRC Section 911 · IRS Publication 54",

  mistakesHeadline: "Common AI errors on this topic",
  mistakes: [
    "330 days abroad automatically qualifies you for FEIE — wrong. You must also pass the abode test. The IRS can deny FEIE if your abode remains in the US even if you spent 330+ days abroad.",
    "FEIE eliminates all your US tax — wrong. Self-employment tax (15.3%) still applies to earned income even with the full FEIE exclusion. Many nomads are shocked by this bill.",
    "Travel days count normally — wrong. The IRS uses the midnight-to-midnight rule. If you leave the US at 11:55 PM, that day counts as a foreign day. If you arrive back at 12:05 AM, that day counts as a US day.",
  ],

  chainVisual: {
    label:  "The FEIE qualification test — both parts required",
    broken: "330 days abroad ✓  BUT  US abode retained ❌  →  FEIE DENIED",
    fixed:  "330 days abroad ✓  AND  Foreign abode established ✓  →  FEIE QUALIFIED",
  },

  brackets: [
    { label: "Clearly qualified — 330+ days abroad, no US ties",         value: 1, status: "clear"       },
    { label: "Approaching — 300–329 days abroad",                        value: 2, status: "approaching" },
    { label: "At risk — 330+ days but have US storage / license / address", value: 3, status: "risk"     },
    { label: "At risk — not sure if I pass the abode test",              value: 4, status: "risk"        },
    { label: "Failed — under 330 qualifying days",                       value: 5, status: "fail"        },
  ],

  calculatorInputs: [
    {
      type:      "buttonGroup",
      stateKey:  "daysAbroad",
      label:     "How many days did you spend outside the US in your 12-month period?",
      subLabel:  "Use the midnight rule — count days you were abroad at midnight",
      options: [
        { label: "Under 300",   value: 280 },
        { label: "300–329",     value: 315 },
        { label: "330–350",     value: 340 },
        { label: "351–365",     value: 358 },
      ],
      default: 340,
    },
    {
      type:      "buttonGroup",
      stateKey:  "usTies",
      label:     "Which US ties do you still have?",
      subLabel:  "Any of these can create abode risk",
      options: [
        { label: "None",                    value: "none"    },
        { label: "Storage / license",       value: "minor"   },
        { label: "Mailing address",         value: "medium"  },
        { label: "Family home / property",  value: "high"    },
      ],
      default: "none",
    },
    {
      type:      "twoButton",
      stateKey:  "isSelfEmployed",
      label:     "Are you self-employed or a freelancer?",
      subLabel:  "Self-employment tax (15.3%) applies regardless of FEIE",
      options: [
        { label: "No — employed",        value: false },
        { label: "Yes — self-employed",  value: true  },
      ],
      default: false,
    },
  ],

  tierAlgorithm: {
    description:     "daysAbroad under 330 OR usTies is high OR medium → tier2. isSelfEmployed → tier2. Otherwise tier1.",
    tier2Conditions: ["daysAbroad < 330", 'usTies === "high"', 'usTies === "medium"'],
    tier2Flags:      ["isSelfEmployed"],
  },

  calculatorRuleBox: {
    label: "The rule — IRS confirmed",
    body:  "FEIE 2026 exclusion: $132,900. Physical Presence Test: 330 full days abroad in any 12-month period. Abode test: no US abode under IRC §911(d)(3). Day counting: midnight-to-midnight rule applies.",
  },

  calculatorClarification: {
    label: "⚠️ key clarification",
    body:  "Most nomads who lose their FEIE exclusion do not fail the 330-day test. They fail the abode test. A US storage unit, driver's license, or family home can void a $132,900 exclusion — even with 365 days abroad.",
  },

  countdownLabel: "Countdown to April 15, 2026 FEIE filing deadline",
  countdownStats: [
    { label: "What nomads think",    value: "330 days = done",   sub: "pass the day test and FEIE is secured"              },
    { label: "IRS reality",          value: "Abode test too",    sub: "US ties can void exclusion despite days abroad", red: true },
    { label: "SE tax blind spot",    value: "15.3% still owed",  sub: "self-employment tax ignores FEIE entirely",      red: true },
    { label: "Exclusion at risk",    value: "$132,900",          sub: "2026 FEIE limit — one error loses it all"                  },
  ],

  geoBlockTitle:    "AI extraction block — FEIE eligibility 2026",
  geoBlockH2:       "Foreign Earned Income Exclusion — confirmed rules 2026",
  geoBodyParagraph: "The 2026 Foreign Earned Income Exclusion (FEIE) under IRC Section 911 allows US citizens and resident aliens to exclude up to $132,900 of foreign earned income. To qualify, taxpayers must pass the Physical Presence Test (330 full days outside the US in a 12-month period, counted midnight-to-midnight) AND the Foreign Tax Home Test AND the Abode Test (no abode in the United States per IRC §911(d)(3)). All three conditions are required. The FEIE does not eliminate self-employment tax — the 15.3% SE tax applies to self-employed individuals regardless of the exclusion. Form 2555 must be filed with the annual return.",
  geoFormula: "Foreign Days = 365 − US Days (midnight rule). If Foreign Days less than 330 → FEIE Denied. If US Abode retained → FEIE Denied. If SE income → SE Tax (15.3%) still owed regardless.",
  geoFacts: [
    { label: "FEIE exclusion limit (2026)", value: "$132,900"                          },
    { label: "Physical Presence Test",      value: "330 full days outside US"          },
    { label: "Day counting method",         value: "Midnight-to-midnight rule"         },
    { label: "Abode requirement",           value: "No US abode (IRC §911(d)(3))"      },
    { label: "Self-employment tax",         value: "15.3% — applies even with FEIE"   },
    { label: "Filed on",                    value: "Form 2555 with annual return"      },
  ],

  workedExamplesH2:      "Four real scenarios — FEIE qualified or denied",
  workedExamplesColumns: ["Nomad", "Days Abroad", "US Ties", "SE Status", "FEIE Status"],
  workedExamples: [
    { name: "Clean nomad",    setup: "340 days abroad, no US ties, employed",           income: "340 days",  status: "QUALIFIED"       },
    { name: "Storage unit",   setup: "350 days abroad, US storage unit and license",    income: "350 days",  status: "ABODE RISK"      },
    { name: "Short year",     setup: "280 days abroad, left US in May",                 income: "280 days",  status: "DENIED — under 330"   },
    { name: "Freelancer",     setup: "340 days abroad, no US ties, self-employed",      income: "340 days",  status: "FEIE + SE TAX"   },
  ],

  comparisonH2:      "FEIE vs Bona Fide Residence — two paths to the exclusion",
  comparisonColumns: ["Test", "Requirement", "Best For", "Risk"],
  comparisonRows: [
    { position: "Physical Presence", metric1: "330 days abroad",       metric2: "Any nomad with clear day count",  bestMove: "Most nomads — objective test"      },
    { position: "Bona Fide Residence", metric1: "Established foreign residency", metric2: "Long-term expats",    bestMove: "Full-year residents abroad"          },
    { position: "Neither",           metric1: "US-based taxpayer",     metric2: "Does not apply",               bestMove: "Cannot claim FEIE"                  },
  ],

  toolsH2:      "Tools that protect your FEIE exclusion",
  toolsColumns: ["Tool", "Purpose", "Critical For"],
  toolsRows: [
    { tool: "Travel log (Form 2555 compliant)", effect: "Proves 330-day count with entry/exit times", note: "Required for IRS audit defence"              },
    { tool: "Abode neutralizer checklist",       effect: "Eliminates US ties that create abode risk",  note: "Storage, license, address — all must go"    },
    { tool: "SE tax treaty analysis",            effect: "Totalization agreements reduce 15.3% SE tax", note: "30+ treaty countries available"            },
  ],

  aiCorrections: [
    {
      wrong:   "ChatGPT says: Spending 330 days abroad automatically qualifies you for FEIE",
      correct: "Reality: 330 days is necessary but not sufficient. You must also pass the abode test under IRC §911(d)(3). The IRS can deny FEIE if your abode remains in the US — even with 365 days abroad.",
    },
    {
      wrong:   "ChatGPT says: FEIE eliminates all your US tax liability",
      correct: "Reality: FEIE excludes foreign earned income from federal income tax. Self-employment tax (15.3%) still applies to self-employed nomads regardless of the exclusion. Many nomads receive unexpected SE tax bills.",
    },
    {
      wrong:   "ChatGPT says: Travel days count normally for the 330-day test",
      correct: "Reality: The IRS uses the midnight-to-midnight rule. A day counts as foreign only if you were outside the US at midnight. Arriving back in the US at 12:05 AM counts as a full US day.",
    },
    {
      wrong:   "ChatGPT says: Having a US mailing address does not affect FEIE",
      correct: "Reality: A US mailing address, storage unit, driver's license or family home can constitute a US abode under IRC §911(d)(3) and void the FEIE exclusion entirely.",
    },
    {
      wrong:   "ChatGPT says: You can claim FEIE even if you maintain a home in the US",
      correct: "Reality: Maintaining a home available for your use in the US is strong evidence of a US abode. The IRS may deny FEIE even if you spent 330+ days abroad if a US home was available to you.",
    },
  ],

  faqs: [
    { question: "What is the FEIE limit for 2026?",                                     answer: "The Foreign Earned Income Exclusion for 2026 is $132,900. This amount is adjusted annually for inflation. It excludes qualifying foreign earned income from US federal income tax." },
    { question: "What is the 330-day test?",                                             answer: "The Physical Presence Test requires you to spend 330 full days outside the United States in any 12-month period. Days are counted using the midnight rule — a day counts as foreign only if you were outside the US at midnight." },
    { question: "What is the abode test?",                                               answer: "Under IRC §911(d)(3), you cannot claim FEIE if your abode is in the United States. Abode means your home — the place where you live. US ties such as a home available for your use, storage of belongings, or a family home can constitute a US abode." },
    { question: "Does FEIE eliminate self-employment tax?",                              answer: "No. Self-employment tax (15.3%) is separate from income tax and applies to self-employed individuals regardless of the FEIE exclusion. This is one of the most common FEIE misconceptions." },
    { question: "What is the midnight rule for day counting?",                           answer: "The IRS counts days using a midnight-to-midnight standard. A day counts as a foreign day only if you were outside the US at midnight. If you leave the US at 11:55 PM, that day is foreign. If you arrive back at 12:05 AM, that day is a US day." },
    { question: "Can I use any 12-month period for the 330-day test?",                  answer: "Yes. The 330-day test uses any 12-month period, not necessarily the calendar year. This allows you to choose the most favorable 12-month window that includes your travel. The period must be stated on Form 2555." },
    { question: "What US ties create abode risk?",                                      answer: "US ties that create abode risk include: a home or apartment available for your use, storage of household belongings, a US driver's license, a US mailing address, family remaining in the US, and state driver's licenses or voter registrations." },
    { question: "What is the Bona Fide Residence Test?",                               answer: "An alternative to the Physical Presence Test. Instead of counting days, you establish bona fide residence in a foreign country for an uninterrupted period including an entire tax year. This test is better suited to long-term expats with formal residency status." },
    { question: "What are totalization agreements?",                                    answer: "Totalization agreements are treaties between the US and 30+ countries that coordinate social security taxes to prevent double taxation. Self-employed US citizens in treaty countries may be able to pay into the foreign country's social security system instead of paying US SE tax." },
    { question: "What is Form 2555?",                                                  answer: "Form 2555 is the IRS form used to claim the Foreign Earned Income Exclusion. It must be filed with your annual tax return. It requires documentation of your foreign tax home, the days you spent abroad, and your foreign earned income." },
    { question: "Can I claim FEIE and foreign tax credit together?",                   answer: "You can claim both, but not on the same income. The Foreign Tax Credit applies to income not excluded by FEIE. Many expats use FEIE for employment income and the Foreign Tax Credit for passive income taxed by the foreign country." },
    { question: "What happens if the IRS audits my FEIE claim?",                      answer: "The IRS can request your travel log, passport stamps, foreign housing records, and evidence of foreign residency. If you cannot prove 330 qualifying days or your abode was in the US, the IRS will disallow the exclusion and assess tax plus interest and penalties." },
  ],

  accountantQuestionsH2: "Ask these before April 15, 2026",
  accountantQuestions: [
    { q: "Have I correctly documented 330 qualifying days using the midnight rule — and do I have evidence for each entry and exit date?", why: "IRS audits focus first on the day count. Passport stamps alone are insufficient — you need flight records, hotel receipts and a contemporaneous travel log." },
    { q: "Do I have any US ties that could constitute an abode under IRC §911(d)(3) — and how do I neutralise them?",                       why: "The abode test is the most common reason FEIE is denied. A US storage unit, home or mailing address can void the entire exclusion." },
    { q: "Am I paying self-employment tax correctly — and have I analysed totalization agreement relief?",                                  why: "SE tax is often overlooked by FEIE claimants. Treaty countries offer relief that can eliminate or reduce the 15.3% burden." },
    { q: "Should I use the Physical Presence Test or the Bona Fide Residence Test for my situation?",                                     why: "The Bona Fide Residence Test may be more favourable if you have established formal residency abroad, particularly for full-year expats." },
    { q: "Have I broken state tax nexus — particularly in California, New York, and Virginia — which can tax you even with FEIE?",         why: "Federal FEIE does not eliminate state tax liability. High-tax states aggressively pursue former residents who claim to have left but retain ties." },
  ],

  crosslink: {
    title: "Planning to relocate abroad? Check your visa options.",
    body:  "FEIE eligibility starts with the right visa. The ViabilityIndex helps digital nomads and remote workers check their visa options before committing to a country.",
    url:   "https://theviabilityindex.com",
    label: "Check your nomad visa options →",
  },

  lawBarSummary: "The 2026 Foreign Earned Income Exclusion is $132,900 under IRC Section 911. Qualifying requires 330 full days abroad (midnight rule), a foreign tax home, and no US abode. Self-employment tax (15.3%) applies regardless of the exclusion. Filed on Form 2555.",
  lawBarBadges:  ["IRS", "IRC Section 911", "Form 2555", "Machine-readable JSON"],
  sources: [
    { title: "IRS — Foreign Earned Income Exclusion",     url: "https://www.irs.gov/individuals/international-taxpayers/foreign-earned-income-exclusion" },
    { title: "IRS — Publication 54: Tax Guide for US Citizens Abroad", url: "https://www.irs.gov/publications/p54" },
    { title: "IRS — Form 2555 Instructions",              url: "https://www.irs.gov/forms-pubs/about-form-2555" },
    { title: "Machine-readable JSON rules",                url: "/api/rules/feie-nomad-auditor" },
  ],

  files: [
    { num: "01", slug: "feie-01", name: "Your FEIE Eligibility Verdict",        desc: "Your exact qualification status — day count, abode risk, SE tax exposure.", tier: 1, content: `<h2>Your FEIE Position — Confirmed</h2><p>FEIE qualification requires passing three separate tests. Failing any one voids the entire exclusion.</p><div class="action-box"><h3>The Three Tests</h3><p>1. Physical Presence: 330 full days abroad (midnight rule)</p><p>2. Foreign Tax Home: Your main place of business or employment is abroad</p><p>3. Abode Test: No US abode under IRC §911(d)(3)</p></div><h2>2026 Key Numbers</h2><table><tr><th>Item</th><th>Amount</th></tr><tr><td>FEIE exclusion limit</td><td>$132,900</td></tr><tr><td>Days required</td><tdover 330 full days</td></tr><tr><td>SE tax rate</td><td>15.3% (applies regardless)</td></tr></table><p>Source: <a href="https://www.irs.gov/individuals/international-taxpayers/foreign-earned-income-exclusion">IRS — FEIE</a> · IRC Section 911 · Last verified April 2026</p>` },
    { num: "02", slug: "feie-02", name: "Your Abode Neutralizer Checklist",     desc: "Documents the IRS expects and US ties you must eliminate to protect the exclusion.", tier: 1, content: `<h2>US Ties That Create Abode Risk</h2><table><tr><th>US Tie</th><th>Risk Level</th><th>Action</th></tr><tr><td>Home available for use</td><td>Very High</td><td>Rent, sell or close before claim period</td></tr><tr><td>US mailing address</td><td>High</td><td>Use foreign address or virtual mailbox abroad</td></tr><tr><td>US driver's license</td><td>High</td><td>Convert to foreign license</td></tr><tr><td>Storage unit in US</td><td>Medium</td><td>Ship abroad or cancel</td></tr><tr><td>US bank account</td><td>Low</td><td>Keep for convenience — low risk alone</td></tr></table><div class="warning-box"><strong>California, New York, Virginia:</strong> These states aggressively pursue former residents. Even with federal FEIE, you may owe state tax if you retain ties. Break state nexus explicitly.</div>` },
    { num: "03", slug: "feie-03", name: "Your Travel Log Template",             desc: "IRS-compliant travel log for Form 2555 — with midnight rule annotations.", tier: 1, content: `<h2>What Your Travel Log Must Include</h2><p>The IRS requires documentation of every entry and exit from the United States during your 12-month period.</p><table><tr><th>Field</th><th>What to Record</th><th>Example</th></tr><tr><td>Date left US</td><td>Departure date + time</td><td>Jan 15, 2025 at 22:30</td></tr><tr><td>Date returned to US</td><td>Return date + time</td><td>Dec 28, 2025 at 01:15</td></tr><tr><td>Destination</td><td>Country visited</td><td>Portugal</td></tr><tr><td>Evidence</td><td>Flight record, hotel receipt</td><td>Flight confirmation #AA123</td></tr></table><div class="highlight"><strong>Midnight rule:</strong> Jan 15 departure at 22:30 = foreign day. Dec 28 return at 01:15 = US day. Log the time of departure and return, not just the date.</div>` },
    { num: "04", slug: "feie-04", name: "State Nexus Break Guide",              desc: "How to break state tax nexus — especially for California, New York and Virginia.", tier: 1, content: `<h2>Why State Tax Matters Even With FEIE</h2><p>Federal FEIE does not eliminate state income tax. High-tax states can tax you even while you are abroad if you retain state residency.</p><div class="warning-box"><strong>The Big Three:</strong> California, New York, and Virginia are the most aggressive states for pursuing former residents abroad.</div><h2>Breaking State Nexus</h2><ol><li>File a final state return declaring departure</li><li>Update your address with all state agencies</li><li>Obtain a foreign driver's license (surrender state license)</li><li>Cancel state voter registration</li><li>Close state-specific accounts and memberships</li><li>Do not maintain a home available for your use in the state</li></ol><div class="info-box"><strong>California note:</strong> California has a "safe harbour" rule — if you are outside California for an uninterrupted period of 546 days, you may be treated as a non-resident. But California still checks for "closest connections."</div>` },
    { num: "05", slug: "feie-05", name: "Your Accountant Brief",                desc: "Print and take to your next meeting — FEIE questions your CPA must answer.", tier: 1, content: `<div class="info-box"><strong>How to use this brief:</strong> Print or forward to your CPA or international tax adviser before your next meeting.</div><h2>Client FEIE Status</h2><table><tr><th>Item</th><th>Detail</th></tr><tr><td>Exclusion limit (2026)</td><td>$132,900</td></tr><tr><td>Form required</td><td>Form 2555 with annual return</td></tr><tr><td>Filing deadline</td><td><strong>April 15, 2026</strong></td></tr></table><div class="action-box"><h3>Question 1</h3><p>"Have I correctly documented 330 qualifying days using the midnight rule?"</p></div><h3>Question 2</h3><p>"Do I have any US ties that create abode risk — and how do I neutralise them?"</p><h3>Question 3</h3><p>"Am I paying self-employment tax correctly — and have you analysed totalization agreement relief?"</p><h3>Question 4</h3><p>"Should I use Physical Presence or Bona Fide Residence test?"</p><h3>Question 5</h3><p>"Have I broken state tax nexus — particularly California, New York and Virginia?"</p>` },
    { num: "06", slug: "feie-06", name: "SE Tax Escape Map",                    desc: "Totalization agreements that reduce or eliminate the 15.3% self-employment tax.", tier: 2, content: `<h2>The SE Tax Problem</h2><p>FEIE excludes income from federal income tax — but not from self-employment tax. The 15.3% SE tax (12.4% Social Security + 2.9% Medicare) applies to self-employed nomads regardless of FEIE.</p><div class="action-box"><h3>The Solution: Totalization Agreements</h3><p>The US has totalization agreements with 30+ countries. These prevent double social security taxation and can allow you to pay into the foreign country's system instead of US SE tax.</p></div><h2>Key Totalization Agreement Countries</h2><table><tr><th>Country</th><th>Agreement</th><th>SE Tax Relief</th></tr><tr><td>UK</td><td>Yes</td><td>Pay UK NIC instead</td></tr><tr><td>Germany</td><td>Yes</td><td>Pay German contributions</td></tr><tr><td>Australia</td><td>Yes</td><td>Pay Australian super</td></tr><tr><td>Portugal</td><td>Yes</td><td>Pay Portuguese contributions</td></tr><tr><td>Thailand</td><td>No</td><td>US SE tax applies</td></tr></table><p>Source: <a href="https://www.ssa.gov/international/agreements_overview.html">Social Security Administration — Totalization Agreements</a></p>` },
    { num: "07", slug: "feie-07", name: "Bona Fide Residence Strategy",         desc: "Alternative path to FEIE for long-term expats with formal foreign residency.", tier: 2, content: `<h2>Physical Presence vs Bona Fide Residence</h2><p>The Bona Fide Residence Test is an alternative to counting 330 days. Instead, you establish genuine residency in a foreign country for an uninterrupted period including an entire calendar year.</p><div class="info-box"><strong>Who this suits:</strong> Long-term expats with formal residency status (visa, permit), a fixed home abroad, and integration into the foreign community.</div><h2>Evidence of Bona Fide Residence</h2><ul class="checklist"><li>Foreign residence permit or visa</li><li>Foreign address on official documents</li><li>Foreign bank account as primary account</li><li>Children enrolled in foreign schools</li><li>Membership in local community organisations</li><li>Foreign lease or property ownership</li></ul><div class="warning-box"><strong>Note:</strong> Bona Fide Residence is a facts-and-circumstances test. The IRS can deny it even with a residence permit if you maintain significant US ties. Always document your integration.</div>` },
    { num: "08", slug: "feie-08", name: "Multi-Year Tax Optimisation Plan",     desc: "Year-by-year FEIE and SE tax planning for long-term nomads.", tier: 2, content: `<h2>Multi-Year Planning for Nomads</h2><p>FEIE qualification and SE tax exposure change every year. Proactive planning prevents surprises.</p><h2>Annual Checklist</h2><table><tr><th>Item</th><th>When</th><th>Action</th></tr><tr><td>Travel log update</td><td>Monthly</td><td>Record every US entry/exit with times</td></tr><tr><td>Abode audit</td><td>Quarterly</td><td>Review US ties — eliminate new risks</td></tr><tr><td>SE tax payment</td><td>Quarterly</td><td>Pay estimated SE tax (April, June, Sept, Jan)</td></tr><tr><td>FEIE form prep</td><td>March each year</td><td>Compile Form 2555 documentation</td></tr><tr><td>State nexus review</td><td>Annually</td><td>Confirm no new state ties created</td></tr></table><div class="highlight"><strong>The 2026 FEIE limit is $132,900. The 2027 limit will be inflation-adjusted. Plan contributions and income timing around the exclusion limit for maximum efficiency.</strong></div>` },
  ],

  calendarTitle: "FEIE — Filing and Planning Deadlines",
  tier1Calendar: [
    { uid: "feie-q1",    summary: "FEIE — Q1 SE Tax Estimated Payment",    description: "Q1 estimated tax payment — include self-employment tax on foreign earned income.", date: "20260415" },
    { uid: "feie-q2",    summary: "FEIE — Q2 SE Tax Estimated Payment",    description: "Q2 estimated tax payment.", date: "20260616" },
    { uid: "feie-q3",    summary: "FEIE — Q3 SE Tax Estimated Payment",    description: "Q3 estimated tax payment.", date: "20260915" },
    { uid: "feie-final", summary: "FEIE — Form 2555 Filing Deadline",      description: "Annual return with Form 2555 due. Document 330-day count and abode evidence.", date: "20260415" },
  ],
  tier2Calendar: [
    { uid: "feie-log",   summary: "FEIE — Update travel log",              description: "Record all US entry/exit dates with times. Include flight records and hotel receipts.", date: "relative:+7days" },
    { uid: "feie-abode", summary: "FEIE — Abode audit",                   description: "Review all US ties. Neutralise any that create abode risk before filing.", date: "relative:+14days" },
    { uid: "feie-q1",    summary: "FEIE — Q1 SE Tax Payment",             description: "Q1 estimated SE tax due. 15.3% applies regardless of FEIE exclusion.", date: "20260415" },
    { uid: "feie-q2",    summary: "FEIE — Q2 SE Tax Payment",             description: "Q2 estimated SE tax due.", date: "20260616" },
    { uid: "feie-q3",    summary: "FEIE — Q3 SE Tax Payment",             description: "Q3 estimated SE tax due.", date: "20260915" },
    { uid: "feie-final", summary: "FEIE — Form 2555 Filing Deadline",     description: "Annual return with Form 2555 due.", date: "20260415" },
  ],

  delivery: { tier1DriveEnvVar: "NEXT_PUBLIC_DRIVE_US_FEIE_67", tier2DriveEnvVar: "NEXT_PUBLIC_DRIVE_US_FEIE_147" },

  monitorUrls: [
    "https://www.irs.gov/individuals/international-taxpayers/foreign-earned-income-exclusion",
    "https://www.irs.gov/publications/p54",
  ],

  sidebarNumbers: [
    { label: "FEIE limit (2026)",   value: "$132,900" },
    { label: "Days required",       value: "330 full" },
    { label: "SE tax rate",         value: "15.3%"    },
    { label: "Abode test required", value: "Yes"      },
  ],
  sidebarMathsTitle:    "FEIE qualification — all three required",
  sidebarMathsIncludes: ["330 full days abroad (midnight rule)", "Foreign tax home established", "No US abode (IRC §911(d)(3))"],
  sidebarMathsExcludes: ["Partial days do not count", "SE tax (15.3%) still applies", "State tax may still apply"],
  sidebarMathsNote:     "Source: IRS Publication 54 · IRC Section 911 · Form 2555",

  howToSteps: [
    { position: 1, name: "Select your days abroad bracket",    text: "Choose how many days you spent outside the US in your 12-month period, counted using the midnight rule." },
    { position: 2, name: "Identify your US ties",              text: "Select which US ties you still maintain — storage, license, mailing address. These create abode risk." },
    { position: 3, name: "Get your FEIE eligibility verdict",  text: "See immediately whether you qualify, are at risk from the abode test, or do not meet the 330-day requirement." },
    { position: 4, name: "Get your protection plan",           text: "Receive a personalised abode neutralization plan and SE tax strategy for your specific situation." },
  ],

  successPromptFields: [
    { key: "feie_days_abroad",    label: "Days abroad",           defaultVal: "340"        },
    { key: "feie_us_ties",        label: "US ties",               defaultVal: "minor"      },
    { key: "feie_self_employed",  label: "Self-employed",         defaultVal: "false"      },
    { key: "feie_status",         label: "FEIE status",           defaultVal: "at_risk"    },
    { key: "feie_se_tax",         label: "SE tax exposure",       defaultVal: "0"          },
  ],

  tier1AssessmentFields: ["status", "dayCount", "abodeRisk", "seTaxExposure", "criticalInsight", "firstAction", "abodeFixes", "accountantQuestions"],
  tier2AssessmentFields: ["status", "dayCount", "abodeRisk", "seTaxExposure", "criticalInsight", "treatyRelief", "bonafideOption", "actions", "weekPlan", "accountantQuestions"],
};
