// Probe competitors schema by inserting a minimal row, printing keys, then deleting.
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
  console.log("=== empty insert ===");
  const empty = await sb.from("competitors").insert({}).select();
  if (empty.error) {
    console.log(`err: ${empty.error.message}`);
    console.log(`details: ${empty.error.details ?? "—"}`);
  } else {
    console.log(`columns: ${Object.keys(empty.data[0]).join(", ")}`);
    console.log(`row: ${JSON.stringify(empty.data[0])}`);
    if (empty.data[0]?.id) await sb.from("competitors").delete().eq("id", empty.data[0].id);
  }

  console.log("\n=== spec'd insert ===");
  const probe = await sb.from("competitors").insert({
    name: "PROBE",
    url: "https://example.com",
    country: "AU",
    weakness: "probe",
    our_advantage: "probe",
  }).select();
  if (probe.error) {
    console.log(`err: ${probe.error.message}`);
    console.log(`details: ${probe.error.details ?? "—"}`);
  } else {
    console.log(`columns: ${Object.keys(probe.data[0]).join(", ")}`);
    console.log(`row: ${JSON.stringify(probe.data[0])}`);
    if (probe.data[0]?.id) await sb.from("competitors").delete().eq("id", probe.data[0].id);
  }
})();
