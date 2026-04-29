// Probe research_questions schema by inserting a minimal row, printing the keys, then deleting.
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
  // Step 1: empty insert to discover columns and required fields
  console.log("--- empty insert ---");
  const empty = await sb.from("research_questions").insert({}).select();
  if (empty.error) {
    console.log(`  ${empty.error.message}`);
    console.log(`  details: ${empty.error.details ?? "—"}`);
  } else {
    console.log(`  columns: ${Object.keys(empty.data[0]).join(", ")}`);
    console.log(`  row: ${JSON.stringify(empty.data[0])}`);
    if (empty.data[0]?.id) await sb.from("research_questions").delete().eq("id", empty.data[0].id);
  }

  // Step 2: spec'd insert
  console.log("\n--- spec'd insert ---");
  const probe = await sb.from("research_questions").insert({
    product_key: "PROBE",
    question: "Probe — schema discovery",
    search_volume: 0,
    source: "generated",
    article_published: false,
  }).select();
  if (probe.error) {
    console.log(`  ${probe.error.message}`);
    console.log(`  details: ${probe.error.details ?? "—"}`);
  } else {
    console.log(`  columns: ${Object.keys(probe.data[0]).join(", ")}`);
    console.log(`  row: ${JSON.stringify(probe.data[0])}`);
    if (probe.data[0]?.id) await sb.from("research_questions").delete().eq("id", probe.data[0].id);
  }
})();
