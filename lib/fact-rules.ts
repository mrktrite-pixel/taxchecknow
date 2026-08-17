// lib/fact-rules.ts
//
// W2 — per-product FACT RULES: how a product's facts must be PHRASED in generated content.
//
// WHY A REGISTRY AND NOT JUST A CONFIG FIELD. The authoring home is the product config
// (`ProductConfig.factRules`), but the config lives under cole/, which the Next build
// excludes and lib/ cannot import. More importantly, the caller that matters most — the
// Stripe webhook — builds its AssessInput itself and is out of scope to edit. If fact rules
// only travelled as an explicit argument, the client success-page fallback would get them
// and the normal purchase path would not: exactly the divergence that left every stored
// FRCGW assessment carrying generic field keys.
//
// So generateAssessment() resolves them itself, from here, for BOTH callers. Same pattern
// assess-core already uses for RULES_SLUG.
//
// The two copies (config + this file) must agree. A behaviour test asserts it element by
// element, so they cannot drift silently.
//
// WHY FACT RULES ARE NOT JUST MORE CORPUS. The corpus states what the law IS; it cannot say
// which true-adjacent paraphrase is wrong. "Processing takes 1–4 weeks" contradicts no single
// corpus figure — the ATO does say allow up to 28 days — but it is the wrong shape of claim
// and it is what the model reached for every time. A fact rule pairs the wrong phrasing with
// the right one, which is the form that actually displaces it.

export const PRODUCT_FACT_RULES: Record<string, string[]> = {
  "frcgw-clearance-certificate": [
    "PROCESSING TIME: say \"most certificates issue within days; the ATO says allow up to 28\". " +
      "NEVER say \"1-4 weeks\", \"one to four weeks\", or any variant. 28 days is the outer allowance " +
      "for an application that needs manual checking, NOT the expected wait, and presenting it as " +
      "the expected wait makes sellers think they have missed their chance when they have not.",

    "THE MONEY IS NOT LOST: an amount withheld is WITHHELD AND CREDITED to the vendor. NEVER say " +
      "the seller will \"lose\" it, that it is \"locked up\", \"tied up\", \"stuck\", or \"forfeited\". " +
      "It is remitted to the ATO and sits there as a credit in the vendor's name.",

    "WHO WITHHOLDS: the PURCHASER withholds the 15% and remits it to the ATO. NEVER write that " +
      "\"the ATO withholds\" — the ATO receives, it does not withhold. Do not write that the money " +
      "is held by \"the buyer's solicitor\" or in anyone's trust account; the purchaser's " +
      "representative may action the payment, but the money goes to the ATO at or before settlement.",

    "RECOVERY TIMING: the credit is claimed in the return for the income year the CONTRACT was " +
      "signed — which can be an earlier income year than settlement. Because a return cannot be " +
      "lodged before its income year ends, the gap between settlement and refund CAN REACH AROUND " +
      "15 MONTHS where the contract was signed early in the year. Derive the timing from that rule. " +
      "NEVER quote a generic \"6-18 months\" or any other invented range.",

    "RESIDENTS ARE NOT EXEMPT: an Australian resident WITHOUT a clearance certificate is still " +
      "subject to the withholding. They could have PREVENTED it by obtaining the certificate; they " +
      "were never exempt from the rule. Never tell a resident the withholding \"should not have " +
      "applied\" or was an error — the purchaser was complying with the law.",

    "THE CERTIFICATE: free, issued by the ATO, valid 12 months from issue, with no obligation to " +
      "use it. Applied for online at ato.gov.au/clearancecertificate. One per VENDOR on the title, " +
      "not one per property.",

    "FORM NAMES: do NOT name a specific ATO form, form number, schedule or online-service " +
      "menu path unless that exact name appears in the corpus above. Describe the INSTRUMENT " +
      "instead — the clearance certificate application, a variation notice, the purchaser's " +
      "payment notification to the ATO. An invented or half-remembered form identifier reads " +
      "as precise and sends people looking for something that does not exist.",
    "FOREIGN RESIDENTS: cannot obtain a clearance certificate at all. The instrument available to " +
      "them is a variation NOTICE (never a \"variation certificate\"), which can set the rate " +
      "anywhere between 0% and 14.99% on real grounds.",

    "THE PURCHASER'S SIDE — LEAD WITH THE ASK: call them the PURCHASER, or the purchaser's " +
      "conveyancer or solicitor. Never \"the buyer's solicitor\". When you write about what to " +
      "send or request, OPEN with the thing to ask for, not with a negation — never begin \"there " +
      "is no instruction\", \"there is nothing to send\" or \"this no longer applies\". Once an " +
      "amount has been withheld there is still something to request: the purchaser's payment " +
      "notification to the ATO, the amount remitted and the date it was paid, which is what " +
      "evidences the credit at lodgement. Say what to ask for first; note that the certificate " +
      "wording no longer applies afterwards, if at all.",
  ],
};

/** Fact rules for a product, or an empty array. Empty ⇒ nothing is injected. */
export function getFactRules(productId: string): string[] {
  return PRODUCT_FACT_RULES[productId] ?? [];
}
