// ─────────────────────────────────────────────────────────────────────────────
// CONFIG vs AUTHORITY DIFF  (Step 4)
//
// Compares the figures a build's research VERIFIED against the authority with the
// figures the product's config actually ships. One comparison, two callers:
//   MODE A  one product          — for the build card
//   MODE B  every product        — the sweep
//
// FOUR STATES PER FIGURE, never two. "No authority" and "authority expired" are
// different facts and NEITHER may read as agreement:
//   AGREES             the authority value appears in the config
//   DISAGREES          it does not — with the config's apparent counterpart
//   NO_AUTHORITY       no usable authority input exists for this product
//   AUTHORITY_EXPIRED  an authority snapshot exists but is past its validity
//                      window, so it cannot support a comparison
//   AUTHORITY_UNPARSEABLE
//                      we HOLD a current page but cannot read figures out of it.
//                      ATO Table 26 is a clean two-column register; most authority
//                      pages are not. A page we hold and cannot read is a DIFFERENT
//                      fact from a page we do not hold — it means the fetch works
//                      and the parser is the gap — and neither may read as
//                      agreement.
//
// ── WHERE THE INPUT ACTUALLY LIVES (corrected against the DB) ────────────────
// The dispatch specified research_output.verified_facts.figures. THAT PATH DOES
// NOT EXIST. Verified against build 28e59e77: research_output's keys are page,
// legal, voice, quality, ai_review, authority, calculator, competitor,
// reset_marker, review_feedback, assertion_*, graph_directives — no
// verified_facts anywhere, on any of the 12 build_jobs rows.
// The figures are really at:
//     research_output.page.sections[N].content.figures[]   (7 entries)
//     research_output.page.sections[N].content.facts[]     (6 + 4 entries)
// each shaped { label, value, unit, fact_role, source_quote } — with NO id and
// NO source_url and NO last_updated field. Consequences, stated rather than
// papered over:
//   · "figure id" in the output is the LABEL, because no id exists.
//   · the source page's last-updated date is not a field; it is prose inside
//     research_output.authority.corpus_text ("Last updated 5 May 2026"), so it is
//     extracted by pattern and reported as null when absent.
//   · the same figures array is duplicated across sections (3× identical for
//     28e59e77, 31 raw entries → 7 distinct), so entries are deduped by
//     label|value|unit or every count would be inflated ~4x.
// ─────────────────────────────────────────────────────────────────────────────

export type FigureState =
  | "AGREES"
  | "DISAGREES"
  | "NO_AUTHORITY"
  | "AUTHORITY_EXPIRED"
  | "AUTHORITY_UNPARSEABLE";

export interface AuthorityFigure {
  /** The label — used as the identifier, because the payload carries no id. */
  id: string;
  value: string;
  unit: string;
  factRole: string;
  sourceQuote: string;
  /** How many raw entries collapsed into this one (dedup evidence). */
  occurrences: number;
}

export interface FigureVerdict {
  id: string;
  state: FigureState;
  authorityValue: string;
  unit: string;
  factRole: string;
  /** What the config appears to say instead. Empty when nothing plausible was found. */
  configCandidates: { value: number; context: string }[];
  sourceQuote: string;
  sourceUrl: string | null;
  sourceLastUpdated: string | null;
  /**
   * AGREES only: did the matched number appear in text that shares a significant
   * word with the figure's label?
   *
   * This exists because of au-15. The ATO says the 2026-27 transfer balance cap is
   * $2,100,000. That number IS present in au-15's config — as a WORKED-EXAMPLE
   * PENSION BALANCE ("Current pension balance: $2,100,000"), while the config's
   * stated cap is still $1,900,000. A bare presence test reports AGREES and the
   * product stays wrong. Uncorroborated agreement is therefore reported as such,
   * so a coincidence cannot pass for a check.
   */
  corroborated?: boolean;
  corroboratingContext?: string;
  note?: string;
}

