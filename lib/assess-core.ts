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
  | { ok: true; assessment: Record<string, unknown>;
      /** Keys the model returned that were never asked for, and asked-for keys it omitted.
       *  null when they match. Part of the contract so a caller can record it. */
      field_mismatch: { unrequested: string[]; missing: string[] } | null;
      /**
       * The second pass, when the first omitted requested fields.
       *
       * `asked` is what the retry was told to produce; `filled` is what came back usable. A
       * caller records this so a pack that needed a retry is distinguishable from one that did
       * not — a product whose every delivery needs a second call is a prompt problem, and it is
       * invisible if the retry is silent.
       */
      retry?: { asked: string[]; filled: string[] };
      grounded: true; corpus_source: string; corpus_verified: string | null }
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

/**
 * WHERE THE GROUNDING CORPUS COMES FROM.  (F57)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE BUG THIS EXISTS TO CLOSE
 *
 * This used to be one line: `process.env.NEXT_PUBLIC_SITE_URL || "https://taxchecknow.com"`. On a
 * branch preview that resolves to PRODUCTION, so a preview generated paid content grounded on
 * main's corpus — not on the corpus in the branch being tested.
 *
 * Measured on 2026-09-27, mid-dispatch: production's us-expat-tax corpus served the stale FEIE
 * limit $126,500 seven times and the correct $132,900 not once, because the correction sat on an
 * unmerged branch. A re-generation against the default origin wrote the stale figure into a fresh
 * pack and every local check passed, because every local check was reading the branch while the
 * MODEL was reading production. Nothing in the logs said which corpus had been used.
 *
 * That is the whole class of failure: a preview that tests the branch's pages against
 * production's facts is not testing the branch.
 *
 * ── THE ORDER, AND WHY ─────────────────────────────────────────────────────────────────────
 *
 *   VERCEL_ENV=preview  ->  this deployment's OWN origin
 *        VERCEL_URL first: it is the immutable per-deployment hostname, so the corpus it serves
 *        is by definition the corpus in the commit being tested. VERCEL_BRANCH_URL (the moving
 *        branch alias) is the fallback — right branch, but whichever deployment is newest, which
 *        during a redeploy is not necessarily this one.
 *   anything else       ->  NEXT_PUBLIC_SITE_URL, else production.
 *        Unchanged. On production those are the same thing, and a local run keeps pointing
 *        wherever the operator aimed it.
 *
 * ── DEPLOYMENT PROTECTION IS THE CATCH, AND IT IS HANDLED, NOT IGNORED ─────────────────────
 *
 * A preview sits behind Vercel Authentication, so a self-fetch 401s unless it carries the
 * automation bypass. Vercel injects VERCEL_AUTOMATION_BYPASS_SECRET into the deployment when
 * Protection Bypass for Automation is enabled, and bypassHeaders() sends it.
 *
 * WHEN IT IS ABSENT WE STILL DO NOT FALL BACK TO PRODUCTION. The fail-closed ruling is about
 * exactly this: an ungrounded-or-wrongly-grounded paid assessment must not be produced, and
 * quietly substituting production's corpus is the wrongly-grounded case wearing a success
 * response. The generation fails with an error that names the origin it could not read, and
 * ship-check's step-4 pre-flight is the thing that tells the operator BEFORE a test buy.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export interface CorpusOrigin {
  /** Scheme + host, no trailing slash. */
  origin: string;
  /** Which env var decided it — printed in the log line so a wrong corpus is visible. */
  source: string;
  /** True when this is the deployment's own origin, i.e. behind Deployment Protection. */
  isSelf: boolean;
}

const PRODUCTION_ORIGIN = "https://taxchecknow.com";

