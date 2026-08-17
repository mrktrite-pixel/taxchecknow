// lib/buyer-context.ts
//
// The ONE place a buyer's answers become (values, flags, conflicts) for everything
// downstream: templated document bodies (R1), the terminal-driven strip/calendar (R2),
// the pack spine (R3), and the assessment prompt (E6/E7).
//
// PURE. Two entry points build the same shape from the two places answers live:
//   fromSession()  — client: the sessionStorage blobs EngineCalculator wrote
//   fromRecord()   — server/tests: an explicit record (e.g. a decision_sessions row)
//
// ── E6: MAZE WINS ─────────────────────────────────────────────────────────────────────
// The maze answers are FACT (the buyer clicked them to reach a verdict). The three
// qualification popup answers are collected AFTER the pay button and are buyer CONTEXT,
// not fact — lib/composer-inputs.ts already namespaces them so they cannot overwrite a
// maze key. What was missing is what to do when they CONTRADICT.
//
// Observed live (decision_sessions 384f32be, 2026-08-14): the maze says "I know what it
// is, but I haven't applied yet and want to know when to apply" while the popup says
// settlement is "Already settled". Both went into the assessment prompt as flat, equal
// truths, so the model had to silently pick one.
//
// Now: the maze answer stands, and the contradiction is passed on as an explicit, labelled
// note — never as two competing assertions. A model told "these disagree, treat X as
// authoritative and acknowledge the discrepancy" produces a materially different (and
// honest) paragraph from one handed both and left to guess.

export interface ConflictNote {
  id: string;
  /** The maze (authoritative) side, verbatim. */
  authoritative: string;
  /** The qualification (non-authoritative) side, verbatim. */
  contradicting: string;
  /** Prose handed to the model and shown in operator surfaces. */
  note: string;
}

export interface BuyerContext {
  terminalId: string | null;
  tier: 1 | 2 | null;
  /** Flags for {{#if}} — engine flags verbatim, plus terminal:/tier:/has: derived flags. */
  flags: string[];
  /** Bind keys for {{bind:…}}. Only ever contains values the buyer actually supplied. */
  values: Record<string, string>;
  /** Detected maze-vs-qualification contradictions (E6). */
  conflicts: ConflictNote[];
}

// ── conflict rules ────────────────────────────────────────────────────────────────────
// Mechanism generic, data per-product. A rule fires when a maze answer LABEL matches
// `mazeMatches` and a qualification answer LABEL matches `qualMatches`. Labels (not flags)
// because both composer paths — the webhook's decision_sessions.inputs and the client's
// sessionStorage — carry labelled answers, and only labels are common to both.

export interface ConflictRule {
  id: string;
  mazeMatches: RegExp;
  qualMatches: RegExp;
  note: string;
}

