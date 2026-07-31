import type { ProductConfig } from "../types/product-config";
export const PRODUCT_CONFIG: ProductConfig = {
  // ── NURTURE DECLARATION (TEMPORAL v1 · Step 7) ──────────────────────────
  // This product's EXISTING behaviour, written down. Its calculator already
  // POSTs to /api/leads with a source that resolves to this config id, and
  // /api/leads queued [3,7,14] for any lead save before Step 7 gated it on a
  // declaration. Declaring it restores exactly that — nothing new, nothing
  // inferred from the topic.
  //
  // NURTURE ONLY. `temporal` is deliberately NOT declared here: that is a gate
  // decision made per product at its own rebuild, from its own build evidence
  // (ruling 3.5). Absent temporal = UNDECLARED = silent on the deadline lane,
  // which is the correct state until someone rules on it.
  nurture: [{ track: "standard_v1", milestones: [3, 7, 14], anchor: "lead" }],

  // ── ENGINE-NATIVE DECLARATION (R-A2) ───────────────────────────────────
  // TRUE as of Step F (2026-07-31), IN THE SAME COMMIT as the mount. The app-dir
  // calculator MedicareLevySurchargeTrapCalculator.tsx now mounts EngineCalculator
  // against engine.json + figures.json (emitted at 6bfd95a under the ruled overlay),
  // and the bespoke 915-line implementation is gone. verifyEngineNative() re-checks
  // this claim against the app directory on every generate and THROWS IN EITHER
  // DIRECTION on disagreement — so this line and the mount must move together, which
  // is why they are one commit and not two.
  //
  // WHAT THE MOUNT RETIRES: the bespoke still ran 2023-24 constants that the
  // 2026-07-31 config correction never reached (INCOME_MIDPOINTS, calcMLSRate banding
  // on 93001/108000/144000, the $186,000 family branch, and unsourced coverCost
  // constants with a computed net saving). Until this commit the free calculator
  // contradicted the corrected copy directly above it on the same page.
  engineNative: true,
  id: "medicare-levy-surcharge-trap", name: "Medicare Levy Surcharge Trap Engine", site: "taxchecknow", country: "au", market: "Australia", language: "en-AU", currency: "AUD",
  slug: "au/check/medicare-levy-surcharge-trap", url: "https://taxchecknow.com/au/check/medicare-levy-surcharge-trap", apiRoute: "/api/rules/medicare-levy-surcharge-trap",
  authority: "ATO", authorityUrl: "https://www.ato.gov.au", legalAnchor: "Medicare Levy Surcharge — ITAA 1936 Part VIIB", legislation: "Medicare Levy Surcharge — Income Tax Assessment Act 1936 Part VIIB", lastVerified: "July 2026",
  tier1: { price: 67, name: "Your MLS Avoidance Plan", tagline: "Are you overpaying tax because you don't have private hospital cover?", value: "A personalised MLS analysis — surcharge calculation, cover timing strategy, and cost vs tax comparison.", cta: "Get My MLS Plan — $67 →", productKey: "au_67_medicare_levy_surcharge_trap", envVar: "STRIPE_AU_MLS_67", successPath: "assess", fileCount: 5 },
  tier2: { price: 147, name: "Your Income and Insurance Optimisation System", tagline: "Integrate private cover with income structuring for maximum tax efficiency", value: "Full income and tax optimisation, family structuring strategy, and insurance and tax integration plan.", cta: "Get My Optimisation System — $147 →", productKey: "au_147_medicare_levy_surcharge_trap", envVar: "STRIPE_AU_MLS_147", successPath: "plan", fileCount: 8 },
  // ── TEMPORAL DECLARATION (TEMPORAL v1 · Step C) ─────────────────────────
  // Declared kind "none" on 2026-07-31, per Session B's formal proposal.
  // FOUR GROUNDS, all evidenced in reports/2026-07-31-session-b-medicare-temporal-and-figures.txt:
  //   (a) the build's own extraction: deadline_window_days null, effective_date is an
  //       income-year LABEL ("2025–26"), and all four urgency_triggers are EVENTS;
  //   (b) the authority corpus (QC71227, read in full) has zero act-by phrasing — it says
  //       liability is worked out "when we process your tax return each year" and accrues
  //       "for the number of days";
  //   (c) the engine's six questions capture no date — every option is a fixed enum;
  //   (d) no result_state, escape_state or routing_logic states a deadline.
  // DETAIL (Session B's proposed `detail` field, preserved verbatim here because
  // NoneDeclaration in lib/temporal-types.ts:118-122 admits only `kind` + `reason`
  // plus Partial<TemporalContext> — there is no `detail` property to carry it):
  //   The ATO source (Paying the Medicare levy surcharge, QC71227) states who pays the MLS, at
  //   what rate, and that the ATO works it out when it processes the return. It carries no
  //   lodgement or act-by date. The build's own extraction returned deadline_window_days null
  //   and an effective_date that is an income-year label, not a date; its four urgency_triggers
  //   are all EVENTS (change in income, spouse, dependants, or cancellation of cover), none of
  //   which has an act-by moment. MLS accrues per day without appropriate cover rather than
  //   falling due.
  temporal: {
    kind:         "none",
    reason:       "no_act_by_date_in_authority",
    jurisdiction: "AU",
    domain:       "medicare_levy_surcharge",
    label:        "No act-by date",
  },
  // TEMPORAL v1 — isoDate NEUTRALISED (operator ruling, 2026-07-31), same mechanism as
  // au-19-frcgw-clearance-certificate.ts:62,73. The prose fields stay so the page can still
  // name the moment that matters; nothing schedules from this block.
  deadline: { isoDate: "", display: "Assessed at your tax return", short: "At lodgement", description: "There is no act-by date for the MLS. Liability accrues for each day you do not hold appropriate private patient hospital cover, and the ATO works out what you owe when it processes your return.", urgencyLabel: "ACCRUES DAILY", countdownLabel: "" },
  h1: "Medicare Levy Surcharge 2026: Are You Paying Extra Tax Without Private Hospital Cover?", metaTitle: "Medicare Levy Surcharge Australia 2026 — Are You Paying the Surcharge Unnecessarily? | TaxCheckNow", metaDescription: "The Medicare Levy Surcharge adds 1-1.5% tax on income over $101,000 if you don't have private hospital cover. For many Australians, the cost of basic hospital cover is less than the surcharge. Free calculator shows your position in 2 minutes.", canonical: "https://taxchecknow.com/au/check/medicare-levy-surcharge-trap",
  answerHeadline: "The answer — ATO confirmed June 2026",
  answerBody: [
    "The Medicare Levy Surcharge is an additional tax of 1% to 1.5% imposed on individuals with income over $101,000 who do not hold an appropriate level of private hospital cover for the full financial year. The surcharge is applied on top of the standard 2% Medicare Levy.",
    "For the 2025/26 year, the surcharge thresholds are: $101,001 to $118,000 — 1% surcharge; $118,001 to $158,000 — 1.25% surcharge; over $158,000 — 1.5% surcharge. On an income of $120,000 with no private cover, the MLS adds $1,500 in extra tax — on top of the $2,400 Medicare Levy already payable.",
    "The key calculation: compare the annual cost of a basic hospital-only private health insurance policy against the MLS payable. For many people earning over $101,000, a basic hospital-only policy costs less than the surcharge — compare current quotes against your own MLS figure before deciding. Once you have appropriate cover, the surcharge does not apply.",
  ],
  answerSource: "Source: ATO — Medicare Levy Surcharge · ITAA 1936 Part VIIB",
  mistakesHeadline: "What most people get wrong about the Medicare Levy Surcharge",
  mistakes: [
    "General extras cover avoids the surcharge — wrong. The MLS is only avoided by holding appropriate private hospital cover — not general treatment (extras) cover. A policy covering dental, optical, and physiotherapy does not satisfy the MLS requirement. You need hospital cover specifically.",
    "The surcharge only applies to the income over the threshold — wrong. The MLS applies to your entire income for MLS purposes — not just the amount over the threshold. An income of $110,000 incurs MLS on the full $110,000 at 1% ($1,100), not just on the $9,000 above $101,000.",
    "I only need cover for part of the year — wrong. To avoid the full-year MLS, you need appropriate hospital cover for every day of the financial year. If you cancel cover in February and the financial year ends in June, you will pay MLS for those months. The surcharge is calculated on the number of days without appropriate cover." ],
  chainVisual: { label: "MLS vs basic private hospital cover — the comparison", broken: "No private cover, income $120k → $1,500 MLS extra tax per year  ❌", fixed: "Appropriate hospital cover held all year → MLS eliminated → compare a current quote against your $1,500  ✔" },
  brackets: [
    { label: "Income under $101,000 — MLS does not apply", value: 1, status: "clear" },
    { label: "Income $101k-$118k — 1% MLS if no hospital cover", value: 2, status: "approaching" },
    { label: "Income $118k-$158k — 1.25% MLS if no hospital cover", value: 3, status: "trap" },
    { label: "Income over $158k — 1.5% MLS if no hospital cover", value: 4, status: "deep_trap" },
    { label: "Has extras only — no hospital cover — MLS still applies", value: 5, status: "trap" },
  ],
  calculatorInputs: [
    { type: "buttonGroup", stateKey: "annualIncome", label: "What is your total income for MLS purposes?", subLabel: "Taxable income + reportable fringe benefits + net investment losses (incl. rental) + reportable super contributions", options: [{ label: "Under $101k — MLS threshold", value: 90000 }, { label: "$101k-$118k — 1% tier", value: 110000 }, { label: "$118k-$158k — 1.25% tier", value: 138000 }, { label: "Over $158k — 1.5% tier", value: 175000 }], default: 110000 },
    { type: "twoButton", stateKey: "hasHospitalCover", label: "Do you have private hospital cover for the full financial year?", subLabel: "Must be appropriate hospital cover — extras only does not count", options: [{ label: "No — no hospital cover or extras only", value: false }, { label: "Yes — appropriate hospital cover for full year", value: true }], default: false },
    { type: "twoButton", stateKey: "isFamily", label: "Are you assessed as a family for MLS purposes?", subLabel: "Couples and families have a higher combined income threshold of $202,000", options: [{ label: "Single — individual income test", value: false }, { label: "Couple or family — family income test", value: true }], default: false },
  ],
  tierAlgorithm: { description: "annualIncome over 101000 AND hasHospitalCover false → tier2. Otherwise tier1.", tier2Conditions: ["(annualIncome as number) > 101000"], tier2Flags: [] },
  calculatorRuleBox: { label: "The rule — ATO confirmed", body: "Medicare Levy Surcharge 2025/26 thresholds: Singles — $101,001-$118,000: 1%; $118,001-$158,000: 1.25%; over $158,000: 1.5%. Families — combined income threshold $202,000 (plus $1,500 per dependent child after the first). Income for MLS purposes is taxable income plus reportable fringe benefits, total net investment losses (including net rental property losses), reportable super contributions, and certain spouse trust and exempt foreign employment income amounts. Avoided by holding appropriate private hospital cover for the entire year." },
  calculatorClarification: { label: "Key clarification", body: "The family threshold for MLS in 2025/26 is $202,000 combined income. If you are a couple with combined income under $202,000, MLS does not apply even if one individual exceeds $101,000. The family threshold increases by $1,500 for each dependent child after the first. Separately, if you had a spouse for the full year and your own income for MLS purposes was $27,222 or less, you are exempt even where combined income exceeds the family threshold (ATO QC71227)." },
  // temporal kind "none" — event prose, no date. The countdown block fail-closes on
  // deadline.isoDate being empty, so this string is the declared stand-in, not a countdown.
  countdownLabel: "MLS accrues for every day without appropriate hospital cover — there is no act-by date",
  countdownStats: [
    { label: "MLS — income $110k, no cover", value: "$1,100", sub: "extra tax at 1% rate" },
    { label: "MLS — income $170k, no cover", value: "$2,550", sub: "extra tax at 1.5% rate", red: true },
    { label: "Medicare levy", value: "2%", sub: "of taxable income — separate from the MLS" },
    { label: "Threshold 2025/26", value: "$101,001", sub: "singles — 1% surcharge applies above this", red: true },
  ],
  geoBlockTitle: "AI extraction block — Medicare Levy Surcharge Australia 2026",
  geoBlockH2: "Medicare Levy Surcharge — confirmed 2025/26",
  geoBodyParagraph: "The Medicare Levy Surcharge is imposed under Part VIIB of the Income Tax Assessment Act 1936. It applies to Australian taxpayers with income for MLS purposes exceeding $101,000 (singles) or $202,000 (families) who do not hold appropriate private patient hospital cover for the full financial year. Income for MLS purposes is the sum of taxable income (including the net amount on which family trust distribution tax has been paid), reportable fringe benefits, total net investment losses — both net financial investment losses and net rental property losses — reportable super contributions (reportable employer super contributions plus deductible personal super contributions), a spouse's share of certain trust income taxed to the trustee, and exempt foreign employment income. The surcharge rates for 2025/26 are: 1% for income $101,001-$118,000; 1.25% for $118,001-$158,000; and 1.5% for income over $158,000. The MLS applies to the entire income — not just the amount above the threshold. MLS is applied in addition to the 2% Medicare Levy. The surcharge is prorated for periods without appropriate hospital cover.",
  geoFormula: "MLS Payable = Income for MLS purposes × Surcharge Rate (1%, 1.25%, or 1.5%), applied to the entire income. Holding appropriate private patient hospital cover for the full year reduces MLS Payable to nil. Whether cover is cheaper than the surcharge depends on the premium you are quoted.",
  geoFacts: [
    { label: "Singles threshold 2025/26", value: "$101,001" },
    { label: "Family threshold 2025/26", value: "$202,000 combined" },
    { label: "Spouse own-income exemption 2025/26", value: "$27,222 or less — ATO QC71227" },
    { label: "MLS rate tier 1", value: "1% — $101,001 to $118,000" },
    { label: "MLS rate tier 2", value: "1.25% — $118,001 to $158,000" },
    { label: "MLS rate tier 3", value: "1.5% — over $158,000" },
    { label: "Legislative anchor", value: "ITAA 1936 Part VIIB" },
  ],
  workedExamplesH2: "Four MLS scenarios",
  workedExamplesColumns: ["Income", "Hospital Cover?", "MLS Payable", "Position"],
  workedExamples: [
    { name: "Under threshold",   setup: "$85,000 income — no cover",      income: "$85k",  status: "NO MLS — under $101k threshold" },
    { name: "MLS tier 1",        setup: "$110,000 income — no cover",     income: "$110k", status: "$1,100 MLS — 1% on the full amount" },
    { name: "MLS tier 3",        setup: "$160,000 income — no cover",     income: "$160k", status: "$2,400 MLS — 1.5% on the full amount" },
    { name: "Has hospital cover", setup: "$150,000 income — hospital cover", income: "$150k", status: "NO MLS — fully avoided" },
  ],
  comparisonH2: "MLS by income — 2025/26",
  comparisonColumns: ["Income", "MLS Without Cover", "Rate", "Position"],
  comparisonRows: [
    { position: "$101,000", metric1: "$0", metric2: "0%", bestMove: "At or below the threshold — MLS does not apply" },
    { position: "$110,000", metric1: "$1,100", metric2: "1%", bestMove: "Above the threshold — MLS on the full amount" },
    { position: "$120,000", metric1: "$1,500", metric2: "1.25%", bestMove: "Compare against a basic hospital-only premium" },
    { position: "$150,000", metric1: "$1,875", metric2: "1.25%", bestMove: "Compare against a basic hospital-only premium" },
    { position: "$170,000", metric1: "$2,550", metric2: "1.5%", bestMove: "Top tier — surcharge is typically well above premium cost" },
  ],
  toolsH2: "How to avoid or minimise the Medicare Levy Surcharge",
  toolsColumns: ["Strategy", "How It Works", "Best For"],
  toolsRows: [
    { tool: "Take out basic hospital cover", effect: "Eliminates MLS entirely — hospital-only policy qualifies", note: "Compare your MLS figure against current premium quotes — the comparison turns on your own income and the policy you choose" },
    { tool: "Check family threshold", effect: "If combined family income under $202k — MLS may not apply", note: "MLS assessed individually but family threshold is higher" },
    { tool: "Cover timing strategy", effect: "Get cover before tax year end — pro-rated MLS for uncovered days", note: "Mid-year cover still reduces MLS on covered period" },
    { tool: "Reduce MLS income", effect: "Concessional super contributions reduce taxable income — may drop below threshold", note: "Check that super strategy does not have other downsides" },
  ],
  aiCorrections: [
    { wrong: "ChatGPT says: Having any private health insurance avoids the Medicare Levy Surcharge", correct: "Reality: Only appropriate private patient hospital cover avoids the MLS. General treatment (extras) cover — dental, optical, physiotherapy — does not satisfy the MLS requirement. You must have hospital cover specifically. Check your policy type, not just that you have private health insurance." },
    { wrong: "ChatGPT says: The Medicare Levy Surcharge applies only to the income above the threshold", correct: "Reality: The MLS applies to your entire MLS income — not just the amount above the threshold. If your income is $110,000 and you cross the $101,001 threshold, you pay 1% on the full $110,000 — $1,100, not 1% of the $9,000 excess. This makes crossing the threshold a significant cliff." },
    { wrong: "ChatGPT says: You can get hospital cover in June to avoid the full year MLS", correct: "Reality: The MLS is calculated on a daily basis for the days you do not have appropriate cover. If you get cover on 1 June and the year ends 30 June, you avoid MLS for those 30 days — but pay MLS for the other 335 days. Getting cover mid-year reduces the MLS but does not eliminate it for the uncovered period." },
  ],
  faqs: [
    { question: "What is the Medicare Levy Surcharge?", answer: "The MLS is an additional tax of 1% to 1.5% imposed on individuals with income over $101,000 who do not hold appropriate private hospital cover for the full financial year. It is charged in addition to the standard 2% Medicare Levy and is designed to encourage higher-income earners to take out private hospital cover and reduce pressure on the public health system." },
    { question: "What counts as appropriate hospital cover?", answer: "Appropriate hospital cover must be provided by a registered health insurer and must include hospital treatment cover. General treatment (extras) cover alone does not qualify. The cover must be for the full year — if you cancel cover mid-year, MLS applies for the uncovered period. Basic hospital-only policies from registered insurers typically satisfy the requirement." },
    { question: "Does the Medicare Levy Surcharge apply to families?", answer: "Families have a higher combined income threshold of $202,000 for 2025/26. If your combined household income is under $202,000, MLS generally does not apply — even if one partner earns over $101,000. The threshold increases by $1,500 for each dependent child after the first. All family members must have appropriate hospital cover for the family threshold to apply. If you had a spouse for the full year and your own income for MLS purposes was $27,222 or less, you are exempt even where combined income is above the threshold (ATO QC71227)." },
    { question: "Can I reduce my MLS income by making super contributions?", answer: "Yes — concessional (before-tax) super contributions reduce your taxable income, which feeds into your income for MLS purposes. If your income is close to the $101,000 threshold, a super contribution that brings income for MLS purposes below $101,001 can eliminate the MLS entirely. Model this carefully — concessional contributions are capped each year, and exceeding the cap has its own tax consequences. Check the current cap before contributing." },
  ],
  accountantQuestionsH2: "Ask these before your tax return is lodged",
  accountantQuestions: [
    { q: "What is my income for MLS purposes — including reportable fringe benefits, net rental property losses, and reportable super contributions?", why: "Many people forget that reportable fringe benefits, net investment losses including net rental property losses, and reportable super contributions are all added back into MLS income. If you negatively gear a property, your income for MLS purposes is HIGHER than your taxable income — not lower." },
    { q: "Is the cost of a basic hospital-only cover less than my MLS liability — and which insurer provides the cheapest qualifying policy?", why: "Above the threshold the surcharge can exceed the cost of a basic hospital-only policy. Your accountant can run the comparison against current premiums for your situation." },
    { q: "As a couple — does the family threshold mean the MLS does not apply to us even though I am over $101,000?", why: "If combined family income is under $202,000, MLS may not apply at all. Many couples do not realise the family threshold is significantly higher." },
    { q: "Would a concessional super contribution bring my income below the MLS threshold and eliminate the surcharge?", why: "If your income is close to $101,000, a relatively small super contribution can eliminate the MLS and save more than the contribution tax paid." },
  ],
  crosslink: { title: "Also check your negative gearing position — income structuring affects MLS.", body: "If you have rental losses offsetting your income, this affects your MLS income calculation. Check your full income picture.", url: "/au/check/negative-gearing-illusion", label: "Check your income and tax position →" },
  lawBarSummary: "Medicare Levy Surcharge 2025/26: singles over $101,001 — 1% to 1.5% additional tax if no appropriate hospital cover. Families over $202,000 combined. Income for MLS purposes includes taxable income + reportable fringe benefits + total net investment losses (including net rental property losses) + reportable super contributions. Avoided by appropriate private hospital cover for full year. Pro-rated for uncovered days. Under ITAA 1936 Part VIIB.",
  lawBarBadges: ["ATO", "ITAA 1936", "MLS", "$101k Threshold 2025/26"],
  sources: [{ title: "ATO — Medicare Levy Surcharge", url: "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge" }, { title: "ATO — Medicare levy surcharge income, thresholds and rates (QC49961)", url: "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates" }],
  files: [
    { num: "01", slug: "mls-01", name: "Your MLS Liability Calculation", desc: "Exact MLS payable and comparison with hospital cover cost.", tier: 1, content: `<h2>Medicare Levy Surcharge Calculation</h2><div class="action-box"><h3>Your MLS Position</h3><p>Income for MLS purposes = Taxable income + Reportable fringe benefits + Total net investment losses (financial + net rental property losses) + Reportable super contributions (employer + deductible personal) + a spouse's share of certain trust income + exempt foreign employment income</p><p>MLS Rate: 1% ($101k-$118k), 1.25% ($118k-$158k), 1.5% (over $158k)</p><p>MLS Payable = MLS Income × Rate (applies to entire income)</p></div><p>Source: <a href="https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge">ATO — Medicare Levy Surcharge</a></p>` },
    { num: "02", slug: "mls-02", name: "Cover Timing Strategy", desc: "How to time hospital cover to minimise MLS for the current year.", tier: 1, content: `<h2>Hospital Cover Timing</h2><p>MLS is calculated on a daily basis for days without appropriate cover. Getting cover now reduces MLS for the rest of the financial year.</p><div class="action-box"><h3>MLS Pro-Rating Calculation</h3><p>Days without cover / 365 × MLS Income × MLS Rate = MLS for uncovered period</p><p>Example: Get cover on 1 January (182 days remaining)</p><p>MLS reduced by: 183/365 × full-year MLS = approximately 50%</p></div><div class="info-box">Getting cover now still saves MLS for the remainder of this financial year.</div>` },
    { num: "03", slug: "mls-03", name: "Threshold Optimisation Guide", desc: "Strategies to reduce MLS income below the threshold.", tier: 1, content: `<h2>MLS Income Reduction Strategies</h2><table><tr><th>Strategy</th><th>How It Reduces MLS Income</th><th>Notes</th></tr><tr><td>Concessional super contributions</td><td>Reduces taxable income — reduces income for MLS purposes</td><td>Subject to the annual concessional contributions cap — check the current cap</td></tr><tr><td>Salary sacrifice (non-super)</td><td>Reduces taxable income if salary sacrificed to work-related items</td><td>FBT implications may apply</td></tr><tr><td>Rental losses (negative gearing)</td><td>Does NOT reduce income for MLS purposes — net rental property losses are added back</td><td>A negatively geared property RAISES your MLS income above your taxable income</td></tr></table>` },
    { num: "04", slug: "mls-04", name: "Your MLS by Income — 2025/26", desc: "What the surcharge costs at each income level, and how to compare it against cover.", tier: 1, content: `<h2>MLS by Income — 2025/26</h2><table><tr><th>Income for MLS purposes</th><th>MLS rate</th><th>Annual MLS</th></tr><tr><td>$101,000 or less</td><td>0%</td><td>$0 — below the threshold</td></tr><tr><td>$110,000</td><td>1%</td><td>$1,100</td></tr><tr><td>$120,000</td><td>1.25%</td><td>$1,500</td></tr><tr><td>$150,000</td><td>1.25%</td><td>$1,875</td></tr><tr><td>$200,000</td><td>1.5%</td><td>$3,000</td></tr></table><p>The MLS applies to your entire income for MLS purposes, not just the amount above the threshold. Compare your figure against current quotes for a basic hospital-only policy — premiums vary by insurer, state and excess, so use live quotes rather than an estimate.</p>` },
    { num: "05", slug: "mls-05", name: "Your Accountant Brief", desc: "MLS questions to take before lodging your tax return.", tier: 1, content: `<div class="info-box">Check these now — MLS is assessed in the annual return and cannot be amended without penalty exposure.</div><div class="action-box"><h3>Question 1</h3><p>"What is my MLS income including fringe benefits and employer super — and do I owe the surcharge?"</p></div><h3>Question 2</h3><p>"Is the cost of hospital cover less than my MLS liability?"</p><h3>Question 3</h3><p>"As a couple — does the family threshold mean MLS doesn't apply to us?"</p>` },
    { num: "06", slug: "mls-06", name: "Full Income and Tax Optimisation", desc: "Coordinate income, super, and private cover for minimum overall tax.", tier: 2, content: `<h2>Income and MLS Optimisation</h2><p>The MLS interacts with superannuation strategy, salary packaging, and overall income structuring. An integrated approach minimises total tax.</p><div class="action-box"><h3>Integrated Strategy</h3><p>1. Calculate income for MLS purposes accurately — include fringe benefits, reportable super contributions, and net investment losses including net rental property losses</p><p>2. Model super contributions — does a contribution eliminate MLS?</p><p>3. Compare net benefit of each strategy against its cost</p><p>4. Select minimum-cost approach to avoid surcharge</p></div>` },
    { num: "07", slug: "mls-07", name: "Family Structuring Strategy", desc: "How couples and families can structure income to minimise MLS.", tier: 2, content: `<h2>Family MLS Strategy</h2><p>Families have a combined income threshold of $202,000 for 2025/26, increased by $1,500 for each dependent child after the first. This can create planning opportunities for couples where income can be spread.</p><table><tr><th>Couple Income Split</th><th>MLS Applies?</th><th>Action</th></tr><tr><td>$120k + $80k = $200,000</td><td>No — under $202,000</td><td>No MLS even without cover</td></tr><tr><td>$110k + $95k = $205,000</td><td>Yes — just over</td><td>1% on combined income; a small reduction may bring you under</td></tr><tr><td>$150k + $100k = $250,000</td><td>Yes — over</td><td>1.25% tier; both partners need appropriate cover</td></tr><tr><td>Spouse own income $27,222 or less</td><td>Exempt</td><td>Exempt even if combined income is above the threshold (QC71227)</td></tr></table>` },
    { num: "08", slug: "mls-08", name: "Insurance and Tax Integration Plan", desc: "Full integration of private cover, MLS, and income structuring.", tier: 2, content: `<h2>Integrated Insurance and Tax Strategy</h2><div class="action-box"><h3>Annual Review Checklist</h3><p>April: Review income forecast for current year — will MLS apply?</p><p>May: Compare cheapest qualifying hospital cover vs MLS</p><p>June: If cover not held — get it before 30 June to limit uncovered period</p><p>July-September: Lodge BAS / review income structuring for next year</p><p>October: Tax return — confirm MLS treatment is correct</p></div><p>For higher-income earners the surcharge is often larger than a basic hospital-only premium, and cover provides additional health access. Break-even depends on your income and the premium you are quoted — compare your own MLS figure against current quotes. The surcharge begins at $101,001 for singles.</p>` },
  ],
  persona: { name: "Gary", age: 64, occupation: "Retired FIFO worker, Perth WA", location: "Perth, Western Australia", family: "Partner Sandra. Two adult kids — Jess and Liam.", financialSnapshot: "$3.4M SMSF income and company distributions. Total income approximately $155,000. Gary and Sandra have not had private health insurance since their FIFO days when it was provided by the employer.", painPoint: "Gary does not know the Medicare Levy Surcharge applies. He has been paying 1.25% MLS on his $155,000 income for at least two years — $1,938 per year in avoidable tax.", discovery: "Sandra mentioned at dinner that she had seen an ad for private health insurance and wondered if they should get it. Gary called his accountant the next day to ask whether it made financial sense.", voice: "Gary will immediately understand the cost comparison once he sees the numbers. Show him $1,938 MLS against a live quote for basic hospital cover and he will make the call that afternoon." },
  story: { hook: "Sandra had seen an ad for private health insurance on the television. She had mentioned it at dinner — maybe they should look into it. Gary had not given it much thought.", setup: ["They had both been on the FIFO employer health cover for years. When Gary retired, the cover stopped. He had not replaced it — they were generally healthy, they had Medicare, and the premiums seemed expensive. Life had moved on.", "At their last accountant meeting in April, the accountant had asked about private health insurance. Gary had said no. The accountant had nodded and moved on. Gary had not connected this to anything.", "Sandra brought it up again in May. She had been to the doctor twice that year and felt the wait at the bulk-billing clinic was getting longer. Gary called his accountant and asked directly: does not having private health insurance cost us anything at tax time?"], revelation: "The accountant's answer was immediate: yes. Gary's income — SMSF pension, company distributions — was around $155,000 for MLS purposes. The 1.25% MLS rate applied. His annual MLS was $1,938. Sandra's income was under the threshold so she was not affected individually. But Gary had been paying $1,938 in extra tax for two years. Total: $3,876 in avoidable tax.", resolution: "Gary and Sandra looked at hospital cover options that afternoon. Gary compared quotes for a basic hospital-only policy and found one that cost less than his surcharge. He took the cover. Gary called the insurer and signed up before the end of the week — ensuring coverage for the last two months of the current financial year and the full year going forward. He also asked his accountant whether prior years could be amended — they could not, but the surcharge stopped from the date cover commenced. Sandra asked why the accountant had not mentioned this when she saw they had no private health insurance listed. It was a fair question." },
  calendarTitle: "Medicare Levy Surcharge — Key Dates",
  // CONFORMED TO THE CALENDAR FAIL-CLOSED RULE (generate-success-pages.ts:126-174).
  // That rule drops an absolute-dated event when the product does not claim a date
  // (productClaimsADate() at :715 → false for temporal kind "none") OR when the date is
  // already past. Both former dates (20260615, 20260501) are past, and kind "none" now
  // disqualifies absolute dates outright — so a rolled-forward absolute date would be
  // dropped at emit rather than shipped. Relative events are computed from the customer's
  // own "today" and assert no legal date, so they are the only shape that survives.
  // Reworded off "before 30 June" / "Due": these are REVIEW PROMPTS, not act-by claims.
  tier1Calendar: [{ uid: "mls-cover", summary: "Private health — check your hospital cover for the current income year", description: "MLS accrues for each day without appropriate hospital cover. Confirm your cover is in place and qualifying.", date: "relative:+14days" }, { uid: "mls-return", summary: "Tax return — confirm MLS treatment", description: "MLS is assessed when the ATO processes your return. Check the surcharge has been applied correctly.", date: "relative:+90days" }],
  tier2Calendar: [{ uid: "mls-review", summary: "MLS — income and cover review", description: "Review forecast income for MLS purposes and compare your surcharge against current cover quotes.", date: "relative:+14days" }, { uid: "mls-cover", summary: "Private health — check your hospital cover for the current income year", description: "MLS accrues for each day without appropriate hospital cover. Confirm your cover is in place and qualifying.", date: "relative:+30days" }, { uid: "mls-return", summary: "Tax return — confirm MLS treatment", description: "MLS is assessed when the ATO processes your return. Check the surcharge has been applied correctly.", date: "relative:+90days" }],
  // MEASURED DEAD 2026-07-31: repo-wide grep for NEXT_PUBLIC_DRIVE / tier1DriveEnvVar /
  // tier2DriveEnvVar finds NO reader in app/, lib/, components/, scripts/ or cole/ — the
  // only occurrences anywhere are these declarations in the config files themselves.
  // Emptied per CLAUDE.md rule 3 (always empty strings) and rule 5 (no Google Drive; delivery
  // is inline via the files array).
  delivery: { tier1DriveEnvVar: "", tier2DriveEnvVar: "" },
  monitorUrls: ["https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge", "https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy-surcharge/medicare-levy-surcharge-income-thresholds-and-rates"],
  sidebarNumbers: [{ label: "Singles threshold", value: "$101,001" }, { label: "Family threshold", value: "$202,000" }, { label: "Top MLS rate", value: "1.5%" }, { label: "On $150k", value: "$1,875 MLS" }],
  sidebarMathsTitle: "The MLS calculation",
  sidebarMathsIncludes: ["Taxable income + reportable fringe benefits + net investment losses (incl. net rental property losses) + reportable super contributions", "Applies to entire income for MLS purposes — not just amount over threshold", "Avoided by appropriate hospital cover for full year"],
  sidebarMathsExcludes: ["NOT avoided by extras-only cover", "NOT pro-rated to threshold excess only", "NOT a family threshold if combined income over $202k"],
  sidebarMathsNote: "Source: ATO — Medicare Levy Surcharge · ITAA 1936 Part VIIB",
  howToSteps: [{ position: 1, name: "Enter total income", text: "Select your income including fringe benefits and reportable employer super." }, { position: 2, name: "Confirm cover status", text: "Indicate whether you have appropriate private hospital cover." }, { position: 3, name: "Get MLS calculation", text: "See your exact MLS liability and comparison with hospital cover cost." }, { position: 4, name: "Get your avoidance plan", text: "Receive cover options, timing strategy, and income structuring analysis." }],
  successPromptFields: [
    { key: "annual_income",      label: "Income band for MLS purposes",          defaultVal: "band_93_108" },
    { key: "has_hospital_cover", label: "Has appropriate hospital cover",         defaultVal: "false" },
    { key: "is_family",          label: "Family or single assessment",            defaultVal: "false" },
    { key: "status",             label: "MLS verdict status",                     defaultVal: "SURCHARGE APPLIES" },
    { key: "mls_annual",         label: "Estimated annual MLS exposure (AUD)",    defaultVal: "1000" },
    { key: "tier",               label: "Product tier purchased",                 defaultVal: "67" },
  ],
  tier1AssessmentFields: [
    "mlsStatus",
    "incomeForMLSPurposes",
    "surchargeRateTier",
    "estimatedMLSPayable",
    "coverCostEstimate",
    "netSavingFromCover",
    "coverTimingStrategy",
    "thresholdPosition",
    "strongestRiskTrigger",
    "confidenceLevel",
    "firstAction",
  ],
  tier2AssessmentFields: [
    "mlsStatus",
    "incomeForMLSPurposes",
    "surchargeRateTier",
    "estimatedMLSPayable",
    "coverCostEstimate",
    "netSavingFromCover",
    "coverTimingStrategy",
    "partnerCoverAnalysis",
    "familyThresholdPosition",
    "superContributionOpportunity",
    "policyExcessCheck",
    "integratedPlan",
    "nextYearCalendar",
    "strongestRiskTrigger",
    "confidenceLevel",
  ],
};
