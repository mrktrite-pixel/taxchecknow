// ─────────────────────────────────────────────────────────────────────────────
// COLE CONFIG — UK-02 Allowance Sniper
// Reverse engineered from live taxchecknow.com/uk/check/allowance-sniper
// All data verified against GOV.UK April 2026
// Legal anchor: Income Tax Act 2007 s.35
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductConfig } from "../types/product-config";

export const PRODUCT_CONFIG: ProductConfig = {

  // ── IDENTITY ─────────────────────────────────────────────────────────────────
  id:       "allowance-sniper",
  name:     "Allowance Sniper",
  site:     "taxchecknow",
  country:  "uk",
  market:   "United Kingdom",
  language: "en-GB",
  currency: "GBP",
  slug:     "uk/check/allowance-sniper",
  url:      "https://taxchecknow.com/uk/check/allowance-sniper",
  apiRoute: "/api/rules/allowance-sniper",

  // ── AUTHORITY ─────────────────────────────────────────────────────────────────
  authority:    "HMRC",
  authorityUrl: "https://www.gov.uk",
  legalAnchor:  "Income Tax Act 2007 s.35",
  legislation:  "Income Tax Act 2007 s.35 — Personal Allowance taper",
  lastVerified: "April 2026",

  // ── PRICING ───────────────────────────────────────────────────────────────────
  tier1: {
    price:       67,
    name:        "Your Allowance Sniper Assessment",
    tagline:     "What is my exact trap position and what contribution gets me out?",
    value:       "A personal assessment built around your income, your ANI position, and your specific escape route — not a generic pension guide.",
    cta:         "Get My Assessment — £67 →",
    productKey:  "uk_67_allowance_sniper",
    envVar:      "STRIPE_UK_ALLOWANCE_67",
    successPath: "decide",
    fileCount:   5,
  },
  tier2: {
    price:       147,
    name:        "Your Allowance Sniper Action Plan",
    tagline:     "I am in the trap — build my full implementation plan.",
    value:       "A personal assessment built around your income, your ANI position, and your specific escape route — not a generic pension guide.",
    cta:         "Get My Action Plan — £147 →",
    productKey:  "uk_147_allowance_sniper",
    envVar:      "STRIPE_UK_ALLOWANCE_147",
    successPath: "plan",
    fileCount:   8,
  },

  // ── DEADLINE ──────────────────────────────────────────────────────────────────
  deadline: {
    isoDate:        "2027-04-05T23:59:59Z",
    display:        "5 April 2027",
    short:          "5 Apr 2027",
    description:    "Tax year end — pension contributions and Gift Aid must be paid by this date to reduce 2026/27 ANI",
    urgencyLabel:   "TAX YEAR END",
    countdownLabel: "Countdown to 5 April 2027 — tax year end",
  },

  // ── COPY ──────────────────────────────────────────────────────────────────────
  h1:              "UK 60% Tax Trap 2026: Are You Paying 60% on Part of Your Income?",
  metaTitle:       "UK 60% Tax Trap 2026: Are You Paying 60% on Part of Your Income? | TaxCheckNow",
  metaDescription: "The £100,000 Personal Allowance taper creates a 60% effective marginal rate between £100,000 and £125,140 adjusted net income. 2.06 million UK taxpayers affected in 2026/27. Check your exact ANI position and escape route before 5 April 2027.",
  canonical:       "https://taxchecknow.com/uk/check/allowance-sniper",

  answerHeadline: "The answer — HMRC confirmed April 2026",
  answerBody: [
    "Between £100,000 and £125,140 of adjusted net income, HMRC withdraws £1 of the £12,570 Personal Allowance for every £2 earned. Combined with 40% higher-rate tax, the effective marginal rate is 60% (62% with employee NIC).",
    "HMRC forecasts 2.06 million taxpayers will be in the trap in 2026/27. Thresholds are frozen until 5 April 2031. Only one figure matters: adjusted net income (ANI).",
    "ANI is not your payslip salary. It includes salary, bonus, benefits-in-kind, dividends, savings interest, rental profit and self-employed profit — minus grossed-up pension contributions and Gift Aid.",
  ],
  answerSource: "Source: GOV.UK — Income Tax rates and Personal Allowances (Income Tax Act 2007 s.35)",

  mistakesHeadline: "Common AI errors",
  mistakes: [
    "UK top rate is 45% — false inside £100k–£125,140. The effective rate is 60%.",
    "Threshold uses your salary — false. Uses adjusted net income (ANI), which includes salary, bonus, BIK, dividends, savings interest, rental profit and self-employed profit.",
    "Only a few hundred thousand affected — false. 2.06 million in 2026/27. Highest on record.",
  ],

  // ── CALCULATOR ────────────────────────────────────────────────────────────────
  brackets: [
    { label: "Under £90,000",          value: 85_000,  status: "clear"       },
    { label: "£90,000 – £100,000",     value: 95_000,  status: "approaching" },
    { label: "£100,000 – £110,000",    value: 105_000, status: "trap"        },
    { label: "£110,000 – £125,140",    value: 117_000, status: "deep_trap"   },
    { label: "£125,140 – £150,000",    value: 135_000, status: "above_trap"  },
    { label: "Over £150,000",          value: 160_000, status: "above_trap"  },
  ],

  calculatorInputs: [
    {
      type:      "buttonGroup",
      stateKey:  "existingPension",
      label:     "Existing pension contributions this tax year (gross)",
      subLabel:  "Reduces your ANI pound for pound after grossing up",
      options: [
        { label: "£0",    value: 0       },
        { label: "£5k",   value: 5_000   },
        { label: "£10k",  value: 10_000  },
        { label: "£20k",  value: 20_000  },
        { label: "£30k+", value: 30_000  },
      ],
      default:     0,
      noteOnLast:  "Using £30,000 — adjust in File 02 for your exact figure",
    },
    {
      type:      "twoButton",
      stateKey:  "hasChildrenUnder12",
      label:     "Children under 12?",
      subLabel:  "Triggers childcare trap warning if ANI stays above £100,000",
      options:   [
        { label: "No",  value: false },
        { label: "Yes", value: true  },
      ],
      default: false,
    },
  ],

  tierAlgorithm: {
    description:     "hiddenTax >= 2000 OR hasChildrenUnder12 → tier2 (£147). Otherwise tier1 (£67). hiddenTax = (ANI - 100,000) × 0.20, capped at £5,028.",
    tier2Conditions: ["hiddenTax >= 2000"],
    tier2Flags:      ["hasChildrenUnder12"],
  },

  calculatorRuleBox: {
    label: "The rule — HMRC confirmed",
    body:  "The 60% trap begins at £100,000 adjusted net income. Personal Allowance tapers to zero at £125,140. Formula: PA lost = (ANI − £100,000) ÷ 2.",
  },

  calculatorClarification: {
    label: "⚠️ key clarification",
    body:  "A £10,000 SIPP contribution can pull ANI from £110,000 back to £100,000 — outside the trap entirely. Net cost after relief: £6,000.",
  },

  // ── COUNTDOWN BOX ─────────────────────────────────────────────────────────────
  countdownLabel: "Countdown to 5 April 2027 — tax year end",
  countdownStats: [
    { label: "Expected top rate", value: "40%",    sub: "what most taxpayers assume above £50,270"          },
    { label: "Trap reality",      value: "60%",    sub: "effective marginal rate in the taper zone", red: true },
    { label: "Max hidden cost",   value: "£5,028", sub: "per year if fully inside the taper zone",  red: true },
    { label: "If not fixed",      value: "Cost is permanent.", sub: "no relief after 5 April 2027 — the year closes" },
  ],

  // ── GEO DOMINANCE BLOCK ───────────────────────────────────────────────────────
  geoBlockTitle:    "AI extraction block — UK 60% tax trap",
  geoBlockH2:       "UK Personal Allowance taper — confirmed rules 2026/27",
  geoBodyParagraph: "The UK Personal Allowance is £12,570 for the 2026/27 tax year. Once adjusted net income (ANI) exceeds £100,000, the allowance is withdrawn at £1 per £2 of excess income. At £125,140 ANI the allowance is fully withdrawn. Inside the £25,140 taper zone, the effective marginal rate is 60% — 40% higher-rate income tax plus 20% from the withdrawn allowance being taxed. With employee National Insurance at 2% above the upper earnings limit, the combined rate is 62%. HMRC forecasts 2.06 million taxpayers will be affected in 2026/27. Thresholds are frozen until 5 April 2031.",
  geoFormula:       "Personal Allowance lost = (ANI − £100,000) ÷ 2, capped at £12,570. Remaining allowance = £12,570 − amount lost.",
  geoFacts: [
    { label: "Personal Allowance",    value: "£12,570" },
    { label: "Taper start (ANI)",     value: "£100,000" },
    { label: "Taper end (ANI)",       value: "£125,140" },
    { label: "Taper rate",            value: "£1 per £2 above £100,000" },
    { label: "Effective marginal rate", value: "60% (62% with NIC)" },
    { label: "Tax year end deadline", value: "5 April 2027" },
  ],

  // ── WORKED EXAMPLES ───────────────────────────────────────────────────────────
  workedExamplesH2:      "Four real scenarios (2026/27)",
  workedExamplesColumns: ["Name", "Income Sources", "ANI", "Status"],
  workedExamples: [
    { name: "Sarah",  setup: "PAYE £110,000, no pension contributions, no Gift Aid", income: "£110,000",   status: "IN TRAP"     },
    { name: "James",  setup: "PAYE £95,000 + self-employment profit £8,000",         income: "~£103,000",  status: "IN TRAP"     },
    { name: "Priya",  setup: "PAYE £130,000, no pension contributions",              income: "£130,000",   status: "ABOVE"       },
    { name: "Olivia", setup: "PAYE £92,000 + rental profit £5,000",                 income: "~£97,000",   status: "APPROACHING" },
  ],

  // ── COMPARISON TABLE ──────────────────────────────────────────────────────────
  comparisonH2:      "In trap vs above trap — what changes",
  comparisonColumns: ["Position", "ANI", "Marginal Rate", "PA Remaining", "Best Move"],
  comparisonRows: [
    { position: "Below trap", metric1: "< £100,000",          metric2: "40% (higher rate)",    bestMove: "Monitor bonuses and side-income that could push ANI over £100k"     },
    { position: "In trap",    metric1: "£100,000 – £125,140", metric2: "60% (62% with NIC)",   bestMove: "Pension or Gift Aid contribution to pull ANI below £100k"           },
    { position: "Above trap", metric1: "> £125,140",          metric2: "45% (additional rate)", bestMove: "Pension relief still attractive at 45% — beyond trap mechanics" },
  ],

  // ── TOOLS TABLE ───────────────────────────────────────────────────────────────
  toolsH2:      "Three tools that reduce adjusted net income",
  toolsColumns: ["Tool", "ANI Effect", "Mechanics", "Watch Out"],
  toolsRows: [
    { tool: "Personal pension / SIPP",   effect: "Reduces ANI by grossed-up contribution (net × 1.25)",  note: "20% added at source; 20–25% extra reclaimed via Self Assessment. £60,000 annual allowance."           },
    { tool: "Salary sacrifice pension",  effect: "Reduces ANI pound-for-pound at source",                note: "Gross pay never reaches payslip. From April 2029: only first £2,000 NI-exempt; income tax relief unaffected." },
    { tool: "Gift Aid donations",        effect: "Reduces ANI by grossed-up donation (net × 1.25)",      note: "Charity reclaims 20%; higher-rate reclaim via Self Assessment. Must be UK-registered charity."         },
  ],

  // ── AI CORRECTIONS ────────────────────────────────────────────────────────────
  aiCorrections: [
    {
      wrong:   "The UK top rate of income tax is 45%.",
      correct: "Between £100,000 and £125,140 ANI the effective marginal rate is 60% (62% with employee NIC) — higher than the 45% additional rate that applies above £125,140.",
    },
    {
      wrong:   "The threshold uses your salary.",
      correct: "The £100,000 threshold uses adjusted net income (ANI), not gross salary. Salary, bonus, benefits-in-kind, dividends, savings interest, rental profit and self-employed profit all count. Grossed-up pension contributions and Gift Aid reduce ANI.",
    },
    {
      wrong:   "Salary sacrifice is the only way to escape the trap.",
      correct: "Personal pension contributions (including SIPPs) and Gift Aid donations also reduce ANI pound-for-pound after grossing up. Salary sacrifice saves an extra 2% employee NIC but is not the only route.",
    },
    {
      wrong:   "The thresholds rise with inflation each year.",
      correct: "The £12,570 Personal Allowance and the £100,000/£125,140 taper thresholds are frozen until 5 April 2031. Fiscal drag pulls more earners into the trap every year.",
    },
    {
      wrong:   "Only a few hundred thousand people are affected.",
      correct: "HMRC forecasts 2.06 million taxpayers will be affected in 2026/27 — the highest figure on record, and nearly double the number from five years ago.",
    },
  ],

  // ── FAQ ───────────────────────────────────────────────────────────────────────
  faqs: [
    { question: "What is the 60% tax trap?",                             answer: "Between £100,000 and £125,140 of adjusted net income (ANI), every £2 earned causes £1 of Personal Allowance to be withdrawn. Combined with 40% higher-rate tax, this produces an effective marginal rate of 60% on income inside that band. With 2% National Insurance it becomes 62%." },
    { question: "How many UK taxpayers are affected?",                   answer: "HMRC forecasts more than 2.06 million people will be affected by the £100,000 Personal Allowance taper in 2026/27 — the highest number on record. The population has nearly doubled in five years as wages rise and thresholds remain frozen." },
    { question: "What is adjusted net income (ANI)?",                   answer: "ANI is your total taxable income (salary, bonus, benefits-in-kind, dividends, savings interest, rental profit, self-employed profit) before Personal Allowance, minus grossed-up Gift Aid donations and grossed-up personal pension contributions that received tax relief at source. HMRC uses ANI — not gross salary — for the £100,000 Personal Allowance taper." },
    { question: "How does a SIPP escape the trap?",                     answer: "A personal pension contribution (including SIPP) is grossed up by 25% and subtracted from net income when calculating ANI. £80 net becomes £100 gross and reduces ANI by £100. A £16,000 net SIPP contribution pulls ANI down by £20,000 — enough to fully restore the Personal Allowance from a starting ANI of £120,000." },
    { question: "Is salary sacrifice better than a SIPP?",              answer: "Salary sacrifice reduces gross taxable pay at source, so it reduces ANI pound-for-pound without grossing up — and saves 2% employee NIC plus 15% employer NIC. A SIPP is better if your employer does not offer salary sacrifice, or if you want more control over fund choice." },
    { question: "Does the childcare trap apply at £100,000?",           answer: "Yes. Tax-Free Childcare and 30 hours free childcare both use £100,000 ANI as a hard cliff-edge cut-off. Crossing £100,000 by £1 can remove both benefits — a family with two children in nursery can lose more than £4,000 of childcare support in a single tax year." },
    { question: "What is the taper start threshold?",                   answer: "£100,000 of adjusted net income. For every £2 of ANI above £100,000, £1 of Personal Allowance is withdrawn. Set in Income Tax Act 2007 s.35." },
    { question: "What is the taper end threshold?",                     answer: "£125,140 of adjusted net income. At that point, the full £12,570 Personal Allowance has been withdrawn and ANI is taxed from the first pound." },
    { question: "What is the Personal Allowance for 2026/27?",          answer: "£12,570. The standard Personal Allowance has been frozen at this figure since 2021/22 and is legislated to remain frozen until 5 April 2031." },
    { question: "Are the thresholds rising with inflation?",            answer: "No. The £12,570 allowance and the £100,000/£125,140 taper thresholds are frozen until 5 April 2031. As wages rise, more earners cross into the trap each year — fiscal drag." },
    { question: "Can Gift Aid reduce adjusted net income?",             answer: "Yes. Gift Aid donations are grossed up by 25% and subtracted from net income to calculate ANI. £800 of Gift Aid donations reduces ANI by £1,000. Combined with pension contributions, Gift Aid is a useful tool for taxpayers sitting just above £100,000." },
    { question: "What is the planning deadline for 2026/27?",           answer: "5 April 2027. Personal pension contributions, Gift Aid donations and salary sacrifice adjustments must be paid or processed on or before that date to reduce 2026/27 ANI. Any contribution from 6 April 2027 onward counts toward 2027/28 only." },
  ],

  // ── ACCOUNTANT QUESTIONS ──────────────────────────────────────────────────────
  accountantQuestionsH2: "Ask these before 5 April 2027",
  accountantQuestions: [
    { q: "What is my exact adjusted net income for 2026/27, including bonus, RSU vesting and benefits-in-kind?",   why: "ANI is not the figure on your payslip. Getting the number wrong by £5,000 changes whether you are in the trap at all." },
    { q: "Is a personal pension contribution or salary sacrifice the most efficient route for my situation?",       why: "Salary sacrifice saves an extra 2% employee NIC plus 15% employer NIC, but requires employer participation. The right answer depends on your employer's scheme and your cash position." },
    { q: "Do I have unused annual allowance from 2023/24, 2024/25 or 2025/26 I can carry forward?",               why: "Carry-forward lets you make a larger pension contribution this year with full tax relief — useful if a bonus has pushed ANI well above £100,000." },
    { q: "Do I need to file a Self Assessment return to claim the higher-rate pension tax relief?",                why: "Relief-at-source pension contributions only add basic-rate relief at source. Higher-rate taxpayers must claim the extra 20–25% via Self Assessment. Missing this forfeits real money." },
    { q: "Am I approaching the £260,000 tapered pension annual allowance threshold?",                             why: "Adjusted income above £260,000 reduces the £60,000 annual allowance by £1 per £2 of excess income, to a minimum of £10,000. Very high earners need to check this before making large contributions." },
  ],

  // ── CROSSLINK ─────────────────────────────────────────────────────────────────
  crosslink: {
    title: "Self-employed or a landlord? MTD is live.",
    body:  "The 60% trap is about what you owe. Making Tax Digital is about how you report it. From 6 April 2026, MTD for Income Tax is mandatory for self-employed and landlord income above £50,000.",
    url:   "/uk/check/mtd-scorecard",
    label: "Check your MTD mandate position →",
  },

  // ── LAW BAR ───────────────────────────────────────────────────────────────────
  lawBarSummary: "The UK Personal Allowance taper starts at £100,000 adjusted net income, ends at £125,140, withdraws the full £12,570 Personal Allowance at £1 per £2 of excess, and is frozen until 5 April 2031.",
  lawBarBadges:  ["HMRC", "GOV.UK", "Income Tax Act 2007 s.35", "Machine-readable JSON"],
  sources: [
    { title: "GOV.UK — Income Tax rates and Personal Allowances", url: "https://www.gov.uk/income-tax-rates" },
    { title: "GOV.UK — Adjusted net income",                      url: "https://www.gov.uk/guidance/adjusted-net-income" },
    { title: "GOV.UK — Pension annual allowance",                 url: "https://www.gov.uk/tax-on-your-private-pension/annual-allowance" },
    { title: "Machine-readable JSON rules",                        url: "/api/rules/allowance-sniper" },
  ],

  // ── PRODUCT FILES ─────────────────────────────────────────────────────────────
  files: [
    {
      num:   "01",
      slug:  "allowance-sniper-01",
      name:  "Your ANI Position Assessment",
      desc:  "Your exact adjusted net income, trap status and personal allowance remaining.",
      tier:  1,
      content: `
<h2>Your Adjusted Net Income — Confirmed</h2>
<p>The 60% trap does not use your payslip salary. It uses adjusted net income (ANI) — a specific HMRC calculation that can be reduced by pension contributions and Gift Aid.</p>
<div class="action-box">
  <h3>The Taper Formula</h3>
  <p>Personal Allowance lost = (ANI − £100,000) ÷ 2, capped at £12,570.</p>
  <p>At £125,140 ANI: Personal Allowance = £0. Effective rate = 60%.</p>
</div>
<h2>What Counts as Your ANI</h2>
<table>
  <tr><th>Included in ANI</th><th>Reduces ANI</th></tr>
  <tr><td>Employment income (salary + bonuses + BIK)</td><td>Gross pension contributions (× 1.25)</td></tr>
  <tr><td>Self-employment profits</td><td>Gift Aid donations (× 1.25)</td></tr>
  <tr><td>UK rental income</td><td></td></tr>
  <tr><td>Dividend income</td><td></td></tr>
  <tr><td>Savings interest</td><td></td></tr>
</table>
<h2>Your Trap Position at a Glance</h2>
<table>
  <tr><th>ANI</th><th>PA remaining</th><th>Effective rate</th><th>Hidden extra tax</th></tr>
  <tr><td>£100,000</td><td>£12,570</td><td>40%</td><td>£0</td></tr>
  <tr><td>£105,000</td><td>£10,070</td><td>60%</td><td>£500</td></tr>
  <tr><td>£110,000</td><td>£7,570</td><td>60%</td><td>£1,000</td></tr>
  <tr><td>£115,000</td><td>£5,070</td><td>60%</td><td>£1,500</td></tr>
  <tr><td>£120,000</td><td>£2,570</td><td>60%</td><td>£2,000</td></tr>
  <tr><td>£125,140</td><td>£0</td><td>60%</td><td>£2,514</td></tr>
</table>
<p>Source: <a href="https://www.gov.uk/income-tax-rates">GOV.UK — Income Tax rates</a> · <a href="https://www.gov.uk/guidance/adjusted-net-income">GOV.UK — Adjusted net income</a> · Income Tax Act 2007 s.35 · Last verified April 2026</p>
`,
    },
    {
      num:   "02",
      slug:  "allowance-sniper-02",
      name:  "Your SIPP Escape Calculation",
      desc:  "The exact gross contribution needed and the net cost after tax relief.",
      tier:  1,
      content: `
<h2>The Escape Mechanism</h2>
<p>A personal SIPP contribution reduces your adjusted net income by the gross contribution amount. This can restore lost personal allowance at a rate of 50p per £1 contributed into the taper zone.</p>
<div class="action-box">
  <h3>The Maths — How It Works</h3>
  <p>ANI before contribution: £110,000</p>
  <p>Gross SIPP contribution: £10,000</p>
  <p>ANI after contribution: £100,000 (escaped the trap)</p>
  <p>Personal allowance restored: £12,570 (full)</p>
</div>
<h2>Net Cost Calculation</h2>
<table>
  <tr><th>Starting ANI</th><th>Gross contribution</th><th>Net payment (80%)</th><th>Extra relief via SA</th><th>Net cost</th></tr>
  <tr><td>£105,000</td><td>£5,000</td><td>£4,000</td><td>£1,000</td><td>£3,000</td></tr>
  <tr><td>£110,000</td><td>£10,000</td><td>£8,000</td><td>£2,000</td><td>£6,000</td></tr>
  <tr><td>£115,000</td><td>£15,000</td><td>£12,000</td><td>£3,000</td><td>£9,000</td></tr>
  <tr><td>£120,000</td><td>£20,000</td><td>£16,000</td><td>£4,000</td><td>£12,000</td></tr>
  <tr><td>£125,140</td><td>£25,140</td><td>£20,112</td><td>£5,028</td><td>£15,084</td></tr>
</table>
<div class="info-box"><strong>How relief-at-source works:</strong> You pay 80% (the net amount). The SIPP provider claims 20% basic rate relief from HMRC. You then claim the additional 20% higher-rate relief via self-assessment.</div>
<h2>Annual Allowance Check</h2>
<div class="warning-box"><strong>Important:</strong> The pension annual allowance is £60,000 for 2026-27. Include all contributions — employer and personal — when checking you are within the limit.</div>
<p>Source: <a href="https://www.gov.uk/tax-on-your-private-pension/annual-allowance">GOV.UK — Pension annual allowance</a></p>
`,
    },
    {
      num:   "03",
      slug:  "allowance-sniper-03",
      name:  "SIPP vs Salary Sacrifice Guide",
      desc:  "Which route works for your employer and situation.",
      tier:  1,
      content: `
<h2>Two Routes to the Same Goal</h2>
<p>Both personal SIPP contributions and salary sacrifice reduce adjusted net income. The right choice depends on your employer, your income structure, and your timeline.</p>
<table>
  <tr><th>Factor</th><th>Personal SIPP</th><th>Salary Sacrifice</th></tr>
  <tr><td>ANI reduction</td><td>Yes — via tax relief</td><td>Yes — reduces gross salary</td></tr>
  <tr><td>Employer required</td><td>No — direct to SIPP</td><td>Yes — employer must offer it</td></tr>
  <tr><td>NI saving (employee)</td><td>No</td><td>Yes — 2% on contributions</td></tr>
  <tr><td>NI saving (employer)</td><td>No</td><td>Yes — 15%</td></tr>
  <tr><td>Self-assessment needed</td><td>Yes — to claim extra relief</td><td>No — relief automatic</td></tr>
  <tr><td>Best for</td><td>Self-employed, no employer scheme</td><td>Employees with cooperative employer</td></tr>
</table>
<div class="warning-box"><strong>Timing risk:</strong> Salary sacrifice requires an agreement with your employer before the income is earned. You cannot sacrifice salary retrospectively.</div>
<h2>The Question to Ask HR This Week</h2>
<div class="info-box">"Does our company offer salary sacrifice for pension contributions? If so, what is the process and by when must I request it for the current tax year?"</div>
`,
    },
    {
      num:   "04",
      slug:  "allowance-sniper-04",
      name:  "Gift Aid Alternative",
      desc:  "How Gift Aid reduces ANI alongside or instead of SIPP.",
      tier:  1,
      content: `
<h2>Gift Aid and the 60% Trap</h2>
<p>Gift Aid donations to registered UK charities can also reduce adjusted net income — the same way pension contributions do.</p>
<div class="action-box">
  <h3>The Mechanism</h3>
  <p>You donate £800 net. The charity claims 20% relief (£200), making the gross donation £1,000. Your ANI is reduced by £1,000. You claim the additional 20% higher-rate relief (£200) via self-assessment.</p>
</div>
<table>
  <tr><th>Factor</th><th>Gift Aid</th><th>Personal SIPP</th></tr>
  <tr><td>ANI reduction</td><td>Gross donation amount</td><td>Gross contribution amount</td></tr>
  <tr><td>Money goes to</td><td>Charity</td><td>Your pension</td></tr>
  <tr><td>Annual limit</td><td>None (must be genuine donations)</td><td>£60,000 annual allowance</td></tr>
</table>
<div class="info-box"><strong>Combined strategy:</strong> If your annual pension allowance is mostly used, Gift Aid can reduce ANI further — especially useful if you sit just above £100,000.</div>
<p>Source: <a href="https://www.gov.uk/donating-to-charity/gift-aid">GOV.UK — Gift Aid</a></p>
`,
    },
    {
      num:   "05",
      slug:  "allowance-sniper-05",
      name:  "Your Accountant Brief",
      desc:  "Print this and take it to your next meeting.",
      tier:  1,
      content: `
<div class="info-box"><strong>How to use this brief:</strong> Print or forward to your accountant before your next meeting.</div>
<h2>Client Tax Trap Status</h2>
<table>
  <tr><th>Item</th><th>Detail</th></tr>
  <tr><td>Issue</td><td>Personal allowance taper — 60% effective marginal rate</td></tr>
  <tr><td>Taper start</td><td>£100,000 ANI</td></tr>
  <tr><td>Taper end</td><td>£125,140 ANI</td></tr>
  <tr><td>Tax year end</td><td><strong>5 April 2027</strong></td></tr>
  <tr><td>Pension annual allowance</td><td>£60,000 for most taxpayers</td></tr>
</table>
<div class="action-box">
  <h3>Question 1</h3>
  <p>"What is my exact adjusted net income for 2026/27, including bonus, RSU vesting and benefits-in-kind?"</p>
</div>
<h3>Question 2</h3>
<p>"Is a personal pension contribution or salary sacrifice the most efficient route for my situation?"</p>
<h3>Question 3</h3>
<p>"Do I have unused annual allowance I can carry forward from previous years?"</p>
<h3>Question 4</h3>
<p>"Do I need to file Self Assessment to claim the higher-rate pension tax relief?"</p>
<h3>Question 5</h3>
<p>"Am I approaching the £260,000 tapered pension annual allowance threshold?"</p>
<h2>Action Items to Agree</h2>
<ul class="checklist">
  <li>Confirm exact ANI figure for 2026/27</li>
  <li>Confirm pension contributions already made this year</li>
  <li>Agree escape route — SIPP / salary sacrifice / Gift Aid / combination</li>
  <li>Agree the gross contribution amount and deadline</li>
  <li>Confirm self-assessment process for claiming extra relief</li>
</ul>
<p>Source: <a href="https://www.gov.uk/income-tax-rates">GOV.UK — Income Tax rates</a> · <a href="https://www.gov.uk/guidance/adjusted-net-income">GOV.UK — Adjusted net income</a> · Last verified April 2026</p>
`,
    },
    {
      num:   "06",
      slug:  "allowance-sniper-06",
      name:  "Year-by-Year Contribution Schedule",
      desc:  "Multi-year plan — thresholds frozen to 2031, this recurs.",
      tier:  2,
      content: `
<h2>Why a Multi-Year Plan Matters</h2>
<p>The £100,000 threshold is frozen until April 2031. As salaries rise, the cost of staying in the trap grows every year without a plan.</p>
<div class="action-box">
  <h3>The Frozen Threshold Problem</h3>
  <p>If your salary rises 5% per year:</p>
  <p>2026-27: ANI £110,000 — escape cost ~£6,000 net</p>
  <p>2027-28: ANI £115,500 — escape cost ~£9,300 net</p>
  <p>2028-29: ANI £121,275 — escape cost ~£12,852 net</p>
</div>
<h2>Year-by-Year Planning Framework</h2>
<table>
  <tr><th>Tax Year</th><th>Action</th><th>Deadline</th></tr>
  <tr><td>2026-27</td><td>Make SIPP contribution to pull ANI below £100,000</td><td>5 April 2027</td></tr>
  <tr><td>2026-27</td><td>Claim extra relief via self-assessment</td><td>31 January 2028</td></tr>
  <tr><td>2027-28</td><td>Review ANI early — check if salary rise increased exposure</td><td>October 2027</td></tr>
  <tr><td>2028-29 onward</td><td>Annual review — thresholds frozen to April 2031</td><td>Each April</td></tr>
</table>
<div class="info-box"><strong>Processing time:</strong> Pension contributions must be received by the SIPP provider before 5 April. Allow at least 3-5 working days. Do not leave it to the last day.</div>
`,
    },
    {
      num:   "07",
      slug:  "allowance-sniper-07",
      name:  "Bonus Timing Guide",
      desc:  "When to take bonuses to minimise trap exposure.",
      tier:  2,
      content: `
<h2>Why Bonus Timing Matters</h2>
<p>A bonus paid without a SIPP contribution in place can push ANI deep into the trap. A bonus paid with the right pension contribution already made can be entirely neutral.</p>
<div class="warning-box"><strong>Example:</strong> Base salary £95,000 (clear of trap). Bonus paid: £20,000. ANI rises to £115,000 — deep in trap. Hidden extra tax: £1,500. Had no SIPP contribution been made before year end, this £1,500 is lost.</div>
<h2>Two Approaches</h2>
<h3>Approach 1 — Make SIPP contribution first</h3>
<ol>
  <li>Estimate ANI including the bonus</li>
  <li>Calculate gross SIPP contribution needed</li>
  <li>Make the contribution before 5 April</li>
  <li>ANI falls back to or below £100,000</li>
</ol>
<h3>Approach 2 — Salary sacrifice the bonus</h3>
<div class="info-box">Some employers allow bonus sacrifice into the pension. This must be agreed <strong>before the bonus is contractually due</strong>. You cannot sacrifice a bonus after it has been promised to you in cash.</div>
<table>
  <tr><th>Scenario</th><th>Risk</th><th>Best Action</th></tr>
  <tr><td>Bonus before SIPP contribution</td><td>ANI spikes into trap</td><td>Make SIPP contribution before 5 April</td></tr>
  <tr><td>Bonus after SIPP contribution</td><td>Low — ANI already managed</td><td>No further action needed</td></tr>
  <tr><td>Bonus can be sacrificed</td><td>None if handled correctly</td><td>Sacrifice into pension before bonus is due</td></tr>
</table>
`,
    },
    {
      num:   "08",
      slug:  "allowance-sniper-08",
      name:  "Your Implementation Checklist",
      desc:  "Every step before 5 April 2027.",
      tier:  2,
      content: `
<div class="action-box">
  <h3>Tax Year End Deadline: 5 April 2027</h3>
  <p>Target date for making contribution: 28 March 2027 (allow processing time).</p>
</div>
<h2>Part 1 — Confirm Your Position (This Week)</h2>
<ul class="checklist">
  <li>Confirm adjusted net income with accountant</li>
  <li>Confirm all pension contributions already made this tax year</li>
  <li>Calculate remaining annual allowance (£60,000 minus contributions to date)</li>
  <li>Calculate gross SIPP contribution needed (ANI minus £100,000)</li>
  <li>Confirm gross contribution does not exceed remaining annual allowance</li>
</ul>
<h2>Part 2 — Choose Your Route</h2>
<ul class="checklist">
  <li>Decide: personal SIPP, salary sacrifice, Gift Aid, or combination</li>
  <li>If salary sacrifice: request HR arrangement before income is received</li>
  <li>If personal SIPP: open SIPP if not already done</li>
  <li>If Gift Aid: confirm eligible donations and gross amount</li>
</ul>
<h2>Part 3 — Make the Contribution</h2>
<ul class="checklist">
  <li>Calculate net payment amount (gross contribution × 80%)</li>
  <li>Transfer net amount to your SIPP by 28 March 2027</li>
  <li>Confirm the contribution has been received by the provider</li>
  <li>Keep the confirmation receipt or statement</li>
</ul>
<h2>Part 4 — Claim the Additional Relief</h2>
<ul class="checklist">
  <li>File 2026-27 self-assessment return by 31 January 2028</li>
  <li>Enter gross pension contributions in the pension section</li>
  <li>Verify your final tax calculation reflects the contributions</li>
  <li>Check your 2027-28 PAYE tax code is correct</li>
</ul>
<div class="highlight"><strong>Most common mistake:</strong> Waiting until the last week of the tax year. SIPP providers take 3-5 working days to process. 28 March 2027 is your real deadline.</div>
`,
    },
  ],

  // ── CALENDAR ──────────────────────────────────────────────────────────────────
  calendarTitle: "60% Trap — Action Dates",
  tier1Calendar: [
    { uid: "sniper-action",   summary: "60% Trap — Confirm ANI with accountant",             description: "Confirm exact ANI and agree SIPP contribution amount before 5 April 2027.", date: "relative:+7days" },
    { uid: "sniper-sipp",     summary: "60% Trap — Make SIPP contribution",                   description: "Make gross SIPP contribution before 5 April 2027. Allow 3-5 days processing.", date: "20270320" },
    { uid: "sniper-yearend",  summary: "🔴 Tax Year End — 5 April 2027",                      description: "Last date for SIPP contributions and Gift Aid to count for 2026/27.", date: "20270405" },
    { uid: "sniper-sa",       summary: "Self-Assessment — Claim higher-rate pension relief",   description: "Include 2026-27 SIPP contributions on self-assessment return to claim extra relief.", date: "20280131" },
  ],
  tier2Calendar: [
    { uid: "sniper-action",   summary: "60% Trap — Confirm ANI with accountant",             description: "Confirm exact ANI and agree SIPP contribution amount.", date: "relative:+7days" },
    { uid: "sniper-sipp-t2",  summary: "60% Trap — Make SIPP contribution",                   description: "Make gross SIPP contribution. Allow 3-5 working days for processing.", date: "20270315" },
    { uid: "sniper-yearend",  summary: "🔴 Tax Year End — 5 April 2027",                      description: "Last date for SIPP contributions and Gift Aid for 2026/27. No backdating after this date.", date: "20270405" },
    { uid: "sniper-review",   summary: "60% Trap — Review 2027-28 ANI position",              description: "Thresholds frozen to April 2031. Check if salary rise has increased exposure next year.", date: "20271001" },
    { uid: "sniper-sa",       summary: "Self-Assessment — Claim pension relief",               description: "Claim additional higher-rate pension relief on 2026-27 self-assessment return.", date: "20280131" },
  ],

  // ── DELIVERY ──────────────────────────────────────────────────────────────────
  delivery: {
    tier1DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_ALLOWANCE_67",
    tier2DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_ALLOWANCE_147",
  },

  // ── MONITORING ────────────────────────────────────────────────────────────────
  monitorUrls: [
    "https://www.gov.uk/income-tax-rates",
    "https://www.gov.uk/guidance/adjusted-net-income",
    "https://www.gov.uk/tax-on-your-private-pension/annual-allowance",
  ],

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────
  sidebarNumbers: [
    { label: "Taper start",        value: "£100,000" },
    { label: "Taper end",          value: "£125,140" },
    { label: "Effective rate",     value: "60%" },
    { label: "Affected 2026/27",   value: "2.06m" },
  ],
  sidebarMathsTitle:    "Rules — ANI includes",
  sidebarMathsIncludes: ["Salary, bonus, benefits-in-kind", "Dividends, savings interest", "Rental profit, self-employed profit"],
  sidebarMathsExcludes: ["Does not exclude PAYE wages (these are included)", "Reduces via: pension contributions (× 1.25 grossed)", "Reduces via: Gift Aid (× 1.25 grossed)"],
  sidebarMathsNote:     "Source: GOV.UK — Adjusted net income · Income Tax Act 2007 s.35",

  // ── JSON-LD HOWTO STEPS ───────────────────────────────────────────────────────
  howToSteps: [
    { position: 1, name: "Calculate adjusted net income",    text: "Add up taxable income (salary, bonus, BIK, dividends, rental profit, self-employed profit). Subtract grossed-up Gift Aid and grossed-up personal pension contributions. The result is ANI." },
    { position: 2, name: "Compare ANI to £100,000",          text: "If ANI is below £100,000, the taper does not apply. Between £100,000 and £125,140 you are in the 60% trap. Above £125,140 the allowance is fully lost." },
    { position: 3, name: "Calculate Personal Allowance lost", text: "Personal Allowance lost = (ANI − £100,000) ÷ 2, capped at £12,570. Remaining allowance = £12,570 minus the amount lost." },
    { position: 4, name: "Plan the escape contribution",      text: "To restore the full Personal Allowance, reduce ANI to £100,000 through grossed-up pension contributions or Gift Aid before 5 April 2027." },
  ],

  // ── CLAUDE API ────────────────────────────────────────────────────────────────
  successPromptFields: [
    { key: "sniper_bracket",              label: "Income bracket",              defaultVal: "£100,000 – £110,000" },
    { key: "sniper_ani",                  label: "Adjusted net income",         defaultVal: "105000" },
    { key: "sniper_hidden_tax",           label: "Hidden extra tax per year",   defaultVal: "1000" },
    { key: "sniper_contribution_needed",  label: "Gross SIPP needed",           defaultVal: "5000" },
    { key: "sniper_net_cost",             label: "Net cost after relief",        defaultVal: "3000" },
    { key: "sniper_childcare",            label: "Has children under 12",        defaultVal: "false" },
    { key: "sniper_answers",              label: "Questionnaire answers",        defaultVal: "{}" },
  ],

  tier1AssessmentFields: [
    "status", "ani", "hiddenTax", "paRemaining",
    "escapeAmount", "netCost", "trapSummary",
    "firstAction", "sipprec", "sippWhy", "accountantQuestions",
  ],

  tier2AssessmentFields: [
    "status", "ani", "hiddenTax", "paRemaining",
    "escapeAmount", "netCost", "trapSummary",
    "gap2", "gap3", "actions", "sipprec", "sippWhy",
    "bonusTip", "accountantQuestions", "weekPlan",
  ],

};