export const CONFLICT_RULES: Record<string, ConflictRule[]> = {
  "frcgw-clearance-certificate": [
    {
      id: "not_yet_applied_vs_already_settled",
      mazeMatches: /haven'?t applied yet|don'?t know what a clearance certificate/i,
      qualMatches: /already settled/i,
      note:
        "The buyer's checker answers say settlement has NOT happened yet (they are still deciding when to " +
        "apply), but the pre-checkout question says settlement is 'Already settled'. Treat the checker " +
        "answers as authoritative. Open by naming the discrepancy in one sentence and asking them to " +
        "confirm which is true, because the two situations need opposite actions — lodging a clearance " +
        "certificate versus recovering a withheld amount through the tax return. Do NOT silently assume " +
        "either one.",
    },
    {
      id: "settlement_passed_vs_upcoming",
      mazeMatches: /Settlement has passed and I did not provide/i,
      qualMatches: /within a month|within 3 months|not scheduled yet|planning to sell soon/i,
      note:
        "The buyer's checker answers say settlement has ALREADY passed without a clearance certificate, " +
        "but the pre-checkout question describes settlement as still upcoming or unscheduled. Treat the " +
        "checker answers as authoritative — write the recovery position — and name the discrepancy in one " +
        "sentence so they can correct it if the checker answer was a mis-click.",
    },
    {
      id: "certificate_provided_vs_upcoming",
      mazeMatches: /I have a clearance certificate and provided it/i,
      qualMatches: /within a month|within 3 months|not scheduled yet|planning to sell soon/i,
      note:
        "The buyer's checker answers say the certificate was already provided at or before settlement, but " +
        "the pre-checkout question describes settlement as still upcoming. Treat the checker answers as " +
        "authoritative and name the discrepancy in one sentence.",
    },
    {
      // D12-C. Measured on a live buy: maze "Yes, I am selling…" + qualification "Helping
      // someone else" produced an assessment written entirely in the third person about
      // "the vendor" — E6's maze-wins rule silently losing on an axis no rule covered.
      id: "vendor_identity",
      mazeMatches: /Yes, I am selling or about to sell Australian real property/i,
      qualMatches: /helping someone else/i,
      note:
        "The buyer's checker answers say THEY are the vendor selling the property, but the " +
        "pre-checkout question says they are helping someone else. Treat the checker answers as " +
        "authoritative: write to the reader as the VENDOR, in the second person (\"you\", " +
        "\"your sale\") throughout — never in the third person about \"the vendor\" or \"the " +
        "person you are helping\". Name the discrepancy in one sentence so they can correct it " +
        "if they are in fact acting for someone else, because that changes who must sign the " +
        "application.",
    },
    {
      id: "not_selling_vs_selling",
      mazeMatches: /No, I am not selling Australian real property/i,
      qualMatches: /selling an Australian property now|sold — waiting on settlement|sold - waiting on settlement/i,
      note:
        "The buyer's checker answers say they are NOT selling Australian real property — which " +
        "is why they reached an out-of-scope result — but the pre-checkout question says they " +
        "are selling or have sold. Treat the checker answers as authoritative, and open by " +
        "naming the discrepancy: if they ARE selling Australian real property under a contract " +
        "dated on or after 1 January 2025, foreign resident capital gains withholding applies " +
        "and they should re-run the check.",
    },
    {
      id: "settlement_date_vs_already_settled",
      // The maze value here is a formatted date ("1 December 2026"), so it is matched by shape.
      mazeMatches: /^\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/,
      qualMatches: /already settled/i,
      note:
        "The buyer typed a settlement DATE in the checker, but the pre-checkout question says " +
        "settlement has already happened. Treat the typed date as authoritative. If that date " +
        "is in the future, write the pre-settlement position; name the discrepancy in one " +
        "sentence so they can correct it, because a settled sale and an upcoming one need " +
        "opposite actions.",
    },
  ],
};

export function detectConflicts(
  productId: string,
  mazeLabels: Record<string, unknown>,
  qualLabels: Record<string, unknown>,
): ConflictNote[] {
  const rules = CONFLICT_RULES[productId];
  if (!rules?.length) return [];

  const mazeEntries = Object.entries(mazeLabels ?? {});
  const qualEntries = Object.entries(qualLabels ?? {});
  const out: ConflictNote[] = [];

  for (const rule of rules) {
    const maze = mazeEntries.find(([, v]) => typeof v === "string" && rule.mazeMatches.test(v));
    const qual = qualEntries.find(([, v]) => typeof v === "string" && rule.qualMatches.test(v));
    if (!maze || !qual) continue;
    out.push({
      id: rule.id,
      authoritative: `${maze[0]} → ${String(maze[1])}`,
      contradicting: `${qual[0]} → ${String(qual[1])}`,
      note: rule.note,
    });
  }
  return out;
}

// ── date helpers ──────────────────────────────────────────────────────────────────────
// Calendar arithmetic on Y-M-D triples, mirroring lib/temporal-resolver.ts rather than
// importing it: that file is AUTO-SYNCED from cole-marketing and must not grow site-local
// callers. Same maths, no dependency, no risk of the sync clobbering an import.

