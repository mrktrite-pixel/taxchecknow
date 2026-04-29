// Read-back of research_questions for one product_key + agent_log verification.
// Usage: npx ts-node --project cole/tsconfig.json scripts/cole-rq-show.ts <product_key>
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

const productKey = process.argv[2];
if (!productKey) { console.error("usage: cole-rq-show.ts <product_key>"); process.exit(2); }

(async () => {
  const r = await sb.from("research_questions")
    .select("id, product_key, question, search_volume, source, article_published, created_at")
    .eq("product_key", productKey)
    .order("search_volume", { ascending: false });
  console.log(`research_questions for ${productKey}: ${r.data?.length ?? 0} rows`);
  const bySource: Record<string, number> = {};
  for (const row of r.data ?? []) bySource[row.source] = (bySource[row.source] ?? 0) + 1;
  console.log(`by source:`, bySource);
  console.log(`top 5 by volume:`);
  for (const row of (r.data ?? []).slice(0, 5)) {
    console.log(`  [${row.source}, vol=${row.search_volume}] ${row.question}`);
  }
  console.log(`bottom 5 by volume:`);
  for (const row of (r.data ?? []).slice(-5)) {
    console.log(`  [${row.source}, vol=${row.search_volume}] ${row.question}`);
  }
  // sanity: every row ends with ?
  const malformed = (r.data ?? []).filter((row: any) => !row.question.trim().endsWith("?"));
  console.log(`malformed (no trailing '?'): ${malformed.length}`);

  const a = await sb.from("agent_log")
    .select("id, bee_name, action, product_key, result, model_used, cost_usd, created_at")
    .eq("bee_name", "market-researcher")
    .eq("product_key", productKey);
  console.log(`\nagent_log (market-researcher × ${productKey}): ${a.data?.length ?? 0} rows`);
  for (const row of a.data ?? []) {
    console.log(`  ${row.id}  ${row.action}  ${row.result}  cost=$${row.cost_usd}  model=${row.model_used}`);
  }
})();
