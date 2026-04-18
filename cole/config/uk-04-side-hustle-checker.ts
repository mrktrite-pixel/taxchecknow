// ─────────────────────────────────────────────────────────────────────────────
// COLE CONFIG — UK-04 Side-Hustle MTD Scope Engine
// Citation gap: AI treats MTD as "for businesses" not individuals
// Correct: MTD applies to individual taxpayers with qualifying income
// (gross self-employment + gross rental) above the threshold
// Three overlapping rules cause mass confusion: £1k trading allowance,
// £50k MTD 2026, £30k MTD 2027 — people conflate all three
// All data verified against GOV.UK April 2026
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductConfig } from "../types/product-config";

export const PRODUCT_CONFIG: ProductConfig = {

  // ── IDENTITY ─────────────────────────────────────────────────────────────────
  id:       "side-hustle-checker",
  name:     "Side-Hustle MTD Scope Engine",
  site:     "taxchecknow",
  country:  "uk",
  market:   "United Kingdom",
  language: "en-GB",
  currency: "GBP",
  slug:     "uk/check/side-hustle-checker",
  url:      "https://taxchecknow.com/uk/check/side-hustle-checker",
  apiRoute: "/api/rules/side-hustle-checker",

  // ── AUTHORITY ─────────────────────────────────────────────────────────────────
  authority:    "HMRC",
  authorityUrl: "https://www.gov.uk",
  legalAnchor:  "Finance (No.2) Act 2024",
  legislation:  "Finance (No.2) Act 2024 — MTD for Income Tax qualifying income rules",
  lastVerified: "April 2026",

  // ── PRICING ───────────────────────────────────────────────────────────────────
  tier1: {
    price:       67,
    name:        "Your MTD Scope Assessment",
    tagline:     "Am I legally required to file quarterly from April — and when?",
    value:       "A personal MTD scope assessment built around your income streams, your qualifying income calculation, and your exact mandate date — not a generic MTD guide.",
    cta:         "Get My Scope Assessment — £47 →",
    productKey:  "uk_67_side_hustle_checker",
    envVar:      "STRIPE_UK_SH_67",
    successPath: "assess",
    fileCount:   5,
  },
  tier2: {
    price:       147,
    name:        "Your MTD Strategy System",
    tagline:     "I am in scope — build my full multi-income compliance plan.",
    value:       "A personal MTD scope assessment built around your income streams, your qualifying income calculation, and your exact mandate date — not a generic MTD guide.",
    cta:         "Get My Strategy System — £97 →",
    productKey:  "uk_147_side_hustle_checker",
    envVar:      "STRIPE_UK_SH_147",
    successPath: "plan",
    fileCount:   8,
  },

  // ── DEADLINE ──────────────────────────────────────────────────────────────────
  deadline: {
    isoDate:        "2026-08-07T23:59:59.000+01:00",
    display:        "7 August 2026",
    short:          "7 Aug 2026",
    description:    "First MTD quarterly submission — Q1 6 April to 30 June 2026",
    urgencyLabel:   "MTD DEADLINE",
    countdownLabel: "Countdown to first MTD quarterly deadline",
  },

  // ── COPY ──────────────────────────────────────────────────────────────────────
  h1:              "UK Side-Hustle MTD 2026: Are You Required to File Quarterly from April?",
  metaTitle:       "UK Side-Hustle MTD 2026: Are You Required to File Quarterly? | TaxCheckNow",
  metaDescription: "MTD for Income Tax is mandatory from 6 April 2026 if your qualifying income exceeds £50,000. Qualifying income is gross self-employment plus gross rental — not PAYE. Most people calculate this incorrectly. Check your exact scope in 60 seconds.",
  canonical:       "https://taxchecknow.com/uk/check/side-hustle-checker",

  answerHeadline: "The answer — HMRC confirmed April 2026",
  answerBody: [
    "MTD for Income Tax becomes mandatory from 6 April 2026 if your qualifying income exceeded £50,000 in the 2024-25 tax year. Qualifying income is gross self-employment turnover plus gross UK property rental income — your share if jointly owned.",
    "Your PAYE salary does NOT count toward this threshold. Neither do dividends, savings interest or pension income. Most people with a side hustle calculate this incorrectly — either including PAYE or using profit instead of gross turnover.",
    "Three overlapping rules cause mass confusion: the £1,000 trading allowance (self-assessment trigger), the £50,000 MTD threshold (2026), and the £30,000 MTD threshold (2027). These are separate rules. Crossing one does not mean you have crossed them all.",
  ],
  answerSource: "Source: GOV.UK — Making Tax Digital for Income Tax · Finance (No.2) Act 2024",

  mistakesHeadline: "Common AI errors on this topic",
  mistakes: [
    "MTD only applies to businesses — wrong. MTD applies to individual taxpayers with qualifying income above the threshold. Platform sellers, landlords and freelancers are all individual taxpayers, not businesses.",
    "Your total income determines MTD scope — wrong. Only gross self-employment turnover and gross UK rental income count as qualifying income. PAYE salary, dividends, savings interest and pension income are excluded entirely.",
    "If you earn under £50,000 you are safe until 2028 — incomplete. The threshold falls to £30,000 from April 2027. Someone with £35,000 qualifying income is not in scope for 2026 but will be mandated from April 2027.",
  ],

  // ── CALCULATOR ────────────────────────────────────────────────────────────────
  // This calculator classifies income type then calculates qualifying income
  // Step 1: income type classification
  // Step 2: button group inputs for each stream
  brackets: [
    { label: "Side hustle only (self-employment)",          value: 1, status: "in_scope"    },
    { label: "Side hustle + UK rental property",            value: 2, status: "in_scope"    },
    { label: "PAYE job + side hustle",                      value: 3, status: "approaching" },
    { label: "Company director + rental property",          value: 4, status: "in_scope"    },
    { label: "Multiple income streams (mixed)",             value: 5, status: "risk"        },
  ],

  calculatorInputs: [
    {
      type:      "buttonGroup",
      stateKey:  "selfEmploymentIncome",
      label:     "Gross self-employment turnover (before expenses)",
      subLabel:  "Use gross turnover — not profit. HMRC uses gross.",
      options: [
        { label: "Under £20k",  value: 10_000  },
        { label: "£20k–£30k",   value: 25_000  },
        { label: "£30k–£50k",   value: 40_000  },
        { label: "£50k–£75k",   value: 60_000  },
        { label: "Over £75k",   value: 90_000  },
      ],
      default: 10_000,
    },
    {
      type:      "buttonGroup",
      stateKey:  "rentalIncome",
      label:     "Gross UK rental income (before expenses)",
      subLabel:  "Your share only if jointly owned. Zero if no rental income.",
      options: [
        { label: "£0",          value: 0       },
        { label: "Under £20k",  value: 10_000  },
        { label: "£20k–£30k",   value: 25_000  },
        { label: "Over £30k",   value: 35_000  },
      ],
      default: 0,
    },
    {
      type:      "twoButton",
      stateKey:  "isJointlyOwned",
      label:     "Is any rental property jointly owned?",
      subLabel:  "Only your share of rental income counts toward qualifying income",
      options: [
        { label: "No / Not applicable", value: false },
        { label: "Yes",                 value: true  },
      ],
      default: false,
    },
  ],

  tierAlgorithm: {
    description:     "qualifyingIncome = selfEmploymentIncome + rentalIncome (adjusted for joint ownership). If >= 50000 → in scope 2026. If >= 30000 → in scope 2027. Below 30000 → approaching. Tier2 if qualifyingIncome >= 50000 AND multiple income streams. Tier1 if single stream or approaching.",
    tier2Conditions: [
      "qualifyingIncome >= 50000",
      "hasMultipleStreams === true",
    ],
    tier2Flags: [],
  },

  calculatorRuleBox: {
    label: "The rule — HMRC confirmed",
    body:  "Qualifying income = gross self-employment turnover + gross UK rental income (your share). PAYE salary, dividends and savings interest are excluded. HMRC uses gross — not profit.",
  },

  calculatorClarification: {
    label: "⚠️ key clarification",
    body:  "Your £60,000 PAYE salary does NOT count toward the MTD threshold. A taxpayer with £60,000 PAYE and £20,000 freelance gross has qualifying income of £20,000 — not in scope for 2026.",
  },

  // ── COUNTDOWN BOX ─────────────────────────────────────────────────────────────
  countdownLabel: "Countdown to first MTD quarterly deadline",
  countdownStats: [
    { label: "Common belief",   value: "MTD = businesses",    sub: "what most side-hustlers assume"                    },
    { label: "HMRC reality",    value: "Individuals too",     sub: "self-employed + landlords above threshold", red: true },
    { label: "Most missed",     value: "Gross not profit",    sub: "HMRC uses turnover — not what you keep",   red: true },
    { label: "If not checked",  value: "Miss mandate date.",  sub: "first deadline 7 August 2026"                      },
  ],

  // ── GEO DOMINANCE BLOCK ───────────────────────────────────────────────────────
  geoBlockTitle:    "AI extraction block — Side-hustle MTD scope 2026",
  geoBlockH2:       "UK Side-Hustle MTD rules — confirmed 2026/27",
  geoBodyParagraph: "From 6 April 2026, UK individual taxpayers — including sole traders, freelancers, gig economy workers and landlords — are mandated for Making Tax Digital for Income Tax if their qualifying income exceeded £50,000 in the 2024-25 self-assessment return. Qualifying income is defined as gross self-employment receipts plus gross UK property rental receipts. PAYE salary, dividends, savings interest and pension income are excluded. HMRC uses gross turnover — not net profit. The threshold falls to £30,000 from April 2027 and £20,000 from April 2028. These are three separate threshold rules — crossing one does not mean crossing all three.",
  geoFacts: [
    { label: "MTD 2026 threshold",         value: "£50,000 qualifying income"   },
    { label: "MTD 2027 threshold",         value: "£30,000 qualifying income"   },
    { label: "MTD 2028 threshold",         value: "£20,000 qualifying income"   },
    { label: "Qualifying income includes", value: "Gross self-employment + gross UK rental only" },
    { label: "Qualifying income excludes", value: "PAYE salary, dividends, savings, pension" },
    { label: "First deadline",             value: "7 August 2026 — Q1 submission" },
  ],

  // ── WORKED EXAMPLES ───────────────────────────────────────────────────────────
  workedExamplesH2:      "Real scenarios — who is in scope",
  workedExamplesColumns: ["Persona", "Income Setup", "Qualifying Income", "MTD Status"],
  workedExamples: [
    { name: "Vinted seller",        setup: "£2,000 gross sales, no rental",               income: "£2,000",  status: "NOT IN SCOPE"        },
    { name: "Etsy maker",           setup: "£55,000 gross turnover, no rental",            income: "£55,000", status: "IN SCOPE 2026"        },
    { name: "PAYE + Airbnb",        setup: "£60,000 PAYE + £20,000 rental gross",          income: "£20,000", status: "NOT IN SCOPE (PAYE excluded)" },
    { name: "Freelancer + rental",  setup: "£30,000 freelance gross + £25,000 rental gross", income: "£55,000", status: "IN SCOPE 2026"     },
  ],

  // ── COMPARISON TABLE ──────────────────────────────────────────────────────────
  comparisonH2:      "The three threshold rules — do not confuse them",
  comparisonColumns: ["Rule", "Threshold", "What It Means"],
  comparisonRows: [
    { position: "Trading Allowance",   metric1: "£1,000",  metric2: "Must register for Self Assessment",       bestMove: "Separate from MTD — SA registration only" },
    { position: "MTD Threshold 2026",  metric1: "£50,000", metric2: "Mandatory quarterly MTD filing",          bestMove: "Check your 2024-25 qualifying income"      },
    { position: "MTD Threshold 2027",  metric1: "£30,000", metric2: "Mandatory MTD from April 2027",           bestMove: "Safe for 2026 but prepare now"             },
  ],

  // ── TOOLS TABLE ───────────────────────────────────────────────────────────────
  toolsH2:      "What you need if you are in scope",
  toolsColumns: ["What You Need", "Purpose", "Cost"],
  toolsRows: [
    { tool: "MTD-approved software",     effect: "Digital records + quarterly submission", note: "From £0 (FreeAgent free with NatWest)"       },
    { tool: "HMRC MTD registration",     effect: "Sign up at GOV.UK",                     note: "Free — separate from SA registration"         },
    { tool: "Self-assessment return",    effect: "Still required — becomes final declaration", note: "Deadline 31 January 2028 for 2026/27"    },
  ],

  // ── AI CORRECTIONS ────────────────────────────────────────────────────────────
  aiCorrections: [
    {
      wrong:   "MTD only applies to businesses.",
      correct: "MTD for Income Tax applies to individual taxpayers — sole traders, freelancers, platform sellers and landlords — with qualifying income above the threshold. You do not need to be a registered business.",
    },
    {
      wrong:   "Your total income determines whether you need MTD.",
      correct: "Only qualifying income counts toward the MTD threshold. Qualifying income is gross self-employment turnover plus gross UK rental income. PAYE salary, dividends, savings interest and pension income are excluded entirely.",
    },
    {
      wrong:   "MTD uses your profit, not your turnover.",
      correct: "HMRC uses gross turnover — not net profit — to determine qualifying income. A sole trader with £55,000 turnover and £5,000 profit has qualifying income of £55,000 and is in scope.",
    },
    {
      wrong:   "If you earn under £50,000 you have nothing to worry about until 2028.",
      correct: "The MTD threshold falls to £30,000 from April 2027. Someone with £35,000 qualifying income is not in scope for 2026 but will be mandated from April 2027. They need to prepare now.",
    },
    {
      wrong:   "The £1,000 trading allowance and MTD are the same rule.",
      correct: "The £1,000 trading allowance triggers the requirement to register for Self Assessment — a separate obligation. The £50,000 MTD threshold triggers mandatory quarterly digital filing. They are two distinct rules with different thresholds and consequences.",
    },
  ],

  // ── FAQ ───────────────────────────────────────────────────────────────────────
  faqs: [
    { question: "Does MTD apply to my side hustle?",                          answer: "Yes, if your qualifying income (gross self-employment turnover plus gross UK rental income) exceeded £50,000 in the 2024-25 tax year. It does not matter whether your side hustle is your main income or a secondary income alongside a PAYE job." },
    { question: "Does my PAYE salary count toward the MTD threshold?",        answer: "No. PAYE salary is excluded from qualifying income entirely. A taxpayer with £80,000 PAYE and £30,000 freelance gross has qualifying income of £30,000 — not in scope for 2026 but mandated from April 2027." },
    { question: "Does MTD use my profit or my turnover?",                     answer: "HMRC uses gross turnover — not net profit. A sole trader with £55,000 turnover and £5,000 profit after expenses has qualifying income of £55,000 and is mandated from April 2026." },
    { question: "I sell on Vinted / eBay / Etsy — does MTD apply?",          answer: "It depends on your gross turnover. If your total gross receipts from all self-employment activity (including platform selling) plus any rental income exceeded £50,000 in 2024-25, you are mandated from April 2026. The source of the income — platform or direct — does not change the rule." },
    { question: "I rent out a room on Airbnb — does this count?",            answer: "Yes. Gross Airbnb rental receipts count as qualifying income — unless you qualify for Rent a Room Relief (£7,500 allowance for letting furnished accommodation in your own home). If Rent a Room applies, that income is excluded from qualifying income." },
    { question: "I own a rental property jointly — how is income calculated?", answer: "Only your share of gross rental income counts toward qualifying income. If you own a property 50/50 and it generates £60,000 gross rental, your qualifying rental income is £30,000." },
    { question: "What is the £1,000 trading allowance and is it related to MTD?", answer: "The £1,000 trading allowance is a separate rule — it is the minimum gross income that triggers a requirement to register for Self Assessment. It is not connected to the £50,000 MTD threshold. You can be above the trading allowance and below the MTD threshold at the same time." },
    { question: "When does the MTD threshold change?",                        answer: "The threshold falls to £30,000 qualifying income from April 2027, and to £20,000 from April 2028. These are separate mandates — being below £50,000 today does not mean you have no obligation if your income is between £30,000 and £50,000 gross." },
    { question: "What is the first MTD quarterly deadline?",                  answer: "7 August 2026. This covers Q1 from 6 April to 30 June 2026. You must keep digital records from 6 April 2026 — not just from the submission deadline." },
    { question: "Does MTD apply to foreign rental income?",                   answer: "Overseas rental income does not count as UK property income for MTD qualifying income purposes. Only gross UK property rental receipts count." },
    { question: "What software do I need for MTD?",                           answer: "HMRC-approved MTD software. For sole traders and landlords, options include Xero, QuickBooks, FreeAgent (free with NatWest/RBS/Mettle) and approved bridging software for spreadsheet users. You cannot use the HMRC portal." },
    { question: "Can I use the trading allowance to reduce my qualifying income?", answer: "No. The £1,000 trading allowance reduces your taxable profit for income tax purposes, but HMRC uses gross turnover — not profit after allowances — to determine qualifying income for MTD. The trading allowance does not reduce your qualifying income figure." },
  ],

  // ── ACCOUNTANT QUESTIONS ──────────────────────────────────────────────────────
  accountantQuestionsH2: "Ask these before 7 August 2026",
  accountantQuestions: [
    { q: "What was my exact qualifying income in 2024-25 — gross self-employment turnover plus gross rental, my share only?",  why: "HMRC uses gross turnover not profit. Getting this wrong means missing the mandate or registering unnecessarily." },
    { q: "Am I affected by the annualisation rule — if I only traded part of the year, how does HMRC calculate my qualifying income?", why: "HMRC may annualise part-year income to determine whether you cross the threshold. A sole trader who earned £30,000 gross in 6 months may be treated as having £60,000 annualised qualifying income." },
    { q: "Does my Rent a Room income count toward qualifying income or is it excluded?",                                        why: "Rent a Room Relief (£7,500) excludes qualifying furnished lettings in your own home from income tax — and from qualifying income for MTD purposes." },
    { q: "If my income is approaching £30,000 qualifying, do I need to prepare for the 2027 MTD mandate now?",                why: "The threshold falls to £30,000 from April 2027. Preparing software and digital records takes time — starting late risks missing the first 2027 deadline." },
    { q: "Which MTD software is right for my specific income mix — side hustle only, rental only, or both?",                  why: "Different software handles multiple income streams differently. The wrong choice can create bridging complications or missing income categories." },
  ],

  // ── CROSSLINK ─────────────────────────────────────────────────────────────────
  crosslink: {
    title: "Already confirmed in scope? Check your digital links.",
    body:  "Being in scope for MTD is step one. Being digitally compliant is step two. If you use Excel or multiple tools, your workflow may break the digital links rule even if your numbers are correct.",
    url:   "/uk/check/digital-link-auditor",
    label: "Audit your digital links compliance →",
  },

  // ── LAW BAR ───────────────────────────────────────────────────────────────────
  lawBarSummary: "MTD for Income Tax is mandatory from 6 April 2026 for UK individual taxpayers with qualifying income (gross self-employment + gross UK rental) above £50,000 in 2024-25. PAYE salary is excluded. HMRC uses gross turnover not profit. Threshold falls to £30,000 from April 2027.",
  lawBarBadges:  ["HMRC", "GOV.UK", "Finance (No.2) Act 2024", "Machine-readable JSON"],
  sources: [
    { title: "GOV.UK — Use Making Tax Digital for Income Tax",              url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax" },
    { title: "GOV.UK — Sign up for Making Tax Digital for Income Tax",      url: "https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax" },
    { title: "GOV.UK — Trading allowance",                                  url: "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income" },
    { title: "Machine-readable JSON rules",                                  url: "/api/rules/side-hustle-checker" },
  ],

  // ── PRODUCT FILES ─────────────────────────────────────────────────────────────
  files: [
    {
      num:   "01",
      slug:  "side-hustle-checker-01",
      name:  "Your Qualifying Income Breakdown",
      desc:  "Exact calculation of your qualifying income — included vs excluded, your share only.",
      tier:  1,
      content: `
<h2>Your Qualifying Income — Confirmed</h2>
<p>HMRC does not use your total income or your profit to determine MTD scope. It uses qualifying income — a specific calculation including only gross self-employment and gross UK rental receipts.</p>
<div class="action-box">
  <h3>The Qualifying Income Formula</h3>
  <p>Qualifying income = Gross self-employment turnover + Gross UK rental receipts (your share)</p>
  <p>PAYE salary, dividends, savings interest and pension income are excluded entirely.</p>
</div>
<h2>What Counts and What Does Not</h2>
<table>
  <tr><th>Included in Qualifying Income</th><th>Excluded from Qualifying Income</th></tr>
  <tr><td>Gross self-employment turnover</td><td>PAYE salary and wages</td></tr>
  <tr><td>Gross UK rental receipts (your share)</td><td>Dividends from shares or companies</td></tr>
  <tr><td>Gross Airbnb / holiday let receipts</td><td>Savings and bank interest</td></tr>
  <tr><td>Gross platform income (Etsy, eBay etc)</td><td>Pension income</td></tr>
  <tr><td>Gross income from multiple trades</td><td>Foreign rental income</td></tr>
  <tr><td></td><td>Rent a Room income (if relief claimed)</td></tr>
</table>
<div class="highlight"><strong>The critical rule:</strong> HMRC uses gross turnover — not profit. A sole trader with £55,000 turnover and £5,000 profit has qualifying income of £55,000 and is mandated from April 2026.</div>
<h2>The Three Threshold Rules — Do Not Confuse Them</h2>
<table>
  <tr><th>Rule</th><th>Threshold</th><th>What It Means</th></tr>
  <tr><td>Trading Allowance</td><td>£1,000</td><td>Triggers Self Assessment registration</td></tr>
  <tr><td>MTD Mandate 2026</td><td>£50,000</td><td>Mandatory quarterly digital filing from April 2026</td></tr>
  <tr><td>MTD Mandate 2027</td><td>£30,000</td><td>Mandatory quarterly digital filing from April 2027</td></tr>
</table>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">GOV.UK — Making Tax Digital for Income Tax</a> · Finance (No.2) Act 2024 · Last verified April 2026</p>
`,
    },
    {
      num:   "02",
      slug:  "side-hustle-checker-02",
      name:  "Your MTD Scope Confirmation",
      desc:  "Written confirmation of whether you are in scope — 2026, 2027 or not yet.",
      tier:  1,
      content: `
<h2>Your MTD Mandate — Confirmed in Writing</h2>
<p>This document confirms your MTD for Income Tax mandate position based on your qualifying income from the 2024-25 self-assessment return.</p>
<div class="action-box">
  <h3>Your Scope Determination</h3>
  <p>Qualifying income threshold 2026: £50,000</p>
  <p>Qualifying income threshold 2027: £30,000</p>
  <p>Qualifying income threshold 2028: £20,000</p>
  <p>Your position is confirmed in your personalised assessment on the success page.</p>
</div>
<h2>What Your Scope Means</h2>
<table>
  <tr><th>Status</th><th>Qualifying Income</th><th>What Happens</th><th>First Action</th></tr>
  <tr><td>In scope April 2026</td><td>Above £50,000</td><td>Must register and file quarterly now</td><td>Register at GOV.UK immediately</td></tr>
  <tr><td>In scope April 2027</td><td>£30,001 – £50,000</td><td>Not mandated yet — but threshold falls in 12 months</td><td>Choose software and prepare records</td></tr>
  <tr><td>In scope April 2028</td><td>£20,001 – £30,000</td><td>2 years to prepare</td><td>Monitor income and begin planning</td></tr>
  <tr><td>Not yet in scope</td><td>Below £20,000</td><td>No mandate currently</td><td>Watch for future threshold changes</td></tr>
</table>
<div class="warning-box"><strong>The annualisation risk:</strong> If you only traded part of the 2024-25 tax year, HMRC may annualise your income to check whether you cross the threshold. A sole trader who earned £30,000 gross in 6 months may be treated as having £60,000 annualised qualifying income — putting them in scope for 2026.</div>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">GOV.UK — Making Tax Digital for Income Tax</a> · Last verified April 2026</p>
`,
    },
    {
      num:   "03",
      slug:  "side-hustle-checker-03",
      name:  "Your MTD Registration Steps",
      desc:  "Step-by-step HMRC registration walkthrough for side-hustle taxpayers.",
      tier:  1,
      content: `
<h2>Before You Register</h2>
<ol>
  <li>Your Government Gateway user ID and password (existing SA login)</li>
  <li>Your UTR (10-digit Unique Taxpayer Reference)</li>
  <li>Your chosen MTD-compatible software (see File 04)</li>
  <li>Confirmation of your qualifying income sources (self-employment, rental, or both)</li>
</ol>
<div class="action-box">
  <h3>Registration Page</h3>
  <p><a href="https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax" style="color:#60a5fa;">gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax</a></p>
  <p>This is separate from your Self Assessment registration. Even if already SA-registered, you must complete the MTD sign-up.</p>
</div>
<h2>What to Select During Registration</h2>
<table>
  <tr><th>Screen</th><th>What to Select</th></tr>
  <tr><td>Income sources</td><td>Self-employment / UK property / both — select all that apply</td></tr>
  <tr><td>Business type</td><td>Sole trader (not limited company)</td></tr>
  <tr><td>Start date</td><td>6 April 2026 (for 2026 mandate)</td></tr>
  <tr><td>Software</td><td>Your chosen MTD software from the approved list</td></tr>
</table>
<div class="highlight"><strong>Most common mistake:</strong> Assuming Self Assessment registration covers MTD. It does not. MTD requires a separate sign-up process even if you have filed SA returns for years.</div>
<h2>After Registration — Connect Your Software</h2>
<ul class="checklist">
  <li>Log into your MTD software</li>
  <li>Find the HMRC connection / MTD setup section</li>
  <li>Sign in with Government Gateway credentials</li>
  <li>Authorise the software to submit on your behalf</li>
  <li>Test the connection before 7 August 2026</li>
</ul>
<p>Source: <a href="https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax">GOV.UK — Sign up for Making Tax Digital for Income Tax</a></p>
`,
    },
    {
      num:   "04",
      slug:  "side-hustle-checker-04",
      name:  "Your Deadline Calendar",
      desc:  "Personalised MTD deadlines based on your income streams and mandate date.",
      tier:  1,
      content: `
<h2>Your 2026-27 MTD Calendar</h2>
<div class="action-box">
  <h3>Q1 — MOST URGENT</h3>
  <p>Period: 6 April – 30 June 2026 · <strong>Deadline: 7 August 2026</strong></p>
  <p>This covers your first quarter of digital records. Software must be set up and records kept from 6 April — not just from the deadline.</p>
</div>
<table>
  <tr><th>Obligation</th><th>Period</th><th>Deadline</th></tr>
  <tr><td><strong>Q1 submission</strong></td><td>6 Apr – 30 Jun 2026</td><td><strong>7 August 2026</strong></td></tr>
  <tr><td>Q2 submission</td><td>1 Jul – 30 Sep 2026</td><td>7 November 2026</td></tr>
  <tr><td>Q3 submission</td><td>1 Oct – 31 Dec 2026</td><td>7 February 2027</td></tr>
  <tr><td>Q4 submission</td><td>1 Jan – 31 Mar 2027</td><td>7 May 2027</td></tr>
  <tr><td>Final declaration</td><td>Full year 2026-27</td><td>31 January 2028</td></tr>
</table>
<h2>If You Have Multiple Income Streams</h2>
<div class="info-box">
  <strong>Self-employment only:</strong> One quarterly submission covering all self-employment income.<br><br>
  <strong>Self-employment + rental:</strong> One quarterly submission covering both — submitted together through your MTD software. HMRC receives a single submission with income categorised by type.
</div>
<h2>Add These to Your Calendar Now</h2>
<ul class="checklist">
  <li>7 August 2026 — Q1 MTD deadline (URGENT)</li>
  <li>7 November 2026 — Q2 MTD deadline</li>
  <li>7 February 2027 — Q3 MTD deadline</li>
  <li>7 May 2027 — Q4 MTD deadline</li>
  <li>31 January 2028 — Final declaration</li>
</ul>
`,
    },
    {
      num:   "05",
      slug:  "side-hustle-checker-05",
      name:  "Your Accountant Brief",
      desc:  "Print this and take it to your next meeting — includes the annualisation risk question.",
      tier:  1,
      content: `
<div class="info-box"><strong>How to use this brief:</strong> Print or forward to your accountant before your next meeting.</div>
<h2>Client MTD Scope Status</h2>
<table>
  <tr><th>Item</th><th>Detail</th></tr>
  <tr><td>Issue</td><td>MTD mandate — qualifying income classification</td></tr>
  <tr><td>2026 threshold</td><td>£50,000 qualifying income (gross)</td></tr>
  <tr><td>2027 threshold</td><td>£30,000 qualifying income (gross)</td></tr>
  <tr><td>First deadline</td><td><strong>7 August 2026</strong></td></tr>
  <tr><td>Qualifying income</td><td>Gross self-employment + gross UK rental (my share only)</td></tr>
</table>
<div class="action-box">
  <h3>Question 1</h3>
  <p>"What was my exact qualifying income in 2024-25 — gross turnover plus gross rental, my share only?"</p>
</div>
<h3>Question 2</h3>
<p>"Am I affected by the annualisation rule — if I only traded part of 2024-25, how does HMRC calculate my qualifying income?"</p>
<h3>Question 3</h3>
<p>"Does my Rent a Room income count or is it excluded from qualifying income?"</p>
<h3>Question 4</h3>
<p>"If my income is approaching £30,000, do I need to prepare for the 2027 MTD mandate now?"</p>
<h3>Question 5</h3>
<p>"Which MTD software is right for my income mix?"</p>
<h2>Action Items to Agree</h2>
<ul class="checklist">
  <li>Confirm exact qualifying income figure from 2024-25 return</li>
  <li>Confirm annualisation does not push me into scope unexpectedly</li>
  <li>Agree MTD software for my income type</li>
  <li>Agree who registers with HMRC and by when</li>
  <li>Confirm how quarterly submissions will be handled</li>
</ul>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">GOV.UK — Making Tax Digital for Income Tax</a> · Finance (No.2) Act 2024 · Last verified April 2026</p>
`,
    },
    {
      num:   "06",
      slug:  "side-hustle-checker-06",
      name:  "Your Multi-Income Strategy",
      desc:  "How streams combine, how to stay under thresholds, and when to accelerate vs delay income.",
      tier:  2,
      content: `
<h2>How Multiple Income Streams Combine</h2>
<p>Every qualifying income source adds to your total. This creates planning opportunities — and traps — that single-income taxpayers never encounter.</p>
<div class="action-box">
  <h3>The Key Rule</h3>
  <p>All qualifying income streams are added together before comparing to the threshold. You cannot choose which streams to include.</p>
</div>
<h2>Income Combination Scenarios</h2>
<table>
  <tr><th>Scenario</th><th>Qualifying Income</th><th>MTD Status 2026</th></tr>
  <tr><td>£40k freelance, no rental</td><td>£40,000</td><td>Not in scope (2027 watch)</td></tr>
  <tr><td>£30k freelance + £25k rental</td><td>£55,000</td><td>IN SCOPE 2026</td></tr>
  <tr><td>£60k PAYE + £20k freelance</td><td>£20,000</td><td>Not in scope (PAYE excluded)</td></tr>
  <tr><td>£25k freelance + £28k rental</td><td>£53,000</td><td>IN SCOPE 2026</td></tr>
</table>
<h2>Threshold Management Strategies</h2>
<h3>Timing income across tax years</h3>
<p>If qualifying income is approaching the threshold, delaying invoicing until after 5 April can shift it to the following tax year. This is legal tax planning — but requires careful cashflow management and agreement with clients.</p>
<h3>Joint property ownership</h3>
<p>If a rental property is jointly owned, only your share of gross receipts counts. Reviewing ownership structure with a solicitor may be appropriate if rental income is a significant contributor to qualifying income.</p>
<div class="warning-box"><strong>Important:</strong> These are planning strategies — not avoidance. Always discuss with a qualified tax adviser before making structural changes.</div>
<h2>The 2027 Threshold Trap</h2>
<div class="info-box">If your qualifying income is between £30,000 and £50,000, you are NOT in scope for 2026 — but you WILL be mandated from April 2027. Start preparing your digital records and software now. The first 2027 Q1 deadline is 7 August 2027.</div>
`,
    },
    {
      num:   "07",
      slug:  "side-hustle-checker-07",
      name:  "Annualisation Risk Model",
      desc:  "If you only traded part of the year — how HMRC calculates your qualifying income.",
      tier:  2,
      content: `
<h2>What Is the Annualisation Risk?</h2>
<p>If you only traded for part of the 2024-25 tax year, HMRC may annualise your income to check whether you cross the MTD threshold — even though your actual receipts were below £50,000.</p>
<div class="action-box">
  <h3>The Annualisation Calculation</h3>
  <p>Annualised income = (Actual gross receipts ÷ months traded) × 12</p>
  <p>Example: £30,000 gross in 6 months = £60,000 annualised = IN SCOPE 2026</p>
</div>
<h2>When Annualisation Applies</h2>
<table>
  <tr><th>Situation</th><th>Risk</th><th>Action</th></tr>
  <tr><td>Started trading mid-year</td><td>High — HMRC may annualise</td><td>Confirm with accountant</td></tr>
  <tr><td>Stopped trading mid-year</td><td>Medium — depends on circumstances</td><td>Confirm with accountant</td></tr>
  <tr><td>Traded full year</td><td>No annualisation risk</td><td>Use actual gross receipts</td></tr>
  <tr><td>Property let for part year</td><td>Medium — void periods may apply</td><td>Confirm with accountant</td></tr>
</table>
<h2>How to Check Your Position</h2>
<ol>
  <li>Identify how many months you traded in 2024-25</li>
  <li>Calculate your gross receipts for those months</li>
  <li>Divide by months traded × 12 = annualised figure</li>
  <li>If annualised figure exceeds £50,000 — you may be in scope</li>
  <li>Confirm with your accountant before assuming you are out of scope</li>
</ol>
<div class="warning-box"><strong>Do not assume you are safe:</strong> The annualisation rule catches many part-year traders who believe their low actual receipts mean no MTD obligation. Always verify.</div>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">GOV.UK — Making Tax Digital for Income Tax</a></p>
`,
    },
    {
      num:   "08",
      slug:  "side-hustle-checker-08",
      name:  "Your Software Recommendation and Implementation Checklist",
      desc:  "The right software for your income mix — and every step before 7 August 2026.",
      tier:  2,
      content: `
<h2>Software Recommendation by Income Type</h2>
<table>
  <tr><th>Income Type</th><th>Recommended Software</th><th>Why</th></tr>
  <tr><td>Self-employment only</td><td>FreeAgent (free with NatWest) or QuickBooks</td><td>Simple invoicing, receipt capture, quarterly submission</td></tr>
  <tr><td>Rental only</td><td>Xero or QuickBooks</td><td>Property income categorisation built in</td></tr>
  <tr><td>Self-employment + rental</td><td>Xero or QuickBooks</td><td>Handles multiple income streams in one submission</td></tr>
  <tr><td>Spreadsheet user</td><td>Excel + verified bridging software</td><td>Keeps familiar workflow with digital link to HMRC</td></tr>
</table>
<p>Full approved list: <a href="https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax">GOV.UK — Find MTD compatible software</a></p>
<h2>Implementation Checklist</h2>
<h3>Part 1 — Software (This Week)</h3>
<ul class="checklist">
  <li>Choose MTD-approved software based on your income type (table above)</li>
  <li>Sign up for free trial</li>
  <li>Connect bank account via bank feed</li>
  <li>Set up income categories matching your streams</li>
</ul>
<h3>Part 2 — Registration (Next Week)</h3>
<ul class="checklist">
  <li>Register for MTD at gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax</li>
  <li>Select all qualifying income sources during registration</li>
  <li>Connect software to HMRC via Government Gateway</li>
  <li>Test the connection — run a practice submission</li>
</ul>
<h3>Part 3 — Q1 Records (Before 7 August)</h3>
<ul class="checklist">
  <li>Enter or import all income from 6 April 2026 onwards</li>
  <li>Enter or import all allowable expenses</li>
  <li>Reconcile to bank statements as at 30 June 2026</li>
  <li>Submit Q1 to HMRC before 7 August 2026</li>
  <li>Save the submission confirmation and reference number</li>
</ul>
<div class="highlight"><strong>If you have both self-employment and rental income:</strong> Confirm your software handles both income types in a single submission. Some software requires separate configurations for each income stream.</div>
`,
    },
  ],

  // ── CALENDAR ──────────────────────────────────────────────────────────────────
  calendarTitle: "Side-Hustle MTD — Scope and Deadline Calendar",
  tier1Calendar: [
    { uid: "sh-confirm",  summary: "Side-Hustle MTD — Confirm qualifying income",   description: "Confirm exact qualifying income with accountant. Check annualisation risk if part-year trading.", date: "relative:+7days" },
    { uid: "sh-register", summary: "Side-Hustle MTD — Register with HMRC",          description: "Register at gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax before 7 August 2026.", date: "relative:+14days" },
    { uid: "sh-q1",       summary: "🔴 MTD Q1 Deadline — 7 August 2026",            description: "First MTD quarterly submission — 6 April to 30 June 2026.", date: "20260807" },
    { uid: "sh-final",    summary: "MTD Final Declaration — 31 January 2028",        description: "File MTD final declaration through your software. Replaces SA100.", date: "20280131" },
  ],
  tier2Calendar: [
    { uid: "sh-confirm",  summary: "Side-Hustle MTD — Confirm qualifying income",   description: "Confirm qualifying income. Check annualisation risk. Review multi-stream combination.", date: "relative:+7days" },
    { uid: "sh-software", summary: "Side-Hustle MTD — Set up software",             description: "Choose and set up MTD software for your income type. Connect bank feed.", date: "relative:+14days" },
    { uid: "sh-register", summary: "Side-Hustle MTD — Register with HMRC",          description: "Complete MTD registration. Select all qualifying income sources.", date: "relative:+21days" },
    { uid: "sh-q1",       summary: "🔴 MTD Q1 Deadline — 7 August 2026",            description: "First MTD quarterly submission — 6 April to 30 June 2026.", date: "20260807" },
    { uid: "sh-2027",     summary: "MTD 2027 Threshold — April 2027",               description: "£30,000 threshold comes into force. Review qualifying income for 2025-26 return.", date: "20270401" },
    { uid: "sh-final",    summary: "MTD Final Declaration — 31 January 2028",        description: "File MTD final declaration through your software.", date: "20280131" },
  ],

  // ── DELIVERY ──────────────────────────────────────────────────────────────────
  delivery: {
    tier1DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_SH_47",
    tier2DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_SH_97",
  },

  // ── MONITORING ────────────────────────────────────────────────────────────────
  monitorUrls: [
    "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
    "https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax",
    "https://www.gov.uk/guidance/tax-free-allowances-on-property-and-trading-income",
  ],

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────
  sidebarNumbers: [
    { label: "MTD threshold 2026", value: "£50,000" },
    { label: "MTD threshold 2027", value: "£30,000" },
    { label: "MTD threshold 2028", value: "£20,000" },
    { label: "First deadline",     value: "7 Aug 2026" },
  ],
  sidebarMathsTitle:    "Qualifying income includes",
  sidebarMathsIncludes: ["Gross self-employment turnover", "Gross UK rental receipts (your share)"],
  sidebarMathsExcludes: ["PAYE salary and wages", "Dividends", "Savings and bank interest", "Pension income", "Foreign rental income"],
  sidebarMathsNote:     "Source: GOV.UK — Making Tax Digital for Income Tax · Finance (No.2) Act 2024",

  // ── JSON-LD HOWTO STEPS ───────────────────────────────────────────────────────
  howToSteps: [
    { position: 1, name: "Identify your income streams",         text: "Select whether you have self-employment only, rental only, or both. Do not include PAYE salary — it is excluded from qualifying income." },
    { position: 2, name: "Enter your gross qualifying income",   text: "Enter gross self-employment turnover and gross rental receipts separately. Use your share only for jointly owned property. Do not deduct expenses — HMRC uses gross." },
    { position: 3, name: "Get your MTD scope verdict",           text: "See immediately whether you are in scope for 2026 (above £50,000), in scope for 2027 (£30,000–£50,000), or approaching the threshold." },
    { position: 4, name: "Get your personalised scope plan",    text: "Receive a personalised assessment confirming your qualifying income, your mandate date, your first deadline and your next steps." },
  ],

  // ── CLAUDE API ────────────────────────────────────────────────────────────────
  successPromptFields: [
    { key: "sh_income_type",        label: "Income type selected",          defaultVal: "side hustle + rental" },
    { key: "sh_self_employment",    label: "Gross self-employment income",   defaultVal: "40000" },
    { key: "sh_rental",             label: "Gross rental income",           defaultVal: "15000" },
    { key: "sh_jointly_owned",      label: "Jointly owned property",        defaultVal: "false" },
    { key: "sh_qualifying_income",  label: "Total qualifying income",       defaultVal: "55000" },
    { key: "sh_status",             label: "MTD scope status",              defaultVal: "in_scope_2026" },
    { key: "sh_answers",            label: "Questionnaire answers",         defaultVal: "{}" },
  ],

  tier1AssessmentFields: [
    "status", "qualifyingIncome", "mandateDate", "firstDeadline",
    "hiddenInsight", "riskFlags", "firstAction",
    "softwareRec", "accountantQuestions",
  ],

  tier2AssessmentFields: [
    "status", "qualifyingIncome", "mandateDate", "firstDeadline",
    "hiddenInsight", "riskFlags", "annualisationRisk",
    "streamBreakdown", "actions", "softwareRec", "softwareWhy",
    "weekPlan", "accountantQuestions",
  ],

};
