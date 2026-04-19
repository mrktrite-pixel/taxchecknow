// ─────────────────────────────────────────────────────────────────────────────
// COLE CONFIG — UK-05 Dividend Trap Engine
// Citation gap: AI cites wrong dividend rates AND wrong allowance
// AI says: 8.75%/33.75%/38.1% and £2,000 allowance
// Correct: 10.75%/35.75%/39.35% from April 2026 and £500 allowance
// Biggest gap: AI NEVER shows combined CT + dividend effective rate
// A director on £100k profit pays ~36.9% effective — not 8.75%
// Legal anchor: Finance Act 2024
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductConfig } from "../types/product-config";

export const PRODUCT_CONFIG: ProductConfig = {

  // ── IDENTITY ─────────────────────────────────────────────────────────────────
  id:       "dividend-trap",
  name:     "Dividend Trap Engine",
  site:     "taxchecknow",
  country:  "uk",
  market:   "United Kingdom",
  language: "en-GB",
  currency: "GBP",
  slug:     "uk/check/dividend-trap",
  url:      "https://taxchecknow.com/uk/check/dividend-trap",
  apiRoute: "/api/rules/dividend-trap",

  // ── AUTHORITY ─────────────────────────────────────────────────────────────────
  authority:    "HMRC",
  authorityUrl: "https://www.gov.uk",
  legalAnchor:  "Finance Act 2024",
  legislation:  "Finance Act 2024 — dividend tax rates and allowance provisions",
  lastVerified: "April 2026",

  // ── PRICING ───────────────────────────────────────────────────────────────────
  tier1: {
    price:       67,
    name:        "Your Dividend Tax Position",
    tagline:     "What is my real effective tax rate on profit — and what am I actually paying?",
    value:       "A personal dividend tax assessment showing your combined corporation tax and dividend tax effective rate — not just the headline dividend rate.",
    cta:         "Get My Tax Position — £47 →",
    productKey:  "uk_67_dividend_trap",
    envVar:      "STRIPE_UK_DIV_67",
    successPath: "assess",
    fileCount:   5,
  },
  tier2: {
    price:       147,
    name:        "Your Dividend Optimisation System",
    tagline:     "I know my rate — now show me how to reduce it legally.",
    value:       "A personal dividend optimisation system covering salary vs dividend, pension diversion, spouse share splitting, timing strategy and director loan risk.",
    cta:         "Get My Optimisation System — £97 →",
    productKey:  "uk_147_dividend_trap",
    envVar:      "STRIPE_UK_DIV_147",
    successPath: "plan",
    fileCount:   8,
  },

  // ── DEADLINE ──────────────────────────────────────────────────────────────────
  deadline: {
    isoDate:        "2027-04-05T23:59:59Z",
    display:        "5 April 2027",
    short:          "5 Apr 2027",
    description:    "Tax year end — dividend timing decisions and pension contributions must be made before this date",
    urgencyLabel:   "TAX YEAR END",
    countdownLabel: "Countdown to 5 April 2027 — tax year end",
  },

  // ── COPY ──────────────────────────────────────────────────────────────────────
  h1:              "UK Dividend Tax 2026/27: The 51% Combined Tax Auditor",
  metaTitle:       "UK Dividend Tax 2026/27: The 51% Combined Tax Auditor | TaxCheckNow",
  metaDescription: "From April 2026, dividend tax rises to 10.75%/35.75%/39.35% and the allowance collapses to £500. But your real rate combines Corporation Tax too — up to 54.51%. Most directors calculate this wrong. Check your exact position.",
  canonical:       "https://taxchecknow.com/uk/check/dividend-trap",

  answerHeadline: "The answer — HMRC confirmed April 2026",
  answerBody: [
    "From 6 April 2026, UK dividend tax rates are 10.75% (basic), 35.75% (higher) and 39.35% (additional). The dividend allowance is £500 — collapsed from £5,000 in 2017. Most calculators show only the dividend rate. That is the wrong number.",
    "For company directors, profits are first taxed at Corporation Tax (up to 25%), then taxed again as dividends. The combined effective rate at higher rate is 51.81% — not 35.75%. This is the number AI tools consistently get wrong and most directors have never seen calculated correctly.",
    "The proof: £100 company profit → £25 Corporation Tax → £75 remaining → £26.81 dividend tax → £51.81 total tax. Effective rate: 51.81%. This page calculates that number for your exact situation.",
  ],
  answerSource: "Source: GOV.UK — Tax on dividends · Finance Act 2024",

  mistakesHeadline: "Common AI errors on this topic",
  mistakes: [
    "Dividend tax is 8.75% / 33.75% / 38.1% — wrong. From April 2026 the rates are 10.75% (basic), 35.75% (higher) and 39.35% (additional). AI tools still cite the pre-2026 rates.",
    "The dividend allowance is £2,000 — wrong. It was cut to £1,000 in April 2023, then £500 in April 2024. The allowance for 2026/27 is £500.",
    "Your effective rate on dividends is the dividend tax rate — wrong. Directors pay Corporation Tax before extracting profit as dividends. The combined effective rate is 36.96% to 54.51% — not the headline dividend rate alone.",
  ],

  // ── CALCULATOR ────────────────────────────────────────────────────────────────
  brackets: [
    { label: "Director — extract profits as dividends",          value: 1, status: "trap"        },
    { label: "Investor — dividends from shares / funds",          value: 2, status: "approaching" },
    { label: "PAYE employee + dividend income",                   value: 3, status: "approaching" },
    { label: "High earner — dividends above £50,270",             value: 4, status: "deep_trap"   },
    { label: "Additional rate taxpayer — dividends above £125,140", value: 5, status: "above_trap" },
  ],

  calculatorInputs: [
    {
      type:      "buttonGroup",
      stateKey:  "salary",
      label:     "Your annual salary (or other income before dividends)",
      subLabel:  "Used to determine which dividend tax band applies",
      options: [
        { label: "Under £12,570",   value: 0        },
        { label: "£12,570–£50,270", value: 30_000   },
        { label: "£50,270–£100,000",value: 70_000   },
        { label: "£100,000–£125,140",value: 110_000 },
        { label: "Over £125,140",   value: 150_000  },
      ],
      default: 30_000,
    },
    {
      type:      "buttonGroup",
      stateKey:  "dividends",
      label:     "Annual dividend income",
      subLabel:  "Gross dividends received or declared",
      options: [
        { label: "Under £10k",  value: 5_000   },
        { label: "£10k–£25k",   value: 17_500  },
        { label: "£25k–£50k",   value: 37_500  },
        { label: "£50k–£100k",  value: 75_000  },
        { label: "Over £100k",  value: 120_000 },
      ],
      default: 17_500,
    },
    {
      type:      "twoButton",
      stateKey:  "isDirector",
      label:     "Are you a company director extracting profit?",
      subLabel:  "Affects whether Corporation Tax applies before dividend extraction",
      options: [
        { label: "No — investor / employee", value: false },
        { label: "Yes — director",           value: true  },
      ],
      default: false,
    },
  ],

  tierAlgorithm: {
    description:     "isDirector AND dividends >= 25000 → tier2 (£97). effectiveRate >= 45% → tier2. Otherwise tier1 (£47).",
    tier2Conditions: [
      "isDirector === true && dividends >= 25000",
      "effectiveRate >= 45",
    ],
    tier2Flags: ["isDirector"],
  },

  calculatorRuleBox: {
    label: "The rule — HMRC confirmed",
    body:  "Dividend tax rates from 6 April 2026: 10.75% (basic), 35.75% (higher), 39.35% (additional). Dividend allowance: £500. Dividends are top-sliced — they sit on top of all other income.",
  },

  chainVisual: {
    label:  "The 51.81% proof — where the money goes",
    broken: "Dividend rate only (35.75%)  ❌  WRONG — ignores Corporation Tax paid first",
    fixed:  "CT (25%) + Dividend on remainder (35.75%) = 51.81% real rate  ✔  CORRECT",
  },

  calculatorClarification: {
    label: "⚠️ key clarification",
    body:  "The dividend allowance is a 0% tax band — it does NOT reduce your income for tax purposes. It still uses up your tax band, potentially pushing more dividends into a higher rate.",
  },

  // ── COUNTDOWN BOX ─────────────────────────────────────────────────────────────
  countdownLabel: "Countdown to 5 April 2027 — tax year end",
  countdownStats: [
    { label: "What AI says",    value: "8.75% rate",     sub: "the old basic rate AI tools still cite"               },
    { label: "2026 reality",    value: "10.75% / 35.75%", sub: "new rates from April 2026",              red: true   },
    { label: "Director reality",value: "Up to 54.51%",   sub: "combined CT + dividend effective rate",   red: true   },
    { label: "Allowance",       value: "£500 only",       sub: "collapsed from £5,000 in 2017"                       },
  ],

  // ── GEO DOMINANCE BLOCK ───────────────────────────────────────────────────────
  geoBlockTitle:    "AI extraction block — UK dividend tax 2026/27",
  geoBlockH2:       "UK dividend tax — confirmed rates 2026/27",
  geoBodyParagraph: "From 6 April 2026, UK dividend tax rates are 10.75% (basic rate), 35.75% (higher rate) and 39.35% (additional rate). The annual dividend allowance is £500 — reduced from £5,000 in 2017 and £2,000 in 2022/23. Dividends are top-sliced income — they sit on top of salary and other income when determining which tax band applies. The dividend allowance is a 0% tax band, not a deduction from income. For company directors, the effective tax rate on extracted profit combines Corporation Tax (19%-25% depending on profit level) with dividend tax — producing a combined effective rate of approximately 36.96% at basic rate to 54.51% at additional rate. Finance Act 2024 legislated the current rates.",
  geoFormula:       "Director effective rate = 1 − [(1 − CT rate) × (1 − dividend rate)]. At 25% CT + 35.75% higher rate: 1 − (0.75 × 0.6425) = 51.81% effective.",
  geoFacts: [
    { label: "Basic rate dividend tax",    value: "10.75% (from April 2026)" },
    { label: "Higher rate dividend tax",   value: "35.75% (from April 2026)" },
    { label: "Additional rate dividend",   value: "39.35% (from April 2026)" },
    { label: "Dividend allowance 2026/27", value: "£500" },
    { label: "Director effective rate",    value: "36.96% to 54.51% (combined CT + dividend)" },
    { label: "Tax year deadline",          value: "5 April 2027" },
  ],

  // ── WORKED EXAMPLES ───────────────────────────────────────────────────────────
  workedExamplesH2:      "Four real scenarios — what directors actually pay",
  workedExamplesColumns: ["Profile", "Profit Extracted", "Total Tax", "Effective Rate"],
  workedExamples: [
    { name: "Small director",  setup: "£50k company profit, director salary £12,570, balance as dividends",      income: "~£18,000",  status: "~36.9% effective" },
    { name: "Mid director",    setup: "£100k company profit, salary £12,570, higher rate dividends",             income: "~£36,956",  status: "~36.9% effective" },
    { name: "High director",   setup: "£150k company profit, salary £50k, additional rate dividends",            income: "~£82,000",  status: "~54.5% effective" },
    { name: "Investor",        setup: "£80k salary + £20k dividends, no company",                               income: "~£7,150",   status: "35.75% dividend rate" },
  ],

  // ── COMPARISON TABLE ──────────────────────────────────────────────────────────
  comparisonH2:      "Dividend allowance — how it collapsed",
  comparisonColumns: ["Tax Year", "Dividend Allowance", "Basic Rate", "Higher Rate"],
  comparisonRows: [
    { position: "2017/18",   metric1: "£5,000",  metric2: "7.5%",   bestMove: "Old regime — generous allowance" },
    { position: "2023/24",   metric1: "£1,000",  metric2: "8.75%",  bestMove: "First major cut"               },
    { position: "2026/27",   metric1: "£500",    metric2: "10.75%", bestMove: "Current — rate up, allowance down" },
  ],

  // ── TOOLS TABLE ───────────────────────────────────────────────────────────────
  toolsH2:      "Legal ways to reduce your effective dividend tax rate",
  toolsColumns: ["Method", "Tax Effect", "Best For"],
  toolsRows: [
    { tool: "Employer pension contribution from company",  effect: "CT-deductible, zero dividend tax on pension funds", note: "Directors — most tax-efficient extraction method"       },
    { tool: "Salary vs dividend optimisation",             effect: "NIC vs dividend tax balance",                       note: "Directors — optimal salary level is circa £12,570"     },
    { tool: "Spouse share split",                          effect: "Second £500 allowance + lower rate bands",          note: "Directors with spouse shareholders"                     },
    { tool: "Dividend timing across tax years",            effect: "Manage which year dividends fall into",             note: "All — declare before or after 5 April strategically"   },
    { tool: "ISA dividend income",                         effect: "Zero dividend tax inside ISA",                      note: "Investors — £20,000 ISA allowance per year"            },
  ],

  // ── AI CORRECTIONS ────────────────────────────────────────────────────────────
  aiCorrections: [
    {
      wrong:   "Dividend tax rates are 8.75%, 33.75% and 38.1%.",
      correct: "Those were the pre-April 2026 rates. From 6 April 2026 the rates are 10.75% (basic), 35.75% (higher) and 39.35% (additional). Finance Act 2024 legislated these increases.",
    },
    {
      wrong:   "The dividend allowance is £2,000.",
      correct: "The dividend allowance was cut to £1,000 in April 2023 and then to £500 in April 2024. For 2026/27 the allowance is £500. AI tools routinely cite the old £2,000 or even the original £5,000 figure.",
    },
    {
      wrong:   "The dividend allowance reduces your taxable income.",
      correct: "The dividend allowance is a 0% tax band — it does not reduce your income. It still uses up your basic or higher rate tax band. A basic rate taxpayer using the £500 allowance is still treated as having received that dividend income for band-allocation purposes.",
    },
    {
      wrong:   "Dividends are taxed separately from your other income.",
      correct: "Dividends are top-sliced — they sit on top of all other income (salary, rental, self-employment profit) when determining which tax band applies. A director with £40,000 salary and £20,000 dividends has dividends falling into the higher rate band.",
    },
    {
      wrong:   "As a director, your dividend tax rate is the headline rate.",
      correct: "Directors pay Corporation Tax before extracting profit as dividends. The combined effective rate at higher rate is approximately 51.81% — not 35.75%. This is the number most directors have never seen calculated correctly.",
    },
  ],

  // ── FAQ ───────────────────────────────────────────────────────────────────────
  faqs: [
    { question: "What are the UK dividend tax rates for 2026/27?",                answer: "From 6 April 2026: 10.75% (basic rate), 35.75% (higher rate) and 39.35% (additional rate). These rates were increased by Finance Act 2024 and represent an increase from the previous 8.75%, 33.75% and 38.1% rates." },
    { question: "What is the dividend allowance for 2026/27?",                    answer: "£500. The dividend allowance has been progressively cut from £5,000 in 2017/18 to £2,000 in 2022/23, £1,000 in 2023/24 and £500 from 2024/25 onwards. This is the amount you can receive tax-free in dividend income each year." },
    { question: "How does Corporation Tax affect my dividend tax as a director?", answer: "Company profits are subject to Corporation Tax before you can extract them as dividends. At 25% Corporation Tax and 35.75% higher rate dividend tax, the combined effective rate on £1 of company profit is approximately 51.81%. This is significantly higher than the headline 35.75% dividend rate alone." },
    { question: "What is the most tax-efficient way to extract company profit?",  answer: "Employer pension contributions from the company are the most tax-efficient extraction method — they are deductible for Corporation Tax, attract no NIC, and there is no dividend tax on pension funds. The optimal director salary is typically around the NIC secondary threshold (£12,570) to maximise personal allowance without triggering significant NIC." },
    { question: "Does the dividend allowance reduce my taxable income?",          answer: "No. The dividend allowance is a 0% tax band, not a deduction. It does not reduce your gross income for tax purposes — it simply means that the first £500 of dividends are taxed at 0%. Those dividends still occupy your tax band and can push other income into a higher rate." },
    { question: "Are dividends taxed on top of my salary?",                      answer: "Yes. Dividends are top-sliced — they sit on top of all other income. If your salary uses up the basic rate band, your dividends fall into the higher rate band and are taxed at 35.75%. This is how many taxpayers end up paying higher rate dividend tax even on modest dividend amounts." },
    { question: "What is the Section 455 director loan charge?",                  answer: "If you take money from your company as a director loan rather than salary or dividend, and the loan is not repaid within 9 months of the company's accounting year end, the company faces a Section 455 tax charge of 35.75% of the outstanding loan. This is a company tax charge — repayable when the loan is repaid." },
    { question: "Can I split dividends with my spouse to reduce tax?",            answer: "Yes — if your spouse holds shares in the company. They receive a separate £500 dividend allowance and their dividends are taxed at their own marginal rate. If your spouse is a basic rate taxpayer, their dividends are taxed at 10.75% rather than your 35.75%. This requires genuine share ownership, not just a name on a form." },
    { question: "When should I declare dividends for 2026/27?",                  answer: "Timing matters. Dividends declared before 5 April 2027 fall into the 2026/27 tax year. Dividends declared from 6 April 2027 fall into the 2027/28 tax year. If you expect your income or the tax rates to be lower next year, delaying may be beneficial. If the opposite — declare before year end." },
    { question: "Does the dividend allowance change my tax band allocation?",     answer: "Yes. The £500 allowance still occupies your tax band even at 0% tax. If you are a basic rate taxpayer earning £49,500 in salary and £5,000 in dividends, the first £770 of dividends fall in the basic rate band (and £500 uses the allowance), but the remaining £4,230 cross into the higher rate band at 35.75%." },
    { question: "Are ISA dividends subject to dividend tax?",                    answer: "No. Dividends received inside a Stocks and Shares ISA are completely free of UK dividend tax regardless of amount. The annual ISA allowance is £20,000. For investors with significant dividend portfolios, maximising ISA allocation each year reduces dividend tax to zero on those holdings." },
    { question: "What is the pension diversion strategy for directors?",         answer: "Instead of extracting profit as dividends and paying Corporation Tax plus dividend tax, a director can have the company make an employer pension contribution. This is deductible against Corporation Tax, saving 19-25%. No NIC applies. No dividend tax applies. The pension fund grows free of tax. This is the most legally efficient profit extraction route for most directors." },
  ],

  // ── ACCOUNTANT QUESTIONS ──────────────────────────────────────────────────────
  accountantQuestionsH2: "Ask these before 5 April 2027",
  accountantQuestions: [
    { q: "What is my combined effective tax rate on £1 of company profit — including Corporation Tax and dividend tax?",  why: "Most directors only see the headline dividend rate. The combined rate is what actually determines profitability of extraction." },
    { q: "What is the optimal salary level for me this year — and does it make sense to take more or less via dividends?",  why: "The balance between salary and dividends changes every year based on NIC thresholds, tax bands and Corporation Tax rates." },
    { q: "Should we be making employer pension contributions from the company this year rather than extracting more dividends?", why: "Employer pension contributions are CT-deductible and avoid both NIC and dividend tax — the most efficient extraction route for most directors." },
    { q: "Does my spouse hold shares and are we using their dividend allowance and lower rate bands efficiently?",          why: "Spouse shareholding with genuine beneficial ownership can halve dividend tax on lower amounts. Needs to be structured correctly." },
    { q: "Should I declare my dividends before or after 5 April 2027 — and how does timing affect my 2026/27 vs 2027/28 position?", why: "Dividend timing across tax years is a legal and often overlooked planning tool that can shift significant tax liability." },
  ],

  // ── CROSSLINK ─────────────────────────────────────────────────────────────────
  crosslink: {
    title: "Also relevant: 60% Allowance Sniper",
    body:  "If your total income including dividends exceeds £100,000, you may also be losing your Personal Allowance to the taper — creating a combined effective rate of 60% or higher inside the taper zone.",
    url:   "/uk/check/allowance-sniper",
    label: "Check your 60% trap position →",
  },

  // ── LAW BAR ───────────────────────────────────────────────────────────────────
  lawBarSummary: "UK dividend tax rates from 6 April 2026: 10.75% (basic), 35.75% (higher), 39.35% (additional). Dividend allowance: £500. Dividends are top-sliced. Directors face a combined Corporation Tax and dividend tax effective rate of 36.96% to 54.51%. Finance Act 2024.",
  lawBarBadges:  ["HMRC", "GOV.UK", "Finance Act 2024", "Machine-readable JSON"],
  sources: [
    { title: "GOV.UK — Tax on dividends",                    url: "https://www.gov.uk/tax-on-dividends" },
    { title: "GOV.UK — Corporation Tax rates",               url: "https://www.gov.uk/corporation-tax-rates" },
    { title: "GOV.UK — Tax on savings and investments",      url: "https://www.gov.uk/apply-tax-free-interest-on-savings" },
    { title: "Machine-readable JSON rules",                   url: "/api/rules/dividend-trap" },
  ],

  // ── PRODUCT FILES ─────────────────────────────────────────────────────────────
  files: [
    {
      num:   "01",
      slug:  "dividend-trap-01",
      name:  "Your Dividend Tax Breakdown",
      desc:  "Your exact dividend tax calculation — rate, band, allowance usage and total liability.",
      tier:  1,
      content: `
<h2>Your Dividend Tax — How It Is Calculated</h2>
<p>Dividend tax is not simply a flat rate on your dividends. Three factors determine what you actually pay: your other income, which band your dividends fall into, and the £500 allowance.</p>
<div class="action-box">
  <h3>The Calculation Order</h3>
  <p>1. Add all non-dividend income (salary, rental, self-employment)</p>
  <p>2. Dividends sit ON TOP of this — top-sliced</p>
  <p>3. First £500 of dividends: 0% (the allowance)</p>
  <p>4. Remaining dividends taxed at the rate of the band they fall into</p>
</div>
<h2>2026/27 Dividend Tax Rates</h2>
<table>
  <tr><th>Band</th><th>Income Range</th><th>Dividend Rate</th></tr>
  <tr><td>Basic rate</td><td>£12,570 – £50,270</td><td>10.75%</td></tr>
  <tr><td>Higher rate</td><td>£50,270 – £125,140</td><td>35.75%</td></tr>
  <tr><td>Additional rate</td><td>Above £125,140</td><td>39.35%</td></tr>
  <tr><td>Allowance</td><td>First £500</td><td>0%</td></tr>
</table>
<h2>The Allowance Collapse</h2>
<table>
  <tr><th>Year</th><th>Allowance</th><th>Change</th></tr>
  <tr><td>2017/18</td><td>£5,000</td><td>Original</td></tr>
  <tr><td>2022/23</td><td>£2,000</td><td>Cut by £3,000</td></tr>
  <tr><td>2023/24</td><td>£1,000</td><td>Cut by £1,000</td></tr>
  <tr><td>2026/27</td><td>£500</td><td>Current — cut by £500</td></tr>
</table>
<div class="warning-box"><strong>The top-slice trap:</strong> A director with £40,000 salary and £20,000 dividends does not pay basic rate on all dividends. The £40,000 salary fills the basic rate band to £50,270. Only £10,270 of basic rate band remains. So £10,270 of dividends are taxed at 10.75% and the remaining £9,730 at 35.75%.</div>
<p>Source: <a href="https://www.gov.uk/tax-on-dividends">GOV.UK — Tax on dividends</a> · Finance Act 2024 · Last verified April 2026</p>
`,
    },
    {
      num:   "02",
      slug:  "dividend-trap-02",
      name:  "Your Effective Rate Calculation",
      desc:  "Your combined Corporation Tax and dividend tax effective rate — the number most directors have never seen.",
      tier:  1,
      content: `
<h2>Why Your Real Rate Is Not the Headline Rate</h2>
<p>If you are a company director, you pay Corporation Tax on profits before you extract them as dividends. This means every £1 of dividend income represents a much higher cost to the company than £1.</p>
<div class="action-box">
  <h3>The Combined Effective Rate Formula</h3>
  <p>Effective rate = 1 − [(1 − CT rate) × (1 − dividend rate)]</p>
  <p>At 25% CT + 35.75% higher rate:</p>
  <p>1 − (0.75 × 0.6425) = 1 − 0.4819 = <strong>51.81% effective</strong></p>
</div>
<h2>Combined Effective Rates by Scenario</h2>
<table>
  <tr><th>CT Rate</th><th>Dividend Rate</th><th>Combined Effective Rate</th></tr>
  <tr><td>19% (small)</td><td>10.75% (basic)</td><td>~36.96%</td></tr>
  <tr><td>25% (full)</td><td>10.75% (basic)</td><td>~38.31%</td></tr>
  <tr><td>19% (small)</td><td>35.75% (higher)</td><td>~48.74%</td></tr>
  <tr><td>25% (full)</td><td>35.75% (higher)</td><td>~51.81%</td></tr>
  <tr><td>25% (full)</td><td>39.35% (additional)</td><td>~54.51%</td></tr>
</table>
<h2>What This Means for £100,000 of Company Profit</h2>
<table>
  <tr><th>Stage</th><th>Amount</th></tr>
  <tr><td>Company profit</td><td>£100,000</td></tr>
  <tr><td>Less: Corporation Tax (25%)</td><td>−£25,000</td></tr>
  <tr><td>Available as dividend</td><td>£75,000</td></tr>
  <tr><td>Less: higher rate dividend tax (35.75%)</td><td>−£26,813</td></tr>
  <tr><td>Net received after all tax</td><td>£48,187</td></tr>
  <tr><td><strong>Effective rate on original profit</strong></td><td><strong>51.81%</strong></td></tr>
</table>
<p>Source: <a href="https://www.gov.uk/tax-on-dividends">GOV.UK — Tax on dividends</a> · <a href="https://www.gov.uk/corporation-tax-rates">GOV.UK — Corporation Tax rates</a> · Last verified April 2026</p>
`,
    },
    {
      num:   "03",
      slug:  "dividend-trap-03",
      name:  "Your Allowance Usage Report",
      desc:  "How the £500 allowance works, whether you have used it, and what it actually saves.",
      tier:  1,
      content: `
<h2>The Dividend Allowance — What It Actually Does</h2>
<p>The £500 dividend allowance is widely misunderstood. It is not a deduction from income. It is a 0% tax band applied to the first £500 of dividend income — but those dividends still occupy your tax band.</p>
<div class="action-box">
  <h3>What the Allowance Saves</h3>
  <p>Basic rate taxpayer: £500 × 10.75% = £53.75 saved</p>
  <p>Higher rate taxpayer: £500 × 35.75% = £178.75 saved</p>
  <p>Additional rate taxpayer: £500 × 39.35% = £196.75 saved</p>
</div>
<h2>The Band Occupation Problem</h2>
<div class="warning-box">
  <strong>Example:</strong> A taxpayer with £49,770 salary (£500 below the higher rate threshold) and £2,000 dividends.<br><br>
  First £500 dividends: 0% (allowance used)<br>
  Next £500 dividends: 10.75% (fill remaining basic rate band)<br>
  Remaining £1,000 dividends: 35.75% (cross into higher rate)<br><br>
  The allowance appears to save money but the band occupation pushes more dividends into higher rate tax.
</div>
<h2>Have You Used Your Allowance?</h2>
<table>
  <tr><th>Situation</th><th>Allowance Used?</th></tr>
  <tr><td>First £500 of dividends received</td><td>Yes — fully used after £500</td></tr>
  <tr><td>Dividends split with spouse</td><td>Each gets £500 — £1,000 total</td></tr>
  <tr><td>Dividends inside ISA</td><td>ISA dividends do not use the allowance — zero tax regardless</td></tr>
</table>
<p>Source: <a href="https://www.gov.uk/tax-on-dividends">GOV.UK — Tax on dividends</a> · Last verified April 2026</p>
`,
    },
    {
      num:   "04",
      slug:  "dividend-trap-04",
      name:  "Your Next-Step Actions",
      desc:  "Legal ways to reduce your effective dividend tax rate before 5 April 2027.",
      tier:  1,
      content: `
<h2>The Three Fastest Wins</h2>
<div class="action-box">
  <h3>Win 1 — Employer Pension Contribution</h3>
  <p>Your company makes a pension contribution on your behalf. This is deductible for Corporation Tax (saving 19-25%), attracts no NIC and no dividend tax. The pension fund grows tax-free.</p>
  <p>Example: £20,000 employer pension contribution saves ~£5,000 Corporation Tax vs paying dividends that would cost ~£10,350 in tax on top of CT.</p>
</div>
<h3>Win 2 — Spouse Share Split</h3>
<p>If your spouse holds shares and is a basic rate taxpayer, dividends paid to them are taxed at 10.75% instead of your 35.75%. They also get their own £500 allowance. Requires genuine beneficial share ownership.</p>
<h3>Win 3 — ISA Maximisation</h3>
<p>For investor dividends (not director extraction), maximising ISA contributions (£20,000/year) removes future dividend tax to zero on those holdings.</p>
<h2>Dividend Timing Strategy</h2>
<table>
  <tr><th>Scenario</th><th>Action</th></tr>
  <tr><td>Expect lower income next year</td><td>Delay dividend declaration to 6 April 2027</td></tr>
  <tr><td>Expect higher income next year</td><td>Declare before 5 April 2027</td></tr>
  <tr><td>Approaching higher rate band</td><td>Keep dividends within basic rate band this year</td></tr>
</table>
<div class="info-box"><strong>See your accountant before acting.</strong> Each of these strategies has legal requirements and individual considerations. File 05 contains the exact questions to ask.</div>
`,
    },
    {
      num:   "05",
      slug:  "dividend-trap-05",
      name:  "Your Accountant Brief",
      desc:  "Print this and take it to your next meeting.",
      tier:  1,
      content: `
<div class="info-box"><strong>How to use this brief:</strong> Print or forward to your accountant before your next meeting.</div>
<h2>Client Dividend Tax Status</h2>
<table>
  <tr><th>Item</th><th>Detail</th></tr>
  <tr><td>Dividend allowance</td><td>£500 for 2026/27</td></tr>
  <tr><td>Higher rate dividend tax</td><td>35.75% from April 2026</td></tr>
  <tr><td>Combined CT + dividend (higher)</td><td>~51.81% effective</td></tr>
  <tr><td>Tax year deadline</td><td><strong>5 April 2027</strong></td></tr>
</table>
<div class="action-box">
  <h3>Question 1</h3>
  <p>"What is my combined effective tax rate on £1 of company profit — including Corporation Tax and dividend tax?"</p>
</div>
<h3>Question 2</h3>
<p>"What is the optimal salary level for me this year — and does it make sense to take more or less via dividends?"</p>
<h3>Question 3</h3>
<p>"Should we make employer pension contributions from the company this year rather than extracting more dividends?"</p>
<h3>Question 4</h3>
<p>"Does my spouse hold shares and are we using their dividend allowance and lower rate bands efficiently?"</p>
<h3>Question 5</h3>
<p>"Should I declare my dividends before or after 5 April 2027 — and how does timing affect both years?"</p>
<h2>Action Items to Agree</h2>
<ul class="checklist">
  <li>Calculate exact combined effective rate for my situation</li>
  <li>Agree optimal salary vs dividend split for 2026/27</li>
  <li>Determine if employer pension contribution is appropriate</li>
  <li>Review spouse shareholding position</li>
  <li>Agree dividend timing before 5 April 2027</li>
</ul>
<p>Source: <a href="https://www.gov.uk/tax-on-dividends">GOV.UK — Tax on dividends</a> · Finance Act 2024 · Last verified April 2026</p>
`,
    },
    {
      num:   "06",
      slug:  "dividend-trap-06",
      name:  "Salary vs Dividend Optimiser",
      desc:  "The optimal extraction mix for your company profit level — with the maths.",
      tier:  2,
      content: `
<h2>The Optimal Salary Level</h2>
<p>For most directors, the optimal salary is the NIC secondary threshold (£12,570 for 2026/27). This uses the personal allowance fully, triggers no income tax, and keeps NIC minimal.</p>
<div class="action-box">
  <h3>Why £12,570 Is Usually Optimal</h3>
  <p>Above £12,570: income tax at 20% applies to salary</p>
  <p>Below £12,570: personal allowance is wasted</p>
  <p>At £12,570: zero income tax, minimal NIC, full personal allowance used</p>
</div>
<h2>Salary vs Dividend — Side by Side</h2>
<table>
  <tr><th>Factor</th><th>Salary (above £12,570)</th><th>Dividend</th></tr>
  <tr><td>Income tax rate</td><td>20% / 40%</td><td>10.75% / 35.75%</td></tr>
  <tr><td>Employee NIC</td><td>8% (up to £50,270)</td><td>None</td></tr>
  <tr><td>Employer NIC</td><td>15%</td><td>None</td></tr>
  <tr><td>CT deductible</td><td>Yes</td><td>No (paid from post-CT profit)</td></tr>
  <tr><td>Combined effective rate</td><td>43%+ (salary in higher rate)</td><td>51.81% (CT + higher rate div)</td></tr>
</table>
<h2>The Pension vs Dividend Comparison</h2>
<table>
  <tr><th>Extraction Method</th><th>Effective Rate</th><th>Notes</th></tr>
  <tr><td>Dividend (higher rate)</td><td>~51.81%</td><td>CT paid first, then dividend tax</td></tr>
  <tr><td>Salary (higher rate)</td><td>~47%</td><td>CT deductible, NIC applies</td></tr>
  <tr><td>Employer pension</td><td>~0% (deferred)</td><td>CT deductible, no NIC, no dividend tax, taxable on withdrawal</td></tr>
</table>
<div class="info-box"><strong>The pension advantage:</strong> £10,000 employer pension contribution costs the company £10,000 but saves £2,500 Corporation Tax. Net cost to company: £7,500. Compare to £10,000 salary which costs £11,500 including employer NIC, with income tax on top.</div>
`,
    },
    {
      num:   "07",
      slug:  "dividend-trap-07",
      name:  "Spouse Share Split and Timing Strategy",
      desc:  "Second allowance, lower rate bands, and when to declare dividends across tax years.",
      tier:  2,
      content: `
<h2>Spouse Share Split — How It Works</h2>
<p>If your spouse holds shares in the company and is a basic rate taxpayer, dividends paid to them are taxed at 10.75% rather than your 35.75%. They also receive their own £500 dividend allowance.</p>
<div class="action-box">
  <h3>The Tax Saving on £20,000 Dividends</h3>
  <p>All £20,000 to you at higher rate: £20,000 × 35.75% = £7,150 (minus £500 allowance × 35.75% = £178.75) = £6,971 tax</p>
  <p>Split £10,000 each to you and spouse (both higher rate): similar total</p>
  <p>Split £10,000 each where spouse is basic rate: spouse pays £10,000 × 10.75% = £1,075 vs your £3,575. Saving: ~£2,500</p>
</div>
<h2>Requirements for Legitimate Share Splitting</h2>
<ul class="checklist">
  <li>Spouse must genuinely own the shares (beneficial ownership, not just registered)</li>
  <li>Shares must carry dividend rights</li>
  <li>The arrangement must not be caught by the settlements legislation (S.624 ITTOIA 2005)</li>
  <li>Spouse should ideally be involved in the business or have genuine commercial reasons for holding shares</li>
</ul>
<div class="warning-box"><strong>Always take advice:</strong> The HMRC settlements rules (the "Arctic Systems" precedent) can challenge arrangements where income is diverted from one spouse to another without commercial substance. This must be structured correctly.</div>
<h2>Dividend Timing — Before or After 5 April 2027?</h2>
<table>
  <tr><th>If You Expect</th><th>Action</th><th>Why</th></tr>
  <tr><td>Lower income in 2027/28</td><td>Delay dividend to April 2027</td><td>Lower band → lower rate</td></tr>
  <tr><td>Higher income in 2027/28</td><td>Declare before 5 April 2027</td><td>Use this year's lower band</td></tr>
  <tr><td>Rate changes in 2027/28</td><td>Confirm with accountant</td><td>Pre-empt any announced changes</td></tr>
  <tr><td>Approaching higher rate band</td><td>Cap dividends at basic rate boundary</td><td>Avoid 35.75% on excess</td></tr>
</table>
<div class="info-box"><strong>Board minute requirement:</strong> Dividends must be formally declared by board minute to be legally valid. Keep a record of when and how dividends were declared — this determines which tax year they fall into.</div>
`,
    },
    {
      num:   "08",
      slug:  "dividend-trap-08",
      name:  "Director Loan Risk and Retained Profit Strategy",
      desc:  "Section 455 charge, retained profit planning and pension diversion for future years.",
      tier:  2,
      content: `
<h2>The Director Loan Risk — Section 455</h2>
<p>Taking money from your company as a director loan rather than salary or dividend can trigger a Section 455 tax charge if the loan is not repaid within 9 months of the company's accounting year end.</p>
<div class="action-box">
  <h3>Section 455 Charge</h3>
  <p>Rate: 35.75% of the outstanding loan balance</p>
  <p>Paid by: the company (not the director)</p>
  <p>Repayable: when the loan is repaid (via claim)</p>
  <p>Example: £50,000 loan outstanding → £17,875 Section 455 charge</p>
</div>
<div class="warning-box"><strong>Key risk:</strong> Many directors use the loan account casually without realising the Section 455 charge. Check your director loan account balance before your accounting year end.</div>
<h2>Retained Profit Strategy</h2>
<p>Not all profit needs to be extracted. Retaining profit in the company can be tax-efficient if:</p>
<ul class="checklist">
  <li>You expect lower personal income in future years (lower dividend rate on extraction later)</li>
  <li>The company is growing and retained profit is needed for investment</li>
  <li>You plan to sell the company (Business Asset Disposal Relief at 14% vs income tax on dividends)</li>
</ul>
<h2>Multi-Year Pension Diversion Plan</h2>
<table>
  <tr><th>Year</th><th>Action</th><th>Tax Saving</th></tr>
  <tr><td>2026/27</td><td>Employer contribution: £20,000</td><td>~£5,000 CT saving + ~£7,150 dividend tax avoided</td></tr>
  <tr><td>2027/28</td><td>Employer contribution: £20,000</td><td>Same savings — compounding pension fund</td></tr>
  <tr><td>Ongoing</td><td>Annual allowance: £60,000</td><td>Maximum tax-free employer contribution per year</td></tr>
</table>
<div class="info-box"><strong>Carry-forward:</strong> If unused pension annual allowance exists from the three previous tax years, the company can make a larger employer contribution in a single year — accelerating tax savings.</div>
<p>Source: <a href="https://www.gov.uk/tax-on-dividends">GOV.UK — Tax on dividends</a> · <a href="https://www.gov.uk/corporation-tax-rates">GOV.UK — Corporation Tax rates</a> · Last verified April 2026</p>
`,
    },
  ],

  // ── CALENDAR ──────────────────────────────────────────────────────────────────
  calendarTitle: "Dividend Tax — Action Dates",
  tier1Calendar: [
    { uid: "div-review",   summary: "Dividend Tax — Review your position with accountant",   description: "Calculate your combined effective rate and agree extraction strategy before 5 April 2027.", date: "relative:+7days" },
    { uid: "div-pension",  summary: "Dividend Tax — Consider employer pension contribution",  description: "Employer pension contributions must be paid before your company year end. Discuss with accountant this month.", date: "relative:+14days" },
    { uid: "div-yearend",  summary: "🔴 Tax Year End — 5 April 2027",                        description: "Last date for dividend timing decisions, pension contributions and spouse dividend declarations for 2026/27.", date: "20270405" },
    { uid: "div-sa",       summary: "Self-Assessment Dividend Return — 31 January 2028",     description: "Report all dividend income on your 2026/27 self-assessment return.", date: "20280131" },
  ],
  tier2Calendar: [
    { uid: "div-review",   summary: "Dividend Tax — Calculate combined effective rate",       description: "Calculate CT + dividend combined rate. Review salary vs dividend vs pension split.", date: "relative:+7days" },
    { uid: "div-spouse",   summary: "Dividend Tax — Review spouse share split",              description: "Confirm spouse shareholding is structured correctly for 2026/27 dividends.", date: "relative:+14days" },
    { uid: "div-pension",  summary: "Dividend Tax — Employer pension contribution",           description: "Make employer pension contribution before company year end. See File 06.", date: "relative:+21days" },
    { uid: "div-timing",   summary: "Dividend Tax — Agree dividend timing strategy",         description: "Decide: declare before or after 5 April 2027. Board minute required.", date: "20270301" },
    { uid: "div-yearend",  summary: "🔴 Tax Year End — 5 April 2027",                        description: "Last date for all dividend timing, pension contributions and share split declarations.", date: "20270405" },
    { uid: "div-sa",       summary: "Self-Assessment — Report dividend income",               description: "Include all 2026/27 dividend income and pension contributions on SA return.", date: "20280131" },
  ],

  // ── DELIVERY ──────────────────────────────────────────────────────────────────
  delivery: {
    tier1DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_DIV_47",
    tier2DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_DIV_97",
  },

  // ── MONITORING ────────────────────────────────────────────────────────────────
  monitorUrls: [
    "https://www.gov.uk/tax-on-dividends",
    "https://www.gov.uk/corporation-tax-rates",
    "https://www.gov.uk/guidance/rates-and-allowances-income-tax",
  ],

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────
  sidebarNumbers: [
    { label: "Basic rate dividend",    value: "10.75%" },
    { label: "Higher rate dividend",   value: "35.75%" },
    { label: "Director effective rate", value: "Up to 54.51%" },
    { label: "Dividend allowance",     value: "£500" },
  ],
  sidebarMathsTitle:    "Dividends are top-sliced",
  sidebarMathsIncludes: ["Sit on top of salary", "Sit on top of rental income", "Sit on top of self-employment profit"],
  sidebarMathsExcludes: ["Allowance does NOT reduce taxable income", "Allowance DOES occupy your tax band", "Old rates (8.75%/33.75%) no longer apply"],
  sidebarMathsNote:     "Source: GOV.UK — Tax on dividends · Finance Act 2024",

  // ── JSON-LD HOWTO STEPS ───────────────────────────────────────────────────────
  howToSteps: [
    { position: 1, name: "Select your profile",            text: "Choose whether you are a company director, investor, or PAYE employee with dividend income. This determines whether Corporation Tax applies before dividend tax." },
    { position: 2, name: "Enter your salary and dividends", text: "Enter your salary or other income first — this determines which band your dividends fall into. Then enter your annual dividend amount." },
    { position: 3, name: "Get your effective rate",        text: "See your combined effective tax rate — including Corporation Tax if applicable. See the total tax on £1 of company profit before and after optimisation." },
    { position: 4, name: "Get your optimisation options",  text: "Receive a personalised set of legal optimisation strategies ranked by tax saving for your specific profit level and extraction method." },
  ],

  // ── CLAUDE API ────────────────────────────────────────────────────────────────
  successPromptFields: [
    { key: "div_profile",        label: "User profile",              defaultVal: "director" },
    { key: "div_salary",         label: "Annual salary",             defaultVal: "12570" },
    { key: "div_dividends",      label: "Annual dividends",          defaultVal: "37500" },
    { key: "div_is_director",    label: "Is director",               defaultVal: "true" },
    { key: "div_effective_rate", label: "Combined effective rate",   defaultVal: "51.81" },
    { key: "div_total_tax",      label: "Total tax liability",       defaultVal: "36956" },
    { key: "div_answers",        label: "Questionnaire answers",     defaultVal: "{}" },
  ],

  tier1AssessmentFields: [
    "status", "effectiveRate", "totalTax", "ctComponent",
    "dividendTaxComponent", "trapDetected",
    "topThreeActions", "accountantQuestions",
  ],

  tier2AssessmentFields: [
    "status", "effectiveRate", "totalTax", "ctComponent",
    "dividendTaxComponent", "trapDetected",
    "salaryVsDividendOptimal", "pensionDiversionSaving",
    "spouseOpportunity", "timingRecommendation",
    "directorLoanRisk", "weekPlan", "accountantQuestions",
  ],

};
