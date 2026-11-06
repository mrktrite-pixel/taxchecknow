// ── TEMPORAL REGISTRY — GENERATED FILE, DO NOT EDIT ──────────────────────
//
// Emitted by cole/generators/generate-temporal-registry.ts from the `temporal`
// field of each product config. Hand edits are overwritten on the next
// generator run — change the PRODUCT'S CONFIG, not this file.
//
// A product absent from this registry is UNDECLARED, and an undeclared product
// is SILENT (Step 6.3). Absence is never a fallback to another date; there is
// no code path from "not listed here" to "use some other date".
//
// Declared products: 18
// (Deliberately NOT backfilled from the retired lib/product-deadlines.ts or
// from the deadline-shape survey — ruling 3.5: a declaration is made by the
// product's own build at gate time, never inferred. Each product joins this
// list when it next ships through the `temporal_declared` gate item.)

import type { TemporalDeclaration } from "./temporal-types";
import type { NurtureLane, NurtureAnchor } from "./nurture-types";
import { tracksForAnchor } from "./nurture-types";

/** Both lanes for a product. Either may be absent; absent = silent on that lane. */
export interface ProductDeclarations {
  temporal?: TemporalDeclaration;
  /** A LIST of tracks — at most one per anchor (enforced at emit). */
  nurture?:  NurtureLane;
}

