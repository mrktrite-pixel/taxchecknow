// Read-back of competitors + agent_log for competitor-monitor verification.
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
  const r = await sb.from("competitors")
    .select("id, name, url, country, weakness, our_advantage, found_at")
    .order("country", { ascending: true });
  console.log(`competitors: ${r.data?.length ?? 0} rows`);
  const byCountry: Record<string, number> = {};
  for (const row of r.data ?? []) byCountry[row.country] = (byCountry[row.country] ?? 0) + 1;
  console.log(`by country:`, byCountry);
  for (const row of r.data ?? []) {
    console.log(`  [${row.country}] ${row.name}`);
    console.log(`    ${row.url}`);
    console.log(`    weakness: ${row.weakness.slice(0, 100)}${row.weakness.length > 100 ? "…" : ""}`);
  }

  const a = await sb.from("agent_log")
    .select("id, bee_name, action, result, model_used, cost_usd, created_at")
    .eq("bee_name", "competitor-monitor");
  console.log(`\nagent_log (competitor-monitor): ${a.data?.length ?? 0} rows`);
  for (const row of a.data ?? []) {
    console.log(`  ${row.id}  ${row.action}  cost=$${row.cost_usd}  model=${row.model_used}`);
    console.log(`  result: ${row.result}`);
  }

  // sanity checks
  const badUrls = (r.data ?? []).filter((row: any) => !/^https?:\/\//.test(row.url));
  const badCountries = (r.data ?? []).filter((row: any) => !["AU","UK","US","NZ","CAN","Nomad"].includes(row.country));
  console.log(`\nbad urls: ${badUrls.length}, bad countries: ${badCountries.length}`);
})();
