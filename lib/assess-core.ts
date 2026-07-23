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

export interface AssessInput {
  inputs: Record<string, unknown>;
  product_id: string;
  market: string;
  authority: string;
  tier: number; // 1 or 2
  name: string;
  fields: string[];
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
  const { inputs, product_id, market, authority, tier, name, fields } = input;

  if (!inputs || !product_id || !fields) {
    return { ok: false, status: 400, error: "Missing required fields: inputs, product_id, fields" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 500, error: "ANTHROPIC_API_KEY not configured in environment variables" };
  }

  const displayName = name && name !== "your" ? name : "this taxpayer";
  const isTier2 = tier === 2;

  const inputsSummary = Object.entries(inputs)
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

  const prompt = `You are a ${market} ${authority} tax expert writing a personalised ${isTier2 ? "action plan" : "tax assessment"} for ${displayName}.
${corpusBlock}
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
    "deadline": "Specific deadline date",
    "steps": ["specific step 1", "specific step 2", "specific step 3"]
  },
  {
    "title": "Second action",
    "deadline": "deadline",
    "steps": ["step 1", "step 2", "step 3"]
  },
  {
    "title": "Third action",
    "deadline": "deadline",
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
If their name is provided, use it. Reference their income band, cover status, family situation etc directly.`;

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
