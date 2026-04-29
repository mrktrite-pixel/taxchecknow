// Read-back of psychology_insights + agent_log for customer-psychologist verification.
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
  const r = await sb.from("psychology_insights")
    .select("id, product_key, best_fear_format, best_fear_number, converting_demographic, best_utm_source, conversion_rate, insight, created_at")
    .order("product_key", { ascending: true });
  console.log(`psychology_insights: ${r.data?.length ?? 0} rows`);
  for (const row of r.data ?? []) {
    const baseline = row.insight?.startsWith("ASSUMED");
    console.log(`  ${row.product_key.padEnd(18)} fear=${row.best_fear_number.padEnd(12)} format=${row.best_fear_format.padEnd(14)} src=${row.best_utm_source.padEnd(10)} cr=${row.conversion_rate} ${baseline ? "[BASELINE]" : "[DATA]"}`);
    console.log(`    demo: ${row.converting_demographic}`);
    console.log(`    insight: ${row.insight.slice(0, 140)}${row.insight.length > 140 ? "…" : ""}`);
  }

  const a = await sb.from("agent_log")
    .select("id, bee_name, action, result, model_used, cost_usd, created_at")
    .eq("bee_name", "customer-psychologist");
  console.log(`\nagent_log (customer-psychologist): ${a.data?.length ?? 0} rows`);
  for (const row of a.data ?? []) {
    console.log(`  ${row.id}  ${row.action}  cost=$${row.cost_usd}  model=${row.model_used}`);
    console.log(`  result: ${row.result}`);
  }
})();
