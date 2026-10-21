import type { ProductConfig } from "../types/product-config";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// AUTHORED FROM build_jobs.research_output FOR BUILD ac31ce7d, 2026-10-20.
//
// Assembly produced the research and never ran the Build Sequence: no config, no calculator, no
// rules route, no files (F157). This config is written from what it DID produce, and every figure
// below carries its verified id and the quote it came from:
//
//   fig_0   15%        "The rate of Division 293 tax is 15%."
//   fig_1   $250,000   "2017-18 onwards $250,000"
//   fig_2   $300,000   "2012-13 to 2016-17 $300,000"
//   fig_3   4.2906%    "2024-25 4.2906%"   (and fig_4..fig_13, one per income year to 2014-15)
//   formula "Tax is payable on the lesser of: (individual's income + certain super contributions
//            - Division 293 threshold) OR the super contributions, multiplied by 15%."
//
// NOTHING HERE IS INVENTED LAW. Where the research left a page section thin (hero, story,
// worked_examples, comparison, faq), the copy is composed from the verified figures and the
// formula above — not from recollection.
//
// ONE THING THIS CONFIG DOES NOT DECLARE, DELIBERATELY:
//
//   envVar  — F71, now CLOSED. Both fields held a ⚠REVIEW tag through PR #85 precisely because a
//             Stripe price env var name is the operator's to choose and must never be derived.
//             Matt assigned STRIPE_AU_DIV293_67 / _147 and confirmed both exist in Vercel on
//             2026-10-20; they are written in below because he chose them, not because the slug
//             implies them. The productKeys were always declared — they come from the products row
//             Assembly wrote (tier1_key / tier2_key), so they are data, not a derivation.
//
//   temporal — step 7's ruling, not this file's. The research reports
//             deadline_window_days: null and urgency_triggers: [], which is why deadline.isoDate
//             and countdownLabel are EMPTY here (the au-10 pattern): the threshold is a standing
//             rule measured per income year, not a date anyone must act by. The prose is kept.
// ═════════════════════════════════════════════════════════════════════════════════════════════

