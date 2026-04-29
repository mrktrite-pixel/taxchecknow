// Customer Psychologist writer.
// Reads JSON array from stdin, validates, inserts into psychology_insights,
// writes one agent_log row, prints summary JSON.
//
// Usage:
//   echo '[{"product_key":"AU_baseline","best_fear_format":"dollar_amount", ...}]' \
//     | npx ts-node --project cole/tsconfig.json scripts/cole-insert-insights.ts
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

type Insight = {
  product_key: string;
  best_fear_format: "dollar_amount" | "percentage" | "time" | "story";
  best_fear_number: string;
  converting_demographic: string;
  best_utm_source: string;
  conversion_rate: number;
  insight: string;
};

const REQUIRED: (keyof Insight)[] = [
  "product_key", "best_fear_format", "best_fear_number",
  "converting_demographic", "best_utm_source", "conversion_rate", "insight",
];

const FEAR_FORMATS = new Set(["dollar_amount", "percentage", "time", "story"]);

function validate(it: any, idx: number): string | null {
  for (const k of REQUIRED) {
    if (it[k] === undefined || it[k] === null || it[k] === "") {
      return `insight[${idx}] missing required field: ${String(k)}`;
    }
  }
  if (!FEAR_FORMATS.has(it.best_fear_format)) {
    return `insight[${idx}] best_fear_format must be dollar_amount|percentage|time|story (got: ${it.best_fear_format})`;
  }
  if (typeof it.conversion_rate !== "number") {
    return `insight[${idx}] conversion_rate must be a number (got: ${typeof it.conversion_rate})`;
  }
  if (typeof it.insight !== "string" || it.insight.length < 20) {
    return `insight[${idx}] insight too short (must be a real synthesis sentence)`;
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
  if (!raw.trim()) { console.error("ERROR: no JSON received on stdin"); process.exit(2); }

  let insights: any[];
  try {
    const clean = raw.replace(/^﻿/, "").trim();
    insights = JSON.parse(clean);
  } catch (e: any) {
    console.error(`ERROR: stdin is not valid JSON: ${e.message}`);
    process.exit(2);
  }
  if (!Array.isArray(insights)) {
    console.error("ERROR: stdin must be a JSON array of insight objects");
    process.exit(2);
  }
  for (let i = 0; i < insights.length; i++) {
    const err = validate(insights[i], i);
    if (err) { console.error(`ERROR: ${err}`); process.exit(2); }
  }

  // dedupe by product_key — only one insight row per product at a time.
  // If product_key already has a row, skip (operator can DELETE first to refresh).
  const productKeys = Array.from(new Set(insights.map((q) => q.product_key)));
  const { data: existing } = await sb
    .from("psychology_insights")
    .select("product_key")
    .in("product_key", productKeys);
  const seen = new Set<string>((existing ?? []).map((r: any) => r.product_key));
  const fresh: Insight[] = [];
  const skipped: Insight[] = [];
  for (const it of insights as Insight[]) {
    if (seen.has(it.product_key)) skipped.push(it); else { fresh.push(it); seen.add(it.product_key); }
  }

  if (fresh.length === 0) {
    console.log(JSON.stringify({ inserted: 0, skipped_dupes: skipped.length, ids: [] }, null, 2));
    return;
  }

  const { data: inserted, error } = await sb
    .from("psychology_insights")
    .insert(fresh)
    .select("id, product_key, best_fear_format, best_fear_number, conversion_rate");
  if (error) {
    console.error(`ERROR inserting psychology_insights: ${error.message}`);
    process.exit(3);
  }

  const fromData = fresh.filter((i) => i.conversion_rate > 0).length;
  const fromBaseline = fresh.length - fromData;

  const { error: logErr } = await sb.from("agent_log").insert({
    bee_name: "customer-psychologist",
    action: "psychology_analysis",
    result: `${inserted?.length ?? 0} insights written (${fromData} from data, ${fromBaseline} from baseline assumptions)`,
    cost_usd: 0.02,
    model_used: "claude-sonnet-4-6",
  });
  if (logErr) console.error(`WARN: agent_log write failed: ${logErr.message}`);

  console.log(JSON.stringify({
    inserted: inserted?.length ?? 0,
    skipped_dupes: skipped.length,
    ids: (inserted ?? []).map((r: any) => r.id),
    from_data: fromData,
    from_baseline: fromBaseline,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
