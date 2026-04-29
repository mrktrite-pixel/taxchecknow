// Citation Gap Finder writer.
// Reads JSON array from stdin, validates against the gap_queue schema,
// inserts rows, logs the run to agent_log, and prints a summary.
//
// Usage:
//   echo '[{"topic":"...","site":"...","ai_error":"...",...}]' \
//     | npx ts-node --project cole/tsconfig.json scripts/cole-insert-gaps.ts
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

type Gap = {
  topic: string;
  site: string;
  ai_error: string;
  correct_law: string;
  search_volume: number;
  urgency: "low" | "medium" | "high";
  recommended_product: string;
};

const REQUIRED: (keyof Gap)[] = [
  "topic", "site", "ai_error", "correct_law",
  "search_volume", "urgency", "recommended_product",
];

function validate(g: any, idx: number): string | null {
  for (const k of REQUIRED) {
    if (g[k] === undefined || g[k] === null || g[k] === "") {
      return `gap[${idx}] missing required field: ${String(k)}`;
    }
  }
  if (!["low", "medium", "high"].includes(g.urgency)) {
    return `gap[${idx}] urgency must be low|medium|high (got: ${g.urgency})`;
  }
  if (typeof g.search_volume !== "number") {
    return `gap[${idx}] search_volume must be a number (got: ${typeof g.search_volume})`;
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

  let gaps: any[];
  try {
    const clean = raw.replace(/^﻿/, "").trim();
    gaps = JSON.parse(clean);
  } catch (e: any) {
    console.error(`ERROR: stdin is not valid JSON: ${e.message}`);
    process.exit(2);
  }
  if (!Array.isArray(gaps)) {
    console.error("ERROR: stdin must be a JSON array of gap objects");
    process.exit(2);
  }

  for (let i = 0; i < gaps.length; i++) {
    const err = validate(gaps[i], i);
    if (err) { console.error(`ERROR: ${err}`); process.exit(2); }
  }

  // dedupe by exact topic+site against existing rows
  const { data: existing } = await sb
    .from("gap_queue")
    .select("topic, site");
  const seen = new Set<string>(
    (existing ?? []).map((r: any) => `${r.topic.toLowerCase()}|${r.site.toLowerCase()}`),
  );
  const fresh: Gap[] = [];
  const skipped: Gap[] = [];
  for (const g of gaps as Gap[]) {
    const key = `${g.topic.toLowerCase()}|${g.site.toLowerCase()}`;
    if (seen.has(key)) skipped.push(g); else { fresh.push(g); seen.add(key); }
  }

  if (fresh.length === 0) {
    console.log(JSON.stringify({ inserted: 0, skipped_dupes: skipped.length, ids: [] }, null, 2));
    return;
  }

  const { data: inserted, error } = await sb
    .from("gap_queue")
    .insert(fresh)
    .select("id, topic, site, urgency");
  if (error) {
    console.error(`ERROR inserting gap_queue: ${error.message}`);
    process.exit(3);
  }

  // Log the run to agent_log
  const { error: logErr } = await sb.from("agent_log").insert({
    bee_name: "citation-gap-finder",
    action: "insert_gaps",
    result: JSON.stringify({
      inserted: inserted?.length ?? 0,
      skipped_dupes: skipped.length,
      ids: (inserted ?? []).map((r: any) => r.id),
    }),
    model_used: "claude-sonnet-4-6",
  });
  if (logErr) {
    console.error(`WARN: agent_log write failed: ${logErr.message}`);
  }

  console.log(JSON.stringify({
    inserted: inserted?.length ?? 0,
    skipped_dupes: skipped.length,
    ids: (inserted ?? []).map((r: any) => r.id),
    rows: inserted,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
