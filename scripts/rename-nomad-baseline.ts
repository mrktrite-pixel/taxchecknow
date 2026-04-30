// One-shot — rename psychology_insights.product_key Nomad_baseline → NOMAD_baseline.
// Aligns casing with AU_baseline, CAN_baseline, NZ_baseline, UK_baseline, US_baseline.
import * as fs   from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any;

(async () => {
  // Pre-flight — both rows shouldn't exist
  const { data: existingNew } = await sb.from("psychology_insights")
    .select("id").eq("product_key", "NOMAD_baseline").maybeSingle();
  if (existingNew) {
    console.error(`NOMAD_baseline already exists (id ${existingNew.id}). Aborting to avoid duplicate-key collision.`);
    process.exit(1);
  }

  const { data, error } = await sb.from("psychology_insights")
    .update({ product_key: "NOMAD_baseline" })
    .eq("product_key", "Nomad_baseline")
    .select("id, product_key, best_fear_number, conversion_rate");
  if (error) { console.error(error.message); process.exit(1); }
  if (!data || data.length === 0) { console.error("No row matched product_key='Nomad_baseline'"); process.exit(1); }

  console.log(`Renamed ${data.length} row(s):`);
  for (const r of data) console.log(`  ${r.id}  →  ${r.product_key}  (fear: ${r.best_fear_number})`);

  // Log to agent_log for audit trail
  await sb.from("agent_log").insert({
    bee_name:    "customer-psychologist",
    action:      "psychology_rename",
    result:       `Renamed Nomad_baseline → NOMAD_baseline (casing alignment with AU_/CAN_/NZ_/UK_/US_baseline)`,
    cost_usd:      0,
    model_used:    "n/a",
  });
})();