export interface ProductDiff {
  productId: string;
  configFile: string | null;
  /** The single state when there is nothing to compare against. */
  overall: "COMPARED" | "NO_AUTHORITY" | "AUTHORITY_EXPIRED" | "AUTHORITY_UNPARSEABLE" | "NO_CONFIG";
  reason: string;
  authoritySource: "build_figures" | "snapshot" | "none";
  buildId: string | null;
  /** Set when the authority input was a snapshot: could the parser read it? */
  snapshotParse?: { tablesFound: number; tablesParsed: number; rowsSkipped: number; reason: string };
  figures: FigureVerdict[];
  counts: Record<FigureState, number>;
}

// ── NORMALISATION ────────────────────────────────────────────────────────────
// WHAT IS NORMALISED:
//   · currency SYMBOLS are ignored entirely — we compare NUMBERS, never symbols.
//     Session B's sweep returned a false zero for every UK product by matching
//     on "$"; UK configs use £ exclusively (151 occurrences of £, zero $ in
//     uk-01). Comparing numerically removes that whole class of bug rather than
//     enumerating symbols and hoping the list is complete.
//   · thousands separators: "101,000" / "101000" / "101 000"
//   · the k/m/bn suffixes: "$101k" → 101000, "1.5m" → 1500000
//   · percentages: "15%" / "15 per cent" / "15 percent", and 0.15 is accepted as
//     an alternative encoding of 15% for unit "%"
//   · surrounding punctuation and case
//
// WHAT IS DELIBERATELY *NOT* NORMALISED — the blind spots, on the record:
//   · CURRENCY IDENTITY. Because only numbers are compared, a config saying
//     "£101,000" would AGREE with an authority "101000 AUD". Safe in practice
//     (one product is one jurisdiction) but it is a real hole, not a rounding.
//   · SEMANTIC ROLE. A number is matched anywhere in the config, so a
//     coincidental occurrence of 101000 in unrelated copy reads as AGREES. This
//     is the biggest limitation: the check proves a number is PRESENT, not that
//     it is present in the right place. Mitigated only by reporting the config
//     context for a human to judge.
//   · number words ("one hundred thousand"), ranges ("1–1.5%"), ordinals
//   · dates in any form — a date figure will be compared as a bare number and
//     will usually read DISAGREES. Out of scope by choice; the temporal
//     declaration owns dates.
//   · rounding. 101000 and 101001 are different. No tolerance is applied.
//   · SPACE as a thousands separator ("101 000"). Dropped as a precaution: a
//     whitespace-tolerant token can weld two adjacent numbers into a third that
//     exists in neither text, and a phantom number can only do harm — it cannot
//     fix a real disagreement, but it CAN coincidentally equal an authority
//     figure and manufacture a false AGREES. No config observed uses spaces as
//     separators, so nothing is lost.
//     (Correction, recorded because I asserted it wrongly first: I initially took
//     93,001 and 108,001 in the medicare config to be such phantoms. They are
//     REAL — 11 and 4 literal occurrences — being the surcharge BAND boundaries,
//     "$93,001 to $108,000 — 1%". The parser was right; my diagnosis was not.)
//
// ── A STRUCTURAL MISMATCH THIS SURFACED, worth knowing before reading output ──
// The authority states a single BASE threshold (101000). The configs often state
// BANDS ("$93,001–$108,000: 1%"). So a config can be internally coherent and
// still disagree with every authority figure, and the disagreement is about the
// whole year's numbers rather than one typo. That is a real finding about the
// medicare product, not a defect in the comparison.
const NUM_TOKEN = /(\d[\d,]*\.?\d*)\s*(k\b|m\b|bn\b|%|per\s?cent)?/gi;

