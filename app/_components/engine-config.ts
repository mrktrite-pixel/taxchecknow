/**
 * engine-config.ts — per-product configuration for EngineCalculator (stage 3).
 *
 * PURE. The per-product override surface (C1c supplies one config per product).
 * Sensible defaults so a bare engine still renders a working popup + tiering.
 *
 * DOCTRINE (C0): tier is OPERATOR-SET DATA, never logic — `tierMap` maps a terminal
 * id → tier. Resolved tier + price are PINNED into the decision_session at result
 * time so an email return-path re-enters the identical page/tier/price.
 */

export interface QualOption {
  value: string;
  label: string;
}
export interface QualField {
  key: string;
  label: string;
  options: QualOption[];
}
export interface EngineCopy {
  ctaLabel?: string;      // verdict CTA; "{price}" is substituted
  popupHeading?: string;
  popupSubhead?: string;
  qualIntro?: string;
  payLabel?: string;      // "{price}" is substituted
  dismissLabel?: string;
}
export interface EngineConfig {
  productSlug: string;                  // required — session + sessionStorage keys
  sourcePath?: string;                  // e.g. /au/check/<slug>
  country?: string;                     // default "AU"
  currency?: string;                    // default "AUD"
  site?: string;                        // default "taxchecknow"
  tierMap?: Record<string, number>;     // terminal id → tier (operator-set data)
  defaultTier?: number;                 // when a terminal isn't in the map (default 67)
  prices?: Record<string, number>;      // tier → price (default {67:67,147:147})
  qualification?: QualField[];          // the 3 dropdowns (default provided)
  copy?: EngineCopy;
}

// Generic 3-question qualifier — no product strings.
export const DEFAULT_QUALIFICATION: QualField[] = [
  {
    key: "situation",
    label: "What is your main situation?",
    options: [
      { value: "salary", label: "Salary / employment income" },
      { value: "business", label: "Business or self-employed" },
      { value: "investment", label: "Investment or property income" },
      { value: "mixed", label: "Mixed income sources" },
    ],
  },
  {
    key: "urgency",
    label: "How urgently do you need this?",
    options: [
      { value: "before_return", label: "Before lodging my tax return" },
      { value: "next_year", label: "Planning for next financial year" },
      { value: "general", label: "Just understanding my position" },
    ],
  },
  {
    key: "accountant",
    label: "Do you have an accountant?",
    options: [
      { value: "yes_active", label: "Yes — meeting them soon" },
      { value: "yes_inactive", label: "Yes — but haven't spoken recently" },
      { value: "no", label: "No — managing myself" },
    ],
  },
];

export const DEFAULT_TIER = 67;
const DEFAULT_PRICES: Record<string, number> = { "67": 67, "147": 147 };

export interface PinnedTier {
  tier: number;
  price: number;
}

/** Operator-set tier for a terminal id (DATA map, never logic), + its price. */
export function resolveTier(config: EngineConfig | undefined, terminalId: string): PinnedTier {
  const tier = config?.tierMap?.[terminalId] ?? config?.defaultTier ?? DEFAULT_TIER;
  const price = config?.prices?.[String(tier)] ?? DEFAULT_PRICES[String(tier)] ?? tier;
  return { tier, price };
}

export function fmtPrice(n: number): string {
  return `$${n}`;
}

export function qualFields(config: EngineConfig | undefined): QualField[] {
  return config?.qualification ?? DEFAULT_QUALIFICATION;
}

/** Substitute the {price} token in a copy template. */
export function withPrice(template: string, price: number): string {
  return template.replace(/\{price\}/g, fmtPrice(price));
}

export function ctaLabelFor(config: EngineConfig | undefined, price: number): string {
  return withPrice(config?.copy?.ctaLabel ?? "Get my personalised plan — {price} →", price);
}
export function payLabelFor(config: EngineConfig | undefined, price: number): string {
  return withPrice(config?.copy?.payLabel ?? "Pay {price} →", price);
}
