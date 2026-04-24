// ── COLE ADMIN PORTAL ────────────────────────────────────────────────────
// Server component — read-only operations dashboard
// Access via /cole-admin-portal?key={ADMIN_SECRET}

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Supabase client typing is handled via `any` to avoid strict Postgrest generic noise on ad-hoc tables

interface Purchase {
  id:                string;
  created_at:        string;
  product_key:       string;
  tier:               number;
  amount_gbp:          number | null;
  currency:             string | null;
  customer_email:        string | null;
  country_code:            string | null;
  delivery_status:           string | null;
}

interface EmailLogRow {
  id:              string;
  created_at:        string;
  recipient_email:    string | null;
  email_type:          string | null;
  subject:              string | null;
  status:                 string | null;
  product_key:             string | null;
}

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return "-";
  const symbol = (currency ?? "aud").toLowerCase() === "gbp" ? "£" : (currency ?? "aud").toLowerCase() === "eur" ? "€" : "$";
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function fetchData(supabase: any) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

  const [todayRes, recentRes, last30Res, emailRes] = await Promise.all([
    supabase.from("purchases").select("tier, amount_gbp, country_code, currency").gte("created_at", todayIso),
    supabase.from("purchases").select("id, created_at, product_key, tier, amount_gbp, currency, customer_email, country_code, delivery_status").order("created_at", { ascending: false }).limit(50),
    supabase.from("purchases").select("product_key, tier, amount_gbp").gte("created_at", thirtyDaysAgoIso),
    supabase.from("email_log").select("id, created_at, recipient_email, email_type, subject, status, product_key").order("created_at", { ascending: false }).limit(50),
  ]);

  return {
    todayPurchases:   (todayRes.data ?? []) as Pick<Purchase, "tier" | "amount_gbp" | "country_code" | "currency">[],
    recentPurchases:    (recentRes.data ?? []) as Purchase[],
    last30Purchases:      (last30Res.data ?? []) as Pick<Purchase, "product_key" | "tier" | "amount_gbp">[],
    emailLog:                (emailRes.data ?? []) as EmailLogRow[],
  };
}

