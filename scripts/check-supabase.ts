// One-off diagnostic — count rows in purchases + email_queue + assessments tables.
import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb  = createClient(url, key) as any;

async function main() {
  for (const table of ["purchases", "assessments", "email_queue", "email_log", "decision_sessions", "leads"]) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`${table.padEnd(20)} ERROR: ${error.message}`);
    } else {
      console.log(`${table.padEnd(20)} ${count ?? 0} rows`);
    }
  }

  console.log("\n── recent purchases (most recent 10) ──");
  const { data: recent, error: rerr } = await sb
    .from("purchases")
    .select("id, created_at, product_key, tier, customer_email, delivery_status, amount_gbp")
    .order("created_at", { ascending: false })
    .limit(10);
  if (rerr) console.log(`  ERROR: ${rerr.message}`);
  else if (!recent || recent.length === 0) console.log("  (no rows)");
  else {
    for (const r of recent) {
      console.log(`  ${r.created_at}  ${r.product_key?.padEnd(40) ?? ""}  tier:${r.tier}  ${r.customer_email}  status:${r.delivery_status}  ${r.amount_gbp}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
