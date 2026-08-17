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


export function buildComposerInputs(
  maze: Record<string, unknown>,
  qualification: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(maze || {}) };
  for (const [k, v] of Object.entries(qualification || {})) {
    if (v === undefined || v === null || v === "") continue;
    out[`qualification.${k}`] = v; // namespaced — structurally cannot override a maze key
  }

  // E6 detection used to live here. It now runs inside generateAssessment(), resolved from
  // product_id — see lib/assess-core.ts. THE REASON IS THE WEBHOOK: it builds its own
  // AssessInput and calls this with two arguments, so a productId parameter here was
  // undefined on the one path that matters and conflicts were never detected for a stored
  // assessment. Measured on the live table: not one stored row has ever carried a conflict
  // note. Resolving inside the generator reaches BOTH callers without editing the webhook.
  return out;
}

/** Client variant: reads the two sessionStorage blobs the calculator wrote for this product. */
export function buildComposerInputsFromSession(slug: string): Record<string, string> {
  let maze: Record<string, string> = {};
  let qual: Record<string, string> = {};
  try { const a = sessionStorage.getItem(`${slug}_answers`); if (a) maze = JSON.parse(a); } catch { /* ignore */ }
  try { const q = sessionStorage.getItem(`${slug}_qualification`); if (q) qual = JSON.parse(q); } catch { /* ignore */ }
  return buildComposerInputs(maze, qual) as Record<string, string>;
}
