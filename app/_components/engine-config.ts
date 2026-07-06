/**
 * engine-config.ts — per-product configuration for EngineCalculator.
 *
 * PURE. The per-product override surface (one config per product). Sensible GENERIC
 * defaults so a bare engine still renders a working panel/popup/tiering.
 *
 * RULE: structure lives in the renderer; DOMAIN WORDS live in config. Every default
 * here is domain-neutral; the product config supplies the flavoured copy.
 *
 * DOCTRINE: tier is OPERATOR-SET DATA, never logic — `tierMap` maps a terminal id →
 * tier. Resolved tier + price are PINNED into the decision_session at result time.
 * Escapes/quasi-escapes monetise a $67 plan (a "closer look"), never a $147
 * confirmation ("no selling CONFIRMATION of unresolved outcomes").
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
  ctaLabel?: string;          // resolved-dish CTA; "{price}" substituted
  popupHeading?: string;
  popupSubhead?: string;
  qualIntro?: string;
  payLabel?: string;          // "{price}" substituted
  dismissLabel?: string;
  // ── result-panel parity copy ──
  resultLabel?: string;       // resolved-dish banner label (NOT "No match")
  bridgeCopy?: string;        // conversion bridge line (resolved)
  planChecklist?: string[];   // "what's in your plan" items (resolved)
  secondaryTierLabel?: string;// alt-tier link (resolved); "{price}" substituted
  saveHeading?: string;       // email Save box heading (both)
  saveSubcopy?: string;       // email Save box sub-line (both)
  // ── escape / quasi-escape copy (never "confirmed position") ──
  escapeLabel?: string;       // escape banner label
  escapeBody?: string;        // escape framed body (a "closer look")
  escapeCtaLabel?: string;    // escape $67 CTA; "{price}" substituted
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
  qualification?: QualField[];          // the 3 dropdowns (generic default provided)
  copy?: EngineCopy;
}

// Generic 3-question qualifier — NO domain words. Products override via config.qualification.
export const DEFAULT_QUALIFICATION: QualField[] = [
  {
    key: "situation",
    label: "What best describes you?",
    options: [
      { value: "individual", label: "Acting for myself" },
      { value: "business", label: "Acting for a business" },
      { value: "onbehalf", label: "Helping someone else" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    key: "urgency",
    label: "How soon do you need this?",
    options: [
      { value: "soon", label: "Before an upcoming deadline" },
      { value: "planning", label: "Planning ahead" },
      { value: "general", label: "Just understanding my position" },
    ],
  },
  {
    key: "adviser",
    label: "Do you work with a professional adviser?",
    options: [
      { value: "yes_active", label: "Yes — speaking with them soon" },
      { value: "yes_inactive", label: "Yes — but not recently" },
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
  return { tier, price: priceForTier(config, tier) };
}

export function priceForTier(config: EngineConfig | undefined, tier: number): number {
  return config?.prices?.[String(tier)] ?? DEFAULT_PRICES[String(tier)] ?? tier;
}

/** The OTHER tier (67↔147) + its price — the resolved-dish secondary link target. */
export function altTier(config: EngineConfig | undefined, tier: number): PinnedTier {
  const other = tier === 147 ? 67 : 147;
  return { tier: other, price: priceForTier(config, other) };
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

// ── copy accessors (config value → generic default) ──────────────────────────
export function ctaLabelFor(config: EngineConfig | undefined, price: number): string {
  return withPrice(config?.copy?.ctaLabel ?? "Get my personalised plan — {price} →", price);
}
export function payLabelFor(config: EngineConfig | undefined, price: number): string {
  return withPrice(config?.copy?.payLabel ?? "Pay {price} →", price);
}
export function secondaryTierLabelFor(config: EngineConfig | undefined, price: number): string {
  return withPrice(config?.copy?.secondaryTierLabel ?? "Want the complete system instead? — {price}", price);
}
export function escapeCtaLabelFor(config: EngineConfig | undefined, price: number): string {
  return withPrice(config?.copy?.escapeCtaLabel ?? "Get my personalised review — {price} →", price);
}
export function resultLabelFor(config: EngineConfig | undefined): string {
  return config?.copy?.resultLabel ?? "Your result";
}
export function escapeLabelFor(config: EngineConfig | undefined): string {
  return config?.copy?.escapeLabel ?? "A closer look";
}
export function escapeBodyFor(config: EngineConfig | undefined): string {
  return (
    config?.copy?.escapeBody ??
    "Your answers don't point to a single clear position — which usually means there's something specific worth checking. A short personalised review shows what applies to your circumstances and what to do next."
  );
}
export function bridgeCopyFor(config: EngineConfig | undefined): string {
  return (
    config?.copy?.bridgeCopy ??
    "Most people in your situation either take the wrong action or miss one entirely. This shows which applies to you — and what to do about it."
  );
}
export function planChecklistFor(config: EngineConfig | undefined): string[] {
  return (
    config?.copy?.planChecklist ?? [
      "Your exact position, worked through against your answers",
      "The specific steps that apply to your situation",
      "What to check, and by when",
      "Questions to take to a professional adviser",
    ]
  );
}
export function saveHeadingFor(config: EngineConfig | undefined): string {
  return config?.copy?.saveHeading ?? "Save your result to show your adviser.";
}
export function saveSubcopyFor(config: EngineConfig | undefined): string {
  return config?.copy?.saveSubcopy ?? "Get a copy by email — free.";
}
