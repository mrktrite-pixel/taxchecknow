// F5 contract — the ONE place composer inputs are assembled, so the webhook and the client
// success-page fallback build them identically.
//
// RULE: maze flags are AUTHORITATIVE. Popup (qualification) answers travel under a namespaced
// `qualification.*` key and can NEVER collide with, merge into, or override a maze flag. The
// composer (P2 grounding) treats maze/terminal/figures as fact and `qualification.*` as
// non-authoritative buyer context only.

export function buildComposerInputs(
  maze: Record<string, unknown>,
  qualification: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(maze || {}) };
  for (const [k, v] of Object.entries(qualification || {})) {
    if (v === undefined || v === null || v === "") continue;
    out[`qualification.${k}`] = v; // namespaced — structurally cannot override a maze key
  }
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
