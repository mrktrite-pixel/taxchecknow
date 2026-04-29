// Research Manager — fetch pending gap_queue entries with the data the
// manager needs to run its 5 checks. Prints one JSON object to stdout.
//
// Usage:
//   npx ts-node --project cole/tsconfig.json scripts/cole-rm-fetch.ts
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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
  // Pick up both 'pending' (first review) and 'needs_review' (re-review after fix)
  const gaps = await sb.from("gap_queue")
    .select("id, topic, site, ai_error, correct_law, search_volume, urgency, recommended_product, status, created_at")
    .in("status", ["pending", "needs_review"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (gaps.error) { console.error(`ERROR: ${gaps.error.message}`); process.exit(3); }

  // For each pending gap, count research_questions matches by trying both the
  // dash form and the underscore form of recommended_product.
  const enriched: any[] = [];
  for (const g of (gaps.data ?? [])) {
    const slug = g.recommended_product ?? "";
    const variants = Array.from(new Set([slug, slug.replace(/-/g, "_")].filter(Boolean)));
    let total = 0;
    const matched: string[] = [];
    if (variants.length > 0) {
      const r = await sb.from("research_questions")
        .select("product_key", { count: "exact" })
        .in("product_key", variants);
      total = r.count ?? 0;
      matched.push(...(r.data ?? []).map((x: any) => x.product_key));
    }
    enriched.push({
      ...g,
      research_questions_count: total,
      research_questions_match: Array.from(new Set(matched)),
    });
  }

  // Load existing PRODUCTS.md keys so the agent can run Check 2 cheaply.
  let productsMdKeys: string[] = [];
  try {
    const productsPath = "C:\\Users\\MATTV\\CitationGap\\cole-marketing\\PRODUCTS.md";
    const productsRaw = fs.readFileSync(productsPath, "utf8");
    // PRODUCTS.md uses headers like "### au_67_cgt_main_residence_trap | CGT Main Residence Trap Engine"
    const re = /^###\s+([a-z][a-z0-9_]+)\s*\|/gim;
    let m: RegExpExecArray | null;
    while ((m = re.exec(productsRaw)) !== null) productsMdKeys.push(m[1]);
  } catch (e: any) {
    productsMdKeys = [];
  }

  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    pending_count: enriched.length,
    pending_gaps: enriched,
    products_md_keys: productsMdKeys,
  }, null, 2));
})();
