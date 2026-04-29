// Research Manager — apply decisions.
// Reads a JSON object from stdin: { decisions: [{id, status, summary, checks?}, ...] }
// For each decision: UPDATE gap_queue.status. Then writes ONE agent_log row
// with the aggregate summary string. Prints summary JSON.
//
// Usage:
//   echo '{"decisions":[{"id":"...","status":"approved","summary":"..."}]}' \
//     | npx ts-node --project cole/tsconfig.json scripts/cole-rm-apply.ts
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(__dirname, "../.env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
) as any;

type Decision = {
  id: string;
  status: "approved" | "needs_review";
  topic?: string;
  summary: string;
  checks?: Record<string, "PASS" | "FAIL">;
};

const VALID_STATUS = new Set(["approved", "needs_review"]);

function validate(d: any, idx: number): string | null {
  if (!d.id) return `decisions[${idx}] missing id`;
  if (!VALID_STATUS.has(d.status)) return `decisions[${idx}] status must be approved|needs_review (got: ${d.status})`;
  if (typeof d.summary !== "string" || d.summary.length < 10) return `decisions[${idx}] summary too short`;
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

(async () => {
  const raw = await readStdin();
  if (!raw.trim()) { console.error("ERROR: no JSON received on stdin"); process.exit(2); }

  let payload: any;
  try {
    const clean = raw.replace(/^﻿/, "").trim();
    payload = JSON.parse(clean);
  } catch (e: any) {
    console.error(`ERROR: stdin is not valid JSON: ${e.message}`);
    process.exit(2);
  }

  const decisions: Decision[] = payload.decisions ?? [];
  if (!Array.isArray(decisions) || decisions.length === 0) {
    console.error("ERROR: payload.decisions must be a non-empty array");
    process.exit(2);
  }
  for (let i = 0; i < decisions.length; i++) {
    const err = validate(decisions[i], i);
    if (err) { console.error(`ERROR: ${err}`); process.exit(2); }
  }

  // Apply each decision
  const applied: any[] = [];
  let approved = 0, needsReview = 0;
  for (const d of decisions) {
    const upd = await sb.from("gap_queue").update({ status: d.status }).eq("id", d.id).select("id, topic, recommended_product, status");
    if (upd.error) {
      console.error(`ERROR updating ${d.id}: ${upd.error.message}`);
      process.exit(3);
    }
    if (!upd.data || upd.data.length === 0) {
      console.error(`ERROR: gap_queue id ${d.id} not found`);
      process.exit(3);
    }
    applied.push({ ...upd.data[0], summary: d.summary, checks: d.checks });
    if (d.status === "approved") approved += 1; else needsReview += 1;
  }

  // Compose aggregate result string for the single agent_log row.
  const summaryString = decisions.map((d) => `${d.status === "approved" ? "APPROVED" : "REJECTED"}: ${d.topic ?? d.id} — ${d.summary}`).join(" | ");

  const log = await sb.from("agent_log").insert({
    bee_name: "research-manager",
    action: "quality_check",
    result: summaryString.length > 1500 ? summaryString.slice(0, 1500) + "…" : summaryString,
    cost_usd: 0.002,
    model_used: "claude-haiku-4-5",
  }).select("id");
  if (log.error) console.error(`WARN: agent_log write failed: ${log.error.message}`);

  console.log(JSON.stringify({
    reviewed: decisions.length,
    approved,
    needs_review: needsReview,
    log_id: log.data?.[0]?.id ?? null,
    details: applied,
  }, null, 2));
})();
