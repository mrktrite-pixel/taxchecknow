import type { ProductConfig } from "../types/product-config";

// AUTO-EMITTED by the artifact→config adapter (PQ-C1c). Source: soverella build aabca693
// (GATES_PASSED). Deterministic serialization; verbatim ATO prose. Machine product —
// the page mounts EngineCalculator (engine JSON alongside), not a hand-written calculator.

export const PRODUCT_CONFIG: ProductConfig = {
  "id": "superannuation-tax-leaving-australia-confusion-2026",
  "name": "Superannuation Tax When Leaving Australia (DASP)",
  "site": "taxchecknow",
  "country": "au",
  "market": "Australia",
  "language": "en-AU",
  "currency": "AUD",
  "slug": "au/check/superannuation-tax-leaving-australia-confusion-2026",
  "url": "https://taxchecknow.com/au/check/superannuation-tax-leaving-australia-confusion-2026",
  "apiRoute": "/api/rules/superannuation-tax-leaving-australia-confusion-2026",
  "authority": "ATO",
  "authorityUrl": "https://www.ato.gov.au",
  "legalAnchor": "DASP",
  "legislation": "Migration Act 1958",
  "lastVerified": "July 2026",
  "tier1": {
    "price": 67,
    "name": "DASP & Departure Super Plan",
    "tagline": "How much super tax will be withheld when you leave Australia — and what happens if you don't claim?",
    "value": "A personalised super-when-leaving analysis — your DASP tax position by visa class, the 28-day payment window, and what happens to unclaimed super after 6 months. Built around your answers.",
    "cta": "Get My DASP & Departure Super Plan — $67 →",
    "productKey": "au_67_superannuation_tax_leaving_australia_confusion_2026",
    "envVar": "STRIPE_AU_SUPERLEAVE_67",
    "successPath": "assess",
    "fileCount": 5
  },
  "tier2": {
    "price": 147,
    "name": "Departure Tax & Super Optimisation System",
    "tagline": "Plan your whole departure — DASP timing, taxed vs untaxed elements, and residency interaction.",
    "value": "Full departure planning — DASP timing strategy, taxed vs untaxed element breakdown, residency interaction, and a decision framework for your adviser. Everything in the plan, plus the complete system.",
    "cta": "Get My Departure Tax & Super Optimisation System — $147 →",
    "productKey": "au_147_superannuation_tax_leaving_australia_confusion_2026",
    "envVar": "STRIPE_AU_SUPERLEAVE_147",
    "successPath": "plan",
    "fileCount": 8
  },
  "deadline": {
    "isoDate": "2026-10-31T23:59:59.000+11:00",
    "display": "31 October 2026",
    "short": "31 Oct 2026",
    "description": "Individual tax return due — and a reminder that unclaimed super transfers to the ATO 6 months after departure",
    "urgencyLabel": "TIME-SENSITIVE",
    "countdownLabel": "Act before your super becomes ATO unclaimed money"
  },
  "h1": "Superannuation Tax When Leaving Australia (DASP) 2026: How Much Is Withheld — and What If You Never Claim?",
  "metaTitle": "Superannuation Tax Leaving Australia 2026 (DASP) — Withholding Rates by Visa | TaxCheckNow",
  "metaDescription": "Leaving Australia? Your super can be claimed as a DASP, taxed at 35%/45% for most visas or 65% for working holiday makers. Unclaimed super transfers to the ATO after 6 months. Free check shows your position.",
  "canonical": "https://taxchecknow.com/au/check/superannuation-tax-leaving-australia-confusion-2026",
  "answerHeadline": "The answer — ATO confirmed July 2026",
  "answerBody": [
    "When leaving Australia as a temporary resident, you may generally claim your superannuation as a Departing Australia Superannuation Payment (DASP), with tax withheld at the time of payment — 35% on the taxed element and 45% on the untaxed element for most visa holders, or 65% on both elements for working holiday maker visa holders — and if you do not apply, your super fund may transfer your balance to the ATO as unclaimed money once 6 months or more has passed since you left Australia and your visa has ceased, depending on circumstances.",
    "Departing Australia Superannuation Payment (DASP) matters are generally governed under the Migration Act 1958, as indicated by the Australian Taxation Office's guidance on temporary residents and superannuation. Depending on circumstances, the applicable rules and requirements may vary, and this source is indicated as the primary authority on this topic."
  ],
  "answerSource": "ATO — Departing Australia Superannuation Payment (DASP)",
  "mistakesHeadline": "Common DASP mistakes and misconceptions",
  "mistakes": [
    "Assuming the 65% unclaimed-money rate applies to every visa type — it applies specifically to working holiday makers; other temporary residents face 35% (taxed element) and 45% (untaxed element).",
    "Thinking you can leave super in Australia indefinitely — after 6 months since departure with your visa ceased, your fund transfers it to the ATO as unclaimed super money.",
    "Not certifying ID documents before leaving — balances of $5,000 or more need certified proof of identity, far easier to arrange while still in Australia.",
    "Misjudging eligibility — you must have held a temporary visa (excluding subclasses 405 and 410), the visa must have ceased, and you must have left Australia."
  ],
  "chainVisual": {
    "label": "Your DASP position",
    "broken": "Super left unclaimed → transferred to the ATO → working-holiday-maker 65% rate risk",
    "fixed": "Claim DASP correctly → tax withheld at your visa-class rate → generally paid within 28 days"
  },
  "brackets": [
    {
      "label": "Ordinary tax rate — taxed element",
      "value": "35%",
      "status": "risk"
    },
    {
      "label": "Ordinary tax rate — untaxed element",
      "value": "45%",
      "status": "trap"
    },
    {
      "label": "WHM tax rate — both elements",
      "value": "65%",
      "status": "deep_trap"
    },
    {
      "label": "Super balance ID threshold",
      "value": "$5,000",
      "status": "approaching"
    },
    {
      "label": "Unclaimed super → ATO transfer",
      "value": "6 months",
      "status": "risk"
    },
    {
      "label": "DASP payment window",
      "value": "28 days",
      "status": "in_scope"
    },
    {
      "label": "Payment summary issuance",
      "value": "14 days",
      "status": "in_scope"
    }
  ],
  "calculatorInputs": [],
  "tierAlgorithm": {
    "description": "Tier is set by the outcome the calculator routes you to. Most single-surface outcomes map to the $67 plan; situations spanning multiple rule surfaces (super already transferred to the ATO as unclaimed money) map to the $147 system.",
    "tier2Conditions": [
      "Super already transferred to the ATO as unclaimed money",
      "Multiple visa types held across the working period",
      "Balance and residency interaction needs review"
    ],
    "tier2Flags": [
      "dasp-unclaimed-super-ato-transfer"
    ]
  },
  "calculatorRuleBox": {
    "label": "How this check works",
    "body": "Answer a few questions about your visa, your departure, and your super balance. The tool routes you to the DASP outcome that matches your situation using ATO-sourced rules — no numbers are invented."
  },
  "calculatorClarification": {
    "label": "Indicated language",
    "body": "General information, not personal advice. Outcomes are indicated based on your answers and may vary depending on your circumstances."
  },
  "countdownLabel": "Act before your super becomes ATO unclaimed money",
  "countdownStats": [
    {
      "label": "Unclaimed super transfer",
      "value": "6 months",
      "sub": "After leaving with your visa ceased, your fund transfers to the ATO",
      "red": true
    },
    {
      "label": "ID documents",
      "value": "$5,000+",
      "sub": "Balance at/above threshold needs certified ID — easier before you leave",
      "red": false
    },
    {
      "label": "Payment window",
      "value": "28 days",
      "sub": "DASP generally paid within 28 days of a complete application",
      "red": false
    }
  ],
  "geoBlockTitle": "Key facts — DASP when leaving Australia",
  "geoBlockH2": "Superannuation tax on leaving Australia, at a glance",
  "geoBodyParagraph": "When leaving Australia as a temporary resident, you can claim your superannuation as a Departing Australia Superannuation Payment (DASP). Tax is withheld at the time of payment: for non-working holiday maker (WHM) visa holders, the taxable component (taxed element) is taxed at 35% and the untaxed element at 45%; for WHM visa holders, both elements are taxed at 65%. The tax-free component is nil for both. Payment is generally made within 28 days of a completed application. If you don't apply, your super fund will transfer your super to the ATO as unclaimed money if it has been 6 months or more since you left Australia and your visa has ceased.",
  "geoFormula": "",
  "geoFacts": [
    {
      "label": "Super fund transfer to ATO threshold (time since leaving)",
      "value": "6 months"
    },
    {
      "label": "Proof of identification threshold (super balance)",
      "value": "$5,000"
    },
    {
      "label": "Certification of Immigration Status threshold (super balance)",
      "value": "$5,000"
    },
    {
      "label": "DASP payment window",
      "value": "28 days"
    },
    {
      "label": "DASP ordinary tax rate — taxable component (taxed element)",
      "value": "35 %"
    },
    {
      "label": "DASP WHM tax rate — taxable component (taxed element)",
      "value": "65 %"
    },
    {
      "label": "DASP ordinary tax rate — taxable component (untaxed element)",
      "value": "45 %"
    },
    {
      "label": "DASP WHM tax rate — taxable component (untaxed element)",
      "value": "65 %"
    },
    {
      "label": "DASP payment summary issuance window",
      "value": "14 days"
    }
  ],
  "workedExamplesH2": "",
  "workedExamplesColumns": [],
  "workedExamples": [],
  "comparisonH2": "Compare DASP withholding by visa class",
  "comparisonColumns": [
    "Situation",
    "Applies when",
    "Indicated outcome",
    "What to check"
  ],
  "comparisonRows": [
    {
      "position": "Non-WHM — taxed element",
      "metric1": "Temporary visa holder (non-working-holiday-maker) — taxable component, taxed element",
      "metric2": "The taxed element of the taxable component may be subject to a withholding rate of 35 % at the time of DASP payment.",
      "bestMove": "Confirm your taxed-element balance with your fund"
    },
    {
      "position": "Non-WHM — untaxed element",
      "metric1": "Temporary visa holder (non-working-holiday-maker) — taxable component, untaxed element",
      "metric2": "The untaxed element of the taxable component may be subject to a withholding rate of 45 % at the time of DASP payment.",
      "bestMove": "Confirm your untaxed-element balance with your fund"
    },
    {
      "position": "WHM (417/462) — taxed element",
      "metric1": "Working holiday maker visa holder (subclass 417 or 462) — taxable component, taxed element",
      "metric2": "The taxed element of the taxable component may be subject to a withholding rate of 65 % at the time of DASP payment.",
      "bestMove": "Confirm your visa subclass (417 or 462)"
    },
    {
      "position": "WHM (417/462) — untaxed element",
      "metric1": "Working holiday maker visa holder (subclass 417 or 462) — taxable component, untaxed element",
      "metric2": "The untaxed element of the taxable component may be subject to a withholding rate of 65 % at the time of DASP payment.",
      "bestMove": "Confirm your visa subclass (417 or 462)"
    },
    {
      "position": "Complete application received",
      "metric1": "Completed DASP application received — payment window",
      "metric2": "DASP is generally paid within 28 days of a completed application being received.",
      "bestMove": "Submit a complete DASP application"
    }
  ],
  "toolsH2": "What to do for each outcome",
  "toolsColumns": [
    "Outcome",
    "What it means",
    "Your next step"
  ],
  "toolsRows": [
    {
      "tool": "dasp-eligibility-check",
      "effect": "dasp-eligibility-check — one or more of the three core eligibility conditions may not be clearly met",
      "note": "Gather your visa history and Australian departure record and review the three DASP eligibility conditions (temporary visa held, visa ceased, departed Australia) against your circumstances before submitting a claim."
    },
    {
      "tool": "dasp-tax-ordinary-visa",
      "effect": "dasp-tax-ordinary-visa — high-risk signal for tax withholding on taxed and untaxed elements",
      "note": "Request a breakdown of your super balance by component (taxed element and untaxed element) from your super fund so you can understand which withholding rate may apply to each portion of your payment."
    },
    {
      "tool": "dasp-tax-whm-visa",
      "effect": "dasp-tax-whm-visa — high-risk signal for elevated tax withholding on both elements",
      "note": "Request a breakdown of your super balance by component from your super fund and review the applicable withholding rate for working holiday maker visa holders before submitting your DASP claim."
    },
    {
      "tool": "dasp-id-requirements-high-balance",
      "effect": "dasp-id-requirements-high-balance — time-sensitive certified identification requirement",
      "note": "Arrange certified copies of your proof of identification documents and, if submitting a paper application, obtain a Certification of Immigration Status from Home Affairs — ideally before leaving Australia where possible."
    },
    {
      "tool": "dasp-payment-timeline",
      "effect": "dasp-payment-timeline — indicated risk of delay if application is incomplete",
      "note": "Check that your DASP application is complete before submission and note the expected payment and payment summary windows so you can follow up if those timeframes pass without a response."
    },
    {
      "tool": "dasp-unclaimed-super-ato-transfer",
      "effect": "dasp-unclaimed-super-ato-transfer — indicated risk that balance has been transferred to the ATO",
      "note": "Check the ATO's unclaimed super money service to determine whether your balance has been transferred, and follow the ATO's process for claiming unclaimed super rather than contacting your former super fund directly."
    },
    {
      "tool": "none_fit",
      "effect": "none_fit — situation does not match any supported DASP pathway (e.g. permanent resident, excluded subclass, balance below threshold)",
      "note": "Review whether your visa subclass or balance level places you outside the DASP framework and seek guidance appropriate to your specific visa or residency status."
    },
    {
      "tool": "insufficient_information",
      "effect": "insufficient_information — visa type, balance, or time elapsed is unclear",
      "note": "Locate your visa grant notice, super fund statement, and departure records to confirm the missing details before re-entering the tool or seeking further guidance."
    }
  ],
  "aiCorrections": [
    {
      "wrong": "The AI stated that superannuation balances left unclaimed and transferred to the ATO as unclaimed money attract a 65% withholding rate 'regardless of visa type.' In fact, the 65% rate for ATO-held unclaimed money applies specifically to working holiday makers; non-WHM temporary residents have their taxable component (taxed element) withheld at 35% and untaxed element at 45%, consistent with the standard DASP rates.",
      "correct": "When leaving Australia as a temporary resident, you can claim your superannuation as a Departing Australia Superannuation Payment (DASP). Tax is withheld at the time of payment: for non-working holiday maker (WHM) visa holders, the taxable component (taxed element) is taxed at 35% and the untaxed element at 45%; for WHM visa holders, both elements are taxed at 65%. The tax-free component is nil for both. Payment is generally made within 28 days of a completed application. If you don't apply, your super fund will transfer your super to the ATO as unclaimed money if it has been 6 months or more since you left Australia and your visa has ceased."
    },
    {
      "wrong": "The Australian tax landscape for foreign residents, new migrants, and individuals departing Australia is subject to frequent changes and complexities, leading to significant confusion, particularly with new rules and proposals impacting 2026.\n\nKey areas of tax confusion for these groups include:\n\n### For Foreign Residents and New Migrants\n\n1.  **Tax Residency Status:** This is consistently the most significant and confusing aspect. Many individuals mistakenly equate their visa or migration status with their tax residency status.\n    *   **New Rules from July 1, 2026:** Proposed \"bright-line\" residency tests are expected to come into effect from July 1, 2026, which will introduce tougher day-counting rules. Under these new rules, an individual will generally be an Australian resident if they are physically present in Australia for 183 days or more in any 12-month period. There's also a \"45-day trap\" where spending between 45 and 183 days in Australia could still result in tax residency if two or more \"factor tests\" (right to reside, accommodation, economic ties, family ties) are met.\n    *   **Implications:** Australian tax residents are taxed on their worldwide income, while non-residents are only taxed on Australian-sourced income. Temporary residents, holding specific temporary visas, are generally taxed only on Australian-sourced income and certain foreign employment income, with most foreign passive investment income being exempt. Getting residency status wrong can lead to incorrect tax rates, missed deductions, and penalties.\n\n2.  **Taxation of Foreign Income:** New migrants and foreign residents often struggle with declaring income earned outside Australia. Many assume that if income is taxed overseas, it's not taxable in Australia.\n    *   **Worldwide Income Rule:** Australian tax residents are generally taxed on their worldwide income, including overseas salaries, rent, dividends, pensions, business income, and capital gains. While the Australian tax system aims to prevent double taxation through the Foreign Income Tax Offset (FITO), this offset may not eliminate all mismatches between tax systems, and careful reporting and record-keeping are required.\n    *   **Temporary Residents:** Temporary residents generally only pay tax on Australian-sourced income, and certain foreign employment income earned while in Australia. Foreign investment income, such as rent and dividends from overseas, is usually exempt.\n\n3.  **Capital Gains Tax (CGT) for Foreign Residents:** There are significant proposed changes and ongoing complexities in this area.\n    *   **Broadening of Taxable Assets:** The Australian Treasury has released exposure draft legislation in April 2026 that proposes to significantly expand the scope of Australia's CGT regime for foreign residents. This includes clarifying and broadening the definition of \"taxable Australian real property\" (TARP) to include assets with a \"close economic connection\" to Australian land and amending the \"principal asset test\" for indirect interests.\n    *   **Retrospective Application:** Alarmingly, some aspects of these proposed changes could apply retrospectively from 2006, creating significant uncertainty and potential for reassessment of past transactions.\n    *   **Withholding Obligations:** Changes to the foreign resident CGT withholding regime prevent reliance on declarations that membership interests are not indirect Australian real property interests unless the ATO is notified for transactions valued at $50 million or more. The withholding rate for foreign resident capital gains also increased from 12.5% to 15% from January 1, 2025, and the A$750,000 market value threshold was removed.\n\n4.  **Medicare Levy:** New migrants often have confusion surrounding the Medicare levy, especially if they are ineligible for Medicare benefits. They may still be charged the levy until they take steps to obtain an exemption.\n\n5.  **Tax File Number (TFN) and Filing Obligations:** Basic administrative tasks like applying for a TFN, providing it to employers, and understanding the financial year (July 1 to June 30) and filing deadlines (October 31 for self-lodgers) can be confusing for new arrivals. Without a TFN, employers must withhold tax at the top marginal rate.\n\n### For People Leaving Australia\n\n1.  **Change in Tax Residency:** Just like for new migrants, determining the exact date of ceasing Australian tax residency is critical and often misunderstood. Departing individuals may incorrectly assume their tax obligations automatically end upon leaving Australia. The new \"bright-line\" residency rules from July 1, 2026, will make this determination more prescriptive.\n\n2.  **Capital Gains Tax (CGT) on Departure (\"Exit Tax\"):** This is a significant \"tax trap\" for those leaving Australia permanently.\n    *   **CGT Event I1 (Deemed Disposal):** When an individual ceases to be an Australian tax resident, the ATO generally treats them as having disposed of their non-Taxable Australian Property (non-TAP) assets (like shares, managed funds, cryptocurrency, or overseas property) at their market value on the day residency ceases. This can trigger a capital gains tax liability even if the assets haven't been actually sold.\n    *   **Deferral Option:** Individuals can elect to defer the payment of this \"exit tax\" until the actual asset disposal. However, this comes with a cost: the loss of the 50% CGT discount for the period of non-residency, and the assets will be taxed at non-resident rates when eventually sold.\n    *   **Main Residence Exemption:** A significant change in recent years (after May 9, 2017) means that if you sell your former Australian home after ceasing Australian tax residency, you generally cannot claim the main residence exemption, leading to the full capital gain being taxable at non-resident rates with no 50% CGT discount. Selling *before* leaving is often advisable to retain this exemption.\n\n3.  **Superannuation (Departing Australia Superannuation Payment - DASP):** Accessing superannuation upon leaving Australia can be confusing, particularly regarding the withholding tax applied.\n    *   **DASP Tax Rates:** Temporary visa holders leaving permanently can claim their super through DASP, but this payment attracts significant withholding tax, typically 35% for most visas, and 65% for working holiday makers (Subclass 417 or 462 visas). If balances are left unclaimed and transferred to the ATO as unclaimed money, a 65% withholding rate applies regardless of visa type.\n    *   **New Tax on Large Balances (from July 1, 2026):** Proposed changes from July 1, 2026, will introduce an additional tax on earnings attributable to superannuation balances exceeding A$3 million. This impacts Australians living overseas who hold significant super balances.\n\n4.  **Tax-Free Threshold for Part-Year Residents:** Individuals leaving Australia and becoming non-residents for tax purposes will have a reduced tax-free threshold for the income year they depart, calculated proportionally to the months they were an Australian resident.\n\n5.  **Ongoing Australian-Sourced Income:** Even after becoming a foreign resident, individuals remain liable for Australian tax on any Australian-sourced income (e.g., rental income from Australian property, Australian dividends, or business income). Australian banks and share registries may apply non-resident withholding tax to interest and dividends.\n\nIn summary, for all three groups, correctly determining tax residency is paramount, especially with the impending 2026 changes. New migrants face confusion around declaring worldwide income and understanding basic compliance. Foreign residents are significantly impacted by changes to CGT on Australian assets, some with retrospective effect. Individuals leaving Australia must navigate complex \"exit tax\" rules on capital gains and understand the tax implications of accessing their superannuation. The increasing data sharing between international tax authorities in 2026 further underscores the importance of accurate compliance for all internationally mobile individuals.",
      "correct": "When leaving Australia as a temporary resident, you can claim your superannuation as a Departing Australia Superannuation Payment (DASP). Tax is withheld at the time of payment: for non-working holiday maker (WHM) visa holders, the taxable component (taxed element) is taxed at 35% and the untaxed element at 45%; for WHM visa holders, both elements are taxed at 65%. The tax-free component is nil for both. Payment is generally made within 28 days of a completed application. If you don't apply, your super fund will transfer your super to the ATO as unclaimed money if it has been 6 months or more since you left Australia and your visa has ceased."
    }
  ],
  "faqs": [
    {
      "question": "What happens to my super when I lose permanent resident status and leave Australia?",
      "answer": "This is an area many people find unclear, and understandably so. Generally, when a visa holder permanently departs Australia, their super may become claimable through a specific departure payment process. What happens to your balance — including whether it may eventually be transferred to the ATO if unclaimed — depends on your visa type, your departure circumstances, and how much time has passed. It's worth checking directly with your super fund and the ATO to understand where your balance stands, as the rules can differ depending on the residency status you held."
    },
    {
      "question": "Can I access my super as a permanent resident who is no longer a permanent resident?",
      "answer": "This is one of those situations where the rules can feel genuinely uncertain. Access to super generally depends on your current visa status and whether you have permanently departed Australia, not just the status you previously held. If your permanent residency has lapsed or been cancelled and you've left Australia, you may be in a different category than you expect. The ATO and your super fund are the right places to confirm what access conditions may apply to your specific situation — it's not something to assume either way."
    },
    {
      "question": "How do I contribute to super while a non-resident for tax purposes?",
      "answer": "Contributing to super as a non-resident for tax purposes is possible in some circumstances, but the rules around deductibility and eligibility for certain contribution types can work differently than they do for residents. Whether contributions are accepted, and how they're treated, may depend on your employment arrangement, your fund's rules, and your tax residency status. Keeping clear records of any contributions made during this period is generally a good idea. The ATO's guidance on super and tax residency is a useful starting point."
    },
    {
      "question": "What forms do I need to fill for ATO contributions as a non-resident?",
      "answer": "The specific forms involved can depend on what you're trying to do — whether that's making personal contributions, claiming a deduction, or something else. Many people find this part of the process confusing, and it's worth approaching it methodically. The ATO's website outlines the forms relevant to super contributions and non-resident situations. Keeping records of what you submit and when is important, as documentation requirements can apply. If you're unsure where to start, the ATO's online tools or a registered tax agent familiar with non-resident situations may help clarify the right pathway."
    },
    {
      "question": "Can I use the First Home Saver Scheme if I'm on a temporary visa?",
      "answer": "Eligibility for the First Home Super Saver Scheme generally involves a number of conditions, and visa status is one factor that may affect whether someone can participate or make a valid application. It's not straightforward to assume eligibility based on visa type alone. The ATO sets out the eligibility criteria for the scheme, and it's worth reviewing those carefully — or speaking with a registered tax agent — before making any contributions with the intention of using this scheme."
    },
    {
      "question": "What are the tax implications of withdrawing super via FHSS?",
      "answer": "Withdrawals through the First Home Super Saver Scheme are generally subject to tax, and the amount withheld can depend on factors like the type of contributions involved and your individual tax situation. There may also be implications if your circumstances change — for example, if you don't end up purchasing a home within the required timeframe. These are the kinds of 'hidden costs' that can catch people off guard, so it's worth understanding the full picture before requesting a release. The ATO's FHSS guidance covers how tax is applied, and a tax professional can help you model what it may mean for your specific situation."
    },
    {
      "question": "Can my partner's super also be withdrawn via FHSS for a house deposit?",
      "answer": "The First Home Super Saver Scheme is generally assessed on an individual basis, meaning each person's eligibility and contribution history is considered separately. Whether your partner may also be able to access their super through the scheme for the same property purchase depends on whether they independently meet the eligibility conditions. It's not automatic, and the rules around joint purchases and individual eligibility are worth checking carefully with the ATO or a registered tax agent before making plans based on both balances being available."
    }
  ],
  "accountantQuestionsH2": "Questions to take to your accountant",
  "accountantQuestions": [
    {
      "q": "I held more than one visa type while working in Australia — including both a working holiday maker visa and a skilled temporary visa at different times. How is the DASP tax withholding rate determined when my super contributions span both visa types?",
      "why": "Surfaces the 'mixed profile' situation this tool flags as needing a professional review."
    },
    {
      "q": "I was previously a permanent resident, lost that status while overseas, and am now trying to access my super as a former temporary resident. Does my change in residency status affect my DASP eligibility or the process I need to follow?",
      "why": "Surfaces the 'high complexity' situation this tool flags as needing a professional review."
    },
    {
      "q": "I am not sure whether my visa has formally ceased or is still technically active. How do I confirm visa cessation, and does an uncertain visa status prevent me from lodging a DASP claim?",
      "why": "Surfaces the 'insufficient information' situation this tool flags as needing a professional review."
    },
    {
      "q": "My super balance is at or above the identification threshold but I have already left Australia and cannot easily certify documents. What are my options for satisfying the identification requirements from overseas?",
      "why": "Surfaces the 'manual review required' situation this tool flags as needing a professional review."
    },
    {
      "q": "I held a subclass 405 or 410 visa while in Australia. Am I excluded from DASP entirely, and if so, what alternative pathways exist for accessing my superannuation?",
      "why": "Surfaces the 'none fit' situation this tool flags as needing a professional review."
    }
  ],
  "crosslink": {
    "title": "Also relevant",
    "body": "Leaving Australia can also trigger CGT on your former main residence. If you owned an Australian home, check your exposure before you sell.",
    "url": "/au/check/cgt-main-residence-trap",
    "label": "Check your main-residence CGT position →"
  },
  "lawBarSummary": "The governing legislation is the Migration Act 1958, with the ATO's DASP guidance selected as the primary authoritative source for temporary residents departing Australia and their superannuation entitlements.",
  "lawBarBadges": [
    "superannuation",
    "temporary resident",
    "departing Australia",
    "visa",
    "tax",
    "eligibility"
  ],
  "sources": [
    {
      "title": "ATO — Departing Australia Superannuation Payment (DASP)",
      "url": "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/temporary-residents-and-superannuation/departing-australia-superannuation-payment-dasp"
    }
  ],
  "files": [
    {
      "num": "01",
      "slug": "dasp-01",
      "name": "Your DASP Tax Position",
      "desc": "Your withholding rate by visa class and component (taxed vs untaxed element).",
      "tier": 1
    },
    {
      "num": "02",
      "slug": "dasp-02",
      "name": "Claim Timing & Payment Window",
      "desc": "The 28-day payment window and the 14-day payment-summary window, applied to your situation.",
      "tier": 1
    },
    {
      "num": "03",
      "slug": "dasp-03",
      "name": "ID & Certification Checklist",
      "desc": "What certified documents your balance requires and how to prepare them before you leave.",
      "tier": 1
    },
    {
      "num": "04",
      "slug": "dasp-04",
      "name": "Unclaimed Super Risk Brief",
      "desc": "What happens after 6 months and how to claim back from the ATO if it has already transferred.",
      "tier": 1
    },
    {
      "num": "05",
      "slug": "dasp-05",
      "name": "Your Accountant Brief",
      "desc": "DASP questions to take to your adviser, written for your exact situation.",
      "tier": 1
    },
    {
      "num": "06",
      "slug": "dasp-06",
      "name": "Taxed vs Untaxed Element Breakdown",
      "desc": "How your balance splits and the exact rate on each portion.",
      "tier": 2
    },
    {
      "num": "07",
      "slug": "dasp-07",
      "name": "Residency & Departure Interaction",
      "desc": "How ceasing residency interacts with your super and other departure obligations.",
      "tier": 2
    },
    {
      "num": "08",
      "slug": "dasp-08",
      "name": "Adviser Decision Framework",
      "desc": "A structured framework to plan DASP timing with your adviser and any planned return.",
      "tier": 2
    }
  ],
  "calendarTitle": "Key dates for your departure",
  "tier1Calendar": [
    {
      "uid": "dasp-certify",
      "summary": "Certify ID documents before leaving Australia",
      "description": "If your balance is $5,000 or more, certified proof of identity is required — far easier while still in Australia.",
      "date": "20260630"
    },
    {
      "uid": "dasp-6month",
      "summary": "6-month unclaimed-super checkpoint",
      "description": "6 months after departure with your visa ceased, your fund may transfer your super to the ATO as unclaimed money.",
      "date": "20261031"
    }
  ],
  "tier2Calendar": [
    {
      "uid": "dasp-review",
      "summary": "Review DASP timing with your adviser",
      "description": "Confirm component split, visa-class rate, and any planned-return interaction before you claim.",
      "date": "20260930"
    }
  ],
  "delivery": {
    "tier1DriveEnvVar": "",
    "tier2DriveEnvVar": ""
  },
  "monitorUrls": [
    "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/temporary-residents-and-superannuation/departing-australia-superannuation-payment-dasp"
  ],
  "sidebarNumbers": [
    {
      "label": "Super fund transfer to ATO threshold (time since leaving)",
      "value": "6 months"
    },
    {
      "label": "Proof of identification threshold (super balance)",
      "value": "$5,000"
    },
    {
      "label": "Certification of Immigration Status threshold (super balance)",
      "value": "$5,000"
    },
    {
      "label": "DASP ordinary tax rate — taxable component (taxed element)",
      "value": "35 %"
    },
    {
      "label": "DASP WHM tax rate — taxable component (taxed element)",
      "value": "65 %"
    },
    {
      "label": "DASP ordinary tax rate — taxable component (untaxed element)",
      "value": "45 %"
    }
  ],
  "sidebarMathsTitle": "What this check covers",
  "sidebarMathsIncludes": [
    "DASP tax rates by visa class",
    "Taxed vs untaxed element rates",
    "Payment and payment-summary windows",
    "Unclaimed-super transfer timing",
    "ID document thresholds"
  ],
  "sidebarMathsExcludes": [
    "Your exact super balance",
    "CGT on departure",
    "Personal financial advice"
  ],
  "sidebarMathsNote": "Figures are ATO-sourced; your super fund confirms your component split.",
  "howToSteps": [
    {
      "position": 1,
      "name": "Confirm eligibility",
      "text": "Check you held a temporary visa (excluding 405/410), the visa has ceased, and you have left Australia."
    },
    {
      "position": 2,
      "name": "Identify your visa class",
      "text": "Working holiday maker (417/462) or other temporary visa — this sets your withholding rate."
    },
    {
      "position": 3,
      "name": "Prepare documents",
      "text": "For balances of $5,000 or more, arrange certified ID before leaving."
    },
    {
      "position": 4,
      "name": "Submit your DASP claim",
      "text": "Apply via the ATO or your fund; payment is generally made within 28 days of a complete application."
    }
  ],
  "successPromptFields": [
    {
      "key": "visa_class",
      "label": "Visa class held",
      "defaultVal": "temporary"
    },
    {
      "key": "time_since_leaving",
      "label": "Time since leaving Australia",
      "defaultVal": "unknown"
    },
    {
      "key": "super_balance_band",
      "label": "Super balance band",
      "defaultVal": "unknown"
    }
  ],
  "tier1AssessmentFields": [
    "daspStatus",
    "taxByVisaClass",
    "paymentTimeline",
    "idDocRequirements",
    "unclaimedSuperRisk",
    "confidenceLevel",
    "firstAction"
  ],
  "tier2AssessmentFields": [
    "daspStatus",
    "taxByVisaClass",
    "taxedVsUntaxedBreakdown",
    "paymentTimeline",
    "idDocRequirements",
    "unclaimedSuperRisk",
    "residencyInteraction",
    "superBalanceStrategy",
    "adviserDecisionFramework",
    "returnPlanningNote",
    "nextStepsCalendar",
    "strongestRiskTrigger",
    "confidenceLevel",
    "firstAction"
  ]
};
