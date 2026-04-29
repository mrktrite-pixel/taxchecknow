// Analytics Reader snapshot — pulls weekly analytics inputs from Supabase
// and prints one JSON object to stdout. The analytics-reader agent consumes
// this JSON and synthesises PERFORMANCE.md.
//
// Usage:
//   npx ts-node --project cole/tsconfig.json scripts/cole-analytics-snapshot.ts
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

async function count(table: string): Promise<number> {
  const r = await sb.from(table).select("*", { count: "exact", head: true });
  if (r.error) return -1;
  return r.count ?? 0;
}

async function main() {
  // 1 — purchases (last 200, full row to allow synthesis)
  const purchases = await sb.from("purchases")
    .select("id, product_key, tier, amount_paid, amount_gbp, currency, status, country_code, customer_email, delivery_status, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(200);

  // 2 — leads (group counts by source proxy)
  const leadsAll = await sb.from("leads")
    .select("id, site, country_code, source_product_id, converted, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  // 3 — email_log (group counts by type+status)
  const emailAll = await sb.from("email_log")
    .select("id, email_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  // 4 — content_performance (recent + published count)
  const cp = await sb.from("content_performance")
    .select("id, url, page_type, slug, product_key, country, indexnow_pinged, google_pinged, published_at, status")
    .order("published_at", { ascending: false })
    .limit(200);

  // 5 — psychology_insights (so report can reference E3 baseline)
  const pi = await sb.from("psychology_insights")
    .select("id, product_key, best_fear_format, best_fear_number, best_utm_source, conversion_rate, insight")
    .order("product_key", { ascending: true });

  // bee-counts that matter
  const counts = {
    purchases: await count("purchases"),
    leads: await count("leads"),
    email_log: await count("email_log"),
    content_performance: await count("content_performance"),
    psychology_insights: await count("psychology_insights"),
    competitors: await count("competitors"),
    gap_queue: await count("gap_queue"),
    research_questions: await count("research_questions"),
  };

  // Aggregations for the agent (keeps the prompt small)
  const purchaseRows = purchases.data ?? [];
  const revenue_total_gbp = purchaseRows.reduce((s: number, r: any) => s + Number(r.amount_gbp ?? 0), 0);
  const revenue_total_paid = purchaseRows.reduce((s: number, r: any) => s + Number(r.amount_paid ?? 0), 0);
  const by_product: Record<string, { count: number; revenue_gbp: number }> = {};
  for (const r of purchaseRows) {
    const k = r.product_key ?? "unknown";
    by_product[k] = by_product[k] ?? { count: 0, revenue_gbp: 0 };
    by_product[k].count += 1;
    by_product[k].revenue_gbp += Number(r.amount_gbp ?? 0);
  }

  const leads_by_site_country: Record<string, number> = {};
  for (const r of (leadsAll.data ?? [])) {
    const k = `${r.site ?? "?"}|${r.country_code ?? "?"}`;
    leads_by_site_country[k] = (leads_by_site_country[k] ?? 0) + 1;
  }

  const email_by_type_status: Record<string, number> = {};
  for (const r of (emailAll.data ?? [])) {
    const k = `${r.email_type ?? "?"}|${r.status ?? "?"}`;
    email_by_type_status[k] = (email_by_type_status[k] ?? 0) + 1;
  }

  const content_by_type: Record<string, number> = {};
  let indexnow_count = 0;
  let google_count = 0;
  for (const r of (cp.data ?? [])) {
    const k = r.page_type ?? "?";
    content_by_type[k] = (content_by_type[k] ?? 0) + 1;
    if (r.indexnow_pinged) indexnow_count += 1;
    if (r.google_pinged) google_count += 1;
  }

  const snapshot = {
    generated_at: new Date().toISOString(),
    counts,
    revenue: {
      total_gbp: Number(revenue_total_gbp.toFixed(2)),
      total_paid: Number(revenue_total_paid.toFixed(2)),
      by_product,
      products_sold: purchaseRows.length,
      currency_note: "amount_gbp is legacy column; amount_paid is actual paid amount in row.currency",
    },
    leads: {
      total: leadsAll.data?.length ?? 0,
      by_site_country: leads_by_site_country,
      converted: (leadsAll.data ?? []).filter((r: any) => r.converted).length,
    },
    email: {
      total: emailAll.data?.length ?? 0,
      by_type_status: email_by_type_status,
    },
    content_performance: {
      total: cp.data?.length ?? 0,
      by_page_type: content_by_type,
      indexnow_pinged: indexnow_count,
      google_pinged: google_count,
      recent: (cp.data ?? []).slice(0, 10),
    },
    psychology_insights: pi.data ?? [],
  };

  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
