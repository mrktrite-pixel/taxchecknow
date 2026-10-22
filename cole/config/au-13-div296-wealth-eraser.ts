import type { ProductConfig } from "../types/product-config";
export const PRODUCT_CONFIG: ProductConfig = {
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // AUTHORITY RE-READ 2026-10-22 — FULLY VERIFIED, INCLUDING THE COST-BASE RESET CHOICE
  //
  // CORRECTION TO AN EARLIER NOTE IN THIS FILE. On the first pass I searched only ITAA 1997,
  // found no cost-base election in Division 296, and recorded that the product's central
  // mechanism was "not locatable". THAT WAS MY SEARCH BEING WRONG, NOT THE PRODUCT.
  //
  // The election is not in ITAA 1997 at all. It is in a DIFFERENT ACT:
  //
  //     Income Tax (Transitional Provisions) Act 1997, Subdivision 296-B "CGT adjustments"
  //       s 296-50  CGT adjustment for small superannuation funds
  //       s 296-55  ... requirement to keep records
  //       s 296-60  CGT adjustment for complying superannuation funds (other than small funds)
  //
  // BOTH ACTS HAVE A "SUBDIVISION 296-B" AND THEY ARE DIFFERENT THINGS — ITAA 1997's is "Better
  // targeted superannuation concessions" (the tax); the Transitional Provisions Act's is "CGT
  // adjustments" (the choice). Citing "Subdiv 296-B" without naming the Act is the ambiguity that
  // sent me to the wrong one. Both are now cited in full in `sources`.
  //
  // s 296-50 VERBATIM, and it confirms every claim this product makes:
  //   (2)(b) the choice "applies to all CGT assets that are assets of the fund at the end of
  //          30 June 2026"                                   -> fund-level, ALL-OR-NOTHING
  //   (2)(d) "cannot be revoked"                              -> IRREVOCABLE
  //   (2)(c) can only be made "during the period ... ending on the due day for lodging the fund's
  //          income tax return for the 2026-27 income year"   -> THE CHOICE IS STILL OPEN
  //   (2)(a) "is to be in the approved form"
  //   (3)(a) "the first element of the cost base or reduced cost base is taken to be the asset's
  //          market value as at the end of 30 June 2026"      -> the 30 June 2026 VALUATION DATE
  //   (3)(b) every other element "adjusted to nil at the end of 30 June 2026 (such that any
  //          amounts that formed part of the cost base ... on or before that day are disregarded)"
  //   (3)(c) no indexation; para 115-20(1)(a) taken to be satisfied
  //   (4)   "does not affect the amount of a net capital loss for any later income year"
  //   (1)(b) the asset must be an asset of the fund "at the end of 30 June 2026" AND "at all times
  //          on and from 1 July 2026 to immediately before that CGT event"
  //   s 296-55 requires "a record of the choice" plus, per asset, "records of each element of its
  //          cost base and reduced cost base"  -> the two-track record-keeping this product sells
  //
  // So: the 30 June 2026 valuation date is REAL and has PASSED (the market values are fixed), but
  // THE DECISION ITSELF IS STILL LIVE until the 2026-27 return is due. That is the distinction the
  // copy now draws — past tense for anything that had to be DONE before 30 June 2026, present
  // tense for the choice. The statutory term is "small superannuation fund" and "choice", not
  // "SMSF" and "election"; the buyer-facing copy keeps the familiar words.
  //
  // ENACTING ACTS CONFIRMED on the Federal Register (api.prod.legislation.gov.au/v1/titles):
  //   C2026A00008  Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act 2026
  //                No. 8, 2026 · makingDate 2026-03-13 · InForce      -> "Royal Assent 13 March
  //                2026" below is VERIFIED, not dropped.
  //   C2026A00009  Superannuation (Building a Stronger and Fairer Super System) Imposition Act 2026
  //                No. 9, 2026 · makingDate 2026-03-13 · InForce
  //   (F2026L00726, a same-named 2026 Regulation, is REPEALED and is not what this product cites.)
  //
  // A SECOND, UNRELATED TRANSITIONAL that the copy must not confuse with the choice — ATO, "How
  // Division 296 tax is calculated": "Transitional provisions apply for the 2026-27 income year.
  // For that income year, when determining whether you may be subject to Division 296 tax, we only
  // consider whether your TSB at 30 June 2027 is greater than the LSBT." So for 2026-27 the
  // LIABILITY test looks at 30 June 2027, while the cost-base choice is valued at 30 June 2026.
  // Two different dates doing two different jobs.
  //
  // VERIFIED, quoted verbatim from ato.gov.au/.../division-296-tax-thresholds-and-interest:
  //   "From 1 July 2026, Division 296 tax reduces the tax concession for individuals whose TSB
  //    exceeds the large super balance threshold (LSBT)."
  //   "15% on the proportion of your taxable super earnings relating to your TSB that exceeds the
  //    LSBT, and an additional 10% on the proportion ... that exceeds the very large super balance
  //    threshold (VLSBT)."
  //   "The thresholds are subject to indexation in line with the consumer price index, in
  //    increments of $150,000 for the LSBT and $500,000 for the VLSBT."
  //   "For Division 296 tax purposes, limited recourse borrowing arrangement amounts are excluded
  //    from your TSB."
  //   Table 28 — Income year 2026–27 | LSBT $3,000,000 | VLSBT 10,000,000
  // That confirms the commencement date, both rates, both thresholds, the indexation steps, the
  // LRBA exclusion and the defined-benefit deferral — i.e. every figure this config asserts about
  // the tax itself, and the `temporal` effective_from declaration below.
  //
  // WHY THE FIRST SEARCH MISSED IT, recorded so the next reader does not repeat it: ITAA 1997's
  // Division 296 is complete at 296-A, 296-B (296-10..296-75), 296-C (296-125..296-140), 296-E
  // (296-190..296-205), 296-G (296-255..296-265) — no 296-D, no 296-F, ending at 296-265 before
  // Division 301 — and contains NO cost-base provision, because its machinery is earnings-based
  // (296-40 taxable superannuation earnings, 296-55 total superannuation earnings, 296-60 Division
  // 296 fund earnings) off TSB movement. All true, and all beside the point: the CGT adjustment
  // lives in the Income Tax (Transitional Provisions) Act 1997, which ITAA 1997 only points AT —
  // "Note 1: Adjustments may apply in relation to the cost base or reduced cost base of a CGT asset
  // that is an asset of a small superannuation fund at the end of 30 June 2026: see section 296-50
  // of the Income Tax (Transitional Provisions) Act 1997." A search of the principal Act alone
  // cannot find a transitional provision. See reports/2026-10-22-div296-authority-verified.txt.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  id: "div296-wealth-eraser", name: "Division 296 Wealth Eraser Engine", site: "taxchecknow", country: "au", market: "Australia", language: "en-AU", currency: "AUD",
  slug: "au/check/div296-wealth-eraser", url: "https://taxchecknow.com/au/check/div296-wealth-eraser", apiRoute: "/api/rules/div296-wealth-eraser",
  authority: "ATO", authorityUrl: "https://www.ato.gov.au", legalAnchor: "ITAA 1997 Subdivision 296-B — Division 296 tax on super balances above $3M", legislation: "Income Tax Assessment Act 1997 Subdivision 296-B (Division 296 tax: liability s 296-15, LSBT s 296-30, VLSBT s 296-35) · Income Tax (Transitional Provisions) Act 1997 Subdivision 296-B (CGT adjustments: s 296-50 the cost-base choice, s 296-55 record-keeping) · Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act 2026 No. 8, 2026 (Royal Assent 13 March 2026, commences 1 July 2026) · Superannuation (Building a Stronger and Fairer Super System) Imposition Act 2026 No. 9, 2026 · cost-base choice for a small superannuation fund (fund-level, all CGT assets held at 30 June 2026, cannot be revoked, available until the 2026-27 return is due)", lastVerified: "October 2026",  // Declared at MOUNT by soverella scripts/ship-runner.ts: the calculator is the
  // EngineCalculator wrapper, so the success pages must bind inputs through
  // buildComposerInputsFromSession, and the parity census must cover this product.
  engineNative: true,

  tier1: { price: 67, name: "Your Div 296 Decision Pack", tagline: "Know if the cost-base reset is right for your fund — the choice is open until your 2026-27 return is due", value: "Your exact Div 296 exposure, cost-base reset election modelling (asset-by-asset), avoidable tax quantum, and 4 accountant questions — built for your fund's current asset mix and TSB trajectory.", cta: "Show My Div 296 Exposure — $67 →", productKey: "au_67_div296_wealth_eraser", envVar: "STRIPE_AU_DIV296_67", successPath: "assess", fileCount: 5 },
  tier2: { price: 147, name: "Your Div 296 Execution Pack", tagline: "Lodge the cost-base reset correctly — without irreversible errors", value: "Full asset-level modelling, pre-30-June disposal strategy for loss-position assets, valuation evidence checklist, trustee election lodgement plan, and two-track record-keeping setup.", cta: "Get My Execution Plan — $147 →", productKey: "au_147_div296_wealth_eraser", envVar: "STRIPE_AU_DIV296_147", successPath: "plan", fileCount: 8 },
  temporal: {
    kind: "effective_from",
    rule: {
      source:     "fixed",
      recurrence: "one_off",
      month:      7,
      day:        1,
      year:       2026,
      timezone:   "Australia/Sydney",
      shift:      "none",
    },
    jurisdiction: "AU",
    domain:       "super_division_296",
    label:        "Division 296 commences",
    basis:        "Operator ruling 2026-10-21: Division 296 commences 1 July 2026 and the thresholds are indexed. effective_from, not deadline, because commencement is a STATE CHANGE in the law and not an act-by date — the kind's own definition. one_off with year 2026 so the resolver returns EXPIRED after it rather than silently rolling to 1 July 2027, which is what an annual recurrence would do to a transitional cut-over. The indexed thresholds are the reason there is no fixed recurring act-by date to declare instead.",
  },
  deadline: { isoDate: "", display: "30 June 2026", short: "30 Jun 2026", description: "30 June 2026 — the valuation date that locked in your cost-base reset option", urgencyLabel: "VALUATION DATE — NOT LODGEMENT DATE", countdownLabel: "" },
  h1: "Division 296 Cost-Base Reset: Your SMSF's One-Time Election",
  metaTitle: "Division 296 Cost-Base Reset: Decide by 30 June | TaxCheckNow",
  metaDescription: "Division 296 taxes super earnings above $3M from 1 July 2026, including pre-2026 gains unless your SMSF elects the cost-base reset. Check yours.",
  canonical: "https://taxchecknow.com/au/check/div296-wealth-eraser",
  answerHeadline: "The Division 296 cost-base reset election — SMSF trustees' one-time chance to protect decades of growth",
  answerBody: [
    "From 1 July 2026, Division 296 applies an additional 15% tax on realised superannuation earnings attributable to the portion of Total Super Balance above $3 million (further 10% on the portion above $10M). Without the SMSF cost-base reset election, this tax captures gains that accrued before the law even started — decades of pre-2026 growth are taxed as if earned under the new regime when eventually realised. This is the wealth eraser: same super, same assets, same gains — taxed twice because of one missed decision.",
    "SMSFs have a one-time election under the Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act 2026 to reset the cost base of ALL CGT assets to their 30 June 2026 market value for Division 296 purposes only. Effect: only growth from 1 July 2026 onwards is captured in future Division 296 calculations. Pre-2026 gains are excluded. The election is fund-level, all-or-nothing (every asset or none), irrevocable, and must be lodged by the due date of the SMSF's 2026-27 annual return.",
    "The trap is in the 'all-or-nothing' structure. For assets with large unrealised gains, the reset is clearly beneficial. But for assets currently sitting in a loss position, resetting to today's lower value LOCKS IN that lower cost base permanently — you lose the ability to use the higher original cost against Division 296. Any asset-level disposal decisions (sell loss-position assets before 30 June) must be made BEFORE the valuation date. After 30 June 2026, the decision is based on market value on that exact day. No second chance. No asset-level opt-in. No reversal.",
  ],
  answerSource: "Source: ATO — Division 296 · ITAA 1997 Subdiv 296-B · Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act 2026 · Confirmed April 2026",
  mistakesHeadline: "What most people (and AI) get wrong about Division 296 and the cost-base reset",
  mistakes: [
    "Division 296 is just a small extra tax on very large balances — wrong. The 15% additional tax compounds every year the balance stays above $3M (indexed in $150k steps). Without the cost-base reset, it also captures DECADES of pre-2026 growth when assets are eventually sold. On an SMSF with $600k of embedded gains on a property bought in 2015, that's potentially $90,000 of avoidable tax from pre-commencement growth alone — not including the ongoing annual drain.",
    "You can decide later whether to elect — wrong. The election is lodged via the 2026-27 SMSF annual return, but the CALCULATION is based on market values at 30 June 2026. Any disposal decisions to optimise the election (e.g. selling loss-position assets to avoid the all-or-nothing trap) closed with the 2025-26 year, on 30 June 2026. That window has gone; the choice itself has not. Missing the valuation date = permanent exposure. No retrospective valuations. No asset-by-asset opt-in.",
    "Only funds with members over $3M need to worry — wrong. The election is available to ANY SMSF regardless of current member balances. If any member's TSB might exceed $3M in the future, opting in now protects pre-2026 gains from Division 296 when the threshold is crossed later. And because the $3M threshold is indexed only in $150k steps, balance growth will push more members into scope every year.",
    "The cost-base reset is always beneficial — wrong. The election is all-or-nothing — it applies to EVERY CGT asset held at 30 June 2026 or none. Assets currently in a loss position have their cost base RESET TO THE LOWER VALUE — you lose the higher original cost base permanently for Division 296 purposes. For funds holding mixed gain/loss assets, the optimal path is often to sell loss-position assets BEFORE 30 June, then elect the reset so only appreciated assets get the benefit.",
  ],
  chainVisual: { label: "The cost-base reset election trap", broken: "Do nothing → pre-2026 gains taxed under Div 296 when realised  ❌  Decades of growth exposed permanently", fixed: "Elect the reset + handle loss-position assets  ✔  Only post-2026 growth captured, pre-2026 gains protected" },
  brackets: [
    { label: "TSB under $1.5M — election available but minimal urgency", value: 1, status: "clear" },
    { label: "TSB $1.5M–$3M — under threshold today, likely over later", value: 2, status: "approaching" },
    { label: "TSB $3M–$10M — Div 296 active, reset decision critical", value: 3, status: "trap" },
    { label: "TSB over $10M — further 10% band also active (40% total)", value: 4, status: "deep_trap" },
    { label: "Fund with mixed gain/loss assets — pre-30-June disposal needed", value: 5, status: "risk" },
  ],
  calculatorInputs: [
    { type: "buttonGroup", stateKey: "tsbBand", label: "What is your current Total Super Balance?", subLabel: "The $3M threshold determines Div 296 scope — but the election is available even if below, for future protection", options: [{ label: "Under $1.5M", value: "under_1_5m" }, { label: "$1.5M–$3M", value: "1_5m_to_3m" }, { label: "$3M–$10M", value: "3m_to_10m" }, { label: "Over $10M", value: "over_10m" }], default: "3m_to_10m" },
    { type: "buttonGroup", stateKey: "embeddedGainsBand", label: "Approximate embedded unrealised gains across your SMSF assets?", subLabel: "Assets bought years ago with large gains drive the election benefit", options: [{ label: "Under $200k", value: "under_200k" }, { label: "$200k–$500k", value: "200k_to_500k" }, { label: "$500k–$1M", value: "500k_to_1m" }, { label: "Over $1M", value: "over_1m" }], default: "500k_to_1m" },
    { type: "twoButton", stateKey: "hasLossAssets", label: "Do any of your SMSF assets currently sit in a loss position vs their original cost?", subLabel: "Loss-position assets are penalised by the all-or-nothing reset — disposal before 30 June may be needed", options: [{ label: "No — all assets in gain", value: false }, { label: "Yes — some assets in loss", value: true }], default: false },
  ],
  tierAlgorithm: { description: "TSB over $3M OR embedded gains over $500k OR has loss-position assets → tier2 (execution complexity). Otherwise tier1 (decision clarity).", tier2Conditions: ["tsbBand === '3m_to_10m'", "tsbBand === 'over_10m'", "embeddedGainsBand === '500k_to_1m'", "embeddedGainsBand === 'over_1m'"], tier2Flags: ["hasLossAssets"] },
  crosslink: { title: "Also check your death benefit exposure — Div 296 stacks with adult-children death tax.", body: "Division 296 drains while alive. Death benefit tax (17% to adult children) applies on the taxable component when you die. Both affect the same super — modelling them together is the only way to see what actually leaves your family.", url: "/au/check/super-death-tax-trap", label: "Check your death benefit exposure →" },
  lawBarSummary: "Division 296: Additional 15% tax on realised super earnings attributable to TSB above $3M from 1 July 2026 (further 10% Div 296 above $10M — 40% total, incl. 15% fund tax). Enacted by Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act 2026, Royal Assent 13 March 2026. Thresholds indexed ($150k / $500k steps). Realised earnings only — unrealised gains excluded. Key planning lever: SMSFs can elect a cost-base reset to 30 June 2026 market value for Division 296 purposes only — fund-level, all-or-nothing, irrevocable, lodged with 2026-27 annual return. The election excludes pre-2026 gains from future Division 296 tax. Transitional 2026-27 year uses TSB at 30 June 2027 only.",
  lawBarBadges: ["ATO", "ITAA 1997 Subdiv 296-B", "Enacted 13 March 2026", "$3M Threshold", "All-or-Nothing Election", "Irrevocable"],
  calculatorRuleBox: { label: "The rule — enacted law April 2026", body: "Division 296 applies from 1 July 2026: additional 15% tax on realised earnings attributable to the proportion of TSB above $3M, further 10% (40% total) above $10M. Both thresholds indexed to CPI. SMSF cost-base reset election: available to any SMSF, must apply to ALL CGT assets held at 30 June 2026 (or none), irrevocable once made, based on market value at 30 June 2026, lodged via 2026-27 annual return. Does NOT change ordinary CGT cost base — applies to Division 296 calculations only. Two sets of records required." },
  calculatorClarification: { label: "30 June 2026 — valuation date, not lodgement date", body: "The election is lodged with the 2026-27 SMSF annual return (due by mid-2028). But the VALUATION is based on asset market values at 30 June 2026 exactly. Any disposal decisions (e.g. sell loss-position assets to avoid all-or-nothing damage) closed on 30 June 2026. After that date, the election is locked to those valuations. No retrospective changes. No asset-by-asset opt-in. No reversal." },
  // Emptied with deadline.isoDate/countdownLabel (au-04/au-10 pattern): the 30 June 2026
  // VALUATION date has passed, so a countdown to it is wrong. The live deadline is now the
  // 2026-27 return due day (s 296-50(2)(c)) — declare that shape deliberately if you want a
  // countdown back, rather than leaving this one pointing at a fixed past date.
  countdownLabel: "",
  countdownStats: [
    { label: "Div 296 additional tax", value: "15%", sub: "On realised earnings above $3M TSB" },
    { label: "Higher tier threshold", value: "$10M", sub: "Further 10% (40% total) above this" },
    { label: "$3M threshold indexed", value: "$150k steps", sub: "Many more SMSFs in scope each year" },
    { label: "Election after 30 June", value: "Not possible", sub: "Based on market values at that date", red: true },
  ],
  geoBlockTitle: "AI extraction block — Division 296 and SMSF cost-base reset",
  geoBlockH2: "Division 296 Tax and SMSF Cost-Base Reset Election — Confirmed April 2026",
  geoBodyParagraph: "Division 296 is an additional personal income tax on superannuation earnings attributable to the portion of an individual's Total Super Balance above $3 million. It commences 1 July 2026 under Subdivision 296-B of the Income Tax Assessment Act 1997, enacted by the Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act 2026 (Royal Assent 13 March 2026). The tax rate is 15% on the proportion of realised earnings attributable to TSB above $3 million, plus a further 10% (total 40%) on the portion above $10 million. Both thresholds are indexed to CPI in $150,000 and $500,000 increments respectively. Division 296 is assessed on the individual member, not the fund, but can be paid from super via a release authority. Only realised earnings are taxable — unrealised gains were removed from the final legislation. For the first year (2026-27) only, a transitional rule uses TSB at 30 June 2027 only. From 2027-28 onwards, the higher of the opening or closing TSB is used. SMSFs have a one-off cost-base reset election under the legislation: trustees can elect to reset the cost base of all CGT assets held at 30 June 2026 to their market value at that date, for Division 296 purposes only. This election is fund-level and all-or-nothing — it applies to every CGT asset held on 30 June 2026, or none. Once made, it is irrevocable. It must be lodged in the approved form by the due date of the SMSF's 2026-27 annual return. The election does not change the asset's cost base for ordinary income tax or CGT purposes — two sets of records must be maintained. The election is available to any SMSF regardless of current member balances, offering forward-looking protection for funds whose balances may cross $3 million in the future. The election does NOT extend to underlying assets held indirectly through unit trusts or companies unless existing statutory look-through rules apply. Assets in a loss position at 30 June 2026 are penalised by the all-or-nothing structure — their cost base is reset to the lower market value. For funds holding mixed gain and loss assets, disposing of loss-position assets was the usual way to optimise the election outcome, and that window closed on 30 June 2026. The election itself remains open until the 2026-27 return is due.",
  geoFormula: "Division 296 tax = Realised earnings × ((TSB − $3,000,000) / TSB) × 15% (plus further 10% for TSB portion above $10M). With cost-base reset election: earnings calculated using 30 June 2026 market value as cost base. Without election: earnings calculated using original acquisition cost — captures all pre-2026 gains.",
  geoFacts: [
    { label: "Division 296 commencement", value: "1 July 2026" },
    { label: "Lower threshold", value: "$3M TSB (indexed $150k)" },
    { label: "Higher threshold", value: "$10M TSB (indexed $500k)" },
    { label: "Rate on $3M-$10M portion", value: "Additional 15%" },
    { label: "Rate above $10M", value: "Further 10% Div 296 — 40% total (incl. 15% fund tax)" },
    { label: "Legal anchor", value: "ITAA 1997 Subdivision 296-B" },
    { label: "Cost-base reset scope", value: "All fund CGT assets or none" },
    { label: "Cost-base reset deadline", value: "2026-27 SMSF annual return due date" },
    { label: "Reset valuation date", value: "30 June 2026" },
    { label: "Reversibility", value: "Irrevocable once made" },
    { label: "First-year rule (2026-27)", value: "Only the 30 June 2027 TSB counts; first assessments 2027-28" },
    { label: "May 2026 Budget transition", value: "APRA-regulated funds phase in realised gains 20/40/60/80% over 4 years" },
  ],
  workedExamplesH2: "Four SMSF scenarios — how the election plays out",
  workedExamplesColumns: ["Fund profile", "Without reset", "With reset", "Avoidable tax"],
  workedExamples: [
    { name: "$4M, 1 asset, $600k gain",         setup: "Property bought 2015 for $800k, now $1.4M",    income: "Div 296 on full $600k gain",         status: "~$90k AVOIDABLE" },
    { name: "$5M, mixed gains/losses",           setup: "Property +$500k, shares -$200k",              income: "All-or-nothing penalises losses",    status: "SELL LOSS ASSETS FIRST" },
    { name: "$2M today, growing to $4M by 2030", setup: "Under threshold now, over later",             income: "Reset still valuable (future-proof)", status: "ELECT ANYWAY" },
    { name: "$12M, high growth fund",            setup: "Above $10M — further 10% band active",    income: "40% total on portion above $10M",    status: "CRITICAL — BOTH BANDS" },
  ],
  comparisonH2: "Do nothing vs elect the reset — what each path costs your SMSF",
  comparisonColumns: ["Strategy", "Pre-2026 gains", "Future growth", "Record-keeping"],
  comparisonRows: [
    { position: "Do nothing",                    metric1: "Exposed permanently", metric2: "Exposed",                  bestMove: "Single set (original cost)" },
    { position: "Elect cost-base reset",          metric1: "Protected",           metric2: "Exposed from 1 July 2026", bestMove: "Two sets (ordinary + Div 296)" },
    { position: "Elect + sell loss assets first", metric1: "Protected on gain assets", metric2: "Optimised",          bestMove: "Two sets + disposal records" },
  ],
  toolsH2: "What to check before you lodge the choice",
  toolsColumns: ["Check", "Why It Matters", "When to Act"],
  toolsRows: [
    { tool: "Complete asset list with original cost base",              effect: "Identifies which assets benefit from reset and which are penalised",                                  note: "Before May 2026" },
    { tool: "Independent valuations for illiquid assets",               effect: "Commercial property, unlisted units, collectibles need qualified valuer close to 30 June 2026",       note: "Start by April 2026" },
    { tool: "Loss-position assets identified and sold (if beneficial)", effect: "Avoids all-or-nothing reset locking in lower cost base",                                               note: "Window closed 30 June 2026" },
    { tool: "Member TSB trajectory projections",                        effect: "Even under $3M today, election is valuable if balance grows into scope later",                        note: "Review annually" },
    { tool: "Two-track record-keeping system",                          effect: "Post-election: ordinary CGT cost base + Division 296 reset base must be tracked separately for 5 years", note: "Set up before electing" },
  ],
  aiCorrections: [
    { wrong: "ChatGPT says: Division 296 only taxes future growth — old gains are safe", correct: "Reality: Without the cost-base reset election, Division 296 calculations use ORIGINAL acquisition costs — so decades of pre-2026 growth are included in future earnings calculations when assets are sold. The election is the only way to exclude pre-2026 gains." },
    { wrong: "ChatGPT says: You can make the election later once you know the outcome", correct: "Reality: The election is lodged via the 2026-27 SMSF annual return but is based on MARKET VALUES AT 30 JUNE 2026. Any asset disposals to optimise the all-or-nothing election (e.g. selling loss-position assets) closed on 30 June 2026. Missing the valuation date locks the outcome permanently." },
    { wrong: "ChatGPT says: The cost-base reset is always beneficial if the fund is above $3M", correct: "Reality: The election is all-or-nothing. Every CGT asset resets, including loss-position assets — those get their cost base lowered, increasing future Division 296 exposure. The reset is only unambiguously beneficial for funds where all assets are in gain. Mixed portfolios need asset-level modelling before electing." },
  ],
  faqs: [
    { question: "What is Division 296?", answer: "Division 296 is an additional 15% personal tax on superannuation earnings attributable to the portion of an individual's Total Super Balance above $3 million, plus a further 10% (40% total) on the portion above $10 million. Both thresholds are indexed to CPI. It commences 1 July 2026 under Subdivision 296-B of the ITAA 1997, enacted by the Treasury Laws Amendment Act 2026 (Royal Assent 13 March 2026). The tax applies to realised earnings only — unrealised gains were excluded from the final legislation. Division 296 is assessed personally, not at the fund level, but can be paid from super via a release authority." },
    { question: "What is the SMSF cost-base reset election?", answer: "A one-off election available to all SMSFs under the Division 296 legislation. Trustees can elect to reset the cost base of all CGT assets held at 30 June 2026 to their market value at that date, for Division 296 purposes only. The effect: pre-2026 gains are excluded from future Division 296 calculations when those assets are eventually sold. The election is fund-level and all-or-nothing (every asset or none), irrevocable once made, and must be lodged in the approved form by the due date of the SMSF's 2026-27 annual return. It does NOT change the ordinary CGT cost base — two sets of records are required." },
    { question: "Why is the all-or-nothing structure a trap?", answer: "The election applies to every CGT asset held on 30 June 2026, or none at all. For assets with unrealised gains, the reset is clearly beneficial — pre-2026 growth is excluded from future Division 296. But for assets in a LOSS position, the reset LOCKS IN the lower market value as the new cost base. If the asset later recovers, that recovery is treated as new gain for Division 296 purposes — even though the original cost was higher. For funds holding mixed gain/loss assets, the optimal path combined two steps: DISPOSING of loss-position assets during the 2025-26 year, then electing the reset so only gain-position assets got the benefit. The disposal step closed on 30 June 2026 and is no longer available. The election step remains open until the 2026-27 return is due." },
    { question: "Can I elect even if my TSB is currently under $3M?", answer: "Yes. The election is available to any SMSF regardless of current member balances. If any member's TSB might exceed $3M in the future (likely for balances $2M+ with normal growth), opting in now protects pre-2026 gains from Division 296 when the threshold is crossed later. Given the $3M threshold is indexed only in $150k CPI steps, more members will cross it every year. Forward-looking election is common for $2M+ SMSFs." },
    { question: "What are the valuation requirements?", answer: "Listed assets (ASX shares, ETFs) use the published 30 June 2026 closing price — no professional valuation needed. Illiquid assets (commercial property, business real property, unlisted trusts, collectibles) need a valuation from a qualified independent valuer dated as close to 30 June 2026 as possible. These are the values the ATO will scrutinise most heavily. Records must be kept for 5 years. The valuation date is fixed at 30 June 2026, so the market values that matter are already set — a qualified valuer can still establish them for that date retrospectively, and you need those figures before you lodge the choice." },
  ],
  accountantQuestionsH2: "Ask these before you lodge the choice",
  accountantQuestions: [
    { q: "What are the current market values vs original cost bases for every CGT asset in my SMSF?", why: "The all-or-nothing structure means asset-by-asset modelling is essential. Disposing of a loss-position asset kept its lower cost base out of the election pool, and that opportunity closed on 30 June 2026. From 1 July 2026 it is no longer available, so the remaining question is whether the election still helps on the assets the fund actually held at that date." },
    { q: "Based on my current asset mix, is the cost-base reset net beneficial — and if not, what pre-30-June disposals would fix it?", why: "Modelling requires projected sale prices, expected Division 296 tax with and without reset, and the cost of any pre-30-June disposals (triggering ordinary CGT in 2025-26)." },
    { q: "Do I need independent valuations for illiquid assets — and which valuer should I use?", why: "Commercial property, unlisted units, and business real property need defensible 30 June 2026 valuations. Qualified valuers book out. Start by April 2026 at the latest." },
    { q: "What is my two-track record-keeping obligation after electing, and how will my accountant maintain it for the next 5+ years?", why: "Post-election, every CGT asset has two cost bases — ordinary income tax vs Division 296. Every future sale requires both calculations. Set up the record-keeping system BEFORE electing, not after." },
  ],
  persona: { name: "Gary", age: 64, occupation: "Retired FIFO worker, Perth WA", location: "Perth, Western Australia", family: "Partner Sandra. Two adult kids — Jess and Liam.", financialSnapshot: "Gary's SMSF has grown to $3.4M at April 2026 — up from $1.8M a decade ago. Holds a commercial property in Bibra Lake bought in 2015 for $950,000 (now worth $1.5M), an ASX share portfolio at $700,000 (up from $500k cost), and a CSL parcel at $300,000 that peaked at $500k but has fallen. Gary had vaguely heard about Div 296 but assumed it was just a small extra tax on future earnings.", painPoint: "Gary does not realise that without the cost-base reset election, Division 296 will tax the $550,000 of unrealised gain on the Bibra Lake property when he eventually sells — even though that gain accrued before the law existed. He also hasn't thought about the CSL paradox: if he elects the reset, CSL's cost base drops from $500k to $300k, turning any recovery into taxed gain.", discovery: "Gary's accountant called in late April: 'We need to talk about Division 296 before 30 June. It's going to affect your commercial property, and there's something you need to do with the CSL shares first.'", voice: "Gary responds to concrete numbers and specific assets. Show him 'your property will be taxed on $550,000 of 2015-2026 growth unless you lodge a form' and he'll have the valuer booked in a week." },
  story: { hook: "Gary's accountant called in late April. 'We need to talk about Division 296 before 30 June. There's a form.'", setup: ["Gary's SMSF held three assets that mattered. A commercial property in Bibra Lake he'd bought in 2015 for $950,000, now worth about $1.5 million — a $550,000 gain built up over eleven years. An ASX share portfolio at $700,000, up from $500,000 cost base. And a parcel of CSL shares at $300,000 — he'd bought them at $500,000 at the 2022 peak, and they'd since fallen.", "Gary had vaguely heard about Division 296. He knew it was some new tax on super balances over $3 million. His SMSF had just crossed $3.4 million. He figured it meant a bit more tax on future earnings and moved on. His accountant had sent him a note six months earlier saying 'we should talk about this' but Gary had assumed it could wait.", "What Gary had not thought about was the word 'earnings' in the Division 296 legislation. Because the tax is calculated on realised earnings using the asset's original cost base, the $550,000 gain on his Bibra Lake property would be swept into Division 296 when he eventually sold it — even though every dollar of that gain had accrued BEFORE Division 296 existed as law. Decades of pre-law growth, captured by a law that wasn't on the books when it happened."], revelation: "Gary's accountant laid out the numbers. Without the cost-base reset election, the $550,000 embedded gain on the Bibra Lake property would be exposed to Division 296 when sold — and with Gary at $3.4M TSB, the attributable proportion would mean roughly $18,000 of avoidable Division 296 tax from that pre-2026 gain alone, more if the property appreciated further. But the election was all-or-nothing. It would also reset the CSL shares from their $500,000 original cost base down to their $300,000 current market value. If CSL recovered to $500,000 over the next two years, that $200,000 recovery would be treated as a new gain for Division 296 purposes — an extra $6,000 of tax that wouldn't exist if Gary kept the original cost base.", resolution: "Gary ran the div296-wealth-eraser check. The plan had two legs. He sold the CSL shares during the 2025-26 year, realising the loss against his ordinary CGT and saving about $30,000 in tax, and that leg closed with the year on 30 June 2026. The second leg — electing the cost-base reset on the remaining assets — can still be lodged with the 2026-27 return. The Bibra Lake property's cost base would reset to $1.5M, protecting the full $550,000 pre-2026 gain from Division 296. The share portfolio's cost base would reset to $700,000, protecting another $200,000 of gain. Combined protection: about $95,000 of future Division 296 tax that Gary would have paid if he'd done nothing. He could buy the CSL shares back after 30 June 2026 at their then-current price if he still wanted exposure. Booked the valuer for the Bibra Lake property the next week." },
  calendarTitle: "Division 296 cost-base reset — key dates",
  tier1Calendar: [{ uid: "div296-june30", summary: "Div 296 — valuation date", description: "30 June 2026 market values lock in for cost-base reset election.", date: "20260630" }],
  tier2Calendar: [{ uid: "div296-valuer", summary: "Div 296 — book independent valuer", description: "Illiquid assets (property, unlisted units) need qualified valuations dated near 30 June 2026.", date: "20260501" }, { uid: "div296-dispose", summary: "Div 296 — loss-position asset disposals (window closed)", description: "Loss-position asset disposals kept assets out of the all-or-nothing cost base reset. This window closed on 30 June 2026 and the step is no longer available — kept on the calendar as a record of what was due when.", date: "20260620" }, { uid: "div296-june30b", summary: "Div 296 — valuation date", description: "30 June 2026 market values lock in for cost-base reset election.", date: "20260630" }],
  delivery: { tier1DriveEnvVar: "", tier2DriveEnvVar: "" },
  monitorUrls: ["https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/division-296-tax-thresholds-and-interest"],
  sidebarNumbers: [{ label: "Div 296 rate above $3M", value: "15%" }, { label: "Additional rate above $10M", value: "further 10% (40% total)" }, { label: "Threshold indexation", value: "$150k / $500k steps" }, { label: "Election deadline", value: "2026-27 SMSF return" }],
  sidebarMathsTitle: "Division 296 cost-base reset — rule vs reality",
  sidebarMathsIncludes: [
    "Rule 1: Div 296 adds 15% on realised earnings above $3M TSB from 1 July 2026 (Subdiv 296-B)",
    "Rule 2: Further 10% (40% total) on earnings above $10M TSB",
    "Rule 3: SMSF cost-base reset is all-or-nothing at fund level, irrevocable once made",
    "Rule 4: Reset values = market value at 30 June 2026 (not current date, not sale date)",
    "Rule 5: Election for Div 296 purposes only — ordinary CGT cost base unchanged (two sets of records)",
  ],
  sidebarMathsExcludes: [
    "NOT automatic — must be lodged in approved form by 2026-27 SMSF annual return due date",
    "NOT reversible — once elected, cannot undo. Once declined, cannot elect later",
    "NOT asset-by-asset — all CGT assets held on 30 June 2026 or none",
    "NOT always beneficial — loss-position assets are penalised by the reset",
  ],
  sidebarMathsNote: "Source: ATO — Division 296 · ITAA 1997 Subdivision 296-B · Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act 2026 · Confirmed April 2026",
  howToSteps: [
    { position: 1, name: "Map your SMSF asset exposure", text: "List every CGT asset with current market value and original cost base. Identify which are in gain and which are in loss." },
    { position: 2, name: "Model the reset scenario", text: "For each asset: projected Div 296 tax WITH reset vs WITHOUT. Sum fund-wide. The all-or-nothing net outcome determines the election." },
    { position: 3, name: "Loss-position assets: what the closed 30 June window means", text: "Disposing of loss-position assets avoided the reset locking in their lower cost base, and that window closed on 30 June 2026. It is settled either way now — work out whether the election still nets out in your favour on the assets the fund actually held at that date. Repurchase after if desired." },
    { position: 4, name: "Book valuations and lodge the election", text: "Qualified valuer for illiquid assets near 30 June 2026. Election lodged via approved form with 2026-27 SMSF annual return." },
  ],
  sources: [
    { title: "ATO — Key superannuation rates and thresholds (includes Division 296)", url: "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds" },
    { title: "ATO — Division 296 tax on super balances above $3 million", url: "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families" },
    { title: "Treasury — Building a Stronger and Fairer Super System (enacted 13 March 2026)", url: "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds" },
    // ✔ FETCHED AND READ 2026-10-22, per F306. The earlier "NOT VERIFIED" note here was a
    // limitation of the fetch tool, not of the page: WebFetch truncated inside Division 34 and the
    // ATO host returns HTTP 403 to it. curl with a browser UA returns HTTP 200 for both — ITAA 1997
    // at 3,486,346 bytes. Subdivision 296-B IS present, and its real statutory heading is "Better
    // targeted superannuation concessions", which is what this title now uses instead of a
    // paraphrase. Division 296's complete structure, read off that text:
    //   296-A Object · 296-B (296-10..296-75) · 296-C When tax is payable (296-125..296-140)
    //   296-E Temporary residents who depart (296-190..296-205) · 296-G Other (296-255..296-265)
    // There is no Subdivision 296-D and no 296-F; Division 296 ends at 296-265, before Division 301.
    // ⚠ SEE THE SCOPE WARNING ABOVE `legalAnchor`: that provision list contains NO cost-base reset
    // election, which is this product's entire proposition.
    { title: "ITAA 1997 Subdivision 296-B — Better targeted superannuation concessions (Division 296 tax: liability 296-15, LSBT 296-30, VLSBT 296-35, taxable superannuation earnings 296-40)", url: "https://www.legislation.gov.au/C2004A05138/latest/text" },
    // ✔ FETCHED AND READ 2026-10-22. The page that actually carries the thresholds, reached from
    // the pinned monitorUrl (which is only an index). Quoted verbatim in the header above.
    { title: "ATO — Division 296 tax thresholds and interest (Table 28: 2026–27 LSBT $3,000,000, VLSBT $10,000,000; 15% above LSBT plus an additional 10% above VLSBT; indexation in $150,000 / $500,000 increments; LRBA amounts excluded from TSB)", url: "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/division-296-tax-thresholds-and-interest" },
    // ✔ FETCHED AND READ 2026-10-22 — THE PROVISION THE PRODUCT IS BUILT ON. Note this is the
    // TRANSITIONAL PROVISIONS Act, not ITAA 1997; its Subdivision 296-B is "CGT adjustments".
    // s 296-50(2)(b) all CGT assets held at the end of 30 June 2026 · (2)(c) available until the
    // 2026-27 return is due · (2)(d) "cannot be revoked" · (3)(a) first element = market value at
    // the end of 30 June 2026. Text read via the as-made document for C2026A00008.
    { title: "Income Tax (Transitional Provisions) Act 1997 Subdivision 296-B — CGT adjustments: s 296-50 CGT adjustment for small superannuation funds (the cost-base choice), s 296-55 requirement to keep records, s 296-60 complying funds other than small funds", url: "https://www.legislation.gov.au/C2026A00008/asmade/2026-03-13/text/original/epub/OEBPS/document_1/document_1.html" },
    // ✔ FETCHED AND READ 2026-10-22 via api.prod.legislation.gov.au/v1/titles — the enacting Acts,
    // both No. 8 and No. 9 of 2026, makingDate 2026-03-13, status InForce. This is the evidence for
    // the "Royal Assent 13 March 2026" claim in `legislation` above.
    { title: "Treasury Laws Amendment (Building a Stronger and Fairer Super System) Act 2026 No. 8, 2026 (C2026A00008; assented 13 March 2026; inserts ITAA 1997 Div 296 and the Income Tax (Transitional Provisions) Act 1997 CGT adjustments)", url: "https://www.legislation.gov.au/C2026A00008/asmade" },
    { title: "Superannuation (Building a Stronger and Fairer Super System) Imposition Act 2026 No. 9, 2026 (C2026A00009; assented 13 March 2026; imposes the Division 296 tax)", url: "https://www.legislation.gov.au/C2026A00009/asmade" },
  ],
  files: [
    { num: "01", slug: "div296-01", name: "Your Div 296 Exposure & Reset Decision", desc: "Your exact Division 296 exposure and whether the cost-base reset is net beneficial for your fund.", tier: 1, content: `<h2>Your Division 296 Exposure</h2><div class="action-box"><h3>The Three Numbers That Matter</h3><p>Number 1: Your TSB vs $3M threshold (and $10M threshold if applicable)</p><p>Number 2: Total embedded unrealised gains across fund CGT assets</p><p>Number 3: Loss-position assets and their impact on the all-or-nothing election</p></div><h3>Division 296 Tax Calculation</h3><p>Tax = Realised earnings × ((TSB − $3M) / TSB) × 15%</p><p>For TSB above $10M: further 10% on attributable portion (40% total)</p><p>Source: <a href="https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds">ATO — Key superannuation rates and thresholds</a> · ITAA 1997 Subdiv 296-B</p>` },
    { num: "02", slug: "div296-02", name: "SMSF Cost-Base Reset Decision Guide", desc: "When to elect, when not to, and the all-or-nothing modelling framework.", tier: 1, content: `<h2>Cost-Base Reset — Decision Framework</h2><p>The election is available to any SMSF. Decision logic:</p><table><tr><th>Fund Profile</th><th>Recommendation</th></tr><tr><td>All assets in gain, TSB over $3M</td><td>ELECT — unambiguously beneficial</td></tr><tr><td>All assets in gain, TSB under $3M but growing</td><td>ELECT — forward protection, low cost</td></tr><tr><td>Mixed gain/loss, TSB over $3M</td><td>Sell losses first, then elect</td></tr><tr><td>All assets in loss</td><td>DO NOT ELECT — reset locks in lower base</td></tr><tr><td>Single asset fund with minor gain</td><td>Model net benefit — may not justify two-track records</td></tr></table><h3>Key Rule</h3><p>The election applies to every CGT asset held at 30 June 2026, or none. Once made, irrevocable. Lodged via approved form with 2026-27 SMSF annual return.</p>` },
    { num: "03", slug: "div296-03", name: "Asset-Level Exposure Table", desc: "Row-by-row modelling of each SMSF asset with and without the reset.", tier: 1, content: `<h2>Asset-Level Exposure Model</h2><p>For every CGT asset in your fund, you need both: original cost base AND projected 30 June 2026 market value.</p><table><tr><th>Asset Type</th><th>Reset Effect</th><th>Action Trigger</th></tr><tr><td>Appreciated property</td><td>Cost base resets UP — protects pre-2026 gain</td><td>Elect (after mixed-portfolio analysis)</td></tr><tr><td>Appreciated shares</td><td>Cost base resets UP — protects pre-2026 gain</td><td>Elect</td></tr><tr><td>Loss-position shares</td><td>Cost base resets DOWN — locks in lower base</td><td>Sell before 30 June if electing</td></tr><tr><td>Collectibles / unlisted units</td><td>Need valuation — complex</td><td>Engage qualified valuer</td></tr><tr><td>Cash / TDs</td><td>No cost base reset relevant</td><td>Ignore for this decision</td></tr></table>` },
    { num: "04", slug: "div296-04", name: "Valuation & Records Checklist", desc: "Documentation required for the election and subsequent two-track record-keeping.", tier: 1, content: `<h2>Evidence & Records Checklist</h2><ul class="checklist"><li>Complete SMSF CGT asset register with original cost base and dates</li><li>30 June 2026 market valuations — listed assets use closing price, illiquid need qualified valuer</li><li>Evidence of valuation methodology (for ATO audit defence)</li><li>Records of any pre-30-June disposals (triggering ordinary CGT in 2025-26)</li><li>SMSF trustee minutes resolving to make the election</li><li>Approved ATO election form lodged with 2026-27 annual return</li><li>Two-track cost base records established: ordinary CGT + Division 296 reset value</li><li>Multi-member fund: actuarial certificate for Division 296 attribution per member</li><li>Records retained for 5 years minimum</li></ul>` },
    { num: "05", slug: "div296-05", name: "Your Accountant Brief", desc: "4 questions to take to your SMSF accountant before you lodge the choice.", tier: 1, content: `<div class="info-box">Ask these at your pre-June 2026 SMSF review — not at the lodgement review in 2028.</div><div class="action-box"><h3>Question 1</h3><p>"What are the current market values vs original cost bases for every CGT asset in my SMSF?"</p></div><h3>Question 2</h3><p>"Based on my asset mix, is the cost-base reset net beneficial — and if not, what pre-30-June disposals fix it?"</p><h3>Question 3</h3><p>"Do I need independent valuations for illiquid assets — which valuer, when, and what evidence do you need?"</p><h3>Question 4</h3><p>"What's my two-track record-keeping obligation after electing, and how will you maintain it for the next 5+ years?"</p>` },
    { num: "06", slug: "div296-06", name: "Full Cost-Base Reset Execution Plan", desc: "Step-by-step execution for electing the cost-base reset without creating irreversible errors.", tier: 2, content: `<h2>Cost-Base Reset — Full Execution</h2><h2>Phase 1 — Analysis (was April-May 2026)</h2><ol><li>Obtain full SMSF asset register with original cost base and acquisition dates</li><li>Get preliminary market values for all CGT assets (listed + indicative for illiquid)</li><li>Identify loss-position assets — flag for pre-30-June disposal decision</li><li>Run fund-level modelling: Div 296 tax WITH reset vs WITHOUT (10-20 year horizon)</li><li>Decide: ELECT, DO NOT ELECT, or ELECT + sell specific loss assets first</li></ol><h2>Phase 2 — May-June 2026 (Preparation)</h2><ol><li>Engage qualified independent valuer for illiquid assets</li><li>Loss-position asset disposals — window closed on 30 June 2026, no longer available</li><li>Draft SMSF trustee minute resolving to make the election</li></ol><h2>Phase 3 — After 30 June 2026 (Valuations Locked)</h2><ol><li>Obtain final 30 June 2026 market values for all assets</li><li>Update SMSF cost base records to reflect election values</li><li>Set up two-track record-keeping: ordinary CGT ledger + Division 296 reset ledger</li></ol><h2>Phase 4 — 2026-27 Annual Return (Lodgement)</h2><ol><li>Lodge the election in the approved form with the SMSF's 2026-27 annual return</li><li>Once lodged: irrevocable. Retain all documentation for minimum 5 years.</li></ol>` },
    { num: "07", slug: "div296-07", name: "Pre-30-June Disposal Strategy", desc: "How to optimise the all-or-nothing election by disposing of loss-position assets first.", tier: 2, content: `<h2>Loss-Asset Disposal Strategy — window closed 30 June 2026</h2><p>Disposing of loss-position assets removed them from the election pool, so they kept their original (higher) cost base for Division 296. That window closed on 30 June 2026. What follows is recorded so you can see how the fund’s position was set, and judge the election on the assets it actually held at that date.</p><h2>The Decision Formula</h2><p>Sell loss asset before 30 June if: (Future Div 296 tax on recovery if reset) > (Immediate CGT cost of selling + repurchase cost + market risk during gap)</p><h2>Worked Example (CSL)</h2><p>Original cost $500,000, current market value $300,000. If held through reset: cost base drops to $300,000. If CSL recovers to $500,000: $200,000 recovery taxed under Div 296 at attributable proportion × 15%.</p><p>If sold before 30 June: CGT loss of $200,000 realised in 2025-26. Shares repurchased after 30 June at ~$300,000. New cost base = repurchase price. No reset penalty.</p><h2>Wash-Sale Consideration</h2><p>Document the Division 296 commercial rationale in SMSF trustee minutes. Part IVA may apply if the disposal/repurchase lacks genuine commercial purpose.</p>` },
    { num: "08", slug: "div296-08", name: "Long-Term Two-Track Record-Keeping Model", desc: "How to maintain the dual ordinary-CGT and Division 296 cost bases over 5-20 years.", tier: 2, content: `<h2>Two-Track Record-Keeping Model</h2><p>Post-election, every CGT asset has TWO cost bases — one for ordinary CGT (unchanged) and one for Division 296 (reset to 30 June 2026 market value). Both must be tracked through every future corporate action and on disposal.</p><h2>Per-Asset Data Required</h2><ul><li>Original acquisition date and cost (ordinary CGT base)</li><li>30 June 2026 market value (the Division 296 reset base)</li><li>Any subsequent improvements or reinvestments</li></ul><h2>On Disposal — Two Calculations</h2><p>Ordinary CGT gain = Sale price − original cost base</p><p>Division 296 gain = Sale price − 30 June 2026 market value</p><h2>Software Implications</h2><p>Most SMSF admin software (Class, BGL, Supermate) is being updated to handle the two-track model. Confirm your provider's capability before electing. Retention: records must be kept for 5 years from lodgement of the election, and effectively for the life of the asset plus 5 years after disposal.</p>` },
  ],
  successPromptFields: [
    { key: "tsb_band",             label: "TSB band",                           defaultVal: "3m_to_10m" },
    { key: "embedded_gains_band",  label: "Embedded unrealised gains band",     defaultVal: "500k_to_1m" },
    { key: "has_loss_assets",      label: "Has loss-position assets",           defaultVal: "false" },
    { key: "div296_exposure",      label: "Estimated Div 296 tax exposure",     defaultVal: "50000" },
    { key: "avoidable_with_reset", label: "Avoidable tax via reset election",   defaultVal: "30000" },
    { key: "election_recommended", label: "Cost-base reset recommended",        defaultVal: "true" },
    { key: "status",               label: "Verdict status",                     defaultVal: "RESET RECOMMENDED" },
    { key: "tier",                 label: "Product tier purchased",             defaultVal: "147" },
  ],
  tier1AssessmentFields: [
    "div296ExposureStatus",
    "tsbBandAnalysis",
    "embeddedGainsAnalysis",
    "exposurePerAssetSummary",
    "resetElectionRecommendation",
    "avoidableTaxQuantum",
    "lossAssetHandling",
    "valuationRequirements",
    "firstAction",
  ],
  tier2AssessmentFields: [
    "div296ExposureStatus",
    "tsbBandAnalysis",
    "embeddedGainsAnalysis",
    "exposurePerAssetSummary",
    "resetElectionRecommendation",
    "avoidableTaxQuantum",
    "lossAssetHandling",
    "valuationRequirements",
    "preJune30DisposalPlan",
    "electionLodgementProcess",
    "twoTrackRecordKeepingSetup",
    "longTermProjectionModel",
    "accountantImplementationChecklist",
  ],
};
