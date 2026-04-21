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

    // Build required fields for the JSON response
    const fieldsList = [
      ...fields,
      "accountantQuestions",
      ...(isTier2 ? ["actions"] : []),
    ];

    const prompt = `You are a ${market} ${authority} tax expert writing a personalised ${isTier2 ? "action plan" : "tax assessment"} for ${displayName}.

THEIR CALCULATOR ANSWERS:
${inputsSummary}

YOUR JOB:
Write a personalised, specific assessment for this exact person based on their answers above.
- Use ${market} tax terminology throughout
- Reference ${authority} rules, thresholds, and legislation specifically
- Use their name (${displayName}) naturally in the text
- Reference their specific numbers — do not give generic advice
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
        model: "claude-sonnet-4-6",
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
    const clean = text.replace(/```json|```/g, "").trim();

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
