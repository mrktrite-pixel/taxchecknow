// One-shot — migrate G7 email templates JSON into email_templates table.
// Usage: npx ts-node --project cole/tsconfig.json scripts/migrate-email-templates-au19.ts
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb  = createClient(url, key) as any;

const JSON_PATH = path.join(__dirname, "../video-inbox/email-templates-au-19-frcgw-clearance-certificate.json");

interface Template {
  product_key: string;
  email_type:  string;
  subject:     string;
  body:        string;
  market:      string;
}

(async () => {
  const templates: Template[] = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  console.log(`Loaded ${templates.length} templates from JSON`);

  // Pre-flight: confirm table exists
  const probe = await sb.from("email_templates").select("id", { count: "exact", head: true });
  if (probe.error) {
    console.error(`\n❌ email_templates table is not accessible: ${probe.error.message}`);
    console.error(`\nRun this SQL in the Supabase dashboard SQL editor first:\n`);
    console.error(`CREATE TABLE email_templates (`);
    console.error(`  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),`);
    console.error(`  product_key TEXT NOT NULL,`);
    console.error(`  email_type TEXT NOT NULL,`);
    console.error(`  subject TEXT NOT NULL,`);
    console.error(`  body TEXT NOT NULL,`);
    console.error(`  market TEXT NOT NULL DEFAULT 'Australia',`);
    console.error(`  created_at TIMESTAMPTZ DEFAULT now(),`);
    console.error(`  updated_at TIMESTAMPTZ DEFAULT now()`);
    console.error(`);`);
    console.error(`CREATE UNIQUE INDEX email_templates_product_type_idx`);
    console.error(`  ON email_templates(product_key, email_type);`);
    process.exit(1);
  }
  console.log(`Table reachable. Existing row count: ${probe.count ?? 0}`);

  // Upsert by (product_key, email_type) so re-runs are idempotent
  const { error: upsertErr } = await sb
    .from("email_templates")
    .upsert(templates, { onConflict: "product_key,email_type" });

  if (upsertErr) {
    console.error(`\n❌ Upsert failed: ${upsertErr.message}`);
    process.exit(1);
  }

  // Verify
  const { count } = await sb
    .from("email_templates")
    .select("id", { count: "exact", head: true })
    .eq("product_key", "au_67_frcgw_clearance_certificate");
  const { count: t147Count } = await sb
    .from("email_templates")
    .select("id", { count: "exact", head: true })
    .eq("product_key", "au_147_frcgw_clearance_certificate");

  console.log(`\n✅ Migration complete`);
  console.log(`   au_67_frcgw_clearance_certificate:  ${count ?? 0} rows`);
  console.log(`   au_147_frcgw_clearance_certificate: ${t147Count ?? 0} rows`);
  console.log(`   Combined:                            ${(count ?? 0) + (t147Count ?? 0)} rows`);
})();
