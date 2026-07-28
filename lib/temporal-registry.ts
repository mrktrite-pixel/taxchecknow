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
// Declared products: 2
// (Deliberately NOT backfilled from the retired lib/product-deadlines.ts or
// from the deadline-shape survey — ruling 3.5: a declaration is made by the
// product's own build at gate time, never inferred. Each product joins this
// list when it next ships through the `temporal_declared` gate item.)

import type { TemporalDeclaration } from "./temporal-types";

export const TEMPORAL_REGISTRY: Record<string, Record<string, TemporalDeclaration>> = {
  "taxchecknow": {
    "frcgw-clearance-certificate": {
          "kind": "unresolvable",
          "reason": "settlement_date_contingent_not_captured",
          "detail": "Settlement is fixed by the buyer's contract and differs per customer. The calculator captures only a bucketed proximity answer (daysToSettlement), never a date, so no settlement date can be computed for any customer.",
          "jurisdiction": "AU",
          "domain": "property_cgt",
          "label": "Settlement date"
    },
    "superannuation-tax-leaving-australia-confusion-2026": {
          "kind": "unresolvable",
          "reason": "departure_date_not_captured",
          "detail": "The DASP six-month unclaimed-transfer point is measured from the customer's departure and visa cessation, which this product never collects. Its engine captures only which side of that threshold the customer is on (q4-time-since-departure: past_threshold | before_threshold | unsure_time), so no date can be computed for any customer.",
          "jurisdiction": "AU",
          "domain": "superannuation",
          "label": "DASP unclaimed-transfer threshold"
    },
  },
};

/** The declaration for a product, or null when undeclared (→ silent). */
export function lookupTemporal(site: string, productId: string): TemporalDeclaration | null {
  return TEMPORAL_REGISTRY[site]?.[productId] ?? null;
}

/** Every declared (site, productId) pair — used by the gate evidence writer. */
export function declaredProducts(): Array<{ site: string; productId: string }> {
  return Object.entries(TEMPORAL_REGISTRY).flatMap(([site, products]) =>
    Object.keys(products).map(productId => ({ site, productId })),
  );
}