export function parseNumericTokens(text: string): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const m of text.matchAll(NUM_TOKEN)) {
    const raw = m[1];
    const suffix = (m[2] ?? "").toLowerCase().replace(/\s/g, "");
    const digits = raw.replace(/[,\s]/g, "");
    if (!digits || !/^\d/.test(digits)) continue;
    let n = Number(digits);
    if (!Number.isFinite(n)) continue;
    if (suffix === "k") n *= 1_000;
    else if (suffix === "m") n *= 1_000_000;
    else if (suffix === "bn") n *= 1_000_000_000;
    const at = m.index ?? 0;
    const context = text.slice(Math.max(0, at - 60), at + 60).replace(/\s+/g, " ").trim();
    if (!out.has(n)) out.set(n, []);
    const arr = out.get(n)!;
    if (arr.length < 3) arr.push(context);
  }
  return out;
}

/** Candidate numeric readings of one authority figure. */
export function authorityValueCandidates(value: string, unit: string): number[] {
  const digits = String(value).replace(/[,\s$£€]/g, "");
  const n = Number(digits);
  if (!Number.isFinite(n)) return [];
  const out = [n];
  // 15% may be written 0.15. Accept both, for percentage units only.
  if (unit === "%" || /percent/i.test(unit)) {
    out.push(n / 100);
    if (n < 1) out.push(n * 100);
  }
  return out;
}

// ── AUTHORITY FIGURE EXTRACTION ──────────────────────────────────────────────
/**
 * Pull every figure/fact out of a build's research_output and dedupe.
 * Deduped by label|value|unit: the arrays are repeated verbatim across sections
 * (verified 3× identical on 28e59e77), so without this every count is ~4x too high.
 */
export function extractAuthorityFigures(researchOutput: any): AuthorityFigure[] {
  const sections = researchOutput?.page?.sections;
  if (!Array.isArray(sections)) return [];
  const byKey = new Map<string, AuthorityFigure>();
  for (const sec of sections) {
    for (const key of ["figures", "facts"]) {
      const arr = sec?.content?.[key];
      if (!Array.isArray(arr)) continue;
      for (const f of arr) {
        if (f == null || typeof f !== "object") continue;
        const label = String(f.label ?? f.id ?? f.key ?? "").trim();
        if (!label) continue;
        const k = `${label}|${f.value}|${f.unit ?? ""}`;
        const existing = byKey.get(k);
        if (existing) { existing.occurrences++; continue; }
        byKey.set(k, {
          id: label,
          value: String(f.value ?? ""),
          unit: String(f.unit ?? ""),
          factRole: String(f.fact_role ?? ""),
          sourceQuote: String(f.source_quote ?? ""),
          occurrences: 1,
        });
      }
    }
  }
  return [...byKey.values()];
}

/** The source page's last-updated date, which is prose in corpus_text, not a field. */
export function extractSourceLastUpdated(researchOutput: any): string | null {
  const txt = String(researchOutput?.authority?.corpus_text ?? "");
  const m = txt.match(/Last\s+updated\s+([0-9]{1,2}\s+\w+\s+[0-9]{4})/i)
        ?? txt.match(/Last\s+modified\s+([0-9]{1,2}\s+\w+\s+[0-9]{4})/i);
  return m ? m[1] : null;
}

// ── THE COMPARISON ───────────────────────────────────────────────────────────
export interface CompareInput {
  productId: string;
  configFile: string | null;
  /** Serialised config content — the whole file text, so nothing is missed. */
  configText: string | null;
  figures: AuthorityFigure[];
  authoritySource: "build_figures" | "snapshot" | "none";
  buildId?: string | null;
  sourceUrl?: string | null;
  sourceLastUpdated?: string | null;
  /** Set when a snapshot exists but is out of window. */
  expired?: boolean;
  expiredDetail?: string;
  /** Set when a CURRENT snapshot exists but no figures could be read from it. */
  unparseable?: boolean;
  unparseableDetail?: string;
  snapshotParse?: { tablesFound: number; tablesParsed: number; rowsSkipped: number; reason: string };
}

