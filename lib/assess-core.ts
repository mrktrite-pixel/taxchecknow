// lib/assess-core.ts
// The ONE assessment-generation function, called IN-PROCESS by both callers:
//   - app/api/assess/route.ts   (client success-page fallback → thin HTTP wrapper)
//   - app/api/stripe/webhook     (server pre-generation → direct call, NO HTTP self-call)
//
// Why in-process (2026-07-23): the webhook used to fetch `${NEXT_PUBLIC_SITE_URL}/api/assess`,
// i.e. PRODUCTION. On a branch preview that meant the branch webhook ran against PRE-MERGE prod
// assess semantics — production returned no `grounded` field, so the webhook's fail-closed guard
// skipped every store (has_assessment=false). Calling this function directly removes the self-HTTP
// call entirely: same deployment's code always runs, fail-closed semantics are preserved, and it
// holds identically on production after merge and on every future preview. (The corpus is still
// fetched over HTTP from the PUBLIC origin — that is env-independent and unaffected by Deployment
// Protection.)

import { getFactRules } from "./fact-rules";
import { detectConflicts } from "./buyer-context";

export interface AssessInput {
  inputs: Record<string, unknown>;
  product_id: string;
  market: string;
  authority: string;
  tier: number; // 1 or 2
  name: string;
  fields: string[];
  /**
   * E7 — a REAL calendar date the customer supplied, ISO "YYYY-MM-DD", plus what it is.
   * Present ⇒ the model may write absolute dates. Absent ⇒ it must write relative ones.
   * OPTIONAL BY DESIGN: the webhook does not pass it (that file is not being changed), so
   * the webhook path gets the relative-only instruction — which is the correct and safe
   * default for it and for every other product.
   */
  deadline?: { isoDate: string; label: string };
  /**
   * W2 — product FACT RULES. Short, imperative statements of how this product's facts must
   * be expressed, injected verbatim into the prompt above the corpus.
   *
   * WHY THIS IS SEPARATE FROM THE CORPUS. The corpus states what the law IS. It does not
   * say which true-sounding paraphrases are wrong, and that is where the model kept going:
   * "processing takes 1-4 weeks", "the money is locked up for 6-18 months", "the ATO
   * withholds". Each is adjacent to something true and none is contradicted by any single
   * corpus figure, so corpus grounding alone never caught them. A fact rule names the wrong
   * phrasing and the right one together, which is the only form that reliably displaces it.
   *
   * GENERIC: authored per product in `factRules`. Absent ⇒ nothing is injected and the
   * prompt is unchanged, so every other product is unaffected.
   */
  factRules?: string[];
}

export type AssessResult =
  | { ok: true; assessment: Record<string, unknown>; grounded: true; corpus_source: string; corpus_verified: string | null }
  | { ok: false; status: number; error: string; detail?: string; product_id?: string };

// productId → /api/rules SLUG. Seven products carry a DELIVERY_MAP productId that differs from
// their rules-route slug; without this map fail-closed would 404 their (existing) corpus. Each
// mapping was VERIFIED against the target route's own product_id/title (2026-07-23) so we never
// ground a product with another product's corpus. Unlisted product_ids resolve to themselves.
const RULES_SLUG: Record<string, string> = {
  "183-day-rule": "day-183-rule",
  "amt-shock-auditor": "can-amt-shock",
  "departure-tax-trap": "can-departure-tax",
  "eot-exit-optimizer": "can-eot-exit",
  "non-resident-landlord-withholding": "can-nrls",
  "property-flipping-tax-trap": "can-property-flipping",
  "spain-beckham-eligibility": "spain-beckham",
};