export default async function AdminPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const secret = params.key;
  const expected = process.env.ADMIN_SECRET;

  if (!expected || secret !== expected) {
    redirect("/");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return (
      <main className="min-h-screen bg-neutral-50 px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-4 font-serif text-3xl font-bold text-neutral-950">COLE Admin Portal</h1>
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Supabase environment variables not configured. Cannot load data.
          </p>
        </div>
      </main>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const data = await fetchData(supabase);

  // ── SECTION 1 — today stats ───────────────────────────────────────────
  const todayRevenue = data.todayPurchases.reduce((sum, p) => sum + (p.amount_gbp ?? 0), 0);
  const todayCount = data.todayPurchases.length;
  const byCountry = data.todayPurchases.reduce<Record<string, number>>((acc, p) => {
    const c = p.country_code ?? "??";
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});
  const tier67Count = data.todayPurchases.filter(p => p.tier === 67).length;
  const tier147Count = data.todayPurchases.filter(p => p.tier === 147).length;

  // ── SECTION 3 — revenue by product (30 days) ──────────────────────────
  const productAgg = data.last30Purchases.reduce<Record<string, { t67: number; t147: number; total: number }>>((acc, p) => {
    const key = p.product_key ?? "unknown";
    if (!acc[key]) acc[key] = { t67: 0, t147: 0, total: 0 };
    if (p.tier === 67)  acc[key].t67  += 1;
    if (p.tier === 147) acc[key].t147 += 1;
    acc[key].total += p.amount_gbp ?? 0;
    return acc;
  }, {});
  const productRows = Object.entries(productAgg)
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.total - a.total);

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">

        <header>
          <h1 className="font-serif text-3xl font-bold text-neutral-950">COLE Admin Portal</h1>
          <p className="mt-1 text-sm text-neutral-500">TaxCheckNow operations dashboard · {new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}</p>
        </header>

        {/* SECTION 1 — Today at a glance */}
        <section>
          <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">1. Today at a glance</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Revenue today" value={`£${Math.round(todayRevenue).toLocaleString()}`} />
            <StatCard label="Purchases today" value={String(todayCount)} />
            <StatCard label="$67 tier" value={String(tier67Count)} />
            <StatCard label="$147 tier" value={String(tier147Count)} />
          </div>
          {Object.keys(byCountry).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(byCountry).map(([country, count]) => (
                <span key={country} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700">
                  <span className="font-mono font-bold">{country}</span> · {count}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 2 — Recent purchases */}
        <section>
          <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">2. Recent purchases (last 50)</h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Time</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Product</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Tier</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600 text-right">Amount</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Email</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Delivery</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPurchases.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-neutral-400">No purchases yet</td></tr>
                )}
                {data.recentPurchases.map(p => {
                  const rowBg = p.delivery_status === "failed" ? "bg-red-50"
                              : p.delivery_status === "pending" ? "bg-amber-50"
                              : "bg-white";
                  return (
                    <tr key={p.id} className={`border-b border-neutral-100 ${rowBg}`}>
                      <td className="px-3 py-2 font-mono text-neutral-500">{formatTime(p.created_at)}</td>
                      <td className="px-3 py-2 text-neutral-900">{p.product_key}</td>
                      <td className="px-3 py-2 text-neutral-700">${p.tier}</td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-900">{formatMoney(p.amount_gbp, p.currency)}</td>
                      <td className="px-3 py-2 text-neutral-700">{p.customer_email ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          p.delivery_status === "sent"   ? "bg-emerald-100 text-emerald-700"
                        : p.delivery_status === "failed" ? "bg-red-100 text-red-700"
                        : p.delivery_status === "pending"? "bg-amber-100 text-amber-700"
                        : "bg-neutral-100 text-neutral-700"
                        }`}>{p.delivery_status ?? "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 3 — Revenue by product (30 days) */}
        <section>
          <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">3. Revenue by product (last 30 days)</h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Product</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600 text-right">$67</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600 text-right">$147</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {productRows.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-400">No purchases in the last 30 days</td></tr>
                )}
                {productRows.map(r => (
                  <tr key={r.key} className="border-b border-neutral-100">
                    <td className="px-3 py-2 text-neutral-900">{r.key}</td>
                    <td className="px-3 py-2 text-right font-mono text-neutral-700">{r.t67}</td>
                    <td className="px-3 py-2 text-right font-mono text-neutral-700">{r.t147}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-neutral-900">£{Math.round(r.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 4 — Email log */}
        <section>
          <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-neutral-500">4. Email log (last 50)</h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Time</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Product</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Email</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Type</th>
                  <th className="px-3 py-2 font-semibold text-neutral-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.emailLog.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">No email log entries</td></tr>
                )}
                {data.emailLog.map(e => {
                  const rowBg = e.status === "failed" ? "bg-red-50" : "bg-white";
                  return (
                    <tr key={e.id} className={`border-b border-neutral-100 ${rowBg}`}>
                      <td className="px-3 py-2 font-mono text-neutral-500">{formatTime(e.created_at)}</td>
                      <td className="px-3 py-2 text-neutral-900">{e.product_key ?? "-"}</td>
                      <td className="px-3 py-2 text-neutral-700">{e.recipient_email ?? "-"}</td>
                      <td className="px-3 py-2 text-neutral-700">{e.email_type ?? "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          e.status === "sent"     ? "bg-emerald-100 text-emerald-700"
                        : e.status === "failed"   ? "bg-red-100 text-red-700"
                        : e.status === "queued"   ? "bg-amber-100 text-amber-700"
                        : e.status === "captured" ? "bg-blue-100 text-blue-700"
                        : "bg-neutral-100 text-neutral-700"
                        }`}>{e.status ?? "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">{label}</p>
      <p className="font-serif text-2xl font-bold text-neutral-950">{value}</p>
    </div>
  );
}
