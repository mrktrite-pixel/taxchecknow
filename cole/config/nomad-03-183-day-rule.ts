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
  // TRUE as of Step F (2026-08-01), IN THE SAME COMMIT as the mount and the
  // cole/calculators sync. verifyEngineNative() throws in EITHER direction on
  // disagreement, so the declaration, the app-dir mount and the cole/ copy move
  // together or not at all.
  engineNative: true,

  // ── TEMPORAL DECLARATION (TEMPORAL v1 · Step C) ─────────────────────────
  // "unresolvable", NOT "none" — the first product in this programme where the
  // answer is not "none", per Session B's 1.1 (2026-08-01).
  // The build's own extraction says there is nothing (urgency_triggers EMPTY,
  // deadline_window_days null), but the corpus contains an ACT-BY CONSEQUENCE the
  // extractor missed, verbatim from the IRS page: send Form 8843 "by the due date
  // for filing an income tax return", and "if you do not timely file Form 8843,
  // you cannot exclude the days" — miss it and your day count rises, which can
  // flip you from nonresident to resident. So a REAL date exists.
  // It CANNOT BE COMPUTED HERE, which is the definition of unresolvable:
  //   · the corpus names the date only by REFERENCE and states no date (zero
  //     month-day tokens in the whole corpus; "April 15" absent);
  //   · that reference resolves PER-TAXPAYER — US-resident filers, filers abroad
  //     and anyone on extension all differ (a 1040-NR with no withheld wages is
  //     June 15);
  //   · the engine never establishes WHO NEEDS FORM 8843 — it has no question
  //     about exempt-individual status or medical condition.
  // Proposing a fixed April 15 recurrence would import a figure the authority
  // never gave us, which is the fabrication this programme exists to stop.
  temporal: {
    kind:         "unresolvable",
    reason:       "act_by_date_is_per_taxpayer_and_uncaptured",
    jurisdiction: "US",
    domain:       "us_tax_residency",
    label:        "Form 8843 due with the income tax return",
  },
  // `market` is NOT display-only: generate-success-pages.ts:313 posts it to
  // /api/assess as the assessment's market context, so "Global (cross-border
  // residency tests)" was actively steering the paid assessment to answer across
  // five jurisdictions on a one-jurisdiction corpus. Narrowed with the rest.
  // `country: "global"` is STRUCTURAL (it is the app/files/<country>/… path
  // segment) and is deliberately left alone — it is not a claim.
  id: "day-183-rule", name: "183-Day Rule Reality Check", site: "taxchecknow", country: "global", market: "United States (IRS Substantial Presence Test)", language: "en", currency: "USD",
  slug: "nomad/check/183-day-rule", url: "https://taxchecknow.com/nomad/check/183-day-rule", apiRoute: "/api/rules/day-183-rule",
  authority: "IRS", authorityUrl: "https://www.irs.gov/individuals/international-taxpayers/substantial-presence-test", legalAnchor: "US IRC §7701(b) — Substantial Presence Test", legislation: "United States Internal Revenue Code §7701(b) — the Substantial Presence Test. A non-citizen is treated as a U.S. resident for tax purposes when physically present at least 31 days in the current year and at least 183 days across a weighted three-year count (all current-year days, one third of the prior year, one sixth of the year before that). Specified days are excluded, and excluding days as an exempt individual or for a medical condition requires Form 8843.",
  lastVerified: "August 2026",
  tier1: { price: 67, name: "Your U.S. Substantial Presence Check", tagline: "Stayed under 183 days in the U.S. — does that make you a non-resident? The count is over three years.", value: "A personalised walk-through of the U.S. Substantial Presence Test — how your days are weighted across three years, which of your days may not count, and what the result means for your U.S. filing position.", cta: "Get My Residency Check — $67 →", productKey: "nomad_67_183_day_rule", envVar: "STRIPE_NOMAD_183_67", successPath: "assess", fileCount: 5 },
  tier2: { price: 147, name: "Your U.S. Presence Documentation System", tagline: "Day-count evidence, excluded-day support, and audit-ready documentation", value: "Full U.S. presence position: your weighted three-year count, the exclusions you may be entitled to and what each requires, Form 8843 where it applies, and an audit-ready documentation pack.", cta: "Get My Residency Strategy — $147 →", productKey: "nomad_147_183_day_rule", envVar: "STRIPE_NOMAD_183_147", successPath: "plan", fileCount: 8 },
  // TEMPORAL v1 — isoDate NEUTRALISED alongside the kind "unresolvable" declaration above.
  // The old block asserted a 31 December boundary for "most jurisdictions": the corpus states
  // no date at all, and the one real act-by moment (Form 8843, due with the return) resolves
  // per-taxpayer. The prose names the moment without asserting a date.
  deadline: { isoDate: "", display: "Your income tax return due date", short: "With your return", description: "The U.S. day-count year runs on the calendar year, but the one act-by moment in this test — filing Form 8843 to exclude days — falls on your own income tax return due date, which differs by filer.", urgencyLabel: "PER-FILER", countdownLabel: "" },
  h1: "Does Staying Under 183 Days Make You a U.S. Non-Resident? The IRS Counts Three Years of Days, Not One.",
  metaTitle: "183-Day Rule and the U.S. Substantial Presence Test — Does Under 183 Days Make You a Non-Resident? | TaxCheckNow",
  metaDescription: "The U.S. Substantial Presence Test does not count one year of days. It counts 31 days in the current year plus a weighted three-year total of 183 — all of this year, a third of last year, a sixth of the year before. Some days do not count at all. Free checker shows where you land. Other countries apply their own tests, which differ.",
  canonical: "https://taxchecknow.com/nomad/check/183-day-rule",
  answerHeadline: "The answer — IRS, Substantial Presence Test",
  answerBody: [
    "The 183-day rule is widely cited as the test for tax non-residency. For the United States that is not how the count works. Under the Substantial Presence Test you are treated as a U.S. resident for tax purposes if you were physically present in the United States on at least 31 days of the current year AND at least 183 days across three years — counting every day of the current year, one third of the days in the year before, and one sixth of the days in the year before that. A person who spends 120 days in the U.S. in each of three consecutive years reaches 180 on that weighting and is not a resident under this test; a small increase tips it over.",
    "Not every day of physical presence counts. Days in transit through the United States of under 24 hours between two places outside it, days as a crew member of a foreign vessel, days you regularly commute to work from a residence in Canada or Mexico, days you could not leave because of a medical condition that arose while you were in the U.S., and days as an exempt individual are all excluded. Excluding days as an exempt individual or for a medical condition is not automatic — it requires Form 8843, filed by the due date for your income tax return. File it late and the IRS position is that you cannot exclude those days at all.",
    "If the test treats you as a U.S. resident, you are generally taxed on worldwide income and file as a resident, which is a materially different position from filing as a nonresident. A closer connection exception exists for some people who meet the day count but have a tax home and closer connection to another country, and separate rules apply to students. This check covers the U.S. Substantial Presence Test only — every other country applies its own residency test, and they differ from this one and from each other.",
  ],
  answerSource: "Source: IRS — Substantial presence test · US IRC §7701(b)",
  mistakesHeadline: "Common AI errors on this topic",
  mistakes: [
    "I was in the U.S. under 183 days this year so the test does not catch me — wrong. The Substantial Presence Test does not count a single year. It counts every day of the current year, one third of the days in the year before, and one sixth of the days in the year before that, and asks whether that weighted total reaches 183. Someone with 150 U.S. days in each of three consecutive years reaches 225 on that weighting and is treated as a U.S. resident, despite never being near 183 days in any one year.",
    "Reaching 183 weighted days is enough on its own — wrong, there are two thresholds and both must be met. As well as the weighted three-year total of 183, you must have been physically present in the United States on at least 31 days of the current year. Someone with 25 U.S. days this year does not meet the test no matter how large the two earlier years were.",
    "Every day I set foot in the U.S. counts — wrong, several categories of day are excluded. Days in transit through the United States of under 24 hours between two places outside it, days as a regular crew member of a foreign vessel, days you regularly commute to work from a residence in Canada or Mexico, days you could not leave because of a medical condition that arose while you were in the U.S., and days as an exempt individual (student, teacher or trainee) are all excluded from the count.",
    "Excluded days come off my count automatically — wrong for two of the categories. Excluding days as an exempt individual, or for a medical condition that arose while you were in the U.S., requires Form 8843, filed by the due date for your income tax return. The IRS position is that if Form 8843 is not filed on time you cannot exclude those days at all — which can move you from nonresident to resident on the same travel history.",
  ],
  chainVisual: { label: "One-year day count vs the IRS three-year weighted count", broken: "150 U.S. days this year  →  \"under 183, so nonresident\"  →  count only the current year  →  IRS weights in the prior two years (150 + 50 + 25)  →  225 weighted days  →  treated as a U.S. resident  →  worldwide income reporting  ❌", fixed: "Count all three years on the IRS weighting (all of this year + 1/3 + 1/6)  →  check the 31-day current-year minimum  →  subtract excluded days (transit / crew / commuter / medical / exempt individual)  →  file Form 8843 by your return due date where it is required  →  documented position  ✔" },
  brackets: [
    { label: "Under 31 U.S. days in the current year — the test is not met, whatever the earlier years hold", value: 1, status: "clear"       },
    { label: "Weighted three-year total under 183 — not a U.S. resident under this test",       value: 2, status: "clear"       },
    { label: "Counting this year only — the two earlier years still weigh in at 1/3 and 1/6",    value: 3, status: "trap"        },
    { label: "31+ current-year days AND weighted three-year total 183+ — treated as a U.S. resident", value: 4, status: "trap"        },
    { label: "Exempt-individual or medical days claimed without a timely Form 8843 — the days cannot be excluded", value: 5, status: "trap"        },
  ],
  // ── DEAD SINCE engineNative: true — ANNOTATED, NOT REWRITTEN ─────────────
  // The fields from here to `calculatorClarification` fed the BESPOKE calculator
  // generator. generate-calculator.ts:26 does not merely skip on
  // `engineNative: true` — it THROWS a GuardRefusal, so this template can never
  // run for this product again. The mounted calculator is the EngineCalculator
  // wrapper, driven by engine.json and presentation.json, and it never reads these.
  // VERIFIED, not assumed: the only consumers of calculatorInputs, tierAlgorithm,
  // calculatorRuleBox and calculatorClarification anywhere in the repo are
  // generate-calculator.ts (refuses) and the type declaration. `brackets` is the
  // exception — generate-rules-route.ts:166 still emits it into /api/rules as
  // `thresholds` — so it is NARROWED ABOVE rather than annotated here.
  // They therefore assert nothing to any customer or crawler, and are left
  // BYTE-UNCHANGED so the dead surface stays visibly dead rather than becoming a
  // rewritten-and-therefore-plausible one. Whoever revives a bespoke calculator
  // for this product must narrow them first: as written they still describe five
  // jurisdictions the corpus cannot ground.
  calculatorInputs: [
    { type: "buttonGroup", stateKey: "departureCountry", label: "Which country are you trying to leave (or have already left)?", subLabel: "The country you were tax resident in, or that currently claims you.", options: [{ label: "United Kingdom", value: "uk" }, { label: "Australia", value: "au" }, { label: "New Zealand", value: "nz" }, { label: "Canada", value: "ca" }, { label: "United States", value: "us" }, { label: "Other jurisdiction", value: "other" }], default: "uk" },
    { type: "buttonGroup", stateKey: "daysInCountry", label: "Days spent in that country in last 12 months?", subLabel: "Passport/boarding-card accurate day count. Part-days count under most tests.", options: [{ label: "Under 16 days", value: "under_16" }, { label: "16-45 days", value: "16_45" }, { label: "46-90 days", value: "46_90" }, { label: "91-182 days", value: "91_182" }, { label: "183+ days", value: "183_plus" }], default: "91_182" },
    { type: "buttonGroup", stateKey: "ukTiesCount", label: "UK ties count (UK only — how many apply)?", subLabel: "Family tie (spouse/partner or minor children in UK); accommodation tie (home available); work tie (40+ days substantive work); 90-day tie (90+ days in either prior year); country tie (more UK days than any other single country).", options: [{ label: "0 ties", value: "0" }, { label: "1 tie", value: "1" }, { label: "2 ties", value: "2" }, { label: "3 ties", value: "3" }, { label: "4+ ties", value: "4_plus" }], default: "2" },
    { type: "buttonGroup", stateKey: "propertyRetained", label: "Do you still have a property available to you in that country?", subLabel: "Available means accessible on a continuing basis (own, rent, or family home available to you). Not required to be occupied.", options: [{ label: "Yes — own or rent a property there", value: "yes_own_rent" }, { label: "Yes — family home available", value: "yes_family_home" }, { label: "No — all property connections severed", value: "no_severed" }, { label: "Not sure", value: "unsure" }], default: "yes_own_rent" },
    { type: "buttonGroup", stateKey: "familyLocation", label: "Where is your family (spouse/partner and dependent children)?", subLabel: "Family location is a strong tie in UK SRT, AU domicile, CA factual residence tests.", options: [{ label: "All in the country I am leaving", value: "home_country" }, { label: "Split between countries", value: "split" }, { label: "All in new country", value: "new_country" }, { label: "No dependants / single", value: "none" }], default: "home_country" },
    { type: "buttonGroup", stateKey: "formallyNotified", label: "Have you formally notified the tax authority of your departure?", subLabel: "UK: form P85 / self-assessment split-year. AU: ATO departing Australia statement. NZ: IRD non-resident notification. CA: departure return with deemed dispositions.", options: [{ label: "Yes — filed departure return / notified", value: "yes" }, { label: "No — just stopped filing", value: "no" }, { label: "Not applicable / not sure", value: "na" }], default: "no" },
  ],
  tierAlgorithm: { description: "High-risk combinations (still resident via ties, 183+ days triggered, or no formal notification) → tier2. Clean departure with no ties → tier1.", tier2Conditions: ["daysInCountry === '183_plus'", "propertyRetained === 'yes_own_rent' || propertyRetained === 'yes_family_home'", "familyLocation === 'home_country'", "formallyNotified === 'no'"], tier2Flags: [] },
  calculatorRuleBox: { label: "The rule — country-specific residency tests", body: "The 183-day rule is NOT universal. Each country applies its own test: UK Statutory Residence Test (Finance Act 2013 Sch 45) uses automatic tests + sufficient ties — can establish UK residency with as few as 16 days if 4 UK ties exist. Australia (ITAA 1936 s6(1)) applies resides test + domicile test + 183-day test — domicile can maintain residency regardless of days. New Zealand (ITA 2007 s YD 1) applies 183-day presence test + permanent place of abode test — the latter applies regardless of days if a home is maintained. Canada (ITA s250) applies factual residence based on ties + 183-day deemed resident rule. United States (IRC §7701(b)) applies substantial presence test + citizenship-based worldwide taxation. Where two countries both claim residency, OECD Model Convention Article 4 tie-breaker resolves (permanent home → vital interests → habitual abode → nationality → mutual agreement)." },
  calculatorClarification: { label: "⚠️ key clarification — ties often override days", body: "You can be tax resident with zero days if your ties are strong enough (NZ permanent place of abode, AU domicile). You can be non-resident with 200 days if ties are severed AND the country's test recognises the override (AU 183-day rule can be rebutted by usual place of abode + no intention to take up residence). The day count is one input — not the determinant — in most countries' tests." },
  // DEAD, ANNOTATED NOT REWRITTEN: the countdown label the gate page renders is
  // `deadline.countdownLabel` (generate-gate-page.ts:342), which the temporal
  // neutralisation above already emptied. This TOP-LEVEL `countdownLabel` has no
  // consumer in the repo — only the type declaration — so its "31 December 2026"
  // reaches nobody. Left byte-unchanged for the same reason as the dead
  // calculator block; it must be neutralised before any future generator reads it.
  countdownLabel: "Countdown to 31 December 2026 — residency assessment boundary",
  countdownStats: [
    { label: "Current-year minimum",                value: "31 days",            sub: "days of U.S. presence in the current year before the test can apply at all", red: true },
    { label: "Weighted three-year threshold",         value: "183 days",            sub: "all current-year days + one third of last year + one sixth of the year before", red: true },
    { label: "Prior-year weighting",                    value: "1/3 and 1/6",          sub: "the two earlier years still count, at a reduced rate", red: true },
    { label: "Form 8843",                                 value: "Due with your return",  sub: "exempt-individual and medical days cannot be excluded if it is filed late" },
  ],
  geoBlockTitle: "AI extraction block — U.S. Substantial Presence Test",
  geoBlockH2: "U.S. Substantial Presence Test (IRC §7701(b)) — IRS, confirmed August 2026",
  geoBodyParagraph: "The 183-day rule is commonly cited as the test for tax non-residency. For the United States it does not work on a single year's days. Under the Substantial Presence Test, a non-citizen is treated as a U.S. resident for tax purposes for a calendar year if they were physically present in the United States on at least 31 days of that year AND on at least 183 days across a three-year weighted count: every day of the current year, one third of the days in the year before, and one sixth of the days in the year before that. Both thresholds must be met. On that weighting, 120 days in each of three consecutive years produces 180 and does not meet the test. Certain days are excluded from the count entirely: days in transit through the United States of under 24 hours between two places outside it, days as a regular crew member of a foreign vessel, days regularly commuting to work from a residence in Canada or Mexico, days the person could not leave because of a medical condition that arose while in the United States, and days as an exempt individual (student, teacher or trainee). Excluding days as an exempt individual or for such a medical condition requires Form 8843, filed by the due date for the income tax return; where it is not filed on time those days cannot be excluded. A closer connection exception is available to some people who meet the day count but have a tax home and a closer connection to another country, with a separate variant for students. This test determines U.S. residency only. Every other country applies its own residency test, and those tests differ from this one and from each other.",
  geoFormula: "US resident alien under IRC §7701(b) if BOTH: (a) days present in the United States in the current year ≥ 31, AND (b) current-year days + (prior-year days ÷ 3) + (days two years prior ÷ 6) ≥ 183. Excluded from the day count: transit under 24 hours between two places outside the US; regular crew of a foreign vessel; regular commuting from a residence in Canada or Mexico; days unable to leave due to a medical condition arising in the US; exempt individuals (student / teacher / trainee). Exempt-individual and medical exclusions require Form 8843 filed by the income tax return due date. Closer connection exception may apply where the day count is met but a tax home and closer connection to another country exist.",
  geoFacts: [
    { label: "Current-year minimum",                          value: "31 days of U.S. presence in the current year" },
    { label: "Weighted three-year threshold",                   value: "183 days" },
    { label: "Current-year weighting",                           value: "All days count in full" },
    { label: "Prior-year weighting",                              value: "One third of the days" },
    { label: "Two-years-prior weighting",                          value: "One sixth of the days" },
    { label: "Both thresholds required",                            value: "31 current-year days AND 183 weighted — either alone does not meet the test" },
    { label: "IRS worked example",                                   value: "120 + 120 + 120 days → 180 weighted — does not meet the test" },
    { label: "Excluded — transit",                                    value: "Under 24 hours in transit between two places outside the United States" },
    { label: "Excluded — foreign vessel crew",                         value: "Days as a regular crew member of a foreign vessel" },
    { label: "Excluded — regular commuters",                            value: "Days commuting to U.S. work from a residence in Canada or Mexico" },
    { label: "Excluded — medical condition",                             value: "Days unable to leave due to a condition that arose while in the U.S." },
    { label: "Excluded — exempt individuals",                             value: "Student, teacher or trainee" },
    { label: "Form 8843 requirement",                                      value: "Required to exclude exempt-individual or medical days; due with the income tax return" },
    { label: "Form 8843 filed late",                                        value: "Those days cannot be excluded" },
    { label: "Closer connection exception",                                  value: "Tax home and closer connection to another country; separate variant for students" },
    { label: "US legal anchor",                                               value: "IRC §7701(b)" },
    { label: "Scope of this test",                                             value: "Determines U.S. residency only — other countries apply their own tests, which differ" },
  ],
  workedExamplesH2: "Four day-count scenarios under the U.S. test",
  workedExamplesColumns: ["Scenario", "Setup", "Weighted three-year total", "Outcome"],
  workedExamples: [
    { name: "Steady 120 days a year",                     setup: "120 U.S. days in the current year and in each of the two prior years; no excluded days",            income: "180 days",     status: "NOT A RESIDENT — the IRS's own worked example; 120 + 40 + 20 is under 183" },
    { name: "Steady 150 days a year",                        setup: "150 U.S. days in the current year and in each of the two prior years; no excluded days",             income: "225 days",     status: "U.S. RESIDENT — 31+ current-year days and 150 + 50 + 25 is over 183" },
    { name: "Heavy earlier years, light now",                 setup: "25 U.S. days this year; 330 in each of the two prior years",                                          income: "190 days",     status: "NOT A RESIDENT — the weighted total is met but the 31-day current-year minimum is not" },
    { name: "Exempt individual, Form 8843 filed late",         setup: "200 U.S. days this year as a student; Form 8843 not filed by the income tax return due date",          income: "200 days",     status: "U.S. RESIDENT — the exempt-individual days cannot be excluded once the form is late" },
  ],
  comparisonH2: "Same travel, different outcomes under the U.S. test",
  comparisonColumns: ["Day pattern", "How the count runs", "Excluded days available?", "Outcome under the Substantial Presence Test"],
  comparisonRows: [
    { position: "120 / 120 / 120",      metric1: "All of this year + 1/3 of last + 1/6 of the year before",  metric2: "None claimed",                                     bestMove: "180 weighted — does not meet the test" },
    { position: "150 / 150 / 150",       metric1: "Same weighting, larger numbers",                             metric2: "None claimed",                                      bestMove: "225 weighted — treated as a U.S. resident" },
    { position: "25 this year / 330 / 330", metric1: "Current-year minimum is checked first",                     metric2: "None claimed",                                       bestMove: "190 weighted, but under 31 current-year days — does not meet the test" },
    { position: "200 this year, student",     metric1: "Exempt-individual days may come out of the count",          metric2: "Yes — Form 8843 required",                            bestMove: "Excluded only if Form 8843 is filed by the return due date; otherwise counted" },
    { position: "Daily commuter from Canada or Mexico", metric1: "Regular commuting days are excluded outright",      metric2: "Yes — no Form 8843 for this category",                 bestMove: "Only the non-commuting days count toward 31 and 183" },
  ],
  toolsH2: "What each excluded-day category requires",
  toolsColumns: ["Excluded day category", "What it covers", "What it requires"],
  toolsRows: [
    { tool: "Transit under 24 hours", effect: "Days in transit through the United States of less than 24 hours while travelling between two places outside it",         note: "Itinerary, tickets and boarding records establishing both endpoints and the elapsed time" },
    { tool: "Foreign vessel crew",     effect: "Days present as a regular crew member of a foreign vessel travelling between the United States and a foreign country",     note: "Crew documentation and voyage records" },
    { tool: "Regular commuter",         effect: "Days regularly commuting to work in the United States from a residence in Canada or Mexico",                              note: "Evidence of the foreign residence and of the regular commuting pattern" },
    { tool: "Medical condition",         effect: "Days you could not leave the United States because of a medical condition that arose while you were there",                note: "Form 8843, filed by the due date for your income tax return, supported by medical evidence" },
    { tool: "Exempt individual",          effect: "Days present as a student, teacher or trainee within the exempt-individual categories",                                    note: "Form 8843, filed by the due date for your income tax return. Filed late, the days cannot be excluded at all." },
  ],
  aiCorrections: [
    { wrong: "ChatGPT says: I was in the U.S. under 183 days this year, so I am not a U.S. resident", correct: "Reality: the Substantial Presence Test does not count one year. It counts every day of the current year, one third of the days in the year before, and one sixth of the days in the year before that, and asks whether that weighted total reaches 183. 150 U.S. days in each of three consecutive years produces 225 on that weighting and meets the test, without ever approaching 183 in a single year." },
    { wrong: "ChatGPT says: reaching 183 weighted days makes you a U.S. resident", correct: "Reality: there are two thresholds and both must be met. As well as 183 weighted days across three years, you must have been physically present in the United States on at least 31 days of the current year. 25 U.S. days this year does not meet the test however large the two earlier years were." },
    { wrong: "ChatGPT says: every day you are physically in the U.S. counts toward the test", correct: "Reality: several categories of day are excluded. Days in transit through the United States of under 24 hours between two places outside it, days as a regular crew member of a foreign vessel, days regularly commuting to work from a residence in Canada or Mexico, days you could not leave because of a medical condition that arose while you were in the U.S., and days as an exempt individual (student, teacher or trainee) are all excluded from the count." },
    { wrong: "ChatGPT says: excluded days are simply left out of your count", correct: "Reality: two of the categories are conditional on a filing. Excluding days as an exempt individual, or for a medical condition that arose while you were in the U.S., requires Form 8843 filed by the due date for your income tax return. The IRS position is that if it is not filed on time you cannot exclude those days at all — the same travel history can then produce a resident outcome instead of a nonresident one." },
  ],
  faqs: [
    { question: "Does staying under 183 days in the U.S. make me a nonresident?",                              answer: "Not on its own, because the Substantial Presence Test does not count a single year. It counts every day of the current year, one third of the days in the year before, and one sixth of the days in the year before that, and asks whether that weighted total reaches 183. Someone with 150 U.S. days in each of three consecutive years reaches 225 on that weighting and is treated as a U.S. resident, without ever being close to 183 days in any one year." },
    { question: "How exactly is the weighted three-year count calculated?",                                      answer: "All of your U.S. days in the current year, plus one third of your U.S. days in the year before, plus one sixth of your U.S. days in the year before that. The IRS's own worked example is 120 days in each of three years: 120 + 40 + 20 = 180, which is under 183 and does not meet the test." },
    { question: "Is 183 weighted days the only threshold?",                                                      answer: "No — there are two, and both must be met. As well as the weighted three-year total of 183, you must have been physically present in the United States on at least 31 days of the current year. If you were in the U.S. for 25 days this year, the test is not met no matter how many days you spent there in the two earlier years." },
    { question: "Which days do not count toward the test?",                                                       answer: "Days in transit through the United States of under 24 hours while travelling between two places outside it; days as a regular crew member of a foreign vessel travelling between the U.S. and a foreign country; days you regularly commute to work in the U.S. from a residence in Canada or Mexico; days you could not leave because of a medical condition that arose while you were in the United States; and days as an exempt individual." },
    { question: "Who is an exempt individual?",                                                                    answer: "The exempt-individual categories in this test are students, teachers and trainees. Days present in one of those capacities are excluded from the day count — but the exclusion is not automatic, and it depends on filing Form 8843." },
    { question: "What is Form 8843 and when is it due?",                                                            answer: "Form 8843 is what supports excluding days as an exempt individual, or for a medical condition that arose while you were in the United States. It is due by the due date for filing your income tax return. If you do not have to file an income tax return, it is sent on its own to the address in the form's instructions, by that same date." },
    { question: "What happens if I file Form 8843 late?",                                                            answer: "The IRS position is that if you do not timely file Form 8843 you cannot exclude the days you were present as an exempt individual, or because of a medical condition that arose while you were in the U.S. Those days go back into the count, which can move you from nonresident to resident on exactly the same travel history. There is a reasonable-cause let-out where you can show by clear and convincing evidence that you took reasonable actions to become aware of the requirement and to comply." },
    { question: "Do the transit, crew and commuter exclusions also need Form 8843?",                                  answer: "No. The form requirement attaches to the exempt-individual and medical-condition exclusions. The transit, foreign-vessel-crew and regular-commuter exclusions are part of how the count is defined — but you should still hold the records that establish them, because the burden of showing a day does not count is yours." },
    { question: "What does it mean if the test treats me as a U.S. resident?",                                         answer: "You are generally taxed on worldwide income and file as a resident, rather than filing as a nonresident on U.S.-source income. That is a materially different filing position, and it is the reason the day count is worth getting right rather than estimating." },
    { question: "What is the closer connection exception?",                                                             answer: "A person who meets the day count under the Substantial Presence Test may still be treated as a nonresident if they have a tax home in another country and a closer connection to that country than to the United States. There is a separate variant of the exception for students. It is an exception to a test you have otherwise met, not a way of avoiding the count." },
    { question: "Does this test apply to U.S. citizens and green card holders?",                                          answer: "No. The Substantial Presence Test decides whether a non-citizen is treated as a U.S. resident for tax purposes. U.S. citizens and lawful permanent residents are taxed on worldwide income regardless of how many days they spend in the United States and regardless of where they live, so a day count does not change their position." },
    { question: "Does this tell me my residency position in other countries?",                                             answer: "No. This check covers the U.S. Substantial Presence Test only. Every other country applies its own residency test, and those tests differ from this one and from each other — some do not turn on a day count at all. If more than one country may treat you as resident, that is a separate question and it needs advice covering each country involved." },
  ],
  accountantQuestionsH2: "Ask these before you assume the U.S. test does not catch you",
  accountantQuestions: [
    { q: "Run my actual travel history through the weighted three-year count — what is my total, and does it reach 183?", why: "The count is all of the current year, one third of the year before, and one sixth of the year before that. Most people who assume they are safe have only counted the current year, and the two earlier years are where the total comes from." },
    { q: "Was I physically present in the United States on at least 31 days of the current year?", why: "Both thresholds have to be met. If the current-year count is under 31 the test is not met at all, and the weighted total stops mattering. It is the fastest question to settle and it is often skipped." },
    { q: "Which of my U.S. days fall into an excluded category, and what evidence do I hold for each?", why: "Transit under 24 hours, foreign-vessel crew days, regular commuting from a residence in Canada or Mexico, medical days, and exempt-individual days come out of the count. The burden of showing a day does not count sits with you, so the evidence matters as much as the category." },
    { q: "Do I need to file Form 8843, and by what date for my own filing position?", why: "Excluding exempt-individual or medical days depends on Form 8843, due by the due date for your income tax return — which differs between filers. Filed late, the IRS position is that those days cannot be excluded at all." },
    { q: "If the test does treat me as a U.S. resident, does the closer connection exception apply to me?", why: "It is available to some people who meet the day count but have a tax home and a closer connection to another country, with a separate variant for students. It is the remaining route once the count itself is settled, and it needs to be assessed on your facts." },
  ],
  crosslink: { title: "Step 1: classify your residency risk state", body: "Before running the 183-day rule reality check, start with the Nomad Residency Risk Index — classifies GREEN / YELLOW / RED and routes to the right engine for your situation.", url: "/nomad", label: "Nomad Residency Risk Index →" },
  lawBarSummary: "US Substantial Presence Test (IRC §7701(b)): you are treated as a U.S. resident for tax purposes if you were physically present at least 31 days in the current year AND at least 183 days across three years, counting all current-year days, one third of last year's, and one sixth of the year before. Some days do not count — under-24-hour transit between two places outside the U.S., crew of a foreign vessel, regular commuting from Canada or Mexico, days you could not leave because of a medical condition that arose in the U.S., and days as an exempt individual. Excluding days as an exempt individual or for a medical condition requires Form 8843, filed by the due date for your return. This check covers the U.S. test only; other countries apply their own residency tests, which differ.",
  lawBarBadges: ["IRS", "IRC §7701(b)", "Substantial Presence Test", "31-Day + 183-Day Weighted", "Form 8843"],
  // SOURCES TRIMMED TO WHAT IS ACTUALLY CAPTURED. A `sources` entry is a claim of
  // backing, and the build behind this product captured exactly ONE page: the IRS
  // Substantial presence test page (snapshot 6134b9ef, content-hash verified,
  // fetched 2026-08-01). The HMRC, ATO, IRD NZ, CRA and OECD entries asserted
  // backing that does not exist and are removed.
  // NOTE ON COUNT: the work order says "the four uncaptured authority entries".
  // There were FIVE — the OECD Model Tax Convention entry is the fifth, and it was
  // also this config's former declared `authorityUrl`. It is removed on the same
  // ground, because it fails the same test.
  sources: [
    { title: "IRS — Substantial Presence Test (US)",                                          url: "https://www.irs.gov/individuals/international-taxpayers/substantial-presence-test" },
    { title: "Machine-readable JSON rules",                                                       url: "/api/rules/day-183-rule" },
  ],
  files: [
    { num: "01", slug: "d183-01", name: "Your Substantial Presence Position",                  desc: "Where your weighted three-year day count lands against the two IRS thresholds.", tier: 1, content: `<h2>Your Substantial Presence Position</h2><div class="action-box"><h3>The test, in the order it is applied</h3><p><strong>Threshold 1 — current year:</strong> at least 31 days physically present in the United States. Not met, test not met, whatever the earlier years hold.</p><p><strong>Threshold 2 — weighted three-year total:</strong> at least 183 days, counting every day of the current year, one third of the days in the year before, and one sixth of the days in the year before that.</p><p><strong>Both</strong> must be met for the test to treat you as a U.S. resident for tax purposes.</p></div><p>Worked, from the IRS's own example: 120 days in each of three consecutive years is 120 + 40 + 20 = 180 weighted days — under the threshold. 150 days in each of three years is 150 + 50 + 25 = 225 — over it.</p><div class="info-box">This is the U.S. test only. Every other country applies its own residency test, and they differ from this one and from each other.</div><p>Source: IRS — Substantial presence test · US IRC §7701(b).</p>` },
    { num: "02", slug: "d183-02", name: "Your Three-Year Day Count Worksheet",                  desc: "The weighting applied year by year, with the arithmetic set out.", tier: 1, content: `<h2>Weighted Day Count</h2><table><tr><th>Year</th><th>Days physically present in the U.S.</th><th>Weight</th><th>Counts as</th></tr><tr><td>Current year</td><td>your count</td><td>All days</td><td>days × 1</td></tr><tr><td>Year before</td><td>your count</td><td>One third</td><td>days ÷ 3</td></tr><tr><td>Two years before</td><td>your count</td><td>One sixth</td><td>days ÷ 6</td></tr><tr><td colspan="3"><strong>Weighted three-year total</strong></td><td><strong>≥ 183?</strong></td></tr></table><div class="warning-box"><strong>Check the current-year minimum separately.</strong> The weighted total does nothing on its own — you must also have at least 31 days of U.S. presence in the current year. 25 days this year and 330 in each of the two prior years gives 190 weighted days and still does not meet the test.</div><p>Count only days you were physically present. Excluded days come out before the weighting is applied — see document 03.</p>` },
    { num: "03", slug: "d183-03", name: "Excluded Days Checklist",                                  desc: "The five categories of day that do not count, and what each one requires.", tier: 1, content: `<h2>Days That Do Not Count</h2><ul class="checklist"><li><strong>Transit under 24 hours:</strong> days in transit through the United States of less than 24 hours while travelling between two places outside it</li><li><strong>Foreign vessel crew:</strong> days as a regular crew member of a foreign vessel travelling between the United States and a foreign country</li><li><strong>Regular commuters:</strong> days you regularly commute to work in the United States from a residence in Canada or Mexico</li><li><strong>Medical condition:</strong> days you could not leave the United States because of a medical condition that arose while you were there</li><li><strong>Exempt individuals:</strong> days present as a student, teacher or trainee</li></ul><div class="warning-box"><strong>Two of these depend on a filing.</strong> Excluding days as an exempt individual, or for a medical condition that arose while you were in the U.S., requires Form 8843 filed by the due date for your income tax return. Filed late, the IRS position is that you cannot exclude those days at all.</div><div class="info-box"><strong>Evidence:</strong> the burden of showing a day does not count is yours. Keep the itinerary, crew documentation, commuting evidence or medical records that establish each excluded day, dated.</div>` },
    { num: "04", slug: "d183-04", name: "Form 8843 Filing Brief",                              desc: "What Form 8843 supports, when it is due, and what late filing costs you.", tier: 1, content: `<h2>Form 8843</h2><table><tr><th>Question</th><th>Answer</th></tr><tr><td>What does it support?</td><td>Excluding days as an exempt individual (student, teacher, trainee), and excluding days you could not leave because of a medical condition that arose while you were in the U.S.</td></tr><tr><td>When is it due?</td><td>By the due date for filing your income tax return.</td></tr><tr><td>What if I do not have to file a return?</td><td>Send Form 8843 on its own, to the address given in the instructions for Form 8843, by that same date.</td></tr><tr><td>What if it is filed late?</td><td>The IRS position is that you cannot exclude those days — they go back into the count, which can move you from nonresident to resident on the same travel history.</td></tr><tr><td>Is there any relief?</td><td>A reasonable-cause let-out exists where you can show, by clear and convincing evidence, that you took reasonable actions to become aware of the requirement and to comply with it.</td></tr></table><div class="warning-box"><strong>Your own due date.</strong> The return due date is not the same for every filer — it differs for U.S.-resident filers, filers abroad, and anyone on extension. Establish yours rather than assuming a date.</div>` },
    { num: "05", slug: "d183-05", name: "Your Accountant Brief — U.S. Presence",                      desc: "Five questions for a U.S. tax advisor, with why each one matters.", tier: 1, content: `<div class="info-box"><strong>Use this brief</strong> with an advisor qualified in U.S. tax, and bring your travel history with you.</div><h2>Questions</h2><div class="action-box"><h3>Question 1</h3><p>Run my actual travel history through the weighted three-year count — what is my total, and does it reach 183?</p></div><h3>Question 2</h3><p>Was I physically present in the United States on at least 31 days of the current year?</p><h3>Question 3</h3><p>Which of my U.S. days fall into an excluded category, and what evidence do I hold for each?</p><h3>Question 4</h3><p>Do I need to file Form 8843, and by what date for my own filing position?</p><h3>Question 5</h3><p>If the test does treat me as a U.S. resident, does the closer connection exception apply on my facts?</p>` },
    { num: "06", slug: "d183-06", name: "Full U.S. Presence Position",                                 desc: "The complete count, the exclusions claimed, and the filing position that follows.", tier: 2, content: `<h2>Working Your Position</h2><ol><li>Assemble the travel history for the current year and the two years before it</li><li>Identify every day of physical presence in the United States, from records not memory</li><li>Remove the excluded days — transit under 24 hours, foreign vessel crew, regular commuting from Canada or Mexico, medical condition arising in the U.S., exempt individual</li><li>Check the current-year minimum: at least 31 days remaining after exclusions</li><li>Apply the weighting: all of the current year, one third of the year before, one sixth of the year before that</li><li>Compare the weighted total to 183</li><li>Where exempt-individual or medical days were removed, confirm Form 8843 is filed by your income tax return due date</li><li>If the test is met, consider whether the closer connection exception applies</li><li>File on the position the count actually supports, and keep the working</li></ol><div class="warning-box"><strong>Position, not preference.</strong> If the test treats you as a U.S. resident you are generally taxed on worldwide income and file as a resident — a materially different position from filing as a nonresident.</div>` },
    { num: "07", slug: "d183-07", name: "Closer Connection Exception Brief",                                desc: "The remaining route where the day count is met, and what it turns on.", tier: 2, content: `<h2>Closer Connection Exception</h2><p>A person who meets the day count under the Substantial Presence Test may still be treated as a nonresident where they have a tax home in another country and a closer connection to that country than to the United States. There is a separate variant of the exception for students.</p><ol><li>Establish that the day count is in fact met — the exception only operates on a test you have otherwise met</li><li>Identify your tax home for the year in question</li><li>Assemble what supports a closer connection to that country than to the United States</li><li>Take advice on whether the exception is available on your facts, and on how it is claimed</li></ol><div class="info-box">This is an exception to a met test, not an alternative to counting. Work the count first — documents 02 and 03 — and come to this only if it lands over the threshold.</div>` },
    { num: "08", slug: "d183-08", name: "Audit Defence Documentation",                                    desc: "The evidence file behind a U.S. day count and every excluded day in it.", tier: 2, content: `<h2>Audit-Ready Evidence Pack (annual)</h2><ul class="checklist"><li>Passport with U.S. entry and exit stamps</li><li>Flight records (airline confirmations or card statements) for every U.S. arrival and departure</li><li>Day-count spreadsheet for the current year and the two years before it, with the weighting shown</li><li>Transit evidence: itineraries and boarding records showing both endpoints outside the U.S. and elapsed time under 24 hours</li><li>Crew documentation and voyage records, where foreign-vessel days are excluded</li><li>Evidence of the foreign residence and the regular commuting pattern, where commuter days are excluded</li><li>Medical records establishing that the condition arose while you were in the United States</li><li>Visa and status documents for any exempt-individual days</li><li>Filed Form 8843 with proof of the filing date</li><li>Tax home and closer-connection evidence, where that exception is claimed</li></ul><div class="warning-box"><strong>Retention:</strong> the burden of showing a day does not count is yours, and a day count is challenged long after the year it covers. Keep the pack for at least seven years from the filing date.</div>` },
  ],
  // DEAD, ANNOTATED NOT REWRITTEN: `calendarTitle` has no consumer in the repo —
  // only the type declaration. The calendar heading the success pages render comes
  // from the generator, not from here.
  calendarTitle: "Residency exit — key dates",
  // CALENDARS EMPTIED OF FOREIGN-LAW DATES. Every dated event here asserted a
  // filing deadline under UK, NZ, AU or US-expat law, none of which this product's
  // corpus captures — and the two 2026 dates were already in the past.
  // THIS IS OUTPUT-NEUTRAL, verified against generate-success-pages.ts:
  // `emittableEvents` already dropped all seven at the last regeneration, because
  // productClaimsADate() is false for temporal kind "unresolvable". Removing them
  // from the config changes the emitted .ics by nothing; it stops the config
  // asserting dates that no longer reach a customer but would return the moment
  // someone declared a resolvable date.
  // tier1Calendar is deliberately EMPTY rather than refilled: the corpus states no
  // date, and the one act-by moment (Form 8843, due with the return) resolves
  // per-taxpayer — which is exactly what temporal.kind "unresolvable" records.
  tier1Calendar: [],
  tier2Calendar: [
    { uid: "d183-quarterly",  summary: "U.S. presence — quarterly evidence check",                   description: "Pull flight records and entry/exit stamps and update the three-year day-count log.", date: "relative:+90days" },
    { uid: "d183-advisor",    summary: "U.S. presence — annual advisor review",                        description: "Review the weighted three-year count and any excluded days with a U.S. tax advisor.", date: "relative:+365days" },
  ],
  delivery: { tier1DriveEnvVar: "", tier2DriveEnvVar: "" },
  // monitorUrls is LIVE — generate-rules-route.ts:211 publishes it as
  // `monitor_urls` in /api/rules/day-183-rule. It pointed at the OECD Model Tax
  // Convention, which this product no longer claims and never captured. Repointed
  // at the ONE page the build actually captured and hash-verified.
  monitorUrls: ["https://www.irs.gov/individuals/international-taxpayers/substantial-presence-test"],
  sidebarNumbers: [{ label: "Current-year minimum", value: "31 days" }, { label: "Weighted three-year threshold", value: "183 days" }, { label: "Prior-year weighting", value: "One third" }, { label: "Two-years-prior weighting", value: "One sixth" }],
  sidebarMathsTitle: "What the U.S. test actually counts",
  sidebarMathsIncludes: ["All days physically present in the U.S. this year", "One third of your U.S. days in the year before", "One sixth of your U.S. days in the year before that", "The separate 31-day current-year minimum", "Form 8843 where exempt-individual or medical days are excluded"],
  sidebarMathsExcludes: ["NOT a single year's day count", "NOT met by the weighted total alone — the 31-day minimum applies too", "NOT counting transit under 24 hours, foreign vessel crew, or regular commuting from Canada or Mexico", "NOT counting medical or exempt-individual days — but only with a timely Form 8843", "NOT a residency answer for any country other than the United States"],
  sidebarMathsNote: "Source: IRS — Substantial presence test · US IRC §7701(b) · captured 1 August 2026",
  howToSteps: [
    { position: 1, name: "Confirm the test applies to you",     text: "The Substantial Presence Test decides whether a non-citizen is treated as a U.S. resident. U.S. citizens and green card holders are taxed on worldwide income regardless of days." },
    { position: 2, name: "Enter your current-year U.S. days",     text: "Days physically present in the United States this year. Under 31 and the test is not met, whatever the earlier years hold." },
    { position: 3, name: "Identify any days that do not count",    text: "Transit under 24 hours, foreign vessel crew, regular commuting from Canada or Mexico, medical condition arising in the U.S., or exempt individual." },
    { position: 4, name: "Enter the weighted three-year total",     text: "All of this year, one third of last year, one sixth of the year before that. The threshold is 183." },
    { position: 5, name: "Confirm what you can evidence",            text: "The burden of showing a day does not count is yours, and exempt-individual and medical days also need Form 8843 filed on time." },
  ],
  // DEAD, ANNOTATED NOT REWRITTEN: on an engine-native product,
  // generate-success-pages.ts reads the customer's real answers through
  // buildComposerInputsFromSession (the F5 composer contract) and the
  // `inputsObj` / `calReads` branches that consume successPromptFields are both
  // emitted as empty. VERIFIED in the emitted pages: neither success page contains
  // a "Country leaving" label or a legacy per-field sessionStorage read. These
  // defaults ("UK", ties count, property retained) therefore reach nobody, and are
  // left byte-unchanged so the dead surface stays visibly dead.
  successPromptFields: [
    { key: "departure_country",    label: "Country leaving",            defaultVal: "UK" },
    { key: "days_in_country",      label: "Days in country",             defaultVal: "under_91" },
    { key: "ties_count",            label: "Number of ties",              defaultVal: "2" },
    { key: "property_retained",     label: "Property retained",           defaultVal: "yes" },
    { key: "family_location",       label: "Family location",             defaultVal: "home_country" },
    { key: "formally_notified",     label: "Formally notified",           defaultVal: "no" },
    { key: "status",                 label: "Verdict status",              defaultVal: "LIKELY STILL RESIDENT" },
    { key: "tier",                   label: "Tier purchased",              defaultVal: "147" },
  ],
  // LIVE: both arrays are posted to /api/assess as `fields` and become the section
  // headings of the paid assessment (lib/assess-core.ts:127). The old set told the
  // model to write "tiesAssessment", "propertyPosition", "departureComplianceStatus"
  // and "multiCountryOverlapAnalysis" — ties-and-departure concepts belonging to the
  // four residency tests this product's corpus does not capture, and an explicit
  // instruction to analyse multiple countries. Narrowed to the U.S. test, same
  // counts (8 / 13).
  tier1AssessmentFields: ["residencyStatus", "dayCountAnalysis", "currentYearMinimumCheck", "excludedDaysAssessment", "form8843Position", "filingObligations", "riskLevel", "immediateActions"],
  tier2AssessmentFields: ["residencyStatus", "dayCountAnalysis", "currentYearMinimumCheck", "excludedDaysAssessment", "form8843Position", "filingObligations", "riskLevel", "immediateActions", "priorYearCountReview", "exclusionEvidenceStrategy", "closerConnectionAssessment", "recordKeepingSystem", "auditDefenceDocumentation"],
  // `persona` has NO consumer anywhere in the repo — verified, not assumed: no
  // generator, route or component reads it, only the type declares it. It is
  // narrowed anyway, because it is the seed a future surface would pick up, and
  // because the old text asserted UK Statutory Residence Test outcomes as fact.
  // It now carries no legal claim about any country other than the United States.
  persona: {
    name: "Ethan",
    age: 38,
    occupation: "Technology consultant, not a U.S. citizen or green card holder; works with U.S. clients on a project basis",
    location: "Based outside the United States, travelling to client sites in the U.S. in blocks through the year",
    family: "Partner and two primary-age children, all outside the United States",
    financialSnapshot: "Consulting income billed to U.S. clients; no U.S. property; travel booked ad hoc across three calendar years with no consolidated day log",
    painPoint: "Ethan tracked his U.S. days one year at a time and stayed comfortably under 183 in each. He did not know the Substantial Presence Test weights the two previous years back in at one third and one sixth, and that his three-year weighted total had crossed 183.",
    discovery: "A client's finance team asked for a Form W-8BEN and mentioned residency status, which sent Ethan to the IRS substantial presence page for the first time.",
    voice: "Technical. Reads specifications. Frustrated that a widely-cited 'rule' turned out to be specifically wrong for his situation.",
  },
  story: {
    hook: "Ethan had checked the same number three years running: U.S. days, under 183, fine. He had never added the three years together the way the IRS does.",
    setup: [
    "Ethan is not a U.S. citizen and does not hold a green card, so the Substantial Presence Test is what decides whether the United States treats him as a resident for tax purposes. He had read the headline rule — 183 days — and applied it the obvious way, to one year at a time.",
    "His travel ran in blocks around client work: roughly 150 days in the U.S. in the current year, and roughly the same in each of the two years before it. In no single year was he near 183, so in his reading of the rule he was never close.",
    "The test does not read that way. It counts every day of the current year, one third of the days in the year before, and one sixth of the days in the year before that. On Ethan's pattern: 150 + 50 + 25 = 225 weighted days. He also cleared the second threshold without noticing it existed — at least 31 days of physical presence in the current year. Both were met.",
    ],
    revelation: "On the weighted count Ethan met the Substantial Presence Test, which meant the United States treated him as a resident for tax purposes — generally taxed on worldwide income and filing as a resident, rather than as a nonresident on U.S.-source income. That is a materially different filing position from the one he had assumed for three years, and nothing about his travel had changed to cause it.",
    resolution: "Ethan took the position to an advisor qualified in U.S. tax with his actual travel records rather than his recollection. The work was in three parts: rebuild the day count for all three years from flight records and entry stamps; identify which days were excluded from the count at all — transit under 24 hours between two places outside the U.S., days he could not leave for a medical reason, days in an exempt-individual capacity — and establish what evidence he held for each; and, where an exclusion depended on Form 8843, confirm it was filed by the due date for his return, because the IRS position is that a late Form 8843 means those days cannot be excluded. Lesson: the U.S. test is a three-year weighted count with two thresholds, and a single year's day count answers neither of them. It is also the U.S. test only — every other country applies its own, and they differ.",
  },
};