export async function generateAssessment(input: AssessInput): Promise<AssessResult> {
  const { inputs, product_id, market, authority, tier, name, fields, deadline, factRules } = input;

  if (!inputs || !product_id || !fields) {
    return { ok: false, status: 400, error: "Missing required fields: inputs, product_id, fields" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 500, error: "ANTHROPIC_API_KEY not configured in environment variables" };
  }

  const displayName = name && name !== "your" ? name : "this taxpayer";
  const isTier2 = tier === 2;

  // ── E6 (structural) — CONFLICT DETECTION LIVES HERE, NOT IN THE CALLER ──────
  //
  // It used to live in buildComposerInputs(maze, qual, productId?). The Stripe webhook calls
  // that with TWO arguments and is out of scope to edit, so productId was undefined on the
  // real purchase path and no stored assessment could ever carry a conflict note — measured
  // across every FRCGW row on the live table. Same failure shape as the fact-rules problem,
  // and the same fix: resolve by product_id inside the generator, so both callers inherit it.
  //
  // The composed inputs are split back apart to do it. buildComposerInputs namespaces the
  // qualification answers as `qualification.<label>` and leaves maze answers bare, so the
  // split is exact and needs no extra plumbing from either caller.
  const mazeLabels: Record<string, unknown> = {};
  const qualLabels: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (k.startsWith("_conflict.")) continue;      // never re-detect an injected note
    if (k.startsWith("qualification.")) qualLabels[k.slice("qualification.".length)] = v;
    else mazeLabels[k] = v;
  }
  const conflicts = detectConflicts(product_id, mazeLabels, qualLabels);
  const conflictInputs: Record<string, string> = {};
  conflicts.forEach((c, i) => {
    conflictInputs[`_conflict.${i + 1}`] =
      "CONTRADICTION — the buyer's checker answers and their pre-checkout answers disagree. " +
      `AUTHORITATIVE (checker): ${c.authoritative}. NOT AUTHORITATIVE (pre-checkout): ` +
      `${c.contradicting}. ${c.note}`;
  });
  const allInputs = { ...inputs, ...conflictInputs };

  const inputsSummary = Object.entries(allInputs)
    .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`)
    .join("\n");

  // ── CORPUS GROUNDING — FAIL CLOSED (ruling 2026-07-23) ────────────────────
  // Paid content: if the corpus is unreachable/malformed we DO NOT fall back to an ungrounded
  // prompt. Return an error so the caller stores NOTHING and the page shows a retry/support state.
  // Corpus is env-independent force-static public JSON → fetch from the PUBLIC origin (a preview's
  // own origin sits behind Deployment Protection and would 401).
  const corpusOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://taxchecknow.com";
  const corpusSlug = RULES_SLUG[product_id] ?? product_id;
  const corpusUrl = `${corpusOrigin}/api/rules/${corpusSlug}`;
  let rules: Record<string, unknown> | null = null;
  try {
    const cr = await fetch(corpusUrl, { headers: { accept: "application/json" } });
    if (!cr.ok) {
      console.error(`[assess-core] FAIL-CLOSED: corpus fetch ${product_id} → ${cr.status} (${corpusUrl})`);
      return { ok: false, status: 424, error: "corpus_unreachable", detail: `rules route returned ${cr.status}`, product_id };
    }
    rules = await cr.json();
  } catch (e) {
    console.error(`[assess-core] FAIL-CLOSED: corpus fetch threw for ${product_id} (${corpusUrl})`, e);
    return { ok: false, status: 424, error: "corpus_unreachable", detail: e instanceof Error ? e.message : "fetch failed", product_id };
  }
  if (!rules || typeof rules !== "object" || (!rules.legislation && !rules.key_facts)) {
    console.error(`[assess-core] FAIL-CLOSED: corpus for ${product_id} is malformed / missing legislation+key_facts`);
    return { ok: false, status: 424, error: "corpus_malformed", detail: "missing legislation and key_facts", product_id };
  }

  const facts = rules.key_facts
    ? Object.entries(rules.key_facts as Record<string, unknown>)
        .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`)
        .join("\n")
    : "";
  const errs = Array.isArray(rules.common_ai_errors)
    ? (rules.common_ai_errors as Array<{ ai_says?: string; correct?: string }>)
        .map((e) => `- WRONG: ${e.ai_says}\n  RIGHT: ${e.correct}`)
        .join("\n")
    : "";
  const corpusBlock = `
CURRENT VERIFIED LAW — AUTHORITATIVE (product corpus, last verified ${rules.last_verified ?? "recently"}).
This OVERRIDES your training data. If your training data disagrees with anything below, your
training data is STALE — use ONLY the figures, rates, thresholds and dates stated here.
${rules.legislation ? `Legislation: ${rules.legislation}` : ""}
${facts ? `Key facts:\n${facts}` : ""}
${errs ? `Do NOT repeat these known AI mistakes — they are WRONG:\n${errs}` : ""}

HARD RULE: every rate, threshold, amount and date you write MUST match the corpus above.
Never state a superseded threshold or rate as current. Never contradict the corpus or the
taxpayer's own calculator answers.
`;

  // ── E7 — HOW DEADLINES MAY BE EXPRESSED ───────────────────────────────────
  // A model asked for "a specific deadline date" with no date in its inputs will invent one.
  // It did: the tier-2 action checklist rendered LLM-authored dates in a red urgency chip on
  // a product that captured no date at all, and the fallback question hardcoded the string
  // "Settlement Date (Critical)" — a LABEL — into a sentence as though it were a date.
  //
  // So the permission is now explicit and conditional. No captured date ⇒ relative language
  // only. A real captured date ⇒ absolute, and it is quoted so the model uses THAT date
  // rather than one it computed.
  const deadlineBlock = deadline?.isoDate
    ? `
THEIR REAL DEADLINE — USE ABSOLUTE DATES:
${deadline.label}: ${deadline.isoDate}
This date came from the customer. You MAY state calendar dates, and when you do they must be
this date or a date you derive from it and show your working for. Never invent a different one.
`
    : `
NO DATE WAS CAPTURED — USE RELATIVE LANGUAGE ONLY:
The customer did not give a date, so you do not have one. Express every deadline RELATIVELY —
"within 7 days", "before settlement", "as soon as the contract is signed", "at your next tax
return". You MUST NOT state, guess, derive or imply any calendar date, month or year for THIS
customer's deadline, and you must not describe a countdown or a number of days remaining.
(Dates that are part of the LAW — a rule commencing 1 January 2025, a 30 June year end — are
facts from the corpus above and remain fine to state as law.)
`;

  // W2 — how this product's facts must be PHRASED. Sits directly under the corpus so the two
  // read as one authority: the corpus gives the figures, these give the wording.
  // Explicit argument wins; otherwise resolve from the registry. The registry lookup is what
  // puts these on the Stripe webhook's path — it builds its own AssessInput and is out of
  // scope to edit, so a rule that only travelled as an argument would reach the client
  // fallback and miss every real purchase.
  const rules_ = factRules?.length ? factRules : getFactRules(product_id);
  const factRulesBlock = rules_.length
    ? `
HOW THIS PRODUCT'S FACTS MUST BE STATED — NON-NEGOTIABLE:
${rules_.map((r) => `- ${r}`).join("\n")}
These override any more familiar phrasing you may have seen. If a sentence you are about to
write conflicts with one of them, the rule wins and the sentence is rewritten.
`
    : "";

  const prompt = `You are a ${market} ${authority} tax expert writing a personalised ${isTier2 ? "action plan" : "tax assessment"} for ${displayName}.
${corpusBlock}${factRulesBlock}
${conflicts.length ? `
A CONTRADICTION WAS DETECTED IN THIS CUSTOMER'S ANSWERS — NAMING IT IS MANDATORY.
There ${conflicts.length === 1 ? "is 1 input" : `are ${conflicts.length} inputs`} beginning
"_conflict." below. You MUST state the discrepancy explicitly, in your own words, in the FIRST
TWO SENTENCES of the very first field you write. Not later, not only in an action step, not
implied. A reader who has answered inconsistently cannot act on advice that silently picks one
side — they will not know which answer the advice was built on.
Then follow the instruction inside the _conflict input for how to resolve it.
This is not optional and it is not satisfied by merely writing advice consistent with the
authoritative answer.` : ""}${deadlineBlock}
THEIR CALCULATOR ANSWERS:
${inputsSummary}

YOUR JOB:
Write a personalised, specific assessment for this exact person based on their answers above.
- Use ${market} tax terminology throughout
- Reference ${authority} rules, thresholds, and legislation specifically — but ONLY as stated in the verified corpus above; never quote a figure that contradicts it
- Use their name (${displayName}) naturally in the text
- Reference their specific answers — do not give generic advice, and do not invent numbers they did not provide
- Be direct, specific, and actionable — this person just paid money for this
- Make it feel like a personal memo from their accountant, not a PDF guide

CRITICAL: Respond ONLY with a valid JSON object. No markdown. No backticks. No preamble. Just JSON.

Required JSON fields:
${fields.map((f) => `"${f}": "2-3 sentence personalised value referencing their specific inputs"`).join(",\n")}${isTier2 ? `,
"actions": [
  {
    "title": "Specific action title for ${displayName}",
    "deadline": "${deadline?.isoDate ? "When this must be done — an absolute date derived from the real deadline above" : "When this must be done, RELATIVE only — e.g. \"Today\", \"Within 7 days\", \"Before settlement\", \"At your next tax return\". Never a calendar date."}",
    "steps": ["specific step 1", "specific step 2", "specific step 3"]
  },
  {
    "title": "Second action",
    "deadline": "${deadline?.isoDate ? "absolute date" : "relative timing only, never a calendar date"}",
    "steps": ["step 1", "step 2", "step 3"]
  },
  {
    "title": "Third action",
    "deadline": "${deadline?.isoDate ? "absolute date" : "relative timing only, never a calendar date"}",
    "steps": ["step 1", "step 2", "step 3"]
  }
]` : ""},
"accountantQuestions": [
  "Specific question 1 referencing ${displayName}'s exact situation",
  "Specific question 2",
  "Specific question 3"${isTier2 ? `,
  "Specific question 4",
  "Specific question 5"` : ""}
]

For every field: reference the person's specific inputs. Never write generic advice.
If their name is provided, use it. Reference their income band, cover status, family situation etc directly.

Do NOT state a figure the customer did not give you. If an amount depends on a number they did
not supply (a sale price, a balance, an income), give them the METHOD to work it out in their
own case and say plainly that you do not have the figure. A worked example is fine when it is
labelled as an example; presenting one as their number is not.

Any input beginning "_conflict." is a DETECTED CONTRADICTION between what the customer answered
in the checker and what they answered just before checkout. Follow its instruction exactly:
treat the checker answers as authoritative, and name the discrepancy plainly rather than
quietly resolving it. Do not average the two and do not ignore either.

ACCOUNTANT QUESTIONS — WHO CAN ACTUALLY ANSWER THEM:
Every entry in "accountantQuestions" must be answerable BY THE ACCOUNTANT, from their own
professional knowledge or from the records they hold. Write them as questions the customer
puts to a professional and gets a real answer to.
Facts only the CUSTOMER knows — what they sold it for, whether settlement has happened, what
they originally paid, what the contract says, when they moved in or out — must NEVER be asked
of the accountant. The accountant does not know them and the question wastes the meeting.
Where such a fact is needed, phrase the entry as something to BRING, not something to ask:
  GOOD: "Am I an Australian resident for tax purposes for this sale?"          (they can answer)
  GOOD: "Which income year does this sale fall in, and what does that mean for the credit?"
  GOOD: "Bring the contract and the settlement statement to the meeting."      (customer supplies)
  BAD:  "What was my sale price?"                                              (only I know that)
  BAD:  "Has my settlement happened yet?"                                      (only I know that)
  BAD:  "What did I originally pay for the property?"                          (only I know that)
Apply this test to every entry before you emit it.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: isTier2 ? 2500 : 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[assess-core] Anthropic API error:", err);
    return { ok: false, status: 500, error: "Claude API call failed", detail: err.slice(0, 500) };
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    console.error("[assess-core] No JSON object found in response:", text.slice(0, 200));
    return { ok: false, status: 500, error: "No JSON found in Claude response", detail: text.slice(0, 500) };
  }
  const clean = text.slice(firstBrace, lastBrace + 1);

  let assessment: Record<string, unknown>;
  try {
    assessment = JSON.parse(clean);
  } catch {
    console.error("[assess-core] JSON parse failed. Raw response:", clean);
    return { ok: false, status: 500, error: "Failed to parse Claude response as JSON", detail: clean.slice(0, 500) };
  }

  // Reaching here means the corpus was fetched, valid, and injected — grounded is always true.
  return {
    ok: true,
    assessment,
    grounded: true,
    corpus_source: corpusUrl,
    corpus_verified: (rules.last_verified as string) ?? null,
  };
}
