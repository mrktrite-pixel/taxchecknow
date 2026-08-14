// F5 contract — the ONE place composer inputs are assembled, so the webhook and the client
// success-page fallback build them identically.
//
// RULE: maze flags are AUTHORITATIVE. Popup (qualification) answers travel under a namespaced
// `qualification.*` key and can NEVER collide with, merge into, or override a maze flag. The
// composer (P2 grounding) treats maze/terminal/figures as fact and `qualification.*` as
// non-authoritative buyer context only.
//
// E6 extends that rule from "cannot override" to "must say so when they disagree" — see the
// conflict block in buildComposerInputs below.

import { detectConflicts } from "./buyer-context";

export function buildComposerInputs(
  maze: Record<string, unknown>,
  qualification: Record<string, unknown>,
  productId?: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(maze || {}) };
  for (const [k, v] of Object.entries(qualification || {})) {
    if (v === undefined || v === null || v === "") continue;
    out[`qualification.${k}`] = v; // namespaced — structurally cannot override a maze key
  }

  // E6 — CONTRADICTIONS ARE STATED, NOT AVERAGED.
  //
  // Namespacing already stops a popup answer overwriting a maze answer. What it could not do
  // is say anything when the two DISAGREE — both went into the prompt as flat, equal facts and
  // the model silently picked one. Observed live (decision_sessions 384f32be, 2026-08-14): the
  // maze says the seller has not applied yet and wants to know when to; the popup says
  // settlement is "Already settled". Those two need opposite advice.
  //
  // The conflict now travels as its own explicitly-labelled input under a `_conflict.` prefix,
  // so like `qualification.` it cannot collide with a maze key, and it reaches BOTH composer
  // callers — the webhook and the client fallback — without either needing to know it exists.
  // productId is optional: omitted, this is a no-op and every existing caller is unchanged.
  if (productId) {
    for (const [i, c] of detectConflicts(productId, maze || {}, qualification || {}).entries()) {
      out[`_conflict.${i + 1}`] =
        "CONTRADICTION — the buyer's checker answers and their pre-checkout answers disagree. " +
        `AUTHORITATIVE (checker): ${c.authoritative}. NOT AUTHORITATIVE (pre-checkout): ` +
        `${c.contradicting}. ${c.note}`;
    }
  }

  return out;
}

/** Client variant: reads the two sessionStorage blobs the calculator wrote for this product. */
export function buildComposerInputsFromSession(slug: string): Record<string, string> {
  let maze: Record<string, string> = {};
  let qual: Record<string, string> = {};
  try { const a = sessionStorage.getItem(`${slug}_answers`); if (a) maze = JSON.parse(a); } catch { /* ignore */ }
  try { const q = sessionStorage.getItem(`${slug}_qualification`); if (q) qual = JSON.parse(q); } catch { /* ignore */ }
  // The slug IS the product id for every product whose success pages call this.
  return buildComposerInputs(maze, qual, slug) as Record<string, string>;
}
