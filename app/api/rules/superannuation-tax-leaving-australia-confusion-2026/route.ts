// Product corpus for SUPERLEAVE (DASP). Authored 2026-07-23 to close the fail-closed gap: the
// DELIVERY_MAP productId "superannuation-tax-leaving-australia-confusion-2026" had NO /api/rules
// route, so grounded generation was impossible. Every fact below is drawn from this product's OWN
// verified figures.json + au-16 config (answerBody, files, sidebarNumbers) — nothing invented.
// Mirrors the shape of /api/rules/frcgw-clearance-certificate.

import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 86400; // 24 hours

export async function GET() {
  const rules = {
    "schema_version": "1.0",
    "generated_by": "COLE — Citation Operations & Legal Engine (corpus backfill)",
    "product_id": "superannuation-tax-leaving-australia-confusion-2026",
    "title": "Superannuation Tax When Leaving Australia — Departing Australia Superannuation Payment (DASP)",
    "site": "https://taxchecknow.com/au/check/superannuation-tax-leaving-australia-confusion-2026",
    "authority": "ATO",
    "authority_url": "https://www.ato.gov.au",
    "jurisdiction": "Australia",
    "language": "en-AU",
    "currency": "AUD",
    "last_verified": "July 2026",
    "legislation": "Migration Act 1958 · ATO guidance on temporary residents and superannuation (Departing Australia Superannuation Payment). DASP withholding on the taxable component: taxed element 35% and untaxed element 45% for ordinary temporary visa holders; 65% on BOTH elements for working holiday maker (subclass 417/462) visa holders; tax-free component 0%. Unclaimed super transfers to the ATO once 6 months or more have passed since departure with the visa ceased — the 65% rate still applies to working holiday makers on ATO-held unclaimed money.",
    "legal_anchor": "Migration Act 1958 — Departing Australia Superannuation Payment (DASP), ATO temporary-residents-and-superannuation guidance",
    "key_facts": {
        "dasp_taxed_element_ordinary_visa": "35%",
        "dasp_untaxed_element_ordinary_visa": "45%",
        "dasp_taxed_element_working_holiday_maker": "65% (subclass 417/462)",
        "dasp_untaxed_element_working_holiday_maker": "65% (subclass 417/462)",
        "dasp_tax_free_component": "0%",
        "unclaimed_super_transfer_to_ato": "6 months or more after departure with the visa ceased",
        "unclaimed_super_rate_whm": "65% still applies to working holiday makers on ATO-held unclaimed money",
        "dasp_payment_window": "within 28 days of a complete application",
        "dasp_payment_summary_window": "within 14 days of payment",
        "certified_id_threshold": "balance of $5,000 or more may require certified proof of identity / Certification of Immigration Status",
        "eligibility": "held a temporary visa (excluding subclass 405 and 410), visa has ceased, and departed Australia; permanent residents and Australian citizens are NOT eligible",
        "return_deadline_context": "individual tax return due 31 October 2026 (self-lodgers)"
    },
    "formula": "DASP withheld at payment = taxable component (taxed element × rate) + (untaxed element × rate). Ordinary temporary visa: taxed element 35%, untaxed element 45%. Working holiday maker (417/462): 65% on both elements. Tax-free component: 0%.",
    "common_ai_errors": [
        {
            "error_id": 1,
            "ai_says": "ChatGPT says: DASP is taxed at 35% for everyone leaving Australia",
            "correct": "Reality: 35% is the taxed-element rate for ORDINARY temporary visa holders. Working holiday maker visas (subclass 417/462) are taxed at 65% on BOTH the taxed and untaxed elements — nearly double."
        },
        {
            "error_id": 2,
            "ai_says": "ChatGPT says: you get your superannuation tax-free when you leave Australia",
            "correct": "Reality: a DASP has tax withheld AT THE TIME OF PAYMENT — 35% taxed element and 45% untaxed element for ordinary visas, 65% for working holiday makers. Only the tax-free component is 0%."
        },
        {
            "error_id": 3,
            "ai_says": "ChatGPT says: you can claim your Australian super any time after you leave",
            "correct": "Reality: once 6 months or more have passed since you left and your visa ceased, your fund may transfer the balance to the ATO as unclaimed money. You then claim from the ATO, not the fund — and working holiday makers still face the 65% rate."
        },
        {
            "error_id": 4,
            "ai_says": "ChatGPT says: the untaxed element is taxed at the same rate as the taxed element",
            "correct": "Reality: for ordinary temporary visa holders the taxed element is 35% but the untaxed element is 45%. (Working holiday makers are 65% on both.) Ask your fund for a component statement so the split is known before you claim."
        },
        {
            "error_id": 5,
            "ai_says": "ChatGPT says: permanent residents and citizens can claim a DASP too",
            "correct": "Reality: DASP eligibility requires a temporary visa (excluding subclass 405/410) that has ceased, and that you have left Australia. Permanent residents and Australian citizens are NOT eligible."
        }
    ],
    "faq": [
        {
            "id": 1,
            "question": "How much tax is withheld on my super when I leave Australia?",
            "answer": "When a temporary resident leaves Australia and claims their super as a Departing Australia Superannuation Payment (DASP), tax is withheld at the time of payment on the taxable component. For ordinary temporary visa holders the taxed element is withheld at 35% and the untaxed element at 45%. Working holiday maker visa holders (subclass 417 or 462) are withheld at 65% on both elements. Any tax-free component is 0%."
        },
        {
            "id": 2,
            "question": "What happens if I do not claim my super after leaving?",
            "answer": "If 6 months or more have passed since you left Australia and your visa has ceased, your super fund may transfer your balance to the ATO as unclaimed superannuation money. You then claim your DASP from the ATO directly rather than from your fund. The DASP withholding rates still apply — working holiday makers still face the 65% rate on ATO-held unclaimed money."
        },
        {
            "id": 3,
            "question": "How long does a DASP take, and what documents do I need?",
            "answer": "A DASP is generally paid within 28 days of the fund receiving a complete application, and a payment summary is issued within 14 days of payment. Incomplete applications are the most common cause of delay. Where your balance is $5,000 or more, certified copies of your proof-of-identity documents may be required, and paper applications may also require a Certification of Immigration Status from Home Affairs — certify these while still in Australia where possible."
        },
        {
            "id": 4,
            "question": "Who is eligible for a DASP?",
            "answer": "You must have held a temporary visa (other than subclass 405 or 410) that has now ceased, and you must have departed Australia. Permanent residents and Australian citizens are not eligible for a DASP."
        }
    ],
    "sources": [
        {
            "title": "ATO — Departing Australia Superannuation Payment (DASP)",
            "url": "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/temporary-residents-and-superannuation/departing-australia-superannuation-payment-dasp"
        },
        {
            "title": "Migration Act 1958",
            "url": "https://www.legislation.gov.au"
        }
    ],
    "canonical": "https://taxchecknow.com/au/check/superannuation-tax-leaving-australia-confusion-2026",
    "api_endpoint": "/api/rules/superannuation-tax-leaving-australia-confusion-2026",
    "generated_at": "2026-07-23T00:00:00.000Z"
};

  return NextResponse.json(rules, {
    headers: {
      "Content-Type":                "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control":               "public, max-age=86400, stale-while-revalidate=3600",
      "X-COLE-Generated":            "true",
      "X-Product-ID":                "superannuation-tax-leaving-australia-confusion-2026",
      "X-Last-Verified":             "July 2026",
    },
  });
}
