// Quick read of psychology_insights for context.
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
  const { data, error } = await sb.from("psychology_insights")
    .select("product_key, best_fear_format, best_fear_number, converting_demographic, best_utm_source, conversion_rate, insight")
    .order("product_key");
  if (error) { console.error(error.message); process.exit(1); }
  console.log(`${data?.length ?? 0} rows`);
  for (const r of (data ?? [])) {
    console.log(`  ${r.product_key.padEnd(28)} | ${r.best_fear_format.padEnd(14)} | ${String(r.best_fear_number).padEnd(12)} | ${r.best_utm_source.padEnd(10)} | ${r.converting_demographic}`);
  }
})();
