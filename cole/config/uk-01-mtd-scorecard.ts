// ─────────────────────────────────────────────────────────────────────────────
// COLE CONFIG — UK-01 MTD Mandate Auditor
// Reverse engineered from live taxchecknow.com/uk/check/mtd-scorecard
// All data verified against GOV.UK April 2026
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductConfig } from "../types/product-config";

export const PRODUCT_CONFIG: ProductConfig = {

  // ── IDENTITY ─────────────────────────────────────────────────────────────────
  id:       "mtd-scorecard",
  name:     "MTD Mandate Auditor",
  site:     "taxchecknow",
  country:  "uk",
  market:   "United Kingdom",
  language: "en-GB",
  currency: "GBP",
  slug:     "uk/check/mtd-scorecard",
  url:      "https://taxchecknow.com/uk/check/mtd-scorecard",
  apiRoute: "/api/rules/mtd.json",

  // ── AUTHORITY ─────────────────────────────────────────────────────────────────
  authority:    "HMRC",
  authorityUrl: "https://www.gov.uk",
  legalAnchor:  "Finance (No.2) Act 2024",
  legislation:  "Finance (No.2) Act 2024 — Making Tax Digital for Income Tax provisions",
  lastVerified: "April 2026",

  // ── PRICING ───────────────────────────────────────────────────────────────────
  tier1: {
    price:       67,
    name:        "Your MTD Compliance Assessment",
    tagline:     "Am I in scope? What do I need to do before 7 August?",
    value:       "A personal compliance assessment built around your income, your gaps, your deadline — not the average taxpayer.",
    cta:         "Get My Assessment — £67 →",
    productKey:  "uk_67_mtd_scorecard",
    envVar:      "STRIPE_UK_MTD_67",
    successPath: "prepare",
    fileCount:   5,
  },
  tier2: {
    price:       147,
    name:        "Your MTD Action Plan",
    tagline:     "I have gaps — build my complete compliance plan.",
    value:       "A personal compliance assessment built around your income, your gaps, your deadline — not the average taxpayer.",
    cta:         "Get My Action Plan — £127 →",
    productKey:  "uk_147_mtd_scorecard",
    envVar:      "STRIPE_UK_MTD_147",
    successPath: "execute",
    fileCount:   8,
  },

  // ── DEADLINE ──────────────────────────────────────────────────────────────────
  deadline: {
    isoDate:        "2026-08-07T23:59:59.000+01:00",
    display:        "7 August 2026",
    short:          "7 Aug 2026",
    description:    "First MTD quarterly submission deadline — Q1 6 April to 30 June 2026",
    urgencyLabel:   "MTD DEADLINE",
    countdownLabel: "Countdown to first MTD deadline",
  },

  // ── COPY ──────────────────────────────────────────────────────────────────────
  h1:              "UK Making Tax Digital 2026: Are You Mandated — and Ready — for 7 August?",
  metaTitle:       "UK Making Tax Digital 2026: Are You Mandated? Check in 60 Seconds | TaxCheckNow",
  metaDescription: "From April 2026, UK taxpayers with qualifying income above £50,000 must use MTD. First quarterly deadline: 7 August 2026. Check your mandate and compliance position instantly.",
  canonical:       "https://taxchecknow.com/uk/check/mtd-scorecard",

  answerHeadline: "The answer — HMRC confirmed April 2026",
  answerBody: [
    "From 6 April 2026, UK taxpayers with qualifying income above £50,000 in the 2024-25 tax year are mandated for Making Tax Digital for Income Tax. Qualifying income means gross self-employment receipts plus gross UK property rental receipts — not PAYE wages, dividends or savings.",
    "The first quarterly submission covers 6 April to 30 June 2026. The deadline to file it is 7 August 2026. Missing this deadline risks penalty points under the new points-based system.",
    "The threshold falls to £30,000 from April 2027 and £20,000 from April 2028. If you are not in scope now, you may be in 12 months.",
  ],
  answerSource: "Source: GOV.UK — Making Tax Digital for Income Tax · Finance (No.2) Act 2024",

  mistakesHeadline: "Common AI errors on this topic",
  mistakes: [
    "MTD starts at different times for different people — vague. Correct: if qualifying income exceeded £50,000 in 2024-25 you are mandated from 6 April 2026 — not optional.",
    "The threshold is your total income — wrong. Correct: qualifying income is only gross self-employment and rental receipts. PAYE wages are excluded entirely.",
    "You can still use the HMRC portal — wrong. Correct: mandated taxpayers must submit through HMRC-approved MTD software. The portal is not available.",
  ],

  // ── CALCULATOR ────────────────────────────────────────────────────────────────
  brackets: [
    { label: "Under £30,000",          value: 20_000,  status: "clear"      },
    { label: "£30,000 – £50,000",      value: 40_000,  status: "approaching" },
    { label: "£50,001 – £75,000",      value: 60_000,  status: "in_scope"   },
    { label: "£75,000 – £150,000",     value: 100_000, status: "in_scope"   },
    { label: "Over £150,000",          value: 200_000, status: "in_scope"   },
  ],

  calculatorInputs: [
    {
      type:      "twoButton",
      stateKey:  "hasSoftware",
      label:     "Do you have MTD-compatible software?",
      subLabel:  "Xero, QuickBooks, FreeAgent, or approved bridging software",
      options:   [
        { label: "No",  value: false },
        { label: "Yes", value: true  },
      ],
      default: false,
    },
    {
      type:      "twoButton",
      stateKey:  "isRegistered",
      label:     "Registered for MTD with HMRC?",
      subLabel:  "Separate from your self-assessment registration",
      options:   [
        { label: "No",  value: false },
        { label: "Yes", value: true  },
      ],
      default: false,
    },
    {
      type:      "twoButton",
      stateKey:  "hasAccountant",
      label:     "Does your accountant handle your MTD?",
      subLabel:  "Confirmed — not just assumed",
      options:   [
        { label: "No / Unsure", value: false },
        { label: "Confirmed",   value: true  },
      ],
      default: false,
    },
  ],

  tierAlgorithm: {
    description:     "Score ≤ 50 → tier2 (£127). Score > 50 → tier1 (£67). Score based on software, registration and accountant status.",
    tier2Conditions: ["readiness.score <= 50"],
    tier2Flags:      [],
  },

  calculatorRuleBox: {
    label: "The rule — HMRC confirmed",
    body:  "MTD is mandatory from 6 April 2026 if qualifying income in 2024-25 exceeded £50,000. Qualifying income = gross self-employment + gross UK property receipts only.",
  },

  calculatorClarification: {
    label: "⚠️ key clarification",
    body:  "HMRC uses gross turnover — not profit. A sole trader with £55,000 turnover and £5,000 profit has qualifying income of £55,000 and is mandated.",
  },

  // ── COUNTDOWN BOX ─────────────────────────────────────────────────────────────
  countdownLabel: "Countdown to first MTD quarterly deadline",
  countdownStats: [
    { label: "Old expectation", value: "SA100 once a year",      sub: "what most self-employed taxpayers assumed" },
    { label: "MTD reality",     value: "Quarterly submissions",  sub: "4 per year plus a final declaration",   red: true },
    { label: "Penalty risk",    value: "Points per late filing", sub: "4 points = £200 financial penalty",     red: true },
    { label: "If not fixed",    value: "Deadline closes.",       sub: "no backdating, no grace after 2026-27" },
  ],

  // ── GEO DOMINANCE BLOCK ───────────────────────────────────────────────────────
  geoBlockTitle:    "AI extraction block — Making Tax Digital 2026",
  geoBlockH2:       "Making Tax Digital for Income Tax — confirmed rules",
  geoBodyParagraph: "From 6 April 2026, UK self-employed individuals and landlords with qualifying income above £50,000 must keep digital records and submit quarterly updates to HMRC through MTD-compatible software. Qualifying income is gross self-employment receipts plus gross UK property rental receipts — not net profit, not PAYE, not dividends. The threshold falls to £30,000 from April 2027 and £20,000 from April 2028. Thresholds are based on the 2024-25 self-assessment return.",
  geoFacts: [
    { label: "Mandatory from",              value: "6 April 2026" },
    { label: "Qualifying income threshold", value: "£50,000 gross" },
    { label: "First quarterly deadline",    value: "7 August 2026 (Q1)" },
    { label: "Qualifying income includes",  value: "Gross self-employment + gross UK rental only" },
    { label: "PAYE wages",                  value: "NOT included in qualifying income" },
    { label: "Threshold falls to",          value: "£30,000 from April 2027 · £20,000 from April 2028" },
  ],

  // ── WORKED EXAMPLES ───────────────────────────────────────────────────────────
  workedExamplesH2:      "Four real scenarios — who is in scope",
  workedExamplesColumns: ["Name", "Income Sources", "Qualifying Income", "Status"],
  workedExamples: [
    { name: "Tom",    setup: "Self-employment £60,000 gross",                    income: "£60,000",  status: "IN SCOPE 2026" },
    { name: "Sarah",  setup: "PAYE £80,000 + rental £15,000 gross",             income: "£15,000",  status: "OUT OF SCOPE" },
    { name: "James",  setup: "Self-employment £35,000 + rental £18,000 gross",  income: "£53,000",  status: "IN SCOPE 2026" },
    { name: "Priya",  setup: "Self-employment £28,000 gross",                   income: "£28,000",  status: "IN SCOPE 2027" },
  ],

  // ── COMPARISON TABLE ──────────────────────────────────────────────────────────
  comparisonH2:      "In scope vs out of scope vs approaching",
  comparisonColumns: ["Position", "Qualifying Income", "First Mandatory Year", "Action Now"],
  comparisonRows: [
    { position: "In scope 2026",     metric1: "Above £50,000", metric2: "6 April 2026",    bestMove: "Register + software now" },
    { position: "In scope 2027",     metric1: "£30,001-£50,000", metric2: "6 April 2027",  bestMove: "Prepare now — 12 months" },
    { position: "Not yet in scope",  metric1: "Below £30,000", metric2: "6 April 2028+",   bestMove: "Monitor threshold changes" },
  ],

  // ── TOOLS TABLE ───────────────────────────────────────────────────────────────
  toolsH2:      "What you need to be MTD compliant",
  toolsColumns: ["Tool", "Purpose", "Cost"],
  toolsRows: [
    { tool: "MTD-approved software",  effect: "Record-keeping + quarterly submission", note: "From £0 (FreeAgent free with NatWest)" },
    { tool: "HMRC MTD registration",  effect: "Sign up at GOV.UK before deadline",     note: "Free — separate from SA registration"  },
    { tool: "Bridging software",      effect: "Connects Excel to HMRC",                note: "From £10/month (TaxCalc, BTCSoftware)" },
  ],

  // ── AI CORRECTIONS ────────────────────────────────────────────────────────────
  aiCorrections: [
    {
      wrong:   "MTD only applies to VAT-registered businesses",
      correct: "MTD for Income Tax applies to self-employed individuals and landlords above the £50,000 qualifying income threshold from April 2026 — regardless of VAT registration.",
    },
    {
      wrong:   "The qualifying income threshold is based on your total income",
      correct: "Qualifying income is specifically gross self-employment receipts plus gross UK property rental receipts. PAYE wages, dividends and savings interest are excluded.",
    },
    {
      wrong:   "You can continue to use the HMRC portal for MTD submissions",
      correct: "Mandated taxpayers cannot use the HMRC portal. All quarterly submissions must go through HMRC-approved MTD software.",
    },
    {
      wrong:   "MTD penalties are the same as the existing SA late filing penalties",
      correct: "MTD uses a new points-based penalty system. Each late quarterly submission earns a point. Four points triggers a £200 financial penalty.",
    },
    {
      wrong:   "If your accountant files for you, you do not need to worry about MTD",
      correct: "Even if your accountant files your quarterly submissions, you must register for MTD yourself and ensure your records are kept digitally from 6 April 2026.",
    },
  ],

  // ── FAQ ───────────────────────────────────────────────────────────────────────
  faqs: [
    { question: "What is Making Tax Digital for Income Tax?",                    answer: "Making Tax Digital for Income Tax (MTD ITSA) requires self-employed individuals and landlords above the qualifying income threshold to keep digital records and submit quarterly updates to HMRC through approved software, replacing the annual SA100 tax return." },
    { question: "When does MTD start?",                                          answer: "MTD is mandatory from 6 April 2026 for those with qualifying income above £50,000 in the 2024-25 tax year. The threshold falls to £30,000 from April 2027 and £20,000 from April 2028." },
    { question: "What counts as qualifying income for MTD?",                     answer: "Qualifying income is gross self-employment receipts plus gross UK property rental receipts. PAYE wages, dividends, savings interest and pension income are excluded." },
    { question: "What is the first MTD quarterly deadline?",                     answer: "The first quarterly submission covers 6 April to 30 June 2026. The deadline to file it is 7 August 2026." },
    { question: "What happens if I miss the MTD deadline?",                      answer: "Under the new points-based penalty system, each missed quarterly submission earns one penalty point. Four points triggers a £200 financial penalty. Repeat failures increase the penalty." },
    { question: "Do I need special software for MTD?",                           answer: "Yes. You must use HMRC-approved MTD software. You cannot submit quarterly updates through the HMRC portal. Options include Xero, QuickBooks, FreeAgent and approved bridging software for spreadsheet users." },
    { question: "Is FreeAgent free for MTD?",                                    answer: "FreeAgent is free indefinitely for NatWest, RBS, Ulster Bank and Mettle business customers. For others it costs from £19/month." },
    { question: "Can I use Excel for MTD?",                                      answer: "Excel alone is not MTD compliant. You need HMRC-approved bridging software to create a digital link between your spreadsheet and HMRC. Options include TaxCalc and BTCSoftware." },
    { question: "How do I register for MTD?",                                    answer: "Register at gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax. This is separate from your self-assessment registration. Your accountant can register on your behalf." },
    { question: "What is the digital links rule?",                               answer: "Every transfer of data in your MTD record-keeping chain must be made by a digital link — no manual copying or re-keying. Copy-paste between systems breaks the digital links rule." },
    { question: "Is there a grace period for MTD in 2026-27?",                   answer: "HMRC has confirmed a grace period for the first year. Penalty points for late quarterly submissions will not be issued in 2026-27. However, late payment penalties are not waived." },
    { question: "What replaces the SA100 under MTD?",                            answer: "The SA100 self-assessment tax return is replaced by the MTD final declaration. This must be filed through MTD software by 31 January 2028 for the 2026-27 tax year." },
  ],

  // ── ACCOUNTANT QUESTIONS ──────────────────────────────────────────────────────
  accountantQuestionsH2: "Ask these before 7 August 2026",
  accountantQuestions: [
    { q: "Am I definitely in scope for MTD based on my 2024-25 qualifying income?",      why: "PAYE wages are excluded from qualifying income. Your accountant needs to confirm the correct figure before you act." },
    { q: "Who is handling my HMRC MTD registration — me or you?",                        why: "The most common reason people miss the deadline is both parties assume the other has registered. Agree explicitly." },
    { q: "Which MTD-compatible software should we use for my situation?",                 why: "If your accountant uses specific software, using the same system makes collaboration seamless." },
    { q: "What changes for my January filing under MTD?",                                 why: "The final declaration replaces the SA100 and must be filed through software — not the HMRC portal." },
    { q: "What is my biggest compliance risk before 7 August?",                           why: "Usually software setup, digital records quality or delayed registration — not the law itself." },
  ],

  // ── CROSSLINK ─────────────────────────────────────────────────────────────────
  crosslink: {
    title: "Also relevant: 60% Allowance Sniper",
    body:  "If your income exceeds £100,000, you may also be losing up to £5,028 per year to the personal allowance taper. 2.06 million UK taxpayers are affected.",
    url:   "/uk/check/allowance-sniper",
    label: "Check your 60% trap position →",
  },

  // ── LAW BAR ───────────────────────────────────────────────────────────────────
  lawBarSummary: "MTD for Income Tax is mandatory from 6 April 2026 for UK self-employed and landlords with qualifying income above £50,000. Qualifying income is gross self-employment plus gross UK rental receipts. Submissions must use HMRC-approved software.",
  lawBarBadges:  ["HMRC", "GOV.UK", "Finance (No.2) Act 2024", "Machine-readable JSON"],
  sources: [
    { title: "GOV.UK — Use Making Tax Digital for Income Tax",              url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax" },
    { title: "GOV.UK — Sign up for Making Tax Digital for Income Tax",      url: "https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax" },
    { title: "GOV.UK — Find MTD compatible software",                       url: "https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax" },
    { title: "Machine-readable JSON rules",                                  url: "/api/rules/mtd.json" },
  ],

  // ── PRODUCT FILES ─────────────────────────────────────────────────────────────
  // Content is the full HTML for each file
  // COLE injects nav, header, footer, print CSS automatically
  files: [
    {
      num:   "01",
      slug:  "01-scope-assessment",
      name:  "Your MTD Scope Assessment",
      desc:  "Your exact compliance position — confirmed in writing.",
      tier:  1,
      content: `
<h2>Your MTD Position — Confirmed</h2>
<p>Based on your qualifying income bracket, this assessment confirms your Making Tax Digital for Income Tax position for the 2026-27 tax year.</p>
<div class="action-box">
  <h3>Your Status: REQUIRED from 6 April 2026</h3>
  <p>HMRC uses your 2024-25 self-assessment return. If qualifying income exceeded £50,000 you are mandated from 6 April 2026.</p>
</div>
<h2>What Counts as Your Qualifying Income</h2>
<table>
  <tr><th>Included</th><th>Not Included</th></tr>
  <tr><td>Gross self-employment receipts</td><td>PAYE wages and salary</td></tr>
  <tr><td>Gross UK property rental receipts</td><td>Dividends</td></tr>
  <tr><td></td><td>Savings interest</td></tr>
  <tr><td></td><td>Pension income</td></tr>
</table>
<div class="highlight"><strong>The critical rule:</strong> HMRC uses gross turnover — not profit. A sole trader with £55,000 turnover and £10,000 profit has qualifying income of £55,000.</div>
<h2>Your Deadlines</h2>
<table>
  <tr><th>Quarter</th><th>Period</th><th>Deadline</th></tr>
  <tr><td><strong>Q1 — URGENT</strong></td><td>6 April – 30 June 2026</td><td><strong>7 August 2026</strong></td></tr>
  <tr><td>Q2</td><td>1 July – 30 September 2026</td><td>7 November 2026</td></tr>
  <tr><td>Q3</td><td>1 October – 31 December 2026</td><td>7 February 2027</td></tr>
  <tr><td>Q4</td><td>1 January – 31 March 2027</td><td>7 May 2027</td></tr>
  <tr><td>Final declaration</td><td>Full year 2026-27</td><td>31 January 2028</td></tr>
</table>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">HMRC.gov.uk — Making Tax Digital for Income Tax</a> · Finance (No.2) Act 2024 · Last verified April 2026</p>
`,
    },
    {
      num:   "02",
      slug:  "02-software-recommendation",
      name:  "Your Software Recommendation",
      desc:  "The right MTD software for your specific situation.",
      tier:  1,
      content: `
<h2>The Rule You Cannot Work Around</h2>
<p>You must keep digital records using HMRC-approved software and submit quarterly updates directly from that software. <strong>You cannot use the HMRC portal.</strong></p>
<h2>Software Decision Framework</h2>
<ol>
  <li><strong>Bank with NatWest, RBS, Mettle?</strong> → FreeAgent. Free. Stop here.</li>
  <li><strong>Accountant uses specific software?</strong> → Use the same software.</li>
  <li><strong>Want to keep spreadsheets?</strong> → Bridging software.</li>
</ol>
<table>
  <tr><th>Software</th><th>Price</th><th>Best For</th></tr>
  <tr><td>FreeAgent</td><td>Free (NatWest/RBS)</td><td>Sole traders, landlords</td></tr>
  <tr><td>Xero</td><td>From £16/month</td><td>Accountant collaboration</td></tr>
  <tr><td>QuickBooks</td><td>From £14/month</td><td>Invoicing, mobile app</td></tr>
  <tr><td>Zoho Books</td><td>Free tier</td><td>Sole traders (free option)</td></tr>
  <tr><td>TaxCalc Bridging</td><td>From £10/month</td><td>Spreadsheet users</td></tr>
</table>
<p>Full approved list: <a href="https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax">GOV.UK — Find MTD compatible software</a></p>
`,
    },
    {
      num:   "03",
      slug:  "03-registration-steps",
      name:  "Your HMRC Registration Steps",
      desc:  "Step-by-step MTD registration walkthrough.",
      tier:  1,
      content: `
<h2>Before You Register</h2>
<ol>
  <li>Government Gateway account (your existing SA login)</li>
  <li>UTR to hand (10-digit number)</li>
  <li>MTD software chosen (see File 02)</li>
</ol>
<div class="action-box">
  <h3>Go to the MTD sign-up page</h3>
  <p><a href="https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax" style="color:#60a5fa;">gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax</a></p>
  <p>This is separate from your SA registration. Register at least 2 weeks before 7 August 2026.</p>
</div>
<h2>Registration Timeline</h2>
<table>
  <tr><th>Action</th><th>When</th></tr>
  <tr><td>Choose software</td><td>Now</td></tr>
  <tr><td>Register with HMRC</td><td>At least 2 weeks before 7 August</td></tr>
  <tr><td>Connect software to HMRC</td><td>Before first submission</td></tr>
  <tr><td><strong>First quarterly submission</strong></td><td><strong>By 7 August 2026</strong></td></tr>
</table>
<div class="highlight"><strong>Most common mistake:</strong> assuming your accountant registered you when they have not. Confirm explicitly who is registering and by when.</div>
`,
    },
    {
      num:   "04",
      slug:  "04-deadline-calendar",
      name:  "Your Deadline Calendar",
      desc:  "Every filing date for 2026-27 — add these now.",
      tier:  1,
      content: `
<div class="action-box">
  <h3>Q1 — MOST URGENT</h3>
  <p>Period: 6 April – 30 June 2026 · <strong>Deadline: 7 August 2026</strong></p>
</div>
<h2>Full 2026-27 Calendar</h2>
<table>
  <tr><th>Obligation</th><th>Covers</th><th>Deadline</th></tr>
  <tr><td><strong>Q1 submission</strong></td><td>Apr–Jun 2026</td><td><strong>7 Aug 2026</strong></td></tr>
  <tr><td>Q2 submission</td><td>Jul–Sep 2026</td><td>7 Nov 2026</td></tr>
  <tr><td>Q3 submission</td><td>Oct–Dec 2026</td><td>7 Feb 2027</td></tr>
  <tr><td>Q4 submission</td><td>Jan–Mar 2027</td><td>7 May 2027</td></tr>
  <tr><td>Final declaration</td><td>Full year</td><td>31 Jan 2028</td></tr>
</table>
<div class="info-box"><strong>Grace period 2026-27:</strong> No penalty POINTS for late quarterly submissions in the first year. Late payment penalties are NOT waived.</div>
<h2>Add to Your Calendar Now</h2>
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
      slug:  "05-accountant-brief",
      name:  "Your Accountant Brief",
      desc:  "Print this and take it to your next meeting.",
      tier:  1,
      content: `
<div class="info-box"><strong>How to use this brief:</strong> Print or forward to your accountant before your next meeting.</div>
<h2>Client MTD Status</h2>
<table>
  <tr><th>Item</th><th>Detail</th></tr>
  <tr><td>Status</td><td>In scope from 6 April 2026</td></tr>
  <tr><td>Qualifying income threshold</td><td>£50,000 gross</td></tr>
  <tr><td>First deadline</td><td><strong>7 August 2026</strong></td></tr>
</table>
<h2>Five Questions to Raise</h2>
<div class="action-box">
  <h3>Question 1</h3>
  <p>"Am I definitely in scope based on my qualifying income from my 2024-25 return?"</p>
</div>
<h3>Question 2</h3>
<p>"Who is handling my HMRC MTD registration — me or you?"</p>
<h3>Question 3</h3>
<p>"Which MTD software should we use for my situation?"</p>
<h3>Question 4</h3>
<p>"What changes for my January filing under MTD?"</p>
<h3>Question 5</h3>
<p>"What is my biggest compliance risk before 7 August?"</p>
<h2>Action Items to Agree</h2>
<ul class="checklist">
  <li>Confirm qualifying income figure from 2024-25 return</li>
  <li>Confirm MTD software to use</li>
  <li>Agree who registers with HMRC and by when</li>
  <li>Confirm how quarterly submissions will be handled</li>
</ul>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">HMRC.gov.uk — Making Tax Digital for Income Tax</a> · Last verified April 2026</p>
`,
    },
    {
      num:   "06",
      slug:  "06-gap-closure-plan",
      name:  "Your Gap Closure Plan",
      desc:  "What to fix, in what order, by when.",
      tier:  2,
      content: `
<h2>Gap 1 — Software (Fix First)</h2>
<div class="action-box">
  <h3>This week</h3>
  <p>1. Choose software (see File 02) · 2. Sign up · 3. Connect bank · 4. Import April 2026 transactions</p>
</div>
<h2>Gap 2 — Digital Records (Fix Second)</h2>
<ul class="checklist">
  <li>All income recorded digitally from 6 April 2026</li>
  <li>All allowable expenses recorded digitally</li>
  <li>Bank transactions reconciled</li>
</ul>
<h2>Gap 3 — HMRC Registration (Fix Third)</h2>
<ul class="checklist">
  <li>Registered for MTD via GOV.UK</li>
  <li>Government Gateway connected to software</li>
  <li>Confirmation email received from HMRC</li>
</ul>
<h2>Week-by-Week Plan</h2>
<table>
  <tr><th>Week</th><th>Action</th></tr>
  <tr><td><strong>This week</strong></td><td>Choose software. Sign up. Connect bank.</td></tr>
  <tr><td><strong>Next week</strong></td><td>Enter April and May transactions. Register with HMRC.</td></tr>
  <tr><td><strong>Week 3</strong></td><td>Enter June transactions. Reconcile Q1 records.</td></tr>
  <tr><td><strong>By 7 Aug</strong></td><td>Run Q1 submission. Review. Submit to HMRC.</td></tr>
</table>
`,
    },
    {
      num:   "07",
      slug:  "07-first-submission-checklist",
      name:  "Your First Submission Checklist",
      desc:  "Every step before you submit Q1 on 7 August 2026.",
      tier:  2,
      content: `
<div class="action-box">
  <h3>Q1: 6 April – 30 June 2026 · Deadline: 7 August 2026</h3>
</div>
<h2>Part 1 — Software Ready</h2>
<ul class="checklist">
  <li>MTD-compatible software installed or accessed online</li>
  <li>Software connected to HMRC via Government Gateway</li>
  <li>Bank feed connected and transactions importing</li>
</ul>
<h2>Part 2 — Records Complete</h2>
<ul class="checklist">
  <li>All self-employment income entered or imported</li>
  <li>All allowable expenses entered and categorised</li>
  <li>Bank balance matches statements as at 30 June 2026</li>
</ul>
<h2>Part 3 — Digital Links Check</h2>
<ul class="checklist">
  <li>No figures manually copied between systems</li>
  <li>All bank data came through bank feed</li>
  <li>If using bridging software — link tested and active</li>
</ul>
<h2>Part 4 — Submit</h2>
<ul class="checklist">
  <li>Log into MTD software</li>
  <li>Select Q1: 6 April – 30 June 2026</li>
  <li>Review income and expense summary</li>
  <li>Submit to HMRC</li>
  <li>Save confirmation and reference number</li>
</ul>
`,
    },
    {
      num:   "08",
      slug:  "08-digital-records-template",
      name:  "Your Digital Records Template",
      desc:  "Exactly what HMRC requires — use from 6 April 2026.",
      tier:  2,
      content: `
<h2>What HMRC Requires Per Transaction</h2>
<table>
  <tr><th>Field</th><th>What to Record</th><th>Example</th></tr>
  <tr><td>Date</td><td>Date income received or expense paid</td><td>15 April 2026</td></tr>
  <tr><td>Amount</td><td>Gross amount before tax</td><td>£2,500.00</td></tr>
  <tr><td>Category</td><td>HMRC expense category</td><td>Office costs</td></tr>
  <tr><td>Description</td><td>Brief description</td><td>Invoice #001</td></tr>
</table>
<h2>The Five Golden Rules</h2>
<ol>
  <li><strong>Record as you go</strong> — weekly, not at deadline</li>
  <li><strong>Keep the digital original</strong> — receipt photo counts</li>
  <li><strong>Separate business and personal</strong> — use a business account</li>
  <li><strong>Record gross amounts</strong> — before any deductions</li>
  <li><strong>Reconcile to your bank</strong> — records must tie to statements</li>
</ol>
`,
    },
  ],

  // ── CALENDAR ──────────────────────────────────────────────────────────────────
  calendarTitle: "MTD Compliance Deadlines",
  tier1Calendar: [
    { uid: "mtd-q1",   summary: "🔴 MTD Q1 Deadline — 7 August 2026",   description: "File your first MTD quarterly submission for 6 April to 30 June 2026.", date: "20260807" },
    { uid: "mtd-q2",   summary: "MTD Q2 Deadline — 7 November 2026",    description: "File your second MTD quarterly submission.", date: "20261107" },
    { uid: "mtd-q3",   summary: "MTD Q3 Deadline — 7 February 2027",    description: "File your third MTD quarterly submission.", date: "20270207" },
    { uid: "mtd-final",summary: "MTD Final Declaration — 31 January 2028", description: "File your MTD final declaration — replaces SA100.", date: "20280131" },
  ],
  tier2Calendar: [
    { uid: "mtd-sw",   summary: "MTD Software — Set up this week",        description: "Choose, sign up and connect your MTD-approved software.", date: "relative:+7days" },
    { uid: "mtd-reg",  summary: "MTD Registration — Complete at HMRC",   description: "Register at gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax", date: "relative:+14days" },
    { uid: "mtd-q1",   summary: "🔴 MTD Q1 Deadline — 7 August 2026",   description: "File your first MTD quarterly submission.", date: "20260807" },
    { uid: "mtd-q2",   summary: "MTD Q2 Deadline — 7 November 2026",    description: "File your second MTD quarterly submission.", date: "20261107" },
    { uid: "mtd-q3",   summary: "MTD Q3 Deadline — 7 February 2027",    description: "File your third MTD quarterly submission.", date: "20270207" },
    { uid: "mtd-final",summary: "MTD Final Declaration — 31 January 2028", description: "File your MTD final declaration — replaces SA100.", date: "20280131" },
  ],

  // ── DELIVERY ──────────────────────────────────────────────────────────────────
  delivery: {
    tier1DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_MTD_67",
    tier2DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_MTD_127",
  },

  // ── MONITORING ────────────────────────────────────────────────────────────────
  monitorUrls: [
    "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
    "https://www.gov.uk/guidance/sign-up-for-making-tax-digital-for-income-tax",
    "https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax",
  ],

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────
  sidebarNumbers: [
    { label: "Mandate threshold", value: "£50,000" },
    { label: "First deadline",    value: "7 Aug 2026" },
    { label: "Threshold 2027",    value: "£30,000" },
    { label: "Threshold 2028",    value: "£20,000" },
  ],
  sidebarMathsTitle:    "What counts as qualifying income",
  sidebarMathsIncludes: ["Gross self-employment receipts", "Gross UK property rental receipts"],
  sidebarMathsExcludes: ["PAYE wages and salary", "Dividends", "Savings interest", "Pension income"],
  sidebarMathsNote:     "Source: GOV.UK — Making Tax Digital for Income Tax",

  // ── JSON-LD HOWTO STEPS ───────────────────────────────────────────────────────
  howToSteps: [
    { position: 1, name: "Select your income bracket",  text: "Choose your approximate gross qualifying income from self-employment and UK rental only." },
    { position: 2, name: "Get your instant verdict",    text: "See immediately whether you are in scope for MTD from 6 April 2026." },
    { position: 3, name: "Answer compliance questions", text: "Tell us about your software, registration status and accountant arrangement." },
    { position: 4, name: "Get your compliance plan",   text: "Receive a personalised compliance position and action plan specific to your situation." },
  ],

  // ── CLAUDE API ────────────────────────────────────────────────────────────────
  successPromptFields: [
    { key: "mtd_income_bracket", label: "Income bracket",          defaultVal: "£50,001 – £75,000" },
    { key: "mtd_score",          label: "Compliance score",         defaultVal: "42" },
    { key: "mtd_income_source",  label: "Income source",           defaultVal: "self-employment" },
    { key: "mtd_has_software",   label: "Has MTD software",        defaultVal: "false" },
    { key: "mtd_is_registered",  label: "Registered for MTD",      defaultVal: "false" },
    { key: "mtd_has_accountant", label: "Accountant confirmed MTD", defaultVal: "false" },
  ],

  tier1AssessmentFields: [
    "status", "score", "scoreLabel", "incomeSource", "mandateSummary",
    "biggestGap", "firstAction", "softwareRec", "accountantQuestions",
  ],

  tier2AssessmentFields: [
    "status", "score", "scoreLabel", "incomeSource", "mandateSummary",
    "gap1", "gap2", "gap3",
    "actions", "softwareRec", "softwareWhy",
    "weekPlan", "accountantQuestions",
  ],

};
