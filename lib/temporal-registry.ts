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
// Declared products: 8
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
    "day-183-rule": {
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
    "frcgw-clearance-certificate": {
          "temporal": {
                "kind": "unresolvable",
                "reason": "settlement_date_contingent_not_captured",
                "detail": "Settlement is fixed by the buyer's contract and differs per customer. The calculator captures only a bucketed proximity answer (daysToSettlement), never a date, so no settlement date can be computed for any customer.",
                "jurisdiction": "AU",
                "domain": "property_cgt",
                "label": "Settlement date"
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
