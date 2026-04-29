// Probe psychology_insights schema by inserting a minimal row, printing the keys, then deleting.
// Also inspect existing source tables (purchases / decision_sessions / leads) for current state.
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
  console.log("=== psychology_insights schema discovery ===");
  const empty = await sb.from("psychology_insights").insert({}).select();
  if (empty.error) {
    console.log(`empty insert: ${empty.error.message}`);
    console.log(`details: ${empty.error.details ?? "—"}`);
  } else {
    console.log(`empty insert OK; columns: ${Object.keys(empty.data[0]).join(", ")}`);
    console.log(`row: ${JSON.stringify(empty.data[0])}`);
    if (empty.data[0]?.id) await sb.from("psychology_insights").delete().eq("id", empty.data[0].id);
  }

  console.log("\n=== try spec'd payload ===");
  const probe = await sb.from("psychology_insights").insert({
    product_key: "PROBE",
    best_fear_format: "dollar_amount",
    best_fear_number: "$0",
    converting_demographic: "probe",
    best_utm_source: "probe",
    conversion_rate: 0,
    insight: "probe",
  }).select();
  if (probe.error) {
    console.log(`spec'd insert err: ${probe.error.message}`);
    console.log(`details: ${probe.error.details ?? "—"}`);
  } else {
    console.log(`spec'd OK; columns: ${Object.keys(probe.data[0]).join(", ")}`);
    console.log(`row: ${JSON.stringify(probe.data[0])}`);
    if (probe.data[0]?.id) await sb.from("psychology_insights").delete().eq("id", probe.data[0].id);
  }

  console.log("\n=== existing source-table state ===");
  for (const t of ["purchases", "decision_sessions", "leads"]) {
    const c = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`${t.padEnd(22)} ${c.error ? "ERR " + c.error.message : (c.count ?? 0) + " rows"}`);
  }
})();
