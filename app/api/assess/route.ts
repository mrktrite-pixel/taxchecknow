import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/assess
// Server-side Claude API proxy for all TaxCheckNow success pages.
// Keeps the Anthropic API key server-side only — never exposed to the browser.
//
// Request body:
// {
//   inputs:       Record<string, string>  — user's calculator answers from sessionStorage
//   product_id:   string                  — e.g. "medicare-levy-surcharge-trap"
//   market:       string                  — e.g. "Australia"
//   authority:    string                  — e.g. "ATO"
//   tier:         1 | 2
//   name:         string                  — buyer's first name or "your"
//   fields:       string[]                — assessment fields to populate
// }
//
// Response:
// { assessment: Record<string, unknown> }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { inputs, product_id, market, authority, tier, name, fields } = body;

    if (!inputs || !product_id || !fields) {
      return NextResponse.json(
        { error: "Missing required fields: inputs, product_id, fields" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured in environment variables" },
        { status: 500 }
      );
    }

    const displayName = name && name !== "your" ? name : "this taxpayer";
    const isTier2 = tier === 2;

    // Build inputs summary for the prompt
    const inputsSummary = Object.entries(inputs)
      .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`)
      .join("\n");

    // ── CORPUS GROUNDING (P2) ────────────────────────────────────────────────
    // Bind the assessment to the product's VERIFIED fact corpus (/api/rules/<id>)
    // so the model states CURRENT law and cannot regurgitate superseded figures from
    // its training data. Without this, an ungrounded "reference ATO thresholds" prompt
    // free-associates stale law — e.g. the pre-2025 FRCGW $750k threshold / 12.5% rate,
    // which the corpus explicitly flags as a known AI error. Product-general: every
    // product has a corpus at /api/rules/<product_id>. Fails OPEN — if the corpus is
    // unreachable, we fall back to the prior ungrounded prompt (no regression).
    let corpusBlock = "";
    try {
      const origin =
        new URL(req.url).origin ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "https://taxchecknow.com";
      const cr = await fetch(`${origin}/api/rules/${product_id}`, {
        headers: { accept: "application/json" },
      });
      if (cr.ok) {
        const rules = await cr.json();
        const facts = rules.key_facts
          ? Object.entries(rules.key_facts)
              .map(([k, v]) => `- ${k.replace(/_/g, " ")}: ${v}`)
              .join("\n")
          : "";
        const errs = Array.isArray(rules.common_ai_errors)
          ? rules.common_ai_errors
              .map((e: { ai_says?: string; correct?: string }) => `- WRONG: ${e.ai_says}\n  RIGHT: ${e.correct}`)
              .join("\n")
          : "";
        corpusBlock = `
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
      } else {
        console.warn(`[assess] corpus fetch ${product_id} → ${cr.status}; proceeding ungrounded`);
      }
    } catch (e) {
      console.warn(`[assess] corpus fetch failed for ${product_id}; proceeding ungrounded`, e);
    }

    // Build required fields for the JSON response
    const fieldsList = [
      ...fields,
      "accountantQuestions",
      ...(isTier2 ? ["actions"] : []),
    ];

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
${(fields as string[]).map((f: string) => `"${f}": "2-3 sentence personalised value referencing their specific inputs"`).join(",\n")}${isTier2 ? `,
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
      console.error("Anthropic API error:", err);
      return NextResponse.json(
        { error: "Claude API call failed", details: err },
        { status: 500 }
      );
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";

    // Extract JSON more robustly — find first { and last }
    const firstBrace = text.indexOf("{");
    const lastBrace  = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) {
      console.error("No JSON object found in response:", text.slice(0, 200));
      return NextResponse.json(
        { error: "No JSON found in Claude response", raw: text.slice(0, 500) },
        { status: 500 }
      );
    }
    const clean = text.slice(firstBrace, lastBrace + 1);

    let assessment: Record<string, unknown>;
    try {
      assessment = JSON.parse(clean);
    } catch {
      console.error("JSON parse failed. Raw response:", clean);
      return NextResponse.json(
        { error: "Failed to parse Claude response as JSON", raw: clean },
        { status: 500 }
      );
    }

    return NextResponse.json({ assessment });

  } catch (err: unknown) {
    console.error("Assess API error:", err);
    return NextResponse.json(
      {
        error: "Assessment generation failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