export function parseIsoDate(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!match) return null;
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function addDaysIso(iso: string, days: number): string | null {
  const p = parseIsoDate(iso);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split("T")[0];
}

/** Whole days from `from` (default today, UTC calendar) to `iso`. Negative once past. */
export function daysUntilIso(iso: string, from?: Date): number | null {
  const p = parseIsoDate(iso);
  if (!p) return null;
  const target = Date.UTC(p.y, p.m - 1, p.d);
  const now = from ?? new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - todayUtc) / 86400000);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-09-15" → "15 September 2026". Returns "" for anything unparseable. */
export function formatIsoDate(iso: string): string {
  const p = parseIsoDate(iso);
  return p ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : "";
}

// ── context assembly ──────────────────────────────────────────────────────────────────

/** The engine answer key that, when present, holds a real customer-supplied settlement date. */
export const SETTLEMENT_DATE_FIELD = "q6_settlement_date";

/**
 * productId → the raw-answer key holding that product's customer-supplied date.
 *
 * MEASURED against a live decision_sessions row (2026-08-16,
 * d1c7df00-e116-4ffc-b480-d05061c04c21): `output.raw_answers.q6_settlement_date` = "2026-08-26",
 * rendered in the labelled inputs as "What is your settlement date?" → "26 August 2026".
 * One of 25 recent FRCGW sessions carries it — the date question is optional and only asked on
 * the paths where settlement is still ahead.
 *
 * WHY A SMALL EXPLICIT MAP RATHER THAN THE TEMPORAL DECLARATION. The product's own
 * `temporal.rule.field` already names this key, which would be the generic source — but
 * lib/temporal-registry.ts is a GENERATED SNAPSHOT and it has drifted: it still carries
 * FRCGW's pre-E3 `kind: "unresolvable"` declaration, with no rule and no field. Regenerating
 * it would rewrite every product's entry and change what the webhook's reminder path reads
 * platform-wide, which is far outside this change. Reported instead; this map is the
 * zero-blast-radius equivalent and follows the same registry pattern as fact-rules and
 * assessment-fields.
 */
export const DATE_ANSWER_FIELD: Record<string, string> = {
  "frcgw-clearance-certificate": SETTLEMENT_DATE_FIELD,
};

/** The date answer key for a product, or null if it captures no date. */
export function dateAnswerField(productId: string): string | null {
  return DATE_ANSWER_FIELD[productId] ?? null;
}

/** Lead time the ATO corpus states for lodging before settlement. */
export const LODGE_LEAD_DAYS = 28;

export interface BuyerContextSource {
  productId: string;
  /** raw engine answers: questionId → option value (or an ISO date for a date question). */
  rawAnswers?: Record<string, string>;
  /** labelled engine answers: question text → chosen option label. */
  labeledAnswers?: Record<string, unknown>;
  /** labelled qualification answers: field label → chosen option label. */
  qualification?: Record<string, unknown>;
  terminalId?: string | null;
  tier?: 1 | 2 | null;
  /** Flags the engine computed. When absent they are reconstructed as `${qid}:${value}`. */
  engineFlags?: string[];
}

