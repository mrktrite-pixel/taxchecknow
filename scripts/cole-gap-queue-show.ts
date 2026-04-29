// Independent read-back of gap_queue + agent_log to verify Citation Gap Finder run.
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

(async () => {
  const g = await sb.from("gap_queue")
    .select("id, topic, site, urgency, recommended_product, correct_law, search_volume, status, created_at")
    .order("created_at", { ascending: true });
  console.log(`gap_queue: ${g.data?.length ?? 0} rows`);
  for (const r of g.data ?? []) {
    console.log(`  ${r.id}`);
    console.log(`    topic: ${r.topic}`);
    console.log(`    product: ${r.recommended_product}  | urgency: ${r.urgency}  | volume: ${r.search_volume}`);
    console.log(`    law: ${r.correct_law}`);
    console.log(`    status: ${r.status}  created: ${r.created_at}`);
  }
  const a = await sb.from("agent_log")
    .select("id, bee_name, action, result, model_used, created_at")
    .eq("bee_name", "citation-gap-finder");
  console.log(`\nagent_log (citation-gap-finder): ${a.data?.length ?? 0} rows`);
  for (const r of a.data ?? []) {
    console.log(`  ${r.id}  ${r.action}  model=${r.model_used}`);
    console.log(`  result: ${r.result}`);
  }
})();
