// ─────────────────────────────────────────────────────────────────────────────
// FREEZE — lib/render-pack.ts
//
// THE PROBLEM THIS ENDS. A bought pack was re-derived from raw assessment_json keys on
// every page load, so the delivered document depended on the READER agreeing with the
// WRITER about key names forever. It did not: beckham rendered an empty body for weeks
// because the webhook stored GENERIC_FIELDS while the page read the product's own keys,
// and medicare is still half-rendered for the same reason (its registry entry and its
// config have drifted apart). Nothing errored either time — the page just came out thin,
// and both were found by a human reading a delivered PDF.
//
// So the pack stops being a derivation and becomes a DOCUMENT. renderPack() is the one
// canonical renderer; its output is written into assessment_json.rendered at purchase time
// and read back verbatim. A buyer's pack is then immutable: later changes to field lists,
// registries or templates cannot alter what they already paid for.
//
// PURE. No I/O, no clock beyond renderedAt, no framework. That is what lets it run in the
// webhook (server), in the heal path (browser) and in a unit test without adaptation.
// ─────────────────────────────────────────────────────────────────────────────

/** A rendered section — heading and text already resolved. Readers do not re-derive. */
export interface PackSection {
  key: string;
  heading: string;
  text: string;
}

export interface PackAction {
  title: string;
  deadline: string;
  steps: string[];
}

export interface RenderedPack {
  version: 1;
  name: string;
  sections: PackSection[];
  firstAction: string | null;
  accountantQuestions: string[];
  actions: PackAction[];
  renderedAt: string;
}

export interface RenderPackOptions {
  productId: string;
  tier: number;
  customerName?: string | null;
  /** The product's registered field list (lib/assessment-fields.ts getAssessmentFields). */
  fieldList: string[];
  /** Injectable for deterministic tests; defaults to now. */
  now?: () => Date;
}

/**
 * The generic keys a row falls back to. Deliberately the SAME THREE the C degrade used —
 * not the full GENERIC_FIELDS list — because these are the three that read as a position
 * statement on their own. Keep in step with the degrade rule if that ever changes.
 */
export const GENERIC_FALLBACK_KEYS = ["status", "keyFinding", "recommendedAction"];

/**
 * How many product sections a pack shows. SIX, because that is what the success template
 * has always rendered (its emitter sliced the field list to six), and freezing is not the
 * moment to change what a pack looks like.
 */
export const MAX_SECTIONS = 6;

/**
 * Heading for a key — "keyFinding" → "Key Finding".
 *
 * NOT lib/assessment-fields.humaniseFieldKey(), and the difference is deliberate: that one
 * lower-cases the rest of the string ("Key finding"), which is right for the hand-authored
 * FRCGW pages that already use it and wrong here, because this must reproduce what the
 * generator-emitted pages have always shown. Freezing a pack must not restyle it.
 */
export function packHeading(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;

/**
 * Render a stored assessment into the frozen pack.
 *
 * SECTION SELECTION, in order:
 *   1. the product's registered field list, in ITS order, skipping absent/blank keys,
 *      capped at MAX_SECTIONS;
 *   2. if NOT ONE product key resolved, the three generic keys — the C degrade rule, so a
 *      generic-shaped row still yields a readable pack instead of a heading over blank space.
 * Product keys always win when any are present; the generic set is a floor, never a choice.
 */
export function renderPack(
  assessmentJson: Record<string, unknown> | null | undefined,
  opts: RenderPackOptions,
): RenderedPack {
  const a = assessmentJson ?? {};
  const now = (opts.now ?? (() => new Date()))();

  const pick = (keys: string[]): PackSection[] =>
    keys
      .map((key) => ({ key, text: text(a[key]) }))
      .filter((s): s is { key: string; text: string } => s.text !== null)
      .map(({ key, text: t }) => ({ key, heading: packHeading(key), text: t }));

  const product = pick((opts.fieldList ?? []).slice(0, MAX_SECTIONS));
  const sections = product.length > 0 ? product : pick(GENERIC_FALLBACK_KEYS);

  const questions = Array.isArray(a.accountantQuestions)
    ? (a.accountantQuestions as unknown[]).filter((q): q is string => typeof q === "string" && q.trim() !== "")
    : [];

  const actions: PackAction[] = Array.isArray(a.actions)
    ? (a.actions as unknown[])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({
          title: text(x.title) ?? "",
          deadline: text(x.deadline) ?? "",
          steps: Array.isArray(x.steps)
            ? (x.steps as unknown[]).filter((s): s is string => typeof s === "string")
            : [],
        }))
        .filter((x) => x.title !== "")
    : [];

  return {
    version: 1,
    name: (opts.customerName ?? "").trim(),
    sections,
    firstAction: text(a.firstAction),
    accountantQuestions: questions,
    actions,
    renderedAt: now.toISOString(),
  };
}

/** True when a stored row already carries a frozen pack this reader understands. */
export function hasFrozenPack(assessmentJson: unknown): boolean {
  const r = (assessmentJson as Record<string, unknown> | null | undefined)?.rendered as
    | Record<string, unknown>
    | undefined;
  return !!r && r.version === 1 && Array.isArray(r.sections);
}