export function buildBuyerContext(src: BuyerContextSource): BuyerContext {
  const raw = src.rawAnswers ?? {};
  const flags = new Set<string>(src.engineFlags ?? []);

  // Reconstruct `${qid}:${value}` when the caller had no flag list. This matches how every
  // current engine.json authors its flags, and a wrong guess can only ever fail to light a
  // conditional block — never invent content.
  if (!src.engineFlags) {
    for (const [qid, value] of Object.entries(raw)) {
      if (qid === SETTLEMENT_DATE_FIELD) continue; // its value is a date, not an option
      if (value) flags.add(`${qid}:${value}`);
    }
  }

  if (src.terminalId) flags.add(`terminal:${src.terminalId}`);
  if (src.tier) flags.add(`tier:${src.tier}`);

  const values: Record<string, string> = {};

  // Settlement date — the ONE genuinely customer-supplied date in this product.
  const settlementRaw = raw[SETTLEMENT_DATE_FIELD];
  if (settlementRaw && parseIsoDate(settlementRaw)) {
    values.settlement_date = formatIsoDate(settlementRaw);
    values.settlement_date_iso = settlementRaw;
    const lodgeBy = addDaysIso(settlementRaw, -LODGE_LEAD_DAYS);
    if (lodgeBy) {
      values.lodge_by_date = formatIsoDate(lodgeBy);
      values.lodge_by_date_iso = lodgeBy;
    }
    const days = daysUntilIso(settlementRaw);
    if (days !== null) {
      values.days_to_settlement = String(days);
      flags.add(days < 0 ? "settlement:past" : days < LODGE_LEAD_DAYS ? "settlement:inside_28" : "settlement:outside_28");
    }
    flags.add("has:settlement_date");
  }

  // Every labelled maze answer is bindable under its question id, so a document can quote
  // the buyer's own words back ("You told us: <label>") without a per-product mapping.
  for (const [qid, value] of Object.entries(raw)) {
    if (value) values[`answer.${qid}`] = value;
  }

  for (const key of Object.keys(values)) flags.add(`has:${key}`);

  return {
    terminalId: src.terminalId ?? null,
    tier: src.tier ?? null,
    flags: [...flags].sort(),
    values,
    conflicts: detectConflicts(src.productId, src.labeledAnswers ?? {}, src.qualification ?? {}),
  };
}

/**
 * Client variant — reads the blobs EngineCalculator wrote for this product.
 *
 * `terminalIdOverride` (W4) is the terminal resolved SERVER-SIDE from the stored
 * decision_sessions row, passed by the success page once /api/get-assessment answers. It
 * wins over sessionStorage because it is authoritative and, more importantly, because
 * sessionStorage is simply absent on every visit that is not the checkout tab — the receipt
 * email link, another device, a reopened browser. Without it `terminalId` is null there and
 * every terminal-conditioned surface degrades to the neutral default.
 *
 * `settlementDateOverride` is the same idea for the buyer's own date, and is injected into
 * the RAW ANSWERS rather than into `values` on purpose: every derived value — the formatted
 * date, lodge-by, days-to-settlement, `has:settlement_date`, the settlement:past /
 * inside_28 / outside_28 flag — is then computed by exactly the code the client path runs.
 * Setting the derived values directly would let the two paths drift; deriving them from the
 * same input makes them identical by construction.
 */
export function buyerContextFromSession(
  productId: string,
  tier?: 1 | 2,
  terminalIdOverride?: string | null,
  settlementDateOverride?: string | null,
): BuyerContext {
  const read = (k: string): Record<string, string> => {
    try {
      const v = sessionStorage.getItem(k);
      return v ? (JSON.parse(v) as Record<string, string>) : {};
    } catch {
      return {};
    }
  };
  const readStr = (k: string): string | null => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  };

  // Server-resolved date wins; sessionStorage remains the fallback. Injected as a raw answer
  // so everything downstream is derived by the shared code path (see the note above).
  const rawAnswers = read(`${productId}_raw`);
  const dateField = dateAnswerField(productId);
  if (dateField && settlementDateOverride && parseIsoDate(settlementDateOverride)) {
    rawAnswers[dateField] = settlementDateOverride;
  }

  return buildBuyerContext({
    productId,
    rawAnswers,
    labeledAnswers: read(`${productId}_answers`),
    qualification: read(`${productId}_qualification`),
    terminalId: terminalIdOverride ?? readStr(`${productId}_terminal`),
    tier: tier ?? (readStr(`${productId}_tier`) === "147" ? 2 : 1),
    engineFlags: (() => {
      const f = readStr(`${productId}_flags`);
      if (!f) return undefined;
      try {
        const parsed = JSON.parse(f);
        return Array.isArray(parsed) ? (parsed as string[]) : undefined;
      } catch {
        return undefined;
      }
    })(),
  });
}
