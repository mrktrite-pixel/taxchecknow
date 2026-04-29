// Generic agent_log writer — reusable across any bee that doesn't have
// its own primary insert helper.
//
// Usage:
//   echo '{"bee_name":"...","action":"...","result":"...","cost_usd":0.02,"model_used":"..."}' \
//     | npx ts-node --project cole/tsconfig.json scripts/cole-agent-log.ts
//
// Optional: product_key, job_id, tokens_used.
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

const ALLOWED = new Set([
  "bee_name", "job_id", "product_key", "action",
  "result", "model_used", "tokens_used", "cost_usd",
]);

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
  if (!payload.bee_name || !payload.action) {
    console.error("ERROR: bee_name and action are required");
    process.exit(2);
  }
  const row: any = {};
  for (const k of Object.keys(payload)) {
    if (ALLOWED.has(k)) row[k] = payload[k];
  }
  const { data, error } = await sb.from("agent_log").insert(row).select();
  if (error) { console.error(`ERROR agent_log insert: ${error.message}`); process.exit(3); }
  console.log(JSON.stringify({ inserted: 1, id: data[0].id }, null, 2));
})();
