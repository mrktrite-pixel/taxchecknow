// cole/validators/doubled-word.ts — a repeated word a buyer can see, caught before it ships.
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// F75 — THE DEFECT, AND WHY AN EXACT-DUPLICATE CHECK WOULD HAVE MISSED IT
//
// Delivered heading, measured on the australia-smsf-residency success pages:
//
//     Your Australia Australian Taxation Office (ATO) position
//
// "Australia" and "Australian" are not the same word, so every doubled-word rule anyone would
// reach for first — /\b(\w+)\s+\1\b/ — is quiet on it. The duplication is ACROSS A TOKEN
// BOUNDARY: two config fields, `market` and `authority`, joined by a template that could not know
// one already contained the other.
//
//     generate-success-pages.ts:629   Your ${marketProse(config)} ${authorityProse(config)} position
//     nomad-09 config                 market: "Australia"
//                                     authority: "Australian Taxation Office (ATO)"
//
// So the rule has to compare STEMS, not tokens. Measured across the estate's 47 configs, three
// shapes of the same fault appear:
//
//     Australia + Australian Taxation Office (ATO)            stem repeat
//     Canada    + Canada Revenue Agency (CRA)                 exact repeat
//     United States + State Revenue Authorities / US Supreme Court   stem repeat, plural/singular
//
// ── AND WHY THE STEM RULE IS RESTRICTED TO CAPITALISED PAIRS ──
// "the fund funds the pension" and "this tax taxable amount" are ordinary English, and a bare
// prefix rule flags both. The defect this exists for lives in PROPER NOUNS — jurisdictions and
// authorities joined by a template — so a stem repeat only counts when BOTH words are capitalised.
// Lowercase text is still checked, but only for an EXACT repeat, which is never legitimate.
// Measured against every emitted success page before this was wired in as a blocker: the rule
// found the 16 known headings and nothing else.
//
// PURE. No I/O, no config knowledge — it takes a string and returns what it found, so the same
// function can gate a generator, a stored pack, and a test.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Words whose stem legitimately repeats beside itself in tax copy. Extend with evidence only. */
export const DOUBLED_WORD_ALLOW: ReadonlySet<string> = new Set([
  // "New New South Wales" is not a thing, but "Trust Trustee" and "Tax Taxable" are arguable in
  // headings. Nothing is exempted until a real sentence needs it — an empty allow-list that is
  // easy to extend beats a speculative one that hides the next instance.
]);

export interface DoubledWordHit {
  /** The two words as they appear, in order. */
  pair: string;
  /** "exact" — the same word twice. "stem" — one word is a prefix of the other. */
  kind: "exact" | "stem";
  /** A window of the surrounding text, for the report. */
  context: string;
  /** 1-based line number when the input had lines. */
  line: number;
}

/** The shortest word length the stem rule will consider. Below this, prefixes are coincidence. */
const MIN_STEM = 4;

const isCapitalised = (w: string): boolean => /^[A-Z]/.test(w);
const bare = (w: string): string => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");

/**
 * Every visible doubled word in a piece of text.
 *
 * Adjacency is measured over WORDS, with punctuation between them treated as a separator — so
 * "Australia, Australian" is caught and "Australia. Australian" is not (a sentence boundary makes
 * the repeat legitimate). That distinction is the reason the split keeps the separator.
 */
export function findDoubledWords(text: string): DoubledWordHit[] {
  const hits: DoubledWordHit[] = [];
  const lines = text.split(/\r?\n/);

  for (const [i, lineText] of lines.entries()) {
    // Sentence boundaries end adjacency: a repeat across ". " or a closing tag is not a doubling.
    for (const clause of lineText.split(/(?:[.!?;:]|<\/?[a-zA-Z][^>]*>)+/)) {
      const words = clause.split(/[\s,(){}[\]"'`/—–-]+/).map(bare).filter(Boolean);
      for (let k = 0; k + 1 < words.length; k++) {
        const a = words[k];
        const b = words[k + 1];
        if (!a || !b) continue;
        if (DOUBLED_WORD_ALLOW.has(a) || DOUBLED_WORD_ALLOW.has(b)) continue;

        if (a.toLowerCase() === b.toLowerCase()) {
          hits.push({ pair: `${a} ${b}`, kind: "exact", context: clause.trim().slice(0, 160), line: i + 1 });
          continue;
        }
        // THE CROSS-TOKEN CASE. Proper nouns only — see the header.
        if (!isCapitalised(a) || !isCapitalised(b)) continue;
        const lo = a.length <= b.length ? a.toLowerCase() : b.toLowerCase();
        const hi = a.length <= b.length ? b.toLowerCase() : a.toLowerCase();
        if (lo.length >= MIN_STEM && hi !== lo && hi.startsWith(lo)) {
          hits.push({ pair: `${a} ${b}`, kind: "stem", context: clause.trim().slice(0, 160), line: i + 1 });
        }
      }
    }
  }
  return hits;
}

/**
 * Join a jurisdiction and an authority without repeating either.
 *
 * Callers pass the already-shortened forms (marketProse / authorityProse). When the authority
 * ALREADY names the jurisdiction — "Canada Revenue Agency", "Australian Taxation Office", "State
 * Revenue Authorities" after "United States" — the market is dropped rather than trimmed: cutting
 * the clashing word alone yields "United State Revenue Authorities", which is worse than either.
 *
 * Returns the authority on its own when they clash, and "<market> <authority>" when they do not.
 */
export function joinJurisdictionAuthority(market: string, authority: string): string {
  const m = (market ?? "").trim();
  const a = (authority ?? "").trim();
  if (!m) return a;
  if (!a) return m;
  if (findDoubledWords(`${m} ${a}`).length === 0) return `${m} ${a}`;
  return a;
}
