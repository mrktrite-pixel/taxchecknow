// Market Researcher writer.
// Reads JSON array from stdin, validates, inserts into research_questions,
// writes one agent_log row, prints summary JSON.
//
// Usage:
//   echo '[{"product_key":"...","question":"...","search_volume":1200,"source":"reddit"}, ...]' \
//     | npx ts-node --project cole/tsconfig.json scripts/cole-insert-questions.ts
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
) as any;

type Question = {
  product_key: string;
  question: string;
  search_volume: number;
  source: "reddit" | "google" | "generated";
};

const REQUIRED: (keyof Question)[] = ["product_key", "question", "search_volume", "source"];
const SOURCES = new Set(["reddit", "google", "generated"]);

function validate(q: any, idx: number): string | null {
  for (const k of REQUIRED) {
    if (q[k] === undefined || q[k] === null || q[k] === "") {
      return `q[${idx}] missing required field: ${String(k)}`;
    }
  }
  if (typeof q.search_volume !== "number") {
    return `q[${idx}] search_volume must be a number (got: ${typeof q.search_volume})`;
  }
  if (!SOURCES.has(q.source)) {
    return `q[${idx}] source must be reddit|google|generated (got: ${q.source})`;
  }
  if (typeof q.question !== "string" || q.question.length < 8) {
    return `q[${idx}] question too short (must be a real-person sentence)`;
  }
  return null;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (buf += c));
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    console.error("ERROR: no JSON received on stdin");
    process.exit(2);
  }

  let questions: any[];
  try {
    const clean = raw.replace(/^﻿/, "").trim();
    questions = JSON.parse(clean);
  } catch (e: any) {
    console.error(`ERROR: stdin is not valid JSON: ${e.message}`);
    process.exit(2);
  }
  if (!Array.isArray(questions)) {
    console.error("ERROR: stdin must be a JSON array of question objects");
    process.exit(2);
  }
  for (let i = 0; i < questions.length; i++) {
    const err = validate(questions[i], i);
    if (err) { console.error(`ERROR: ${err}`); process.exit(2); }
  }

  // dedupe by product_key + lowercased question against existing rows
  const productKeys = Array.from(new Set(questions.map((q) => q.product_key)));
  const { data: existing } = await sb
    .from("research_questions")
    .select("product_key, question")
    .in("product_key", productKeys);
  const seen = new Set<string>(
    (existing ?? []).map((r: any) => `${r.product_key}|${r.question.toLowerCase().trim()}`),
  );

  const fresh: Question[] = [];
  const skipped: Question[] = [];
  for (const q of questions as Question[]) {
    const key = `${q.product_key}|${q.question.toLowerCase().trim()}`;
    if (seen.has(key)) skipped.push(q); else { fresh.push(q); seen.add(key); }
  }

  if (fresh.length === 0) {
    console.log(JSON.stringify({ inserted: 0, skipped_dupes: skipped.length, ids: [] }, null, 2));
    return;
  }

  // Sort fresh by search_volume desc so the order in the table reflects priority
  fresh.sort((a, b) => b.search_volume - a.search_volume);

  const payload = fresh.map((q) => ({
    product_key: q.product_key,
    question: q.question,
    search_volume: q.search_volume,
    source: q.source,
    article_published: false,
  }));

  const { data: inserted, error } = await sb
    .from("research_questions")
    .insert(payload)
    .select("id, product_key, question, search_volume, source");
  if (error) {
    console.error(`ERROR inserting research_questions: ${error.message}`);
    process.exit(3);
  }

  // Log the run
  const product_key = productKeys.length === 1 ? productKeys[0] : null;
  const { error: logErr } = await sb.from("agent_log").insert({
    bee_name: "market-researcher",
    action: "question_scan",
    product_key,
    result: `${inserted?.length ?? 0} questions found`,
    cost_usd: 0.015,
    model_used: "claude-sonnet-4-6",
  });
  if (logErr) console.error(`WARN: agent_log write failed: ${logErr.message}`);

  console.log(JSON.stringify({
    inserted: inserted?.length ?? 0,
    skipped_dupes: skipped.length,
    ids: (inserted ?? []).map((r: any) => r.id),
    by_source: payload.reduce((acc: any, p) => { acc[p.source] = (acc[p.source] ?? 0) + 1; return acc; }, {}),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
