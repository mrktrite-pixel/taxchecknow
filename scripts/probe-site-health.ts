// Probe whether site_health table exists.
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
  const probe = await sb.from("site_health").select("id", { count: "exact", head: true });
  if (probe.error) {
    console.log(`site_health: NOT REACHABLE — ${probe.error.message}`);
    process.exit(1);
  } else {
    console.log(`site_health: reachable, ${probe.count ?? 0} rows`);
  }
})();