/** Normalise a Vercel *_URL value, which arrives as a bare host with no scheme. */
function asOrigin(hostOrUrl: string): string {
  const trimmed = hostOrUrl.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function resolveCorpusOrigin(env: Record<string, string | undefined> = process.env): CorpusOrigin {
  if (env.VERCEL_ENV === "preview") {
    const self = env.VERCEL_URL?.trim() || env.VERCEL_BRANCH_URL?.trim();
    if (self) {
      return {
        origin: asOrigin(self),
        source: env.VERCEL_URL?.trim() ? "VERCEL_URL (this deployment)" : "VERCEL_BRANCH_URL (branch alias)",
        isSelf: true,
      };
    }
    // preview with neither set should be impossible; say so rather than silently using production.
    console.warn("[assess-core] VERCEL_ENV=preview but neither VERCEL_URL nor VERCEL_BRANCH_URL is set — falling back to the public origin, which serves MAIN's corpus");
  }
  const pub = env.NEXT_PUBLIC_SITE_URL?.trim();
  return {
    origin: pub ? asOrigin(pub) : PRODUCTION_ORIGIN,
    source: pub ? "NEXT_PUBLIC_SITE_URL" : "default (production)",
    isSelf: false,
  };
}

/**
 * The automation-bypass header, when the secret is in the environment.
 *
 * Only sent for a self-origin fetch: a bypass secret is per project, and posting it at the public
 * origin would be a credential sent somewhere it does not belong.
 */
export function corpusFetchHeaders(target: CorpusOrigin, env: Record<string, string | undefined> = process.env): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (target.isSelf && secret) {
    headers["x-vercel-protection-bypass"] = secret;
    // ═══════════════════════════════════════════════════════════════════════════════════════
    // F145 — `x-vercel-set-bypass-cookie` IS NOT SENT, AND THAT HEADER IS WHY PAID GENERATION
    // FAILED ON EVERY PREVIEW.
    //
    // It used to be set to "samesitenone", on this reasoning: "the fetch may be redirected
    // internally, and the header alone is not carried across a redirect hop." The opposite is
    // true. Asking Vercel to SET the cookie makes it answer 307 so the browser can store it —
    // and a server-side fetch has no cookie jar, so the redirect target re-asks, and the loop
    // runs until Node's 20-redirect limit throws:
    //
    //     TypeError: fetch failed
    //       [cause]: Error: redirect count exceeded
    //
    // which assess-core catches and reports as `corpus_unreachable` (424), after which the
    // webhook's fail-closed rule stores NOTHING. The buyer gets the delivery email and a
    // success page reading "Assessment generation issue"; `assessments` has no row at all.
    //
    // MEASURED 2026-10-20 against the failing deployment's own corpus URL
    // (taxchecknow-ojkt7r2mj…/api/rules/cgt-discount-timing-sniper), three requests:
    //
    //   no headers                      → 2 redirects to vercel.com/login (protection is on)
    //   bypass header only              → 200, 0 redirects, corpus JSON returned
    //   bypass header + set-bypass-cookie → 307, 20 redirects, "redirect count exceeded"
    //
    // So the bypass header alone needs no redirect hop to survive: there is no hop. The cookie
    // is for a browser session, and nothing here is a browser.
    // ═══════════════════════════════════════════════════════════════════════════════════════
  }
  return headers;
}

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
  // WHICH corpus is resolveCorpusOrigin()'s job — see its header for why a preview must read its
  // own and not production's.
  const corpusTarget = resolveCorpusOrigin();
  const corpusSlug = RULES_SLUG[product_id] ?? product_id;
  const corpusUrl = `${corpusTarget.origin}/api/rules/${corpusSlug}`;
  // LOGGED ON EVERY GENERATION, not only on failure. The stale-figure incident was invisible
  // precisely because a SUCCESSFUL generation said nothing about where its facts came from.
  console.log(`[assess-core] corpus origin: ${corpusTarget.origin} (${corpusTarget.source}) → ${corpusUrl}`);
  let rules: Record<string, unknown> | null = null;
  try {
    const cr = await fetch(corpusUrl, { headers: corpusFetchHeaders(corpusTarget) });
    if (!cr.ok) {
      // A self-origin 401/403 is Deployment Protection, which has a specific fix — say which one
      // it is rather than making someone infer it from a bare status code.
      const protectionLikely = corpusTarget.isSelf && (cr.status === 401 || cr.status === 403);
      const detail = protectionLikely
        ? `${corpusUrl} returned ${cr.status} — the preview is behind Deployment Protection and VERCEL_AUTOMATION_BYPASS_SECRET ${process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? "was sent but rejected" : "is not set in this deployment"}. Enable Protection Bypass for Automation, or the branch's own corpus cannot be read.`
        : `rules route returned ${cr.status} (${corpusUrl})`;
      console.error(`[assess-core] FAIL-CLOSED: corpus fetch ${product_id} → ${cr.status} (${corpusUrl}, ${corpusTarget.source})`);
      return { ok: false, status: 424, error: "corpus_unreachable", detail, product_id };
    }
    rules = await cr.json();
  } catch (e) {
    console.error(`[assess-core] FAIL-CLOSED: corpus fetch threw for ${product_id} (${corpusUrl}, ${corpusTarget.source})`, e);
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

VOICE: this is a written report addressed to the reader, in the third person and the imperative.
Never refer to yourself and never use the first person singular anywhere in any field — not once.
A sentence about what you are unable to do turns a paid document into a chat reply, and it has
already shipped to buyers that way. State the limitation impersonally and move straight to the
method: "this figure is not available here — work it out as follows", "the deciding factor is X".
The reader is buying their position, not a conversation with an assistant.

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

  // ── ONE CALL, EXPRESSED ONCE, SO THE RETRY CANNOT DRIFT FROM THE FIRST PASS ──────────────
  //
  // The retry below must use the SAME model, the same version header and the same token budget.
  // A second fetch written out longhand is how those quietly diverge — and a retry that ran on a
  // different model would make the two halves of one delivered pack inconsistent.
  const callModel = async (promptText: string): Promise<
    { ok: true; obj: Record<string, unknown> } | { ok: false; status: number; error: string; detail: string }
  > => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      // Pinned to the DATED id, which is the form the deprecations table uses
      // (claude-opus-4-5-20251101, Active, retirement "not sooner than
      // 2026-11-24"). The bare "claude-opus-4-5" alias resolved fine but named
      // no specific snapshot, so a silent alias repoint would have moved the
      // model under the paid assessment without a diff.
      //
      // DEFAULT DELIBERATELY UNCHANGED. Moving to opus-4-8 or opus-5 is a
      // quality change to the one call customers pay for, and it gets its own
      // sandbox A/B rather than riding along with an infrastructure commit.
      // The env var exists so that A/B needs no deploy.
      model: process.env.ASSESS_MODEL ?? "claude-opus-4-5-20251101",
      max_tokens: isTier2 ? 2500 : 1500,
      messages: [{ role: "user", content: promptText }],
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

  try {
    return { ok: true, obj: JSON.parse(clean) as Record<string, unknown> };
  } catch {
    console.error("[assess-core] JSON parse failed. Raw response:", clean);
    return { ok: false, status: 500, error: "Failed to parse Claude response as JSON", detail: clean.slice(0, 500) };
  }
  };

  const first = await callModel(prompt);
  if (!first.ok) return { ok: false, status: first.status, error: first.error, detail: first.detail };
  const assessment: Record<string, unknown> = first.obj;

  // ── A KEY THAT WAS NOT ASKED FOR IS NOT A FIELD ─────────────────────────────────────────
  //
  // MEASURED on allowance-sniper, 2026-10-27. The prompt asked for the product's 13 registered
  // tier-2 fields; the stored pack came back with 13, twelve of them exact and one RENAMED:
  //
  //     requested   multiYearPensionPlan        (cole/config/uk-02-allowance-sniper.ts:230,
  //                                              and lib/assessment-fields.ts, copied from it)
  //     stored      multiYearPlanningStrategy   — a string that appears NOWHERE in either repo
  //
  // The success page binds by key, so that section renders blank for every buyer, and nothing
  // noticed: the field-parity gate compares the pack against the GENERIC schema (it asks "are
  // these product keys or generic keys?"), which a renamed product-shaped key passes.
  //
  // So the check belongs here, at the only point that knows what was ASKED FOR. It is the same
  // construction as F-S234's tooth (c) in Bee D: the producer verifies its own output against the
  // list it was given, rather than leaving it to a reviewer one stage later.
  //
  // REPORTED, NOT SILENTLY DROPPED, and never auto-renamed. Renaming would be a guess about which
  // requested field the model meant; dropping silently is how this got to production. The pack is
  // returned with the unrequested keys REMOVED and both lists recorded, so the caller stores a
  // pack whose every key binds, and the operator can see what the model tried to call it.
  //
  // IN-PROCESS CALLERS GET THIS TOO. The Stripe webhook calls generateAssessment() directly
  // rather than through /api/assess, so a check in the route alone would miss every real buy.
  const RESERVED = new Set(["_meta", "rendered", "status", "actions", "accountantQuestions"]);
  const requested = new Set(fields);
  const usable = (v: unknown): boolean =>
    v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "");
  const missingFrom = (obj: Record<string, unknown>): string[] =>
    fields.filter((f) => !(f in obj) || !usable(obj[f]));

  let retry: { asked: string[]; filled: string[] } | undefined;
  let missingKeys = missingFrom(assessment);

  // ── A MISSING FIELD IS A BLANK SECTION, SO ASK AGAIN — ONCE ──────────────────────────────
  //
  // The check above has reported the absence since #93, and reporting was the right first step:
  // it is how multiYearPensionPlan's absence was finally measured. But a reported absence still
  // DELIVERS. MEASURED on allowance-sniper's tier-2 test buy, 2026-10-27: the pack carried 13
  // keys, twelve exact and one renamed, so `multiYearPensionPlan` was absent and the buyer's page
  // rendered that section empty. The gate on the dashboard side saw it after the fact.
  //
  // ONE retry, asking ONLY for what is missing and merging the answer in. Asking only for the
  // gaps is deliberate: a full re-run could come back with DIFFERENT text for the twelve fields
  // that were already correct, so a second complete pass risks replacing good content to fix one
  // absence. Merging cannot regress a field that was already there.
  //
  // ONE, not a loop. If naming the exact keys once does not produce them, a third identical ask
  // is unlikely to, and a paid request must not sit in a retry loop while a buyer waits.
  if (missingKeys.length > 0) {
    console.error(
      `[assess-core] MISSING REQUESTED FIELD(S) product=${product_id} tier=${tier}`
      + ` missing=[${missingKeys.join(", ")}] — retrying once for those keys only`,
    );
    // THE KEYS ARE NAMED, ONE PER LINE, SPELLED EXACTLY. The whole defect was a rename, so a
    // retry that said "you missed some fields" would invite the same substitution again.
    const retryPrompt = `${prompt}

── SECOND PASS — YOU OMITTED REQUIRED FIELDS ──
Your previous answer did not include these keys, or left them empty:
${missingKeys.map((k) => `  - ${k}`).join("\n")}
Return a JSON object containing ONLY those keys, spelled EXACTLY as listed above — do not rename
them, do not abbreviate them, do not substitute a similar name. Every other field has already been
accepted; do not repeat it. Apply the same corpus, the same fact rules and the same date rules as
above. If a key genuinely cannot be answered from this taxpayer's inputs, still emit it with an
honest explanation of what is needed and why — an empty value is not an acceptable answer for a
field the buyer paid for.`;

    const second = await callModel(retryPrompt);
    if (second.ok) {
      const filled: string[] = [];
      for (const k of missingKeys) {
        if (k in second.obj && usable(second.obj[k])) { assessment[k] = second.obj[k]; filled.push(k); }
      }
      retry = { asked: missingKeys, filled };
      console.log(`[assess-core] retry filled ${filled.length}/${missingKeys.length}: [${filled.join(", ")}]`);
    } else {
      // The retry itself failed. Recorded, and the still-missing check below decides the delivery.
      retry = { asked: missingKeys, filled: [] };
      console.error(`[assess-core] retry call failed (${second.error}) — nothing filled`);
    }
    missingKeys = missingFrom(assessment);
  }

  const unrequestedKeys = Object.keys(assessment).filter((k) => !requested.has(k) && !RESERVED.has(k));
  if (unrequestedKeys.length > 0) {
    console.error(
      `[assess-core] FIELD MISMATCH product=${product_id} tier=${tier}`
      + ` unrequested=[${unrequestedKeys.join(", ")}]`,
    );
  }
  for (const k of unrequestedKeys) delete assessment[k];

  // ── STILL MISSING AFTER THE RETRY: THE DELIVERY FAILS ───────────────────────────────────
  //
  // FAIL CLOSED, the same discipline as corpus_unreachable above and for the same reason: this is
  // paid content. A pack with an absent registered field renders a blank section on a page the
  // buyer paid for, and the two previous occasions were both found by a human reading the
  // delivered PDF. Returning ok:true with the absence merely NOTED is what let that happen twice.
  //
  // The caller stores NOTHING on a failure, so there is no half-pack to deliver and no row for a
  // later gate to argue about — the page shows its retry/support state and the operator has the
  // key names.
  if (missingKeys.length > 0) {
    console.error(
      `[assess-core] FAIL-CLOSED: ${missingKeys.length} requested field(s) still missing after the`
      + ` retry for ${product_id} tier=${tier}: [${missingKeys.join(", ")}]`,
    );
    return {
      ok: false,
      status: 502,
      error: "assessment_incomplete",
      detail:
        `the model omitted ${missingKeys.length} requested field(s) and a second pass naming them`
        + ` did not produce them: ${missingKeys.join(", ")}. Nothing was stored — the page a buyer`
        + ` would see renders a section for each of those keys and would have had nothing to put`
        + ` in it.`,
      product_id,
    };
  }

  // Reaching here means the corpus was fetched, valid, and injected — grounded is always true.
  return {
    ok: true,
    assessment,
    field_mismatch: unrequestedKeys.length > 0 ? { unrequested: unrequestedKeys, missing: [] } : null,
    ...(retry ? { retry } : {}),
    grounded: true,
    corpus_source: corpusUrl,
    corpus_verified: (rules.last_verified as string) ?? null,
  };
}
