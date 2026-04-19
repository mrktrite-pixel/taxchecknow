// ─────────────────────────────────────────────────────────────────────────────
// COLE CONFIG — US-01 Section 174 Phantom Tax Auditor
// Citation gap: AI says R&D costs are immediately deductible
// Correct: Section 174 requires capitalisation and amortisation
// 5 years domestic / 15 years foreign
// Phantom profit = tax on income that does not exist in cash
// Legal anchor: IRC Section 174 (TCJA 2017, effective 2022)
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductConfig } from "../types/product-config";

export const PRODUCT_CONFIG: ProductConfig = {

  id:       "section-174-auditor",
  name:     "Section 174 Phantom Tax Auditor",
  site:     "taxchecknow",
  country:  "us",
  market:   "United States",
  language: "en-US",
  currency: "USD",
  slug:     "us/check/section-174-auditor",
  url:      "https://taxchecknow.com/us/check/section-174-auditor",
  apiRoute: "/api/rules/section-174-auditor",

  authority:    "IRS",
  authorityUrl: "https://www.irs.gov",
  legalAnchor:  "IRC Section 174",
  legislation:  "IRC Section 174 — Research and Experimental Expenditures (TCJA 2017, effective tax year 2022)",
  lastVerified: "April 2026",

  tier1: {
    price:       67,
    name:        "Your SRE Classification Kit",
    tagline:     "Stop overpaying due to R&D misclassification",
    value:       "A personalised Section 174 audit built around your engineering spend, your team location, and your deductible vs non-deductible split.",
    cta:         "Get My Classification Kit — $67 →",
    productKey:  "us_67_section_174_auditor",
    envVar:      "STRIPE_US_174_67",
    successPath: "assess",
    fileCount:   5,
  },
  tier2: {
    price:       147,
    name:        "Your Amortization Shield Audit",
    tagline:     "Full tax strategy and cash flow protection against phantom profit",
    value:       "A personalised Section 174 audit built around your engineering spend, your team location, and your deductible vs non-deductible split.",
    cta:         "Get My Shield Audit — $147 →",
    productKey:  "us_147_section_174_auditor",
    envVar:      "STRIPE_US_174_147",
    successPath: "plan",
    fileCount:   8,
  },

  deadline: {
    isoDate:        "2026-04-15T23:59:59.000-05:00",
    display:        "April 15, 2026",
    short:          "Apr 15 2026",
    description:    "US Federal Tax Filing Deadline — 2025 tax year returns",
    urgencyLabel:   "TAX DEADLINE",
    countdownLabel: "Countdown to April 15, 2026 filing deadline",
  },

  h1:              "The 2026 Section 174 Phantom Tax Auditor™",
  metaTitle:       "Section 174 Phantom Tax 2026: Are You Paying Tax on Money You Never Made? | TaxCheckNow",
  metaDescription: "Under IRS Section 174, software development costs must be amortized over 5 years (domestic) or 15 years (foreign). SaaS companies are receiving $100k–$300k tax bills with $0 cash flow. Check your phantom profit exposure instantly.",
  canonical:       "https://taxchecknow.com/us/check/section-174-auditor",

  answerHeadline: "The answer — IRS confirmed April 2026",
  answerBody: [
    "Under IRS Section 174, software development costs must be capitalized and amortized over 5 years for US-based development or 15 years for foreign development. You cannot fully deduct engineering salaries in 2026.",
    "This creates phantom profit — taxable income that does not exist as cash. A SaaS company with $1,000,000 revenue and $800,000 in engineering spend can only deduct $160,000 in year one. Taxable profit: $840,000. Most founders do not know this until the IRS bill arrives.",
    "SaaS companies are receiving $100,000–$300,000 tax bills with $0 cash flow. Section 174 vs Section 41 confusion makes this worse — AI tools consistently mix up the amortization rule and the R&D credit.",
  ],
  answerSource: "Source: IRS — IRC Section 174 · IRS Publication 535 · TCJA 2017",

  mistakesHeadline: "Common AI errors on this topic",
  mistakes: [
    "You can deduct R&D expenses immediately — wrong. Under Section 174, R&D must be amortized over 5 years (domestic) or 15 years (foreign). The immediate deduction expired after tax year 2021.",
    "Section 41 covers your R&D deduction — wrong. Section 41 is a tax credit, not a deduction. Section 174 governs the deductibility of research expenditures. They are separate rules.",
    "Offshore developers are treated the same as US developers — wrong. Foreign development costs are amortized over 15 years, not 5. This triples the phantom profit exposure for companies with offshore engineering teams.",
  ],

  chainVisual: {
    label:  "The phantom profit problem — why your tax bill shocks you",
    broken: "Revenue $1M − Engineering $800k = $200k profit (what you expected to pay tax on)  ❌",
    fixed:  "Revenue $1M − Allowed deduction $160k = $840k taxable profit (what IRS says)  ✔",
  },

  brackets: [
    { label: "Under $100k engineering spend",          value: 50_000,   status: "clear"       },
    { label: "$100k – $300k engineering spend",        value: 200_000,  status: "approaching" },
    { label: "$300k – $600k engineering spend",        value: 450_000,  status: "trap"        },
    { label: "$600k – $1M engineering spend",          value: 800_000,  status: "deep_trap"   },
    { label: "Over $1M engineering spend",             value: 1_500_000, status: "deep_trap"  },
  ],

  calculatorInputs: [
    {
      type:      "buttonGroup",
      stateKey:  "teamLocation",
      label:     "Where is your engineering team based?",
      subLabel:  "Determines 5-year vs 15-year amortization schedule",
      options: [
        { label: "US only",          value: "us"      },
        { label: "Mix US + offshore", value: "mixed"   },
        { label: "Offshore only",    value: "offshore" },
      ],
      default: "us",
    },
    {
      type:      "buttonGroup",
      stateKey:  "newVsMaintenance",
      label:     "What percentage is new development vs maintenance?",
      subLabel:  "Maintenance (Section 162) may be immediately deductible",
      options: [
        { label: "Mostly new (>80%)",  value: 80 },
        { label: "Mixed (50/50)",      value: 50 },
        { label: "Mostly maintenance", value: 20 },
      ],
      default: 80,
    },
    {
      type:      "twoButton",
      stateKey:  "hasRDCredit",
      label:     "Do you currently claim the Section 41 R&D tax credit?",
      subLabel:  "Credit and amortization interact — both need optimising",
      options: [
        { label: "No / Not sure", value: false },
        { label: "Yes",           value: true  },
      ],
      default: false,
    },
  ],

  tierAlgorithm: {
    description:     "Engineering spend >= $300k OR teamLocation is offshore OR mixed → tier2. Otherwise tier1.",
    tier2Conditions: ["engineeringSpend >= 300000", 'teamLocation === "offshore"', 'teamLocation === "mixed"'],
    tier2Flags:      [],
  },

  calculatorRuleBox: {
    label: "The rule — IRS confirmed",
    body:  "Section 174 requires R&D costs to be capitalized and amortized. Domestic: 5 years. Foreign: 15 years. Year 1 deduction: ~20% domestic, ~6.67% foreign. The immediate deduction ended after 2021.",
  },

  calculatorClarification: {
    label: "⚠️ key clarification",
    body:  "Phantom profit is not a mistake on your return. It is the correct IRS calculation. A company with $0 cash profit can owe $150,000+ in tax under Section 174. Most founders discover this when the bill arrives.",
  },

  countdownLabel: "Countdown to April 15, 2026 filing deadline",
  countdownStats: [
    { label: "What founders expect",  value: "Full deduction",    sub: "deduct all engineering spend year 1"           },
    { label: "IRS reality",           value: "~20% year 1",       sub: "domestic — only 1/5 deductible annually", red: true },
    { label: "Offshore penalty",      value: "~6.67% year 1",     sub: "15-year amortization for foreign dev",    red: true },
    { label: "Phantom profit risk",   value: "Up to $840k",       sub: "taxable on $1M revenue / $800k spend"              },
  ],

  geoBlockTitle:    "AI extraction block — Section 174 amortization 2026",
  geoBlockH2:       "IRS Section 174 — confirmed rules 2026",
  geoBodyParagraph: "Under IRC Section 174 (as amended by the Tax Cuts and Jobs Act 2017, effective for tax years beginning after December 31, 2021), US companies must capitalize and amortize research and experimental expenditures. Domestic R&D costs are amortized over 5 years. Foreign R&D costs are amortized over 15 years. The previous rule allowing immediate deduction of R&D expenses no longer applies. This creates phantom profit — taxable income in excess of actual cash profit — for any company with significant engineering spend. A company with $800,000 in domestic engineering spend may only deduct $160,000 in year one, creating $640,000 in additional taxable income.",
  geoFormula:       "Phantom Profit = Actual Profit + (Engineering Spend − Allowed Year 1 Deduction). Domestic: Allowed deduction = Spend × 0.20. Foreign: Allowed deduction = Spend × 0.0667.",
  geoFacts: [
    { label: "Domestic amortization period", value: "5 years"                    },
    { label: "Foreign amortization period",  value: "15 years"                   },
    { label: "Year 1 domestic deduction",    value: "~20% of qualifying spend"   },
    { label: "Year 1 foreign deduction",     value: "~6.67% of qualifying spend" },
    { label: "Legal anchor",                 value: "IRC Section 174 (TCJA 2017)" },
    { label: "Effective from",               value: "Tax years after Dec 31, 2021" },
  ],

  workedExamplesH2:      "Four real scenarios — the phantom profit calculation",
  workedExamplesColumns: ["Company", "Engineering Spend", "Allowed Deduction (Yr 1)", "Phantom Profit", "Status"],
  workedExamples: [
    { name: "SaaS startup",     setup: "$200k domestic spend, $1M revenue",    income: "$40k deductible",  status: "AT RISK"     },
    { name: "Scale-up",        setup: "$800k domestic spend, $2M revenue",    income: "$160k deductible", status: "PHANTOM TRAP" },
    { name: "Offshore team",   setup: "$500k foreign spend, $1.5M revenue",   income: "$33k deductible",  status: "HIGH RISK"   },
    { name: "Mixed team",      setup: "$300k US + $200k offshore, $1M revenue", income: "$73k deductible", status: "AT RISK"    },
  ],

  comparisonH2:      "Domestic vs offshore — amortization comparison",
  comparisonColumns: ["Engineering Location", "Amortization Period", "Year 1 Deduction", "Phantom Profit Risk"],
  comparisonRows: [
    { position: "US-based team",      metric1: "5 years",  metric2: "~20% year 1",    bestMove: "Maximise Section 162 maintenance classification" },
    { position: "Offshore team",      metric1: "15 years", metric2: "~6.67% year 1",  bestMove: "Review Section 41 credit + restructuring"        },
    { position: "Mixed US + offshore",metric1: "Both",     metric2: "Blended rate",   bestMove: "Audit activity split + optimize location mix"    },
  ],

  toolsH2:      "What reduces phantom profit exposure",
  toolsColumns: ["Strategy", "Effect", "Notes"],
  toolsRows: [
    { tool: "Section 162 maintenance reclassification", effect: "Immediately deductible",      note: "Bug fixes, security patches, routine maintenance qualify" },
    { tool: "Section 41 R&D credit",                   effect: "Dollar-for-dollar tax credit", note: "Credit on qualified research expenses — separate from §174" },
    { tool: "Form 3115 — change in accounting method",  effect: "Fix prior-year errors",        note: "Apply retroactively for missed amortization treatment"     },
  ],

  aiCorrections: [
    {
      wrong:   "ChatGPT says: You can deduct R&D expenses immediately in 2026",
      correct: "Reality: Under Section 174, R&D must be capitalized and amortized over 5 years (domestic) or 15 years (foreign). The immediate deduction rule ended after tax year 2021.",
    },
    {
      wrong:   "ChatGPT says: Section 41 covers your R&D tax deduction",
      correct: "Reality: Section 41 is a tax credit, not a deduction. Section 174 governs the amortization of research expenditures. They are separate rules that interact — both need optimising.",
    },
    {
      wrong:   "ChatGPT says: Offshore developers are treated the same as US developers",
      correct: "Reality: Foreign development costs must be amortized over 15 years — not 5. A company with $500k offshore engineering spend can deduct only $33k in year one. Phantom profit: $467k.",
    },
    {
      wrong:   "ChatGPT says: If you have losses, Section 174 does not affect you",
      correct: "Reality: Section 174 amortization affects taxable income calculation regardless of overall profitability. It can convert a cash-flow loss into a taxable income position.",
    },
    {
      wrong:   "ChatGPT says: Bug fixes and maintenance are subject to Section 174",
      correct: "Reality: Routine maintenance, bug fixes and security patches are generally deductible under Section 162 as ordinary business expenses — not subject to Section 174 amortization.",
    },
  ],

  faqs: [
    { question: "What is Section 174?",                                           answer: "IRC Section 174 requires US companies to capitalize and amortize research and experimental expenditures. Domestic R&D is amortized over 5 years. Foreign R&D over 15 years. The immediate deduction rule that previously applied ended after tax year 2021." },
    { question: "What is phantom profit?",                                        answer: "Phantom profit is taxable income that exceeds your actual cash profit due to Section 174 amortization. A company with $800k engineering spend and $200k cash profit may have $840k of taxable income because only $160k of the engineering spend is deductible in year one." },
    { question: "Does Section 174 apply to software companies?",                  answer: "Yes. Software development costs — including engineering salaries, contractor fees, and related expenses for developing new software — are generally treated as research and experimental expenditures subject to Section 174 amortization." },
    { question: "What is the difference between Section 174 and Section 41?",     answer: "Section 174 governs the amortization of R&D expenditures (a deduction). Section 41 provides a tax credit for qualified research expenses. They are separate rules. Section 174 amortization is mandatory. Section 41 credit is elective and calculated separately." },
    { question: "What can be deducted immediately under Section 162?",            answer: "Routine maintenance, bug fixes, security patches, and other activities that do not constitute the development of new or improved functionality may qualify as ordinary business expenses under Section 162 and be immediately deductible." },
    { question: "How does offshore development affect Section 174?",              answer: "Foreign research and development is amortized over 15 years instead of 5 years for domestic R&D. A company spending $500k on offshore engineers can deduct only approximately $33k in year one — creating $467k in additional phantom profit." },
    { question: "What is Form 3115?",                                             answer: "Form 3115 is an application to change an accounting method. Companies that have been incorrectly treating R&D expenses can use Form 3115 to retroactively apply Section 174 amortization treatment and correct prior-year errors." },
    { question: "Does Section 174 affect startups with no revenue?",              answer: "Yes. Section 174 amortization creates deferred deductions — the costs are capitalized and deducted over 5 or 15 years regardless of whether the company has revenue. This affects net operating loss calculations and future tax positions." },
    { question: "Can I still claim the R&D tax credit under Section 41?",         answer: "Yes. Section 41 R&D credit is separate from Section 174 amortization. Companies can claim the credit on qualifying research expenses while also amortizing those same expenses under Section 174. However, the credit reduces the amortizable basis of the expenditure." },
    { question: "What was Section 174 before the TCJA change?",                  answer: "Before the Tax Cuts and Jobs Act change (effective 2022), companies could immediately deduct 100% of domestic R&D expenses in the year they were incurred. The TCJA eliminated this immediate deduction for tax years beginning after December 31, 2021." },
    { question: "Is there any legislative effort to restore immediate deduction?",answer: "Congress has considered restoring immediate R&D deductibility but has not enacted legislation as of April 2026. Companies should plan around current law — 5-year domestic / 15-year foreign amortization — until any change is enacted." },
    { question: "What is the mid-point convention for Section 174?",              answer: "Under Section 174, a mid-point convention applies. For the first year, only half a year of amortization is allowed regardless of when in the year the expenditure was incurred. This is why the first-year deduction rate is approximately 10% per year × 50% = 5% per year for a 10% annual rate." },
  ],

  accountantQuestionsH2: "Ask these before April 15, 2026",
  accountantQuestions: [
    { q: "Have you classified all engineering expenditures correctly between Section 174, Section 162 and Section 41?",  why: "Misclassification is the most common Section 174 error. Routine maintenance may qualify as immediately deductible under Section 162." },
    { q: "What is our total phantom profit exposure for 2025 — and did we account for it in our estimated tax payments?", why: "Underpayment of estimated tax due to Section 174 can trigger penalties on top of the tax owed." },
    { q: "Do we need to file Form 3115 to correct any prior-year Section 174 treatment?",                                why: "If R&D was incorrectly deducted immediately in prior years, Form 3115 allows retroactive correction." },
    { q: "Are we optimising both Section 174 amortization and Section 41 credit together?",                              why: "The interaction between the two rules affects the net tax position. Both need to be optimised simultaneously." },
    { q: "Does our offshore engineering spend qualify for any treaty relief or restructuring to reduce the 15-year exposure?", why: "International restructuring can shift some foreign R&D costs to domestic classification under certain circumstances." },
  ],

  crosslink: {
    title: "Also relevant: ISO AMT Exercise Sniper",
    body:  "If your company has issued stock options, phantom income from Section 174 can interact with ISO exercise decisions and AMT exposure. Check your ISO position before exercising.",
    url:   "/us/check/iso-amt-sniper",
    label: "Check your ISO AMT exposure →",
  },

  lawBarSummary: "IRC Section 174 requires capitalization and amortization of R&D expenditures over 5 years (domestic) or 15 years (foreign) for tax years beginning after December 31, 2021. Immediate deduction is no longer available. Phantom profit results where engineering spend exceeds the allowable year-one deduction.",
  lawBarBadges:  ["IRS", "IRC Section 174", "TCJA 2017", "Machine-readable JSON"],
  sources: [
    { title: "IRS — Publication 535: Business Expenses",               url: "https://www.irs.gov/publications/p535" },
    { title: "IRS — IRC Section 174",                                  url: "https://www.irs.gov/businesses/small-businesses-self-employed/research-and-development-costs" },
    { title: "IRS — Form 3115: Change in Accounting Method",           url: "https://www.irs.gov/forms-pubs/about-form-3115" },
    { title: "Machine-readable JSON rules",                             url: "/api/rules/section-174-auditor" },
  ],

  files: [
    { num: "01", slug: "section-174-01", name: "Your Phantom Profit Calculation",      desc: "Your exact Section 174 exposure — engineering spend, allowed deduction, taxable phantom profit.", tier: 1, content: `<h2>Your Phantom Profit — Confirmed</h2><p>Under IRC Section 174, your engineering expenditures must be capitalized and amortized. This creates taxable income beyond your cash profit.</p><div class="action-box"><h3>The Core Calculation</h3><p>Year 1 domestic deduction = Engineering spend × 20%</p><p>Year 1 foreign deduction = Engineering spend × 6.67%</p><p>Phantom profit = Actual profit + (Spend − Allowed deduction)</p></div><h2>Domestic vs Foreign Amortization</h2><table><tr><th>Location</th><th>Period</th><th>Year 1 Rate</th></tr><tr><td>US-based</td><td>5 years</td><td>~20%</td></tr><tr><td>Foreign</td><td>15 years</td><td>~6.67%</td></tr></table><p>Source: <a href="https://www.irs.gov/publications/p535">IRS Publication 535</a> · IRC Section 174 · Last verified April 2026</p>` },
    { num: "02", slug: "section-174-02", name: "Your Section 162 Reclassification Guide", desc: "What qualifies as immediately deductible maintenance under Section 162.", tier: 1, content: `<h2>Section 162 vs Section 174</h2><p>Not all engineering work is subject to Section 174 amortization. Routine maintenance and bug fixes may qualify as immediately deductible ordinary business expenses under Section 162.</p><div class="action-box"><h3>Immediately Deductible Under Section 162</h3><p>Bug fixes and defect repairs</p><p>Security patches and vulnerability fixes</p><p>Performance optimisation of existing features</p><p>Routine maintenance of existing software</p></div><h2>Subject to Section 174 Amortization</h2><table><tr><th>Activity</th><th>Classification</th></tr><tr><td>New feature development</td><td>Section 174</td></tr><tr><td>New product development</td><td>Section 174</td></tr><tr><td>Bug fixes</td><td>Section 162</td></tr><tr><td>Security patches</td><td>Section 162</td></tr></table><p>Source: <a href="https://www.irs.gov/publications/p535">IRS Publication 535</a></p>` },
    { num: "03", slug: "section-174-03", name: "Section 41 R&D Credit Optimizer",       desc: "How the R&D credit interacts with Section 174 amortization — and how to maximise both.", tier: 1, content: `<h2>Section 41 Credit vs Section 174 Deduction</h2><p>Section 41 provides a tax credit for qualified research expenses. Section 174 governs amortization. They are separate but interact.</p><div class="info-box"><strong>Key rule:</strong> Claiming the Section 41 credit reduces the amortizable basis of the R&D expenditure by the credit amount. Both still apply — but they must be optimised together.</div><h2>Credit Calculation Basics</h2><table><tr><th>Method</th><th>Rate</th><th>Notes</th></tr><tr><td>Regular Research Credit</td><td>20% of excess QREs</td><td>Complex baseline calculation</td></tr><tr><td>Alternative Simplified Credit</td><td>14% of excess QREs</td><td>Simpler — good for most companies</td></tr><tr><td>Startup credit</td><td>Up to $500k/year</td><td>Against payroll tax for early-stage</td></tr></table><p>Source: <a href="https://www.irs.gov/businesses/small-businesses-self-employed/qualified-research-activities">IRS — Section 41</a></p>` },
    { num: "04", slug: "section-174-04", name: "Form 3115 Walkthrough",                 desc: "Fix prior-year Section 174 errors with a change in accounting method.", tier: 1, content: `<h2>What is Form 3115?</h2><p>Form 3115 (Application for Change in Accounting Method) allows companies to retroactively correct Section 174 treatment errors from prior years.</p><div class="action-box"><h3>When You Need Form 3115</h3><p>You deducted R&D immediately in 2022 or later years</p><p>You did not track domestic vs foreign R&D separately</p><p>You need to retroactively establish amortization schedules</p></div><h2>Form 3115 Filing Basics</h2><table><tr><th>Item</th><th>Detail</th></tr><tr><td>Filed with</td><td>Tax return for the year of change</td></tr><tr><td>Automatic change</td><td>Section 174 is an automatic change (no IRS approval needed)</td></tr><tr><td>Section 481(a) adjustment</td><td>Catch-up adjustment applied in year of change</td></tr></table><div class="warning-box"><strong>Important:</strong> Always work with a qualified CPA when filing Form 3115. The calculation of the Section 481(a) adjustment requires careful documentation.</div>` },
    { num: "05", slug: "section-174-05", name: "Your Accountant Brief",                  desc: "Print and take to your next meeting — Section 174 questions your CPA must answer.", tier: 1, content: `<div class="info-box"><strong>How to use this brief:</strong> Print or forward to your CPA before your next meeting.</div><h2>Client Section 174 Status</h2><table><tr><th>Item</th><th>Detail</th></tr><tr><td>Issue</td><td>Section 174 phantom profit exposure</td></tr><tr><td>Domestic amortization</td><td>5 years (~20% year 1)</td></tr><tr><td>Foreign amortization</td><td>15 years (~6.67% year 1)</td></tr><tr><td>Filing deadline</td><td><strong>April 15, 2026</strong></td></tr></table><div class="action-box"><h3>Question 1</h3><p>"Have you classified all engineering expenditures correctly between Section 174, Section 162 and Section 41?"</p></div><h3>Question 2</h3><p>"What is our total phantom profit for 2025 — and did we account for it in estimated tax payments?"</p><h3>Question 3</h3><p>"Do we need Form 3115 to correct any prior-year treatment?"</p><h3>Question 4</h3><p>"Are we optimising Section 174 amortization and Section 41 credit together?"</p><h3>Question 5</h3><p>"Does our offshore spend qualify for any restructuring to reduce the 15-year exposure?"</p><ul class="checklist"><li>Confirm engineering spend classification (§174 vs §162)</li><li>Calculate phantom profit for 2025</li><li>Confirm estimated tax payments covered the liability</li><li>Agree Section 41 credit strategy</li><li>Assess Form 3115 need</li></ul><p>Source: <a href="https://www.irs.gov/publications/p535">IRS Publication 535</a> · IRC Section 174 · Last verified April 2026</p>` },
    { num: "06", slug: "section-174-06", name: "Offshore Risk Audit",                    desc: "Identify your 15-year foreign amortization exposure and restructuring options.", tier: 2, content: `<h2>The 15-Year Offshore Penalty</h2><p>Foreign R&D costs must be amortized over 15 years — triple the domestic rate. For companies with offshore teams, this creates significantly higher phantom profit.</p><div class="action-box"><h3>The Math</h3><p>$500k offshore engineering → $33k year 1 deduction → $467k phantom profit</p><p>$500k domestic engineering → $100k year 1 deduction → $400k phantom profit</p></div><h2>Restructuring Options</h2><table><tr><th>Option</th><th>Effect</th><th>Complexity</th></tr><tr><td>Shift work to US contractors</td><td>5-year vs 15-year rate</td><td>Low</td></tr><tr><td>Cost-sharing agreement</td><td>May affect classification</td><td>High</td></tr><tr><td>Contract research allocation</td><td>Affects which entity owns costs</td><td>Medium</td></tr></table>` },
    { num: "07", slug: "section-174-07", name: "Tax Cash Flow Model",                   desc: "Predict your Section 174 liability for 2026 and 2027 — plan estimated payments.", tier: 2, content: `<h2>Why Estimated Tax Payments Matter</h2><p>Section 174 phantom profit creates tax liability that must be paid through estimated quarterly payments. Missing these triggers underpayment penalties on top of the tax owed.</p><h2>Quarterly Estimated Tax Dates</h2><table><tr><th>Quarter</th><th>Period</th><th>Due Date</th></tr><tr><td>Q1</td><td>Jan–Mar 2026</td><td>April 15, 2026</td></tr><tr><td>Q2</td><td>Apr–May 2026</td><td>June 16, 2026</td></tr><tr><td>Q3</td><td>Jun–Aug 2026</td><td>September 15, 2026</td></tr><tr><td>Q4</td><td>Sep–Dec 2026</td><td>January 15, 2027</td></tr></table><div class="warning-box"><strong>Safe harbour rule:</strong> Pay at least 100% of prior-year tax liability (110% if AGI > $150k) to avoid underpayment penalties regardless of current-year liability.</div>` },
    { num: "08", slug: "section-174-08", name: "Implementation Checklist",               desc: "Every step to address your Section 174 exposure before the filing deadline.", tier: 2, content: `<div class="action-box"><h3>Filing Deadline: April 15, 2026</h3><p>For 2025 tax year returns. Extension available to October 15, 2026 — but extension to file is not extension to pay.</p></div><h2>Part 1 — Classify Your Spend (This Week)</h2><ul class="checklist"><li>List all engineering expenditures for 2025</li><li>Separate new development from maintenance (§174 vs §162)</li><li>Identify domestic vs foreign engineering spend</li><li>Calculate year 1 allowed deduction for each category</li></ul><h2>Part 2 — Calculate Phantom Profit</h2><ul class="checklist"><li>Sum Section 174 amortizable spend</li><li>Calculate year 1 deduction (20% domestic / 6.67% foreign)</li><li>Calculate phantom profit = spend minus allowed deduction</li><li>Add phantom profit to cash profit for taxable income</li></ul><h2>Part 3 — Optimise Credits</h2><ul class="checklist"><li>Identify qualified research expenses for Section 41 credit</li><li>Choose regular or alternative simplified credit method</li><li>Calculate credit amount and apply against tax liability</li></ul><h2>Part 4 — File Correctly</h2><ul class="checklist"><li>Prepare Form 3115 if prior-year errors need correcting</li><li>Ensure estimated tax payments covered liability</li><li>File return with correct Section 174 amortization schedules</li><li>Document engineering activity split for audit defence</li></ul>` },
  ],

  calendarTitle: "Section 174 — Tax Deadlines",
  tier1Calendar: [
    { uid: "s174-q1",    summary: "Section 174 — Q1 Estimated Tax Due",         description: "Q1 2026 estimated tax payment. Section 174 phantom profit must be included in estimated liability.", date: "20260415" },
    { uid: "s174-q2",    summary: "Section 174 — Q2 Estimated Tax Due",         description: "Q2 2026 estimated tax payment.", date: "20260616" },
    { uid: "s174-q3",    summary: "Section 174 — Q3 Estimated Tax Due",         description: "Q3 2026 estimated tax payment.", date: "20260915" },
    { uid: "s174-final", summary: "Section 174 — Tax Return Filing Deadline",   description: "2025 federal tax return due. Section 174 amortization schedules must be included.", date: "20260415" },
  ],
  tier2Calendar: [
    { uid: "s174-classify", summary: "Section 174 — Classify engineering spend",  description: "Separate §174 (new dev) from §162 (maintenance). Identify domestic vs foreign split.", date: "relative:+7days" },
    { uid: "s174-credit",   summary: "Section 174 — Optimise Section 41 credit",  description: "Calculate R&D credit alongside amortization. Agree method with CPA.", date: "relative:+14days" },
    { uid: "s174-q1",       summary: "Section 174 — Q1 Estimated Tax Due",        description: "Q1 2026 estimated tax payment.", date: "20260415" },
    { uid: "s174-q2",       summary: "Section 174 — Q2 Estimated Tax Due",        description: "Q2 2026 estimated tax payment.", date: "20260616" },
    { uid: "s174-q3",       summary: "Section 174 — Q3 Estimated Tax Due",        description: "Q3 2026 estimated tax payment.", date: "20260915" },
    { uid: "s174-final",    summary: "Section 174 — Tax Return Deadline",         description: "2025 federal return due with Section 174 amortization schedules.", date: "20260415" },
  ],

  delivery: { tier1DriveEnvVar: "NEXT_PUBLIC_DRIVE_US_174_67", tier2DriveEnvVar: "NEXT_PUBLIC_DRIVE_US_174_147" },

  monitorUrls: [
    "https://www.irs.gov/businesses/small-businesses-self-employed/research-and-development-costs",
    "https://www.irs.gov/publications/p535",
  ],

  sidebarNumbers: [
    { label: "Domestic amortization", value: "5 years"  },
    { label: "Foreign amortization",  value: "15 years" },
    { label: "Year 1 domestic rate",  value: "~20%"     },
    { label: "Year 1 foreign rate",   value: "~6.67%"   },
  ],
  sidebarMathsTitle:    "What is subject to Section 174",
  sidebarMathsIncludes: ["Engineering salaries (new development)", "Contractor fees for new software", "Cloud computing costs for R&D"],
  sidebarMathsExcludes: ["Bug fixes and routine maintenance (§162)", "Marketing and sales engineering", "Customer support"],
  sidebarMathsNote:     "Source: IRS Publication 535 · IRC Section 174",

  howToSteps: [
    { position: 1, name: "Select your engineering spend bracket", text: "Choose your approximate total engineering expenditure for the tax year." },
    { position: 2, name: "Identify team location",                text: "Specify whether your engineers are US-based, offshore, or mixed. This determines 5-year vs 15-year amortization." },
    { position: 3, name: "Get your phantom profit calculation",   text: "See your estimated taxable income after Section 174 amortization — including the gap between cash profit and taxable profit." },
    { position: 4, name: "Get your classification plan",         text: "Receive a personalised plan for Section 162 reclassification, Section 41 credit optimisation and estimated tax planning." },
  ],

  successPromptFields: [
    { key: "s174_spend",         label: "Engineering spend bracket",  defaultVal: "$300k-$600k" },
    { key: "s174_location",      label: "Team location",              defaultVal: "mixed"        },
    { key: "s174_new_pct",       label: "New development percentage", defaultVal: "80"           },
    { key: "s174_has_credit",    label: "Claims Section 41 credit",   defaultVal: "false"        },
    { key: "s174_phantom_profit",label: "Estimated phantom profit",   defaultVal: "420000"       },
  ],

  tier1AssessmentFields: ["status", "phantomProfit", "allowedDeduction", "taxImpact", "biggestRisk", "firstAction", "section162Opportunity", "accountantQuestions"],
  tier2AssessmentFields: ["status", "phantomProfit", "allowedDeduction", "taxImpact", "biggestRisk", "offshoreExposure", "section41Opportunity", "actions", "weekPlan", "accountantQuestions"],
};