export const PRODUCT_CONFIG: ProductConfig = {
  id: "division-293-tax-calculation", name: "Division 293 Tax Calculation", site: "taxchecknow", country: "au", market: "Australia", language: "en-AU", currency: "AUD",
  slug: "au/check/division-293-tax-calculation", url: "https://taxchecknow.com/au/check/division-293-tax-calculation", apiRoute: "/api/rules/division-293-tax-calculation",
  authority: "ATO", authorityUrl: "https://www.ato.gov.au", legalAnchor: "ITAA 1997 — Division 293 (additional tax on concessional contributions)", legislation: "Income Tax Assessment Act 1997 Division 293 — an additional 15% tax on the concessional contributions of individuals whose income plus certain super contributions exceeds the Division 293 threshold. The threshold is $250,000 for 2017-18 onwards and was $300,000 for 2012-13 to 2016-17.", lastVerified: "October 2026",  // Declared at MOUNT by soverella scripts/ship-runner.ts: the calculator is the
  // EngineCalculator wrapper, so the success pages must bind inputs through
  // buildComposerInputsFromSession, and the parity census must cover this product.
  engineNative: true,


  tier1: { price: 67, name: "Your Division 293 Threshold Report", tagline: "Which side of the $250,000 line are you on?", value: "Your personalised Division 293 position: the threshold test applied to your income and concessional contributions, the amount the 15% would be charged on, and what to confirm with your fund.", cta: "Get My Division 293 Report — $67 →", productKey: "au_67_division_293_tax_calculation", envVar: "STRIPE_AU_DIV293_67", successPath: "assess", fileCount: 5 },
  tier2: { price: 147, name: "Your Division 293 Management Plan", tagline: "Contribution structure, income timing and payment options in one plan", value: "The full Division 293 plan: concessional contribution structuring, income timing against the threshold, defined benefit mechanics including the Treasury bond rates, and the deferred-debt payment and election options.", cta: "Get My Division 293 Plan — $147 →", productKey: "au_147_division_293_tax_calculation", envVar: "STRIPE_AU_DIV293_147", successPath: "plan", fileCount: 8 },

  temporal: {
    kind:         "none",
    reason:       "standing_rule_assessed_per_income_year_no_act_by_date",
    jurisdiction: "AU",
    domain:       "superannuation",
    label:        "Income year end",
    basis:        "ITAA 1997 Division 293 (additional tax on concessional contributions): assessed per income year on income plus certain super contributions, and there is no separate act-by date — config au-17 deadline.description, with display \"End of the income year\" and urgencyLabel \"PER INCOME YEAR\". isoDate and countdownLabel are deliberately empty in that config (the au-10 pattern for a standing rule). Operator ruling 2026-10-21.",
  },
  deadline: { isoDate: "", display: "End of the income year", short: "Income year end", description: "Division 293 is assessed per income year on income plus certain super contributions — there is no separate act-by date", urgencyLabel: "PER INCOME YEAR", countdownLabel: "" },

  h1: "Division 293 Tax: Do You Cross the $250,000 Threshold?",
  metaTitle: "Division 293 Tax: Do You Cross $250,000? | TaxCheckNow",
  metaDescription: "Division 293 adds 15% tax on concessional super contributions once income plus contributions pass $250,000. Check which side you are on.",
  canonical: "https://taxchecknow.com/au/check/division-293-tax-calculation",

  answerHeadline: "The answer — ATO confirmed October 2026",
  answerBody: [
    "Division 293 tax is an additional 15% on concessional super contributions for individuals whose income plus certain super contributions exceeds the Division 293 threshold. The threshold is $250,000 for 2017-18 onwards; it was $300,000 for 2012-13 to 2016-17.",
    "The tax is not charged on the whole excess. It is payable on the LESSER of two amounts: the amount by which income plus certain super contributions exceeds the threshold, or the super contributions themselves. That lesser amount is then taxed at 15%.",
    "So crossing the threshold by a small margin produces a small assessment, not a cliff: if the excess is $4,000 and the concessional contributions are $27,500, the 15% applies to $4,000.",
    "A defined benefit interest is calculated differently and can produce a deferred debt, on which the ATO applies the average 10-year Treasury bond rate for the relevant income year — 4.2906% for 2024-25.",
  ],
  answerSource: "Source: ATO — Division 293 tax · ITAA 1997 Division 293",

  mistakesHeadline: "What most people (and AI) get wrong about Division 293",
  mistakes: [
    "That the 15% applies to all your contributions once you cross the threshold — it applies to the LESSER of the excess over the threshold or the contributions.",
    "That the threshold has always been $250,000 — it was $300,000 for 2012-13 to 2016-17, which matters for any amended assessment covering those years.",
    "That the threshold is measured on salary — it is income PLUS certain super contributions, so the contributions that trigger the tax are themselves part of the test.",
    "That a defined benefit interest works the same way — it does not, and an unfunded interest can produce a deferred debt carrying the Treasury bond rate for each year it is deferred.",
    "That reducing salary sacrifice always helps — it reduces the contributions side of the test, which can reduce the lesser amount, but it also changes the income side.",
  ],

  chainVisual: { label: "How the Division 293 test works", broken: "Income $240,000 + contributions $27,500 = $267,500 → $17,500 over the threshold → 15% on $17,500 ❌", fixed: "Income $222,500 + contributions $27,500 = $250,000 → nothing over the threshold → no Division 293 ✓" },

  brackets: [
    { label: "Clearly below $250,000 — Division 293 does not apply", value: 1, status: "clear" },
    { label: "Around or close to $250,000 — the test decides", value: 2, status: "approaching" },
    { label: "Clearly above $250,000 — Division 293 applies", value: 3, status: "risk" },
    { label: "Above $300,000 in 2012-13 to 2016-17 — the earlier threshold", value: 4, status: "risk" },
  ],

  calculatorInputs: [
    { type: "buttonGroup", stateKey: "superType", label: "What type of superannuation interest do you hold?", subLabel: "A defined benefit interest is calculated differently and can produce a deferred debt.", options: [{ label: "Accumulation account only", value: "accumulation" }, { label: "Defined benefit interest", value: "defined_benefit" }, { label: "Both", value: "both" }], default: "accumulation" },
    { type: "buttonGroup", stateKey: "incomeLevel", label: "Where does your income, including concessional contributions, sit against $250,000?", subLabel: "The test adds income and certain super contributions together.", options: [{ label: "Clearly below", value: "below_threshold" }, { label: "Around or close to it", value: "near_threshold" }, { label: "Clearly above", value: "above_threshold" }, { label: "Varied — above $300,000 in 2012-13 to 2016-17", value: "historical_threshold" }], default: "near_threshold" },
    { type: "buttonGroup", stateKey: "contributionStructure", label: "How are your concessional contributions structured?", subLabel: "The contributions are one side of the threshold test and the base the 15% can apply to.", options: [{ label: "Employer contributions only", value: "employer_only" }, { label: "A mix of salary sacrifice and employer", value: "mix" }, { label: "Personal concessional (claiming a deduction)", value: "personal_concessional" }, { label: "Considering non-concessional instead", value: "considering_non_concessional" }], default: "mix" },
    { type: "buttonGroup", stateKey: "assessmentStatus", label: "Have you received a Division 293 assessment from the ATO?", subLabel: "An assessment opens the payment and deferral election options.", options: [{ label: "Yes — deciding how to pay it", value: "assessment_received" }, { label: "Yes — looking at deferral or paying from super", value: "assessment_deferral" }, { label: "No — planning ahead", value: "planning_ahead" }], default: "planning_ahead" },
    { type: "buttonGroup", stateKey: "primaryConcern", label: "What is your primary concern?", options: [{ label: "Whether and how the 15% applies to me", value: "applicability" }, { label: "Structuring salary sacrifice and employer contributions", value: "salary_sacrifice" }, { label: "Timing income to stay below the threshold", value: "income_timing" }, { label: "Non-concessional or recontribution strategies", value: "non_concessional" }, { label: "Interaction with splitting, spouse or carry-forward", value: "other_tools" }, { label: "Paying an assessment — deferral and cash flow", value: "payment_deferral" }], default: "applicability" },
  ],

  // tier2Flags name BOOLEAN STATE KEYS, which the generator emits as bare identifiers in the
  // tier expression. This product has no boolean input - every lever is a buttonGroup - so the
  // logic lives entirely in tier2Conditions. Four label-shaped strings here produced four
  // undefined identifiers in the generated calculator.
  tierAlgorithm: {
    description: "A defined benefit interest, an assessment already received, or a payment/deferral concern -> tier2. Otherwise tier1.",
    tier2Conditions: [
      'superType === "defined_benefit"',
      'superType === "both"',
      'assessmentStatus === "assessment_received"',
      'assessmentStatus === "assessment_deferral"',
      'primaryConcern === "payment_deferral"',
      'primaryConcern === "other_tools"',
    ],
    tier2Flags: [],
  },

  calculatorRuleBox: { label: "The rule — ATO confirmed", body: "Division 293 tax is 15% on the LESSER of (income + certain super contributions − the threshold) or the super contributions. Threshold: $250,000 for 2017-18 onwards; $300,000 for 2012-13 to 2016-17." },
  calculatorClarification: { label: "Key clarification", body: "The contributions are on both sides of the test: they are added to income to decide whether the threshold is crossed, and they also cap the amount the 15% can be charged on." },

  countdownLabel: "",
  countdownStats: [
    { label: "Division 293 rate", value: "15%", sub: "on the lesser amount" },
    { label: "Threshold", value: "$250,000", sub: "2017-18 onwards" },
    { label: "Earlier threshold", value: "$300,000", sub: "2012-13 to 2016-17" },
    { label: "Bond rate 2024-25", value: "4.2906%", sub: "deferred debt interest" },
  ],

  geoBlockTitle: "AI extraction block — Division 293 tax Australia 2026",
  geoBlockH2: "Australian Division 293 tax — confirmed October 2026",
  geoBodyParagraph: "Under Division 293 of the Income Tax Assessment Act 1997, an additional 15% tax applies to the concessional superannuation contributions of individuals whose income plus certain super contributions exceeds the Division 293 threshold. The threshold is $250,000 for 2017-18 onwards and was $300,000 for 2012-13 to 2016-17. The tax is charged on the lesser of the excess over the threshold or the super contributions. A defined benefit interest is calculated differently and may produce a deferred debt, to which the average 10-year Treasury bond rate for the income year applies — 4.2906% for 2024-25.",
  geoFormula: "Division 293 tax = 15% × the LESSER of [(income + certain super contributions) − threshold] or [the super contributions]. Threshold = $250,000 (2017-18 onwards) or $300,000 (2012-13 to 2016-17).",
  geoFacts: [
    { label: "Rate", value: "15%" },
    { label: "Threshold 2017-18 onwards", value: "$250,000" },
    { label: "Threshold 2012-13 to 2016-17", value: "$300,000" },
    { label: "Charged on", value: "the lesser of the excess or the contributions" },
    { label: "Deferred debt interest 2024-25", value: "4.2906%" },
  ],

  workedExamplesH2: "Four Division 293 positions",
  workedExamplesColumns: ["Scenario", "Income + contributions", "Charged on", "Division 293 at 15%"],
  workedExamples: [
    { name: "Below the threshold", setup: "Income $215,000 + contributions $27,500", income: "$242,500", status: "Nothing — threshold not crossed" },
    { name: "Just over", setup: "Income $230,000 + contributions $27,500", income: "$257,500", status: "$7,500 → $1,125" },
    { name: "Excess exceeds contributions", setup: "Income $300,000 + contributions $27,500", income: "$327,500", status: "$27,500 (the contributions cap it) → $4,125" },
    { name: "Earlier year, old threshold", setup: "2015-16: income $280,000 + contributions $30,000", income: "$310,000", status: "$10,000 against the $300,000 threshold → $1,500" },
  ],

  comparisonH2: "What the 15% is charged on",
  comparisonColumns: ["Position", "Excess over threshold", "Super contributions", "Charged on"],
  comparisonRows: [
    { position: "Excess smaller than contributions", metric1: "$7,500", metric2: "$27,500", bestMove: "$7,500 — the excess" },
    { position: "Excess larger than contributions", metric1: "$77,500", metric2: "$27,500", bestMove: "$27,500 — the contributions" },
    { position: "No excess", metric1: "$0", metric2: "$27,500", bestMove: "Nothing — Division 293 does not apply" },
  ],

  toolsH2: "Levers that change a Division 293 position",
  toolsColumns: ["Lever", "How it works", "What to confirm"],
  toolsRows: [
    { tool: "Concessional contribution structure", effect: "Reduces the contributions side of the test, which can reduce the lesser amount", note: "Confirm the employer and salary sacrifice split with your fund for the income year" },
    { tool: "Income timing", effect: "Moves assessable income, such as a bonus, between income years", note: "Confirm which income year the amount is derived in" },
    { tool: "Non-concessional or recontribution", effect: "Non-concessional contributions are not concessional contributions for this test", note: "Confirm the contribution caps that apply to you" },
    { tool: "Deferral election on a defined benefit debt", effect: "Defers payment, with the Treasury bond rate applied for the income year", note: "Confirm the rate for each year deferred — 4.2906% for 2024-25" },
  ],

  aiCorrections: [
    { wrong: "ChatGPT says: once you earn over $250,000 the 15% applies to all your super contributions", correct: "Reality: it applies to the LESSER of the excess over the threshold or the contributions, so a small excess produces a small assessment." },
    { wrong: "ChatGPT says: the Division 293 threshold is $250,000 and always has been", correct: "Reality: it was $300,000 for 2012-13 to 2016-17, which still matters for those income years." },
    { wrong: "ChatGPT says: Division 293 is calculated on your salary", correct: "Reality: the test is income PLUS certain super contributions, so the contributions count on both sides." },
  ],

  faqs: [
    { question: "What is Division 293 tax?", answer: "An additional 15% tax on concessional super contributions, charged when an individual's income plus certain super contributions exceeds the Division 293 threshold." },
    { question: "What is the threshold?", answer: "$250,000 for 2017-18 onwards. It was $300,000 for 2012-13 to 2016-17." },
    { question: "Is the 15% charged on the whole excess?", answer: "No. It is charged on the lesser of the excess over the threshold or the super contributions." },
    { question: "How is a defined benefit interest different?", answer: "It is calculated differently and can produce a deferred debt. The ATO applies the average 10-year Treasury bond rate for the income year to a deferred amount — 4.2906% for 2024-25." },
    { question: "Can the tax be paid from super?", answer: "An assessment opens payment and election options, including releasing an amount from a super interest. The options depend on the interest type and the assessment." },
  ],

  accountantQuestionsH2: "Ask these before the income year closes",
  accountantQuestions: [
    { q: "What is my income plus certain super contributions for this income year, and does that figure cross $250,000?", why: "This is the whole test — income plus certain super contributions, against the threshold." },
    { q: "If it crosses, which is smaller — the excess over the threshold or my concessional contributions? That is what the 15% is charged on.", why: "The 15% is charged on the lesser of the two, so this decides the size of the assessment." },
    { q: "Do I hold a defined benefit interest, and if so is any part of the Division 293 amount a deferred debt?", why: "A defined benefit interest is calculated differently and can produce a deferred debt." },
    { q: "If there is a deferred debt, which Treasury bond rate applies for each income year it is deferred?", why: "A deferred amount carries the average 10-year Treasury bond rate for each income year." },
    { q: "Were any of my earlier income years above $300,000 between 2012-13 and 2016-17?", why: "The threshold was $300,000 for those years, so an earlier year can be assessed differently." },
  ],

  crosslink: { title: "Leaving Australia with super? Check the departing-super position.", body: "Division 293 is about contributions crossing a threshold while you are here. If you are leaving Australia, the question is what happens to the super itself.", url: "/au/check/superannuation-tax-leaving-australia-confusion-2026", label: "Check departing super →" },

  lawBarSummary: "Division 293 tax: an additional 15% on concessional super contributions where income plus certain super contributions exceeds the threshold. Threshold $250,000 from 2017-18; $300,000 for 2012-13 to 2016-17. Charged on the lesser of the excess or the contributions. Defined benefit interests are calculated differently and can carry a deferred debt at the income year's Treasury bond rate.",
  lawBarBadges: ["ATO", "ITAA 1997", "Division 293", "Superannuation"],

  sources: [
    { title: "ATO — Division 293 tax (rates, thresholds and Treasury bond rates)", url: "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/division-293-tax" },
    { title: "ITAA 1997 Division 293 s293-15 — liability for Division 293 tax", url: "https://www.legislation.gov.au/C2004A05138/latest/text" },
    { title: "ITAA 1997 Division 293 s293-20 — the Division 293 threshold and the amount taxed", url: "https://www.legislation.gov.au/C2004A05138/latest/text" },
    { title: "ITAA 1997 Division 293 s293-25 — taxable contributions for the income year", url: "https://www.legislation.gov.au/C2004A05138/latest/text" },
  ],

  files: [
    { num: "01", slug: "d293-01", name: "Your Division 293 Threshold Test", desc: "Your income plus contributions against the threshold, and the amount the 15% would apply to.", tier: 1, content: `<h2>Division 293 — Threshold Test</h2><div class="action-box"><h3>The Test</h3><p>Income + certain super contributions, compared to the threshold</p><p>Threshold: $250,000 from 2017-18; $300,000 for 2012-13 to 2016-17</p><p>Charged on the LESSER of the excess or the contributions, at 15%</p></div><p>Source: <a href="https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/division-293-tax">ATO — Division 293 tax</a></p>` },
    { num: "02", slug: "d293-02", name: "Which Amount the 15% Applies To", desc: "Why a small excess produces a small assessment, with the two-sided test worked through.", tier: 1, content: `<h2>The Lesser of Two Amounts</h2><p>Division 293 is not charged on the whole excess. It is charged on the lesser of the amount by which income plus certain super contributions exceeds the threshold, or the super contributions themselves.</p><div class="action-box"><h3>Worked</h3><p>Excess $7,500, contributions $27,500 &rarr; charged on $7,500 &rarr; $1,125</p><p>Excess $77,500, contributions $27,500 &rarr; charged on $27,500 &rarr; $4,125</p></div>` },
    { num: "03", slug: "d293-03", name: "Concessional Contribution Structure", desc: "How the employer and salary sacrifice split sits on both sides of the threshold test.", tier: 1, content: `<h2>Contributions Sit on Both Sides</h2><p>Concessional contributions are added to income to decide whether the threshold is crossed, and they also cap the amount the 15% can be charged on. Changing the structure changes both sides, which is why the direction of the effect has to be worked rather than assumed.</p>` },
    { num: "04", slug: "d293-04", name: "Income Timing and the Threshold", desc: "What moving a bonus or investment income between income years does to the test.", tier: 1, content: `<h2>Income Timing</h2><p>The test is applied per income year. Moving assessable income between years changes which year's threshold it is tested against. Confirm which income year an amount is derived in before treating it as moved.</p>` },
    { num: "05", slug: "d293-05", name: "Your Accountant Brief", desc: "The five questions to put to your accountant before the income year closes.", tier: 1, content: `<h2>Accountant Brief</h2><div class="action-box"><h3>Ask</h3><p>1. What is my income plus certain super contributions this year?</p><p>2. Which is smaller — the excess or my contributions?</p><p>3. Do I hold a defined benefit interest?</p><p>4. Is any amount a deferred debt, and at which bond rate?</p><p>5. Were any years 2012-13 to 2016-17 above $300,000?</p></div>` },
    { num: "06", slug: "d293-06", name: "Defined Benefit Interests and Deferred Debt", desc: "How the calculation differs for a defined benefit interest, and how a deferred debt accrues.", tier: 2, content: `<h2>Defined Benefit Interests</h2><p>A defined benefit interest is calculated differently from an accumulation account, and an unfunded interest can produce a Division 293 deferred debt. The ATO applies the average 10-year Treasury bond rate for the relevant income year to a deferred amount.</p><div class="action-box"><h3>Treasury bond rates, by income year</h3><p>2024-25 4.2906% &middot; 2023-24 4.2482% &middot; 2022-23 3.6096% &middot; 2021-22 2.1124%</p><p>2020-21 1.1816% &middot; 2019-20 1.0333% &middot; 2018-19 2.2547% &middot; 2017-18 2.7021%</p><p>2016-17 2.4157% &middot; 2015-16 2.6139% &middot; 2014-15 2.9978%</p></div>` },
    { num: "07", slug: "d293-07", name: "Payment, Deferral and Release Options", desc: "What an assessment opens up: payment timing, deferral elections and releasing from super.", tier: 2, content: `<h2>Paying an Assessment</h2><p>An assessment opens payment and election options, including releasing an amount from a super interest. Which options are available depends on the interest type and the assessment itself, so the election should be confirmed against the assessment you actually received.</p>` },
    { num: "08", slug: "d293-08", name: "Interaction With Other Super Strategies", desc: "Contribution splitting, spouse contributions and carry-forward, against the Division 293 test.", tier: 2, content: `<h2>Other Strategies</h2><p>Contribution splitting, spouse contributions and carry-forward concessional contributions each change the contributions counted for an income year, which is one side of the Division 293 test. Each has its own caps and conditions to confirm.</p>` },
  ],

  persona: { name: "Priya", age: 48, occupation: "Hospital specialist, public health service", location: "Adelaide, South Australia", family: "Partner Ravi, one child in high school", financialSnapshot: "Public sector defined benefit interest plus an accumulation account with salary sacrifice; income plus contributions close to $250,000", painPoint: "One Division 293 assessment already received, and no clear picture of what the 15% was actually charged on.", discovery: "Looked up the threshold after the assessment arrived and found the rate but not the two-sided test.", voice: "Precise. Asks for the arithmetic. Wants the defined benefit part explained once, properly." },
  story: { hook: "Priya's income plus concessional contributions came to $257,500 for the year, and she assumed the 15% would land on the whole $27,500 she had contributed.", setup: ["She had read the rate and the threshold and stopped there, which is where most summaries stop.", "Her payslips showed the salary sacrifice; her fund statement showed the employer contributions. Neither document mentions the Division 293 test."], revelation: "The excess over the threshold was $7,500 — smaller than her contributions — so the 15% applied to $7,500, not $27,500. The assessment was $1,125, not the $4,125 she had braced for.", resolution: "The part that needed real attention was the defined benefit interest: an unfunded component can produce a deferred debt, and each year it is deferred carries that year's Treasury bond rate." },

  calendarTitle: "Division 293 — Key Dates",
  tier1Calendar: [{ uid: "d293-threshold", summary: "Division 293 — check income plus contributions against the threshold", description: "Confirm income plus certain super contributions for the income year and compare to $250,000.", date: "annual:06-30" }],
  tier2Calendar: [{ uid: "d293-deferral", summary: "Division 293 — review any deferred debt and the bond rate", description: "Confirm whether any Division 293 amount is deferred and which Treasury bond rate applies for the year.", date: "annual:06-30" }],

  delivery: { tier1DriveEnvVar: "", tier2DriveEnvVar: "" },
  monitorUrls: ["https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/division-293-tax"],

  sidebarNumbers: [
    { label: "Rate", value: "15%" },
    { label: "Threshold", value: "$250,000" },
    { label: "Earlier threshold", value: "$300,000" },
    { label: "Bond rate 2024-25", value: "4.2906%" },
  ],
  sidebarMathsTitle: "Division 293 — what counts",
  sidebarMathsIncludes: [
    "Income for surcharge purposes, plus certain super contributions",
    "Concessional contributions — employer, salary sacrifice and personal deducted",
    "Charged on the LESSER of the excess over the threshold or the contributions",
    "Defined benefit interests, calculated differently, possibly as a deferred debt",
  ],
  sidebarMathsExcludes: [
    "NOT charged on the whole excess when the contributions are smaller",
    "NOT a flat charge on all contributions once the threshold is crossed",
    "NOT non-concessional contributions — they are not concessional contributions for this test",
    "NOT a fixed threshold across all years — $300,000 applied for 2012-13 to 2016-17",
  ],
  sidebarMathsNote: "Source: ATO — Division 293 tax · ITAA 1997 Division 293 · confirmed October 2026",

  howToSteps: [
    { position: 1, name: "Add income and contributions", text: "Add income for surcharge purposes to certain super contributions for the income year." },
    { position: 2, name: "Compare to the threshold", text: "Compare that total to $250,000, or to $300,000 for 2012-13 to 2016-17." },
    { position: 3, name: "Take the lesser amount", text: "Take the lesser of the excess over the threshold or the super contributions." },
    { position: 4, name: "Apply 15%", text: "Division 293 tax is 15% of that lesser amount." },
    { position: 5, name: "Check the interest type", text: "A defined benefit interest is calculated differently and may produce a deferred debt." },
  ],

  successPromptFields: [
    { key: "super_type", label: "Type of superannuation interest held", defaultVal: "accumulation" },
    { key: "income_level", label: "Income plus contributions against the threshold", defaultVal: "near_threshold" },
    { key: "contribution_structure", label: "How concessional contributions are structured", defaultVal: "mix" },
    { key: "assessment_status", label: "Whether a Division 293 assessment has been received", defaultVal: "planning_ahead" },
    { key: "primary_concern", label: "Primary Division 293 concern", defaultVal: "applicability" },
  ],

  tier1AssessmentFields: ["thresholdTest", "amountChargedOn", "contributionStructureReview", "incomeTimingPosition", "interestTypeImpact", "earlierYearExposure", "fundConfirmationList", "firstAction"],
  tier2AssessmentFields: ["thresholdTest", "amountChargedOn", "contributionStructureReview", "incomeTimingPosition", "interestTypeImpact", "earlierYearExposure", "fundConfirmationList", "definedBenefitMechanics", "deferredDebtRateSchedule", "paymentAndElectionOptions", "otherStrategyInteractions", "multiYearThresholdPlan"],
};
