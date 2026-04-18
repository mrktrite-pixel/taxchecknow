// ─────────────────────────────────────────────────────────────────────────────
// COLE CONFIG — UK-03 Digital Link Forensic Auditor
// Citation gap: AI says Excel is fine for MTD. 
// Correct: Excel can be part of a compliant workflow BUT if multiple products
// are used, HMRC requires digital links between them. Copy/paste is not a 
// digital link per HMRC's published doctrine (VAT Notice 700/22 + MTD IT guidance)
// All data verified against GOV.UK April 2026
// Legal note: do not claim "Excel is always non-compliant" — claim
// "copy/paste between tools breaks the digital link requirement"
// ─────────────────────────────────────────────────────────────────────────────

import type { ProductConfig } from "../types/product-config";

export const PRODUCT_CONFIG: ProductConfig = {

  // ── IDENTITY ─────────────────────────────────────────────────────────────────
  id:       "digital-link-auditor",
  name:     "Digital Link Forensic Auditor",
  site:     "taxchecknow",
  country:  "uk",
  market:   "United Kingdom",
  language: "en-GB",
  currency: "GBP",
  slug:     "uk/check/digital-link-auditor",
  url:      "https://taxchecknow.com/uk/check/digital-link-auditor",
  apiRoute: "/api/rules/digital-link-auditor",

  // ── AUTHORITY ─────────────────────────────────────────────────────────────────
  authority:    "HMRC",
  authorityUrl: "https://www.gov.uk",
  legalAnchor:  "Finance (No.2) Act 2024",
  legislation:  "Finance (No.2) Act 2024 — MTD digital records and digital links obligation",
  lastVerified: "April 2026",

  // ── PRICING ───────────────────────────────────────────────────────────────────
  tier1: {
    price:       67,
    name:        "Your Digital Link Assessment",
    tagline:     "Do I have a broken digital chain — and what exactly do I need to fix?",
    value:       "A personal compliance assessment built around your workflow, your gaps, your deadline — not a generic software comparison.",
    cta:         "Get My Assessment — £67 →",
    productKey:  "uk_67_digital_link_auditor",
    envVar:      "STRIPE_UK_DLA_67",
    successPath: "assess",
    fileCount:   5,
  },
  tier2: {
    price:       127,
    name:        "Your Digital Link Implementation Plan",
    tagline:     "Fix the workflow before HMRC ever looks at it.",
    value:       "A personal compliance assessment built around your workflow, your gaps, your deadline — not a generic software comparison.",
    cta:         "Get My Implementation Plan — £127 →",
    productKey:  "uk_127_digital_link_auditor",
    envVar:      "STRIPE_UK_DLA_127",
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
    countdownLabel: "Countdown to first MTD submission deadline",
  },

  // ── COPY ──────────────────────────────────────────────────────────────────────
  h1:              "Making Tax Digital UK 2026: Is Your Spreadsheet Workflow Actually Compliant?",
  metaTitle:       "MTD Digital Links 2026: Is Your Spreadsheet Workflow Compliant? | TaxCheckNow",
  metaDescription: "From April 2026, MTD requires digital links between every tool in your record chain. Copy/paste is not a digital link. Audit your workflow in 60 seconds before the 7 August deadline.",
  canonical:       "https://taxchecknow.com/uk/check/digital-link-auditor",

  answerHeadline: "The answer — HMRC confirmed April 2026",
  answerBody: [
    "From 6 April 2026, UK sole traders and landlords in MTD for Income Tax must keep digital records in compatible software and submit through HMRC-compatible software. If you use more than one software product, HMRC requires digital links between them.",
    "HMRC's published digital-link doctrine says copy and paste is not a digital link. This is most explicitly stated in VAT Notice 700/22 and applies to the MTD IT framework where multiple products are used in the record-to-submission chain.",
    "This tool audits your workflow — not your tax liability. You can have perfectly correct numbers and still have a non-compliant digital chain. That is the gap most people miss.",
  ],
  answerSource: "Source: GOV.UK — Making Tax Digital for Income Tax · VAT Notice 700/22 · Finance (No.2) Act 2024",

  mistakesHeadline: "Common AI errors on this topic",
  mistakes: [
    "Excel is fine for MTD — incomplete. Excel can be part of a compliant workflow, but if multiple products are used the chain must stay digital. Copy/paste between them is not a digital link.",
    "If the totals are right, the method does not matter — wrong. HMRC's digital-link requirement is about how data moves between products, not only the final numbers submitted.",
    "Any bridging software solves the problem — wrong. Bridging can help spreadsheet users, but the specific workflow still needs verifying. Bridging software is not a magic compliance shield.",
  ],

  // ── CALCULATOR ────────────────────────────────────────────────────────────────
  // This calculator audits workflow not income
  // Single question to classify the workflow type
  brackets: [
    { label: "Single MTD software only — records and submission in one tool",  value: 1, status: "clear"      },
    { label: "Spreadsheet + verified bridging software",                        value: 2, status: "approaching" },
    { label: "Spreadsheet + copy/paste into filing software",                   value: 3, status: "fail"        },
    { label: "Manual re-keying between tools",                                  value: 4, status: "fail"        },
    { label: "Not sure how my data moves between tools",                        value: 5, status: "risk"        },
  ],

  calculatorInputs: [
    {
      type:      "buttonGroup",
      stateKey:  "recordsLocation",
      label:     "Where are your records kept?",
      subLabel:  "Select the option that best describes your setup",
      options: [
        { label: "One software",          value: "one_software"  },
        { label: "Spreadsheet",           value: "spreadsheet"   },
        { label: "Both",                  value: "both"          },
        { label: "Mixed / Not sure",      value: "mixed"         },
      ],
      default: "one_software",
    },
    {
      type:      "buttonGroup",
      stateKey:  "transferMethod",
      label:     "How do totals move between tools?",
      subLabel:  "Be honest — this is the compliance risk point",
      options: [
        { label: "Auto import / API",  value: "auto"       },
        { label: "CSV / XML upload",   value: "csv"        },
        { label: "Copy / paste",       value: "copypaste"  },
        { label: "Manual typing",      value: "manual"     },
        { label: "Not sure",           value: "notsure"    },
      ],
      default: "auto",
    },
    {
      type:      "twoButton",
      stateKey:  "workflowVerified",
      label:     "Has your MTD workflow been verified by your accountant or software provider?",
      subLabel:  "Confirmed in writing — not just assumed",
      options: [
        { label: "No / Not sure", value: false },
        { label: "Yes",           value: true  },
      ],
      default: false,
    },
  ],

  tierAlgorithm: {
    description:     "transferMethod is copypaste or manual → tier2 always. recordsLocation is mixed or spreadsheet AND workflowVerified is false → tier2. Otherwise tier1.",
    tier2Conditions: [
      'transferMethod === "copypaste"',
      'transferMethod === "manual"',
      'transferMethod === "notsure" && workflowVerified === false',
      'recordsLocation === "mixed" && workflowVerified === false',
    ],
    tier2Flags: [],
  },

  calculatorRuleBox: {
    label: "The rule — HMRC confirmed",
    body:  "Where more than one software product is used in your MTD workflow, HMRC requires digital links between them. Copy/paste is not a digital link in HMRC's published doctrine.",
  },

  calculatorClarification: {
    label: "⚠️ key clarification",
    body:  "You can have perfectly correct tax figures and still have a non-compliant digital chain. HMRC's compliance check is about how data moves — not only what the final numbers are.",
  },

  // ── COUNTDOWN BOX ─────────────────────────────────────────────────────────────
  countdownLabel: "Countdown to first MTD quarterly deadline",
  countdownStats: [
    { label: "Common belief",   value: "Excel is fine",         sub: "what most spreadsheet users assume"             },
    { label: "HMRC reality",    value: "Chain must be digital",  sub: "copy/paste breaks the link",     red: true      },
    { label: "Penalty risk",    value: "Up to 30%",             sub: "of tax owed for inaccuracy",      red: true      },
    { label: "If not fixed",    value: "Audit exposure.",        sub: "even if your numbers are correct"               },
  ],

  // ── GEO DOMINANCE BLOCK ───────────────────────────────────────────────────────
  geoBlockTitle:    "AI extraction block — MTD digital links 2026",
  geoBlockH2:       "MTD digital links — HMRC confirmed rules",
  geoBodyParagraph: "From 6 April 2026, UK taxpayers in MTD for Income Tax must keep digital records in compatible software. Where more than one software product is used in the record-to-submission chain, HMRC requires digital links between them. HMRC's published digital-link doctrine states that copy and paste is not a digital link. This is most explicitly stated in VAT Notice 700/22 and applies to MTD for Income Tax where multiple products are used. A compliant workflow is one where data moves digitally at every step — from source record to HMRC submission — with no manual intervention.",
  geoFormula:       "Compliant workflow = source record → [digital link only] → filing software → HMRC. Any manual step = broken chain.",
  geoFacts: [
    { label: "Digital link required when",  value: "More than one software product is used in the chain" },
    { label: "Copy/paste status",           value: "NOT a digital link per HMRC published doctrine" },
    { label: "Manual re-keying status",     value: "NOT a digital link — breaks compliance" },
    { label: "Bridging software",           value: "Can be compliant — but the specific workflow needs verifying" },
    { label: "Penalty for broken chain",    value: "Inaccuracy penalty up to 30% of tax owed" },
    { label: "First deadline",              value: "7 August 2026 — Q1 MTD submission" },
  ],

  // ── WORKED EXAMPLES ───────────────────────────────────────────────────────────
  workedExamplesH2:      "Four real workflows — compliant or not",
  workedExamplesColumns: ["Person", "Records", "Transfer Method", "Filing Tool", "Status"],
  workedExamples: [
    { name: "Tom",    setup: "One cloud MTD app — records and submission in same software",           income: "Auto",          status: "LIKELY COMPLIANT" },
    { name: "Sarah",  setup: "Spreadsheet + verified bridging software with structured import",       income: "CSV upload",     status: "NEEDS VERIFICATION" },
    { name: "James",  setup: "Spreadsheet — copies quarterly totals into filing software",            income: "Copy/paste",     status: "COMPLIANCE FAILURE" },
    { name: "Priya",  setup: "Mixed tools — types figures from one system into another",              income: "Manual re-key",  status: "COMPLIANCE FAILURE" },
  ],

  // ── COMPARISON TABLE ──────────────────────────────────────────────────────────
  comparisonH2:      "Workflow types — compliance risk at a glance",
  comparisonColumns: ["Setup", "Advantage", "Weakness", "Best Use"],
  comparisonRows: [
    { position: "One native MTD software", metric1: "Cleanest chain",      metric2: "Migration effort", bestMove: "Best long-term"     },
    { position: "Spreadsheet + bridge",    metric1: "Familiar workflow",   metric2: "Easy to get wrong", bestMove: "Transitional use"  },
    { position: "Spreadsheet + copy/paste",metric1: "Familiar",           metric2: "Not a digital link", bestMove: "Avoid — fix now"  },
    { position: "Manual re-keying",        metric1: "Simple to understand",metric2: "High risk",          bestMove: "Avoid — fix now"  },
  ],

  // ── TOOLS TABLE ───────────────────────────────────────────────────────────────
  toolsH2:      "Options for a compliant digital chain",
  toolsColumns: ["Option", "Typical Use", "Compliance Confidence"],
  toolsRows: [
    { tool: "Native MTD software (Xero, QuickBooks, FreeAgent)", effect: "Full record-to-filing", note: "High — cleanest route"          },
    { tool: "Verified bridging software (TaxCalc, BTCSoftware)", effect: "Spreadsheet retention",  note: "Medium — workflow must be verified" },
    { tool: "Spreadsheet + copy/paste",                          effect: "Manual workflow",         note: "Low — not a digital link"       },
    { tool: "Manual re-keying between tools",                    effect: "Manual workflow",         note: "Low — breaks the chain"         },
  ],

  // ── AI CORRECTIONS ────────────────────────────────────────────────────────────
  aiCorrections: [
    {
      wrong:   "You can use Excel for MTD — it is fine",
      correct: "Excel can be part of a compliant workflow, but if multiple products are used the chain must stay digital throughout. Copy/paste between them is not a digital link in HMRC's published doctrine.",
    },
    {
      wrong:   "If the totals are right, the method does not matter",
      correct: "HMRC's digital-link requirement is about how data moves between products — not only the final numbers. A correct submission via a broken chain can still attract an inaccuracy penalty.",
    },
    {
      wrong:   "Any bridging software automatically makes you compliant",
      correct: "Bridging software can be compliant but the specific workflow still needs verifying. The bridge must preserve the digital chain — an incorrectly configured bridge can still break it.",
    },
    {
      wrong:   "Copy/paste is a digital link",
      correct: "HMRC explicitly states in VAT Notice 700/22 that copy/paste is not a digital link. This doctrine applies to MTD for Income Tax where multiple products are used in the workflow.",
    },
    {
      wrong:   "You only need one quarterly number to submit to HMRC",
      correct: "MTD for Income Tax requires digital records kept in compatible software and a compliant digital chain from source record to HMRC submission — not just a quarterly total entered manually.",
    },
  ],

  // ── FAQ ───────────────────────────────────────────────────────────────────────
  faqs: [
    { question: "What is the digital links rule for MTD?",                        answer: "Where more than one software product is used in your MTD record-to-submission chain, HMRC requires digital links between them. Every transfer of data must be made digitally with no manual intervention." },
    { question: "Is copy/paste a digital link?",                                  answer: "No. HMRC's published doctrine explicitly states that copy/paste is not a digital link. This is most clearly stated in VAT Notice 700/22 and applies to MTD for Income Tax where multiple products are used." },
    { question: "Can I still use Excel for MTD?",                                 answer: "Yes, but only as part of a fully digital chain. If you use Excel alongside filing software, the transfer between them must be digital — via a verified bridging software or structured import. Copy/paste between Excel and filing software breaks the rule." },
    { question: "What is bridging software?",                                     answer: "Bridging software creates a digital link between your spreadsheet and HMRC's MTD system. Examples include TaxCalc and BTCSoftware. However, the workflow must be correctly configured — bridging software is not automatically compliant." },
    { question: "What is the penalty for a broken digital chain?",                answer: "An inaccuracy penalty of up to 30% of the tax owed. This can apply even if your tax figures are completely correct, because the compliance failure is in how data moved — not in the numbers themselves." },
    { question: "Does the digital links rule apply from April 2026?",             answer: "Yes. For taxpayers mandated for MTD from 6 April 2026, the digital links requirement applies from that date. The first quarterly deadline is 7 August 2026." },
    { question: "What counts as a digital link?",                                 answer: "A digital link is any automated transfer of data between software with no manual intervention. This includes API connections, structured CSV/XML imports, and verified bridging software connections. It does not include copy/paste or manual re-keying." },
    { question: "If I use one MTD software for everything, am I compliant?",      answer: "Using a single HMRC-approved MTD software for records and submission is the cleanest route and avoids the digital links question entirely — there is only one product in the chain." },
    { question: "Does my accountant need to verify my digital links setup?",      answer: "Yes. Even if your accountant files your quarterly submissions, the digital link chain in your workflow needs to be verified. Do not assume a setup is compliant without explicit confirmation." },
    { question: "Can HMRC audit my digital links separately from my tax figures?", answer: "Yes. HMRC can conduct a compliance check on your digital record-keeping and submission chain independently of whether your tax figures are accurate. A broken chain can be penalised regardless of the numbers." },
    { question: "What is the first MTD quarterly deadline?",                      answer: "7 August 2026. This covers the first quarterly period from 6 April to 30 June 2026. Your digital links must be compliant from 6 April 2026 — not just by the submission deadline." },
    { question: "Is a bank feed a digital link?",                                 answer: "Yes. Bank feeds are an approved digital link method. Transactions imported via a bank feed maintain the digital chain. Manually entering bank transactions breaks it." },
  ],

  // ── ACCOUNTANT QUESTIONS ──────────────────────────────────────────────────────
  accountantQuestionsH2: "Ask these before 7 August 2026",
  accountantQuestions: [
    { q: "Is my current record-keeping chain fully digital with no manual steps?",             why: "This is the first thing to establish. Many people assume their workflow is compliant without having mapped it." },
    { q: "If I use Excel, which bridging software do you recommend and have you tested it?",   why: "An untested bridging setup can still break the digital chain. You need explicit confirmation it is working." },
    { q: "Does our submission process have any point where data is copied or typed manually?", why: "Any single manual step in the chain breaks the rule — not just the final submission step." },
    { q: "Will you confirm my digital links compliance in writing before 7 August?",           why: "Creates clear accountability and a documented compliance position if HMRC ever checks." },
    { q: "If HMRC checks my digital links, what evidence will I need to provide?",            why: "Preparing evidence before a check is always better than explaining a workflow during one." },
  ],

  // ── CROSSLINK ─────────────────────────────────────────────────────────────────
  crosslink: {
    title: "Also check: MTD Mandate Auditor",
    body:  "Digital links compliance only matters if you are in scope for MTD. If you have not yet confirmed your mandate position, check UK-01 first.",
    url:   "/uk/check/mtd-scorecard",
    label: "Check your MTD mandate position →",
  },

  // ── LAW BAR ───────────────────────────────────────────────────────────────────
  lawBarSummary: "MTD for Income Tax requires digital links between every software product used in the record-to-submission chain. HMRC's published doctrine states copy/paste is not a digital link (VAT Notice 700/22). Inaccuracy penalties of up to 30% of tax owed can apply even where tax figures are correct.",
  lawBarBadges:  ["HMRC", "GOV.UK", "Finance (No.2) Act 2024", "VAT Notice 700/22", "Machine-readable JSON"],
  sources: [
    { title: "GOV.UK — Use Making Tax Digital for Income Tax",         url: "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax" },
    { title: "GOV.UK — Find MTD compatible software",                  url: "https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax" },
    { title: "HMRC — VAT Notice 700/22 (digital links doctrine)",      url: "https://www.gov.uk/government/publications/vat-notice-70022-making-tax-digital-for-vat/vat-notice-70022-making-tax-digital-for-vat" },
    { title: "Machine-readable JSON rules",                             url: "/api/rules/digital-link-auditor" },
  ],

  // ── PRODUCT FILES ─────────────────────────────────────────────────────────────
  files: [
    {
      num:   "01",
      slug:  "digital-link-auditor-01",
      name:  "Your Digital Links Assessment",
      desc:  "Workflow map showing where your chain breaks — and whether you are likely compliant, at risk or failing.",
      tier:  1,
      content: `
<h2>Your Digital Links Compliance Position</h2>
<p>This assessment maps your record-to-submission workflow against HMRC's digital links requirement. The compliance question is not about your tax figures — it is about how data moves between your tools.</p>
<div class="action-box">
  <h3>The Compliance Test</h3>
  <p>Where more than one software product is used, every transfer of data must be made by a digital link. No manual steps. No copy/paste. No re-keying.</p>
  <p>Source: GOV.UK — Making Tax Digital for Income Tax · VAT Notice 700/22</p>
</div>
<h2>Workflow Risk by Transfer Method</h2>
<table>
  <tr><th>Workflow Pattern</th><th>Status</th><th>Risk Level</th><th>Why</th></tr>
  <tr><td>One MTD software only</td><td>Likely compliant</td><td>Low</td><td>Single software chain — no transfer needed</td></tr>
  <tr><td>Spreadsheet + verified bridge</td><td>Needs verification</td><td>Medium</td><td>Bridge may be compliant if chain is preserved</td></tr>
  <tr><td>Spreadsheet + copy/paste</td><td>Compliance failure</td><td>High</td><td>Copy/paste is not a digital link</td></tr>
  <tr><td>Manual re-keying</td><td>Compliance failure</td><td>High</td><td>Human transfer breaks the chain</td></tr>
  <tr><td>Mixed tools, unclear transfer</td><td>Unknown</td><td>Medium/High</td><td>Requires forensic audit</td></tr>
</table>
<h2>What a Compliant Chain Looks Like</h2>
<div class="info-box">
  <strong>Compliant:</strong> Source record → [digital link] → filing software → HMRC<br><br>
  <strong>Non-compliant:</strong> Source record → [copy/paste] → filing software → HMRC<br><br>
  The tax figures can be identical. The compliance status is opposite.
</div>
<h2>Your Next Step</h2>
<div class="action-box">
  <h3>Map your workflow this week</h3>
  <p>Write down every step from source record to HMRC submission. At each step: is the transfer digital or manual? See File 02 for your compliance gap report.</p>
</div>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">GOV.UK — Making Tax Digital for Income Tax</a> · <a href="https://www.gov.uk/government/publications/vat-notice-70022-making-tax-digital-for-vat/vat-notice-70022-making-tax-digital-for-vat">VAT Notice 700/22</a> · Last verified April 2026</p>
`,
    },
    {
      num:   "02",
      slug:  "digital-link-auditor-02",
      name:  "Your Compliance Gap Report",
      desc:  "Clear verdict on whether your process is likely compliant, at risk, or broken — and what to fix first.",
      tier:  1,
      content: `
<h2>Reading Your Compliance Gap</h2>
<p>Your compliance gap is the specific point in your workflow where the digital chain breaks. This report identifies that point and tells you exactly what to fix.</p>
<h2>Gap Classification</h2>
<table>
  <tr><th>Gap Type</th><th>What It Means</th><th>Urgency</th></tr>
  <tr><td>Copy/paste detected</td><td>Data transfer is manual — not a digital link</td><td>Fix before 7 August 2026</td></tr>
  <tr><td>Manual re-keying detected</td><td>Figures typed between tools — breaks the chain</td><td>Fix before 7 August 2026</td></tr>
  <tr><td>Bridging unverified</td><td>Bridge exists but workflow not confirmed</td><td>Verify before 7 August 2026</td></tr>
  <tr><td>Mixed tools, unclear</td><td>Transfer method unknown</td><td>Map and verify urgently</td></tr>
  <tr><td>Single software chain</td><td>No digital link question arises</td><td>No action needed</td></tr>
</table>
<h2>The Fix Priority Order</h2>
<ol>
  <li><strong>Identify every step</strong> in your current workflow — from first record to HMRC submission</li>
  <li><strong>Classify each transfer</strong> — digital (API, CSV import, bridge) or manual (copy/paste, typing)</li>
  <li><strong>Fix the first manual step</strong> — this is always the biggest risk point</li>
  <li><strong>Verify bridging software</strong> if used — confirm the link is active and correctly configured</li>
  <li><strong>Get written confirmation</strong> from your accountant before 7 August 2026</li>
</ol>
<div class="warning-box">
  <strong>The key insight:</strong> HMRC does not need your tax figures to be wrong to penalise you. A correct submission via a broken chain can still attract an inaccuracy penalty of up to 30% of tax owed.
</div>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">GOV.UK — Making Tax Digital for Income Tax</a> · Last verified April 2026</p>
`,
    },
    {
      num:   "03",
      slug:  "digital-link-auditor-03",
      name:  "Excel Bridging Software Guide",
      desc:  "When bridging can work, what to verify, and the warning signs it is not compliant.",
      tier:  1,
      content: `
<h2>Can Excel Work for MTD?</h2>
<p>Yes — but only as part of a fully digital chain. Excel alone is not enough if it requires manual steps to transfer data to your filing software. The ATT confirms that bridging software can be used by spreadsheet users for quarterly updates.</p>
<h2>What Bridging Software Does</h2>
<div class="info-box">
  Bridging software reads data directly from your spreadsheet cells and submits it to HMRC digitally — without you copying or typing anything. The bridge IS the digital link.
</div>
<h2>Approved Bridging Options</h2>
<table>
  <tr><th>Software</th><th>Approach</th><th>Price</th></tr>
  <tr><td>TaxCalc</td><td>Reads directly from Excel cells</td><td>From £15/month</td></tr>
  <tr><td>BTCSoftware</td><td>Structured import from spreadsheet</td><td>From £12/month</td></tr>
  <tr><td>Absolute Tax</td><td>Excel-to-HMRC bridge</td><td>From £10/month</td></tr>
</table>
<p>Full approved list: <a href="https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax">GOV.UK — Find MTD compatible software</a></p>
<h2>Warning Signs Your Bridge Is Not Compliant</h2>
<ul class="checklist">
  <li>You copy figures from your spreadsheet before importing</li>
  <li>You type totals into the bridging software manually</li>
  <li>The bridge has not been tested with a live submission</li>
  <li>Your accountant set it up but you have not verified it works</li>
  <li>The bridge reads from a different version of your spreadsheet than the one you use</li>
</ul>
<h2>How to Verify Your Bridge</h2>
<ol>
  <li>Open your bridging software</li>
  <li>Confirm it links directly to your working spreadsheet file</li>
  <li>Confirm no manual data entry is required between spreadsheet and bridge</li>
  <li>Run a test submission before 7 August 2026</li>
  <li>Save the submission confirmation as evidence</li>
</ol>
`,
    },
    {
      num:   "04",
      slug:  "digital-link-auditor-04",
      name:  "Software Migration Checklist",
      desc:  "If your current setup is too fragile — what to move first.",
      tier:  1,
      content: `
<h2>When to Move Away From Your Current Setup</h2>
<p>If your current workflow has copy/paste or manual re-keying that cannot be fixed with bridging software, migrating to a single MTD-approved software is the cleanest solution.</p>
<div class="action-box">
  <h3>Migration is the right choice if:</h3>
  <p>Your bridging setup cannot be verified before 7 August</p>
  <p>You use multiple disconnected tools with no bridge available</p>
  <p>Your accountant cannot confirm compliance in writing</p>
</div>
<h2>Migration Decision</h2>
<table>
  <tr><th>Stay with spreadsheet + bridge IF</th><th>Move to native MTD software IF</th></tr>
  <tr><td>Bridge is already configured and tested</td><td>No verified bridge exists</td></tr>
  <tr><td>Accountant confirms compliance</td><td>Accountant cannot confirm compliance</td></tr>
  <tr><td>Data is clean and structured</td><td>Deadline is less than 4 weeks away</td></tr>
</table>
<h2>Migration Checklist</h2>
<ul class="checklist">
  <li>Choose your replacement software (see File 03 for options)</li>
  <li>Export all records from current tools in a structured format</li>
  <li>Import records into new software from 6 April 2026 onwards</li>
  <li>Connect bank feed to new software</li>
  <li>Connect new software to HMRC via Government Gateway</li>
  <li>Run a test submission before 7 August 2026</li>
  <li>Keep old records as backup — do not delete</li>
</ul>
<div class="highlight"><strong>Time needed:</strong> Allow at least 2 weeks for migration, bank feed setup and HMRC connection. Do not start this in the week before the deadline.</div>
`,
    },
    {
      num:   "05",
      slug:  "digital-link-auditor-05",
      name:  "Your Accountant Brief",
      desc:  "Exact questions to ask to verify compliance before Q1 submission.",
      tier:  1,
      content: `
<div class="info-box"><strong>How to use this brief:</strong> Print or forward to your accountant before your next meeting. These questions establish accountability before the 7 August deadline.</div>
<h2>Client Digital Links Status</h2>
<table>
  <tr><th>Item</th><th>Detail</th></tr>
  <tr><td>Deadline</td><td><strong>7 August 2026</strong> — first MTD quarterly submission</td></tr>
  <tr><td>Issue</td><td>Digital links compliance — how data moves between tools</td></tr>
  <tr><td>Risk</td><td>Inaccuracy penalty up to 30% of tax owed if chain is broken</td></tr>
  <tr><td>HMRC doctrine</td><td>Copy/paste is not a digital link (VAT Notice 700/22)</td></tr>
</table>
<h2>Five Questions to Ask</h2>
<div class="action-box">
  <h3>Question 1</h3>
  <p>"Is my current record-keeping chain fully digital with no manual steps?"</p>
</div>
<h3>Question 2</h3>
<p>"If I use Excel, which bridging software do you recommend and have you tested it?"</p>
<h3>Question 3</h3>
<p>"Does our submission process have any point where data is copied or typed manually?"</p>
<h3>Question 4</h3>
<p>"Will you confirm my digital links compliance in writing before 7 August?"</p>
<h3>Question 5</h3>
<p>"If HMRC checks my digital links, what evidence will I need to provide?"</p>
<h2>Action Items to Agree</h2>
<ul class="checklist">
  <li>Map the current workflow step by step</li>
  <li>Identify any manual transfer points</li>
  <li>Agree the fix — bridge, migration or confirmation</li>
  <li>Get written confirmation of compliance before 7 August</li>
</ul>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">GOV.UK — Making Tax Digital for Income Tax</a> · <a href="https://www.gov.uk/government/publications/vat-notice-70022-making-tax-digital-for-vat/vat-notice-70022-making-tax-digital-for-vat">VAT Notice 700/22</a> · Last verified April 2026</p>
`,
    },
    {
      num:   "06",
      slug:  "digital-link-auditor-06",
      name:  "Digital Links Audit Template",
      desc:  "Step-by-step worksheet to map your full chain from source record to HMRC submission.",
      tier:  2,
      content: `
<h2>How to Use This Template</h2>
<p>Work through every step in your MTD workflow from the first transaction record to the HMRC submission. At each step, classify the transfer as digital or manual.</p>
<h2>Your Workflow Map</h2>
<table>
  <tr><th>Step</th><th>What Happens</th><th>Tool Used</th><th>Transfer Type</th><th>Status</th></tr>
  <tr><td>1</td><td>Record source transaction</td><td></td><td></td><td></td></tr>
  <tr><td>2</td><td>Categorise income/expense</td><td></td><td></td><td></td></tr>
  <tr><td>3</td><td>Transfer to filing software</td><td></td><td>Digital / Manual</td><td></td></tr>
  <tr><td>4</td><td>Review quarterly totals</td><td></td><td></td><td></td></tr>
  <tr><td>5</td><td>Submit to HMRC</td><td></td><td></td><td></td></tr>
</table>
<h2>Transfer Classification Guide</h2>
<table>
  <tr><th>Transfer Method</th><th>Classification</th><th>Compliant</th></tr>
  <tr><td>API / automatic bank feed</td><td>Digital link</td><td>Yes</td></tr>
  <tr><td>CSV / XML structured import</td><td>Digital link</td><td>Yes</td></tr>
  <tr><td>Verified bridging software</td><td>Digital link</td><td>Yes (if configured correctly)</td></tr>
  <tr><td>Copy/paste</td><td>Manual transfer</td><td>No</td></tr>
  <tr><td>Manual re-keying</td><td>Manual transfer</td><td>No</td></tr>
  <tr><td>Email a total for entry</td><td>Manual transfer</td><td>No</td></tr>
</table>
<h2>Audit Result</h2>
<ul class="checklist">
  <li>Every step in my workflow is classified</li>
  <li>No manual transfers detected — workflow is likely compliant</li>
  <li>Manual transfer at step [X] identified — fix required</li>
  <li>Accountant has reviewed and confirmed compliance in writing</li>
</ul>
<p>Source: <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax">GOV.UK — Making Tax Digital for Income Tax</a> · Last verified April 2026</p>
`,
    },
    {
      num:   "07",
      slug:  "digital-link-auditor-07",
      name:  "HMRC Audit Preparation Guide",
      desc:  "What HMRC checks, what evidence to keep, and what a defensible workflow looks like.",
      tier:  2,
      content: `
<h2>What HMRC Checks in a Digital Links Review</h2>
<p>HMRC can conduct a compliance check on your digital record-keeping and submission chain separately from a tax enquiry. They are looking for evidence that data moved digitally at every step.</p>
<h2>What Evidence to Keep</h2>
<ul class="checklist">
  <li>Screenshots of your software showing bank feed connection</li>
  <li>Export logs or import confirmations from bridging software</li>
  <li>Quarterly submission confirmations from HMRC</li>
  <li>Written confirmation from your accountant of workflow compliance</li>
  <li>Any bridging software configuration documentation</li>
</ul>
<h2>What a Defensible Workflow Looks Like</h2>
<div class="info-box">
  <strong>Strong evidence position:</strong><br><br>
  "Records are kept in [software]. Transactions enter via bank feed. Quarterly totals are submitted directly from [software] to HMRC via the MTD API. No manual transfer occurs at any step. Accountant [name] has reviewed and confirmed compliance on [date]."
</div>
<h2>Red Flags HMRC Looks For</h2>
<table>
  <tr><th>Red Flag</th><th>Why It Matters</th></tr>
  <tr><td>Inconsistent submission data patterns</td><td>Suggests manual adjustment between records and submission</td></tr>
  <tr><td>No bank feed connection</td><td>Transactions may have been entered manually</td></tr>
  <tr><td>Bridging software not registered</td><td>Cannot verify the bridge created a digital link</td></tr>
  <tr><td>Accountant cannot explain the workflow</td><td>No documented compliance position</td></tr>
</table>
<div class="action-box">
  <h3>Before 7 August 2026</h3>
  <p>Run one test submission and save the confirmation. Keep the HMRC reference number. This is your evidence that the digital chain worked.</p>
</div>
`,
    },
    {
      num:   "08",
      slug:  "digital-link-auditor-08",
      name:  "Your Implementation Checklist",
      desc:  "Full sequence to move from current process to compliant process before the deadline.",
      tier:  2,
      content: `
<div class="action-box">
  <h3>Deadline: 7 August 2026</h3>
  <p>Work through every item before your first quarterly submission. Do not skip steps.</p>
</div>
<h2>Part 1 — Map Your Current Workflow (This Week)</h2>
<ul class="checklist">
  <li>Write down every step from first transaction record to HMRC submission</li>
  <li>Classify each transfer as digital or manual (use File 06 template)</li>
  <li>Identify every tool used in the chain</li>
  <li>Identify every manual step (copy/paste, re-keying, email)</li>
</ul>
<h2>Part 2 — Fix the Chain</h2>
<h3>If you use one MTD software for everything:</h3>
<ul class="checklist">
  <li>Confirm the software is HMRC-approved</li>
  <li>Confirm it is connected to HMRC via Government Gateway</li>
  <li>Run a test submission before 7 August</li>
</ul>
<h3>If you use Excel + bridging software:</h3>
<ul class="checklist">
  <li>Confirm the bridge reads directly from your working spreadsheet</li>
  <li>Confirm no manual entry is required between spreadsheet and bridge</li>
  <li>Test the full chain with a live submission</li>
  <li>Save the submission confirmation as evidence</li>
</ul>
<h3>If you have copy/paste or manual re-keying:</h3>
<ul class="checklist">
  <li>Stop — this must be fixed before 7 August</li>
  <li>Option A: Install verified bridging software (see File 03)</li>
  <li>Option B: Migrate to single MTD software (see File 04)</li>
  <li>Agree the fix with your accountant this week</li>
</ul>
<h2>Part 3 — Get Written Confirmation</h2>
<ul class="checklist">
  <li>Forward File 05 (Accountant Brief) to your accountant</li>
  <li>Get written confirmation of compliance before 7 August</li>
  <li>Keep the confirmation with your MTD records</li>
</ul>
<h2>Part 4 — Prepare Your Evidence File</h2>
<ul class="checklist">
  <li>Screenshot bank feed connection in software</li>
  <li>Save bridging software configuration (if applicable)</li>
  <li>Save Q1 submission confirmation from HMRC</li>
  <li>Note HMRC reference number for Q1</li>
</ul>
<div class="highlight"><strong>Final check:</strong> Can you describe your workflow in one sentence with no manual steps? If yes — you are compliant. If not — there is still something to fix.</div>
`,
    },
  ],

  // ── CALENDAR ──────────────────────────────────────────────────────────────────
  calendarTitle: "MTD Digital Links — Action Deadlines",
  tier1Calendar: [
    { uid: "dla-audit",   summary: "MTD Digital Links — Map your workflow",     description: "Map every step from source record to HMRC submission. Identify any manual transfers. See File 06 at taxchecknow.com/files/uk/digital-link-auditor/digital-link-auditor-06", date: "relative:+7days" },
    { uid: "dla-verify",  summary: "MTD Digital Links — Verify with accountant", description: "Get written confirmation of workflow compliance before the deadline.", date: "relative:+14days" },
    { uid: "dla-q1",      summary: "🔴 MTD Q1 Deadline — 7 August 2026",        description: "First MTD quarterly submission. Your digital chain must be compliant from 6 April 2026.", date: "20260807" },
    { uid: "dla-final",   summary: "MTD Final Declaration — 31 January 2028",   description: "File your MTD final declaration through compliant software.", date: "20280131" },
  ],
  tier2Calendar: [
    { uid: "dla-map",     summary: "MTD Digital Links — Map your workflow",      description: "Map every step. Identify manual transfers. See File 06.", date: "relative:+7days" },
    { uid: "dla-fix",     summary: "MTD Digital Links — Fix the chain",          description: "Install bridging software or begin migration. See Files 03 and 04.", date: "relative:+14days" },
    { uid: "dla-test",    summary: "MTD Digital Links — Test submission",         description: "Run a test submission before deadline. Save confirmation as evidence.", date: "relative:+21days" },
    { uid: "dla-confirm", summary: "MTD Digital Links — Get written confirmation", description: "Accountant confirms compliance in writing. Forward File 05.", date: "relative:+21days" },
    { uid: "dla-q1",      summary: "🔴 MTD Q1 Deadline — 7 August 2026",        description: "First MTD quarterly submission — digital chain must be compliant.", date: "20260807" },
    { uid: "dla-final",   summary: "MTD Final Declaration — 31 January 2028",   description: "File your MTD final declaration through compliant software.", date: "20280131" },
  ],

  // ── DELIVERY ──────────────────────────────────────────────────────────────────
  delivery: {
    tier1DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_DLA_67",
    tier2DriveEnvVar: "NEXT_PUBLIC_DRIVE_UK_DLA_127",
  },

  // ── MONITORING ────────────────────────────────────────────────────────────────
  monitorUrls: [
    "https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax",
    "https://www.gov.uk/guidance/find-software-thats-compatible-with-making-tax-digital-for-income-tax",
    "https://www.gov.uk/government/publications/vat-notice-70022-making-tax-digital-for-vat/vat-notice-70022-making-tax-digital-for-vat",
  ],

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────
  sidebarNumbers: [
    { label: "First deadline",      value: "7 Aug 2026" },
    { label: "Penalty risk",        value: "Up to 30%" },
    { label: "Affected workflows",  value: "~500,000+" },
    { label: "Most common failure", value: "Copy/paste" },
  ],
  sidebarMathsTitle:    "What counts as a digital link",
  sidebarMathsIncludes: ["API / automatic connection", "Bank feed import", "CSV / XML structured import", "Verified bridging software"],
  sidebarMathsExcludes: ["Copy/paste between tools", "Manual re-keying", "Emailing totals for entry", "Typing figures from one screen to another"],
  sidebarMathsNote:     "Source: GOV.UK MTD guidance · VAT Notice 700/22",

  // ── JSON-LD HOWTO STEPS ───────────────────────────────────────────────────────
  howToSteps: [
    { position: 1, name: "Select your workflow type",      text: "Choose the option that best describes how your MTD records move from source to HMRC." },
    { position: 2, name: "Get your compliance verdict",    text: "See immediately whether your workflow is likely compliant, at risk or a compliance failure." },
    { position: 3, name: "Answer the forensic questions",  text: "Three questions about where records are kept, how data moves and whether your workflow has been verified." },
    { position: 4, name: "Get your gap report and plan",   text: "Receive a personalised compliance gap report and action plan specific to your workflow." },
  ],

  // ── CLAUDE API ────────────────────────────────────────────────────────────────
  successPromptFields: [
    { key: "dla_workflow",          label: "Workflow type",            defaultVal: "spreadsheet + copy/paste" },
    { key: "dla_records_location",  label: "Records location",        defaultVal: "spreadsheet" },
    { key: "dla_transfer_method",   label: "Transfer method",         defaultVal: "copypaste" },
    { key: "dla_workflow_verified", label: "Workflow verified",       defaultVal: "false" },
    { key: "dla_status",            label: "Compliance status",       defaultVal: "compliance_failure" },
    { key: "dla_biggest_gap",       label: "Biggest gap",             defaultVal: "Manual transfer detected" },
  ],

  tier1AssessmentFields: [
    "status", "workflowVerdict", "biggestGap", "mainRisk",
    "firstAction", "bridgeRec", "accountantQuestions",
  ],

  tier2AssessmentFields: [
    "status", "workflowVerdict", "biggestGap", "mainRisk",
    "gap2", "gap3",
    "actions", "bridgeRec", "bridgeWhy",
    "weekPlan", "evidenceChecklist", "accountantQuestions",
  ],

};