export function compareProduct(input: CompareInput): ProductDiff {
  const counts: Record<FigureState, number> = { AGREES: 0, DISAGREES: 0, NO_AUTHORITY: 0, AUTHORITY_EXPIRED: 0, AUTHORITY_UNPARSEABLE: 0 };
  const base = {
    productId: input.productId,
    configFile: input.configFile,
    authoritySource: input.authoritySource,
    buildId: input.buildId ?? null,
    snapshotParse: input.snapshotParse,
    figures: [] as FigureVerdict[],
    counts,
  };

  if (!input.configText) {
    return { ...base, overall: "NO_CONFIG", reason: "no config file resolves for this product — nothing to compare the authority against" };
  }
  if (input.expired && input.figures.length === 0) {
    counts.AUTHORITY_EXPIRED = 1;
    return { ...base, overall: "AUTHORITY_EXPIRED", reason: input.expiredDetail ?? "authority snapshot is past its validity window" };
  }
  if (input.unparseable && input.figures.length === 0) {
    counts.AUTHORITY_UNPARSEABLE = 1;
    return { ...base, overall: "AUTHORITY_UNPARSEABLE", reason: input.unparseableDetail ?? "a current snapshot is held but no figures could be read from it" };
  }
  if (input.figures.length === 0) {
    counts.NO_AUTHORITY = 1;
    return { ...base, overall: "NO_AUTHORITY", reason: "no usable authority figures exist for this product" };
  }

  const configNumbers = parseNumericTokens(input.configText);
  const figures: FigureVerdict[] = [];

  for (const f of input.figures) {
    const candidates = authorityValueCandidates(f.value, f.unit);
    const hit = candidates.find(c => configNumbers.has(c));
    const state: FigureState = hit !== undefined ? "AGREES" : "DISAGREES";
    counts[state]++;

    // Corroboration for an AGREES: does any context carrying that number mention
    // a significant word from the label? See the field doc — au-15 agrees on
    // 2,100,000 purely by coincidence.
    let corroborated: boolean | undefined;
    let corroboratingContext: string | undefined;
    if (state === "AGREES") {
      const words = f.id.toLowerCase().match(/[a-z]{5,}/g) ?? [];
      const ctxs = configNumbers.get(hit!) ?? [];
      const found = ctxs.find(c => words.some(w => c.toLowerCase().includes(w)));
      corroborated = !!found;
      corroboratingContext = found ?? ctxs[0];
    }

    // For a disagreement, offer what the config plausibly says instead: numbers
    // of similar magnitude whose surrounding text shares a significant word with
    // the figure's label. Reported as CANDIDATES, never asserted as the answer —
    // guessing here would be worse than admitting the tool cannot tell.
    let configCandidates: { value: number; context: string }[] = [];
    if (state === "DISAGREES") {
      const words = f.id.toLowerCase().match(/[a-z]{5,}/g) ?? [];
      const target = candidates[0];
      const scored: { value: number; context: string; score: number }[] = [];
      for (const [n, ctxs] of configNumbers) {
        const sameMagnitude = target > 0 && n > 0 && Math.abs(Math.log10(n) - Math.log10(target)) < 0.35;
        if (!sameMagnitude) continue;
        const ctx = ctxs[0] ?? "";
        const overlap = words.filter(w => ctx.toLowerCase().includes(w)).length;
        if (overlap === 0) continue;
        scored.push({ value: n, context: ctx, score: overlap });
      }
      scored.sort((a, b) => b.score - a.score || Math.abs(a.value - target) - Math.abs(b.value - target));
      configCandidates = scored.slice(0, 4).map(({ value, context }) => ({ value, context }));
    }

    figures.push({
      id: f.id,
      state,
      authorityValue: f.value,
      unit: f.unit,
      factRole: f.factRole,
      configCandidates,
      sourceQuote: f.sourceQuote,
      sourceUrl: input.sourceUrl ?? null,
      sourceLastUpdated: input.sourceLastUpdated ?? null,
      corroborated,
      corroboratingContext,
      note: state === "DISAGREES" && configCandidates.length === 0
        ? "no same-magnitude number with related wording found in the config — the figure may simply be absent"
        : undefined,
    });
  }

  return { ...base, figures, overall: "COMPARED", reason: `${figures.length} figure(s) compared` };
}
