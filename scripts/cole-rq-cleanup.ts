// One-shot — delete any research_questions rows with product_key=null (probe leftovers).
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
  const r = await sb.from("research_questions").delete().is("product_key", null);
  console.log(r.error ? `ERR: ${r.error.message}` : "deleted null-product rows: ok");
  const c = await sb.from("research_questions").select("*", { count: "exact", head: true });
  console.log(`research_questions now: ${c.count ?? 0} rows`);
})();
