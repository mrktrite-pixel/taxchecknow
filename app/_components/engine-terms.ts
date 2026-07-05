/**
 * engine-terms.ts — PURE helpers for EngineVerdictPanel (stage 2).
 *
 * Stat-box figure resolution + confidence derivation. No React, no I/O — unit-testable.
 * Term matching is PORTED from the soverella PQ-B11 comparison-axes approach (label
 * discriminating-terms + role filter); the two repos don't share code, so the algorithm
 * is re-implemented here, not imported.
 */

export interface EngineFigure {
  id?: string;
  label: string;
  value: string;
  unit?: string | null;
  fact_role?: string | null;
}

export type ConfidenceLevel = "HIGH" | "MEDIUM";
export interface EngineConfidence {
  level: ConfidenceLevel;
  checklist: string[]; // the decisive answers given (chosen option labels)
}

export interface AnsweredStep {
  value: string;
  label: string;
}

// ── tokenisation ─────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "and", "or", "to", "in", "on", "at", "by",
  "is", "are", "be", "with", "as", "from", "that", "this", "your", "you", "per",
  "how", "much", "what", "when", "do", "does", "my", "am", "i", "if", "it", "its",
]);
const normDash = (s: string): string => s.replace(/[–—]/g, "-");
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function significantTerms(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normDash(text.toLowerCase()).split(/[^a-z0-9]+/)) {
    if (raw.length < 3) continue;
    if (/^\d+$/.test(raw)) continue; // never match on value-tokens
    if (STOPWORDS.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

function hasTerm(hayNorm: string, term: string): boolean {
  return new RegExp(`\\b${escapeRe(term)}\\b`).test(hayNorm);
}

// ── role filter ──────────────────────────────────────────────────────────────
const ROLE_CUES: Array<{ role: string; re: RegExp }> = [
  { role: "rate", re: /\b(rate|rates|withheld|withholding|taxed|untaxed|percent|per cent)\b|%/ },
  { role: "threshold", re: /\b(threshold|thresholds|or more|at least|minimum|exceeds?|above|balance)\b/ },
  { role: "duration", re: /\b(within|day|days|week|weeks|month|months|timeframe|window|deadline)\b/ },
];
const ROLE_PRIORITY: Record<string, number> = { rate: 0, threshold: 1, duration: 2 };

function impliedRole(hayNorm: string): string | null {
  const hit = ROLE_CUES.filter((c) => c.re.test(hayNorm)).map((c) => c.role);
  return hit.length === 1 ? hit[0] : null; // one role → filter; else leave all
}

/**
 * Figures to show as stat boxes for a terminal.
 *   1. PROVENANCE-FIRST: explicit figure ids on the dish → use them (forward-compat;
 *      no current Bee D engine carries per-dish figure ids, so this is usually empty).
 *   2. TERM MATCH: role-filter the pool by the terminal context, then keep figures whose
 *      discriminating label terms (label terms minus terms common to all candidates) are
 *      ALL present in the context. Unlike B11's single-figure merge this is NOT uniqueness-
 *      gated — a dish legitimately has several relevant figures (e.g. taxed + untaxed rate).
 *   A box renders ONLY for a resolved figure — never a placeholder. Returns up to maxN.
 */
export function resolveTerminalFigures(
  pool: EngineFigure[],
  contextText: string,
  opts?: { figureIds?: string[]; maxN?: number },
): EngineFigure[] {
  const maxN = opts?.maxN ?? 3;
  if (!pool.length) return [];

  if (opts?.figureIds?.length) {
    const byId = new Map(pool.filter((f) => f.id).map((f) => [f.id as string, f]));
    const picked = opts.figureIds.map((id) => byId.get(id)).filter((f): f is EngineFigure => !!f);
    if (picked.length) return picked.slice(0, maxN);
  }

  const hay = normDash(contextText.toLowerCase());
  const role = impliedRole(hay);
  let cands = pool;
  if (role) {
    const byRole = pool.filter((f) => (f.fact_role ?? null) === role);
    if (byRole.length) cands = byRole;
  }

  const termSets = cands.map((f) => significantTerms(f.label));
  const common = new Set<string>(termSets[0] ? [...termSets[0]] : []);
  for (const ts of termSets) for (const t of [...common]) if (!ts.has(t)) common.delete(t);
  const disc = termSets.map((ts) => new Set([...ts].filter((t) => !common.has(t))));

  const survivors = cands
    .map((f, i) => ({ f, i }))
    .filter(({ i }) => [...disc[i]].every((t) => hasTerm(hay, t)))
    .sort((a, b) => {
      const ra = ROLE_PRIORITY[a.f.fact_role ?? ""] ?? 9;
      const rb = ROLE_PRIORITY[b.f.fact_role ?? ""] ?? 9;
      return ra - rb || a.i - b.i;
    })
    .map(({ f }) => f);

  return survivors.slice(0, maxN);
}

// ── confidence (code-only, from the answered path) ───────────────────────────
const HEDGE = /\b(not sure|unsure|don'?t know|do not know|dont know|unknown|not certain|maybe)\b/i;

export function isHedge(value: string, label: string): boolean {
  return HEDGE.test(label) || /unsure|unknown|not-?sure/i.test(value);
}

/**
 * HIGH  — terminal reached via decisive answers only.
 * MEDIUM — path includes any "not sure"-class option (but still lands on a dish).
 * null  — terminal is an escape (or non-dish): confidence is omitted (1d/1e).
 * Never a numeric percentage. Checklist = the answers given (chosen option labels).
 */
export function deriveConfidence(
  trail: AnsweredStep[],
  terminalKind: "menu" | "escape" | "unknown",
): EngineConfidence | null {
  if (terminalKind !== "menu") return null;
  const hedged = trail.some((t) => isHedge(t.value, t.label));
  return { level: hedged ? "MEDIUM" : "HIGH", checklist: trail.map((t) => t.label) };
}

/** Split verbatim engine text into sentence lines (for arrow rendering); no paraphrase. */
export function toArrowLines(text: string): string[] {
  return text
    .split(/(?<=[.:])\s+(?=[A-Z“"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