export const TEMPORAL_REGISTRY: Record<string, Record<string, ProductDeclarations>> = {
  "taxchecknow": {
    "allowance-sniper": {
          "temporal": {
                "kind": "deadline",
                "rule": {
                      "source": "fixed",
                      "recurrence": "annual",
                      "month": 4,
                      "day": 5,
                      "timezone": "Europe/London",
                      "shift": "none"
                },
                "jurisdiction": "GB",
                "domain": "uk_tax_year_end",
                "label": "5 April",
                "basis": "Operator ruling 2026-10-28: UK tax year end; pension/salary-sacrifice to restore the PA must land in-year"
          }
    },
    "australia-smsf-residency": {
          "temporal": {
                "kind": "deadline",
                "rule": {
                      "source": "fixed",
                      "recurrence": "annual",
                      "month": 2,
                      "day": 28,
                      "timezone": "Australia/Sydney",
                      "shift": "next_business_day"
                },
                "jurisdiction": "AU",
                "domain": "super",
                "label": "SMSF annual return due (self-lodged)",
                "basis": "ATO, Lodge SMSF annual returns, fetched 2026-09-28: \"You should lodge and pay all other SARs by 28 February unless we ask you to lodge on a different date.\" 31 October applies only to newly registered funds and funds with overdue prior-year returns; where a tax agent lodges, the agent provides the date."
          }
    },
    "cgt-discount-timing-sniper": {
          "temporal": {
                "kind": "none",
                "reason": "standing_rule_holding_period_is_asset_relative_no_act_by_date",
                "jurisdiction": "AU",
                "domain": "cgt_discount_holding_period",
                "label": "No act-by date",
                "basis": "ITAA 1997 Div 115: 12-month ownership measured per asset from acquisition; no calendar deadline. Operator ruling 2026-10-20"
          }
    },
    "cgt-main-residence-trap": {
          "temporal": {
                "kind": "none",
                "reason": "standing_rule_periods_are_dwelling_relative_no_act_by_date",
                "jurisdiction": "AU",
                "domain": "main_residence_exemption_periods",
                "label": "No act-by date",
                "basis": "ITAA 1997 Subdiv 118-B: the main residence exemption's periods run from the owner's own dates per dwelling (s118-145's 6-year absence limit, the 6-month moving-house overlap); no calendar deadline. Research proposed unresolvable - 27 quoted sentences examined, every date in an example. Declared none under the operator's standing step-7 ruling, 2026-10-20"
          }
    },
    "day-183-rule": {
          "temporal": {
                "kind": "unresolvable",
                "reason": "act_by_date_is_per_taxpayer_and_uncaptured",
                "jurisdiction": "US",
                "domain": "us_tax_residency",
                "label": "Form 8843 due with the income tax return"
          },
          "nurture": [
                {
                      "track": "standard_v1",
                      "milestones": [
                            3,
                            7,
                            14
                      ],
                      "anchor": "lead"
                }
          ]
    },
    "div296-wealth-eraser": {
          "temporal": {
                "kind": "effective_from",
                "rule": {
                      "source": "fixed",
                      "recurrence": "one_off",
                      "month": 7,
                      "day": 1,
                      "year": 2026,
                      "timezone": "Australia/Sydney",
                      "shift": "none"
                },
                "jurisdiction": "AU",
                "domain": "super_division_296",
                "label": "Division 296 commences",
                "basis": "Operator ruling 2026-10-21: Division 296 commences 1 July 2026 and the thresholds are indexed. effective_from, not deadline, because commencement is a STATE CHANGE in the law and not an act-by date — the kind's own definition. one_off with year 2026 so the resolver returns EXPIRED after it rather than silently rolling to 1 July 2027, which is what an annual recurrence would do to a transitional cut-over. The indexed thresholds are the reason there is no fixed recurring act-by date to declare instead."
          }
    },
    "division-293-tax-calculation": {
          "temporal": {
                "kind": "none",
                "reason": "standing_rule_assessed_per_income_year_no_act_by_date",
                "jurisdiction": "AU",
                "domain": "superannuation",
                "label": "Income year end",
                "basis": "ITAA 1997 Division 293 (additional tax on concessional contributions): assessed per income year on income plus certain super contributions, and there is no separate act-by date — config au-17 deadline.description, with display \"End of the income year\" and urgencyLabel \"PER INCOME YEAR\". isoDate and countdownLabel are deliberately empty in that config (the au-10 pattern for a standing rule). Operator ruling 2026-10-21."
          }
    },
    "fbt-hidden-exposure": {
          "temporal": {
                "kind": "none",
                "reason": "fbt_return_recurs_annually_on_21_may_no_single_act_by_date",
                "jurisdiction": "AU",
                "domain": "fringe_benefits_tax",
                "label": "No act-by date",
                "basis": "The FBT return and payment are due by 21 May each year for the FBT year ended the preceding 31 March, so the obligation RECURS and there is no single act-by date. Declared under the operator's step-7 ruling, 2026-11-06, because this config carries no temporal block of its own. Re-read https://www.ato.gov.au/tax-rates-and-codes/fringe-benefits-tax-rates-and-thresholds on 2026-11-06 (the page shows last updated 20 May 2026), which states \"A fringe benefits tax (FBT) rate of 47% applies across the 31 March 2023 to 31 March 2027 FBT years. The FBT year runs from 1 April to 31 March\", gives the Type 1 gross-up rate 2.0802 and the Type 2 rate 1.8868, and states \"If your FBT liability for the last year was $3,000 or more, you will need to pay 4 quarterly instalments\". THE 21 MAY DATE IS NOT ON THAT PAGE AT ALL (0 occurrences), so it is not grounded in the pinned source. The config's own `deadline` carried 21 May 2026, which has PASSED; its isoDate and countdownLabel are emptied (the au-10 pattern) so no expired countdown ships, and the recurrence is kept in the prose. The next occurrence is 21 May 2027, but which year applies is a declaration for the operator at sign-off, not an inference this build may make."
          }
    },
    "frcgw-clearance-certificate": {
          "temporal": {
                "kind": "deadline",
                "rule": {
                      "source": "user_supplied",
                      "field": "q6_settlement_date",
                      "offset": {
                            "days": -28
                      },
                      "timezone": "Australia/Sydney",
                      "shift": "prev_business_day"
                },
                "jurisdiction": "AU",
                "domain": "property_cgt",
                "label": "Lodge-by date (28 days before your settlement)"
          },
          "nurture": [
                {
                      "track": "standard_v1",
                      "milestones": [
                            3,
                            7,
                            14
                      ],
                      "anchor": "lead"
                }
          ]
    },
    "medicare-levy-surcharge-trap": {
          "temporal": {
                "kind": "none",
                "reason": "no_act_by_date_in_authority",
                "jurisdiction": "AU",
                "domain": "medicare_levy_surcharge",
                "label": "No act-by date"
          },
          "nurture": [
                {
                      "track": "standard_v1",
                      "milestones": [
                            3,
                            7,
                            14
                      ],
                      "anchor": "lead"
                }
          ]
    },
    "mtd-scorecard": {
          "temporal": {
                "kind": "unresolvable",
                "reason": "authority_page_stating_the_deadline_not_captured",
                "jurisdiction": "UK",
                "domain": "mtd_income_tax",
                "label": "your first quarterly update deadline"
          },
          "nurture": [
                {
                      "track": "standard_v1",
                      "milestones": [
                            3,
                            7,
                            14
                      ],
                      "anchor": "lead"
                }
          ]
    },
    "rental-property-deduction-audit": {
          "temporal": {
                "kind": "deadline",
                "rule": {
                      "source": "fixed",
                      "recurrence": "annual",
                      "month": 10,
                      "day": 31,
                      "timezone": "Australia/Sydney",
                      "shift": "next_business_day"
                },
                "jurisdiction": "AU",
                "domain": "property_rental",
                "label": "Individual tax return due"
          },
          "nurture": [
                {
                      "track": "standard_v1",
                      "milestones": [
                            3,
                            7,
                            14
                      ],
                      "anchor": "lead"
                }
          ]
    },
    "side-hustle-checker": {
          "nurture": [
                {
                      "track": "standard_v1",
                      "milestones": [
                            3,
                            7,
                            14
                      ],
                      "anchor": "lead"
                }
          ]
    },
    "spain-beckham": {
          "temporal": {
                "kind": "unresolvable",
                "reason": "ss_registration_date_is_per_customer_and_uncaptured",
                "jurisdiction": "ES",
                "domain": "es_expat_income_tax",
                "label": "the Modelo 149 six-month deadline"
          },
          "nurture": [
                {
                      "track": "standard_v1",
                      "milestones": [
                            3,
                            7,
                            14
                      ],
                      "anchor": "lead"
                }
          ]
    },
    "superannuation-tax-leaving-australia-confusion-2026": {
          "temporal": {
                "kind": "unresolvable",
                "reason": "departure_date_not_captured",
                "detail": "The DASP six-month unclaimed-transfer point is measured from the customer's departure and visa cessation, which this product never collects. Its engine captures only which side of that threshold the customer is on (q4-time-since-departure: past_threshold | before_threshold | unsure_time), so no date can be computed for any customer.",
                "jurisdiction": "AU",
                "domain": "superannuation",
                "label": "DASP unclaimed-transfer threshold"
          },
          "nurture": [
                {
                      "track": "standard_v1",
                      "milestones": [
                            3,
                            7,
                            14
                      ],
                      "anchor": "lead"
                }
          ]
    },
    "tax-treaty-navigator": {
          "temporal": {
                "kind": "none",
                "reason": "standing_treaty_rule_no_act_by_date",
                "jurisdiction": "OECD",
                "domain": "tax_treaty_residence",
                "label": "No act-by date",
                "basis": "OECD Model Tax Convention Article 4(2) is a standing tie-breaker rule: it states no deadline, window or effective-from date. Operator ruling 2026-10-14."
          }
    },
    "uk-nrls": {
          "temporal": {
                "kind": "none",
                "reason": "nrl_scheme_has_no_fixed_act_by_date_quarterly_returns_recur",
                "jurisdiction": "GB",
                "domain": "non_resident_landlord_scheme",
                "label": "No act-by date",
                "basis": "NRL Scheme has no fixed act-by date; quarterly returns recur. Declared under the operator's step-7 ruling, 2026-11-05, because this config carries no temporal block of its own. Re-read https://www.gov.uk/guidance/paying-tax-on-rent-to-landlords-abroad on 2026-11-05 (3 consecutive 200s), which states: \"You must send payment within 30 days of the end of each tax quarter — 30 June, 30 September, 31 December and 31 March.\" Four recurring quarter ends are a recurring obligation, not a one-off act-by date, which is what kind \"none\" records. The 31 January 2027 Self Assessment date in `deadline` is retained: it is a true filing deadline for a non-resident landlord and is NOT an NRLS act-by date — the same shape as au-01-cgt-main-residence-trap, which declares none and keeps its EOFY countdown."
          }
    },
    "us-expat-tax": {
          "temporal": {
                "kind": "deadline",
                "rule": {
                      "source": "fixed",
                      "recurrence": "annual",
                      "month": 6,
                      "day": 15,
                      "timezone": "America/New_York",
                      "shift": "next_business_day"
                },
                "jurisdiction": "US",
                "domain": "income_tax",
                "label": "the automatic 2-month expat extension"
          },
          "nurture": [
                {
                      "track": "standard_v1",
                      "milestones": [
                            3,
                            7,
                            14
                      ],
                      "anchor": "lead"
                }
          ]
    },
  },
};

/** The temporal declaration for a product, or null when undeclared (→ silent). */
export function lookupTemporal(site: string, productId: string): TemporalDeclaration | null {
  return TEMPORAL_REGISTRY[site]?.[productId]?.temporal ?? null;
}

/** Every nurture track for a product ([] when it declares none → no nurture). */
export function lookupNurture(site: string, productId: string): NurtureLane {
  return TEMPORAL_REGISTRY[site]?.[productId]?.nurture ?? [];
}

/**
 * The tracks a given path owns. THIS is what makes double-firing impossible:
 * /api/leads asks for "lead" and the webhook asks for "purchase", so neither can
 * queue the other's track no matter what a product declares.
 */
export function nurtureTracksFor(site: string, productId: string, anchor: NurtureAnchor): NurtureLane {
  return tracksForAnchor(lookupNurture(site, productId), anchor);
}

/** Every declared (site, productId) pair — used by the gate evidence writer. */
export function declaredProducts(): Array<{ site: string; productId: string }> {
  return Object.entries(TEMPORAL_REGISTRY).flatMap(([site, products]) =>
    Object.keys(products).map(productId => ({ site, productId })),
  );
}
