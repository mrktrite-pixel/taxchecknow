// One-shot wrapper to fire distributionBee for the 5 G6 question pages.
// Loads .env.local + injects INDEXNOW_KEY.
// Usage: npx ts-node --project cole/tsconfig.json scripts/fire-distribution-bee-g6.ts
import * as fs   from "fs";
import * as path from "path";

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
process.env.INDEXNOW_KEY ??= "879c5718e8ab4114a247c1b85552331a";

import { distributionBee } from "../lib/distribution-bee";

const articles = [
  { slug: "do-i-need-an-ato-clearance-certificate-if-im-an-australian-resident-selling-my",  question: "Do I need an ATO clearance certificate if I'm an Australian resident selling my own house?" },
  { slug: "what-happens-if-i-dont-have-a-clearance-certificate-at-settlement-in-australia",   question: "What happens if I don't have a clearance certificate at settlement in Australia?" },
  { slug: "how-long-does-it-take-the-ato-to-issue-a-clearance-certificate",                    question: "How long does it take the ATO to issue a clearance certificate?" },
  { slug: "is-the-frcgw-threshold-really-0-from-1-january-2025",                                question: "Is the FRCGW threshold really $0 from 1 January 2025?" },
  { slug: "does-the-15-withholding-apply-to-the-sale-price-or-the-capital-gain",                question: "Does the 15% withholding apply to the sale price or the capital gain?" },
];

(async () => {
  const results = [];
  for (const a of articles) {
    const r = await distributionBee({
      url:         `https://www.taxchecknow.com/questions/${a.slug}`,
      pageType:    "question",
      slug:        a.slug,
      productKey:  "au-19-frcgw-clearance-certificate",
      country:     "AU",
      description: a.question,
    });
    results.push(r);
    console.log(`${a.slug.slice(0, 60).padEnd(60)} | indexnow=${r.indexnow_pinged} google=${r.google_pinged} logged=${r.logged} errors=${r.errors.length}`);
  }
  const indexnowOk = results.filter(r => r.indexnow_pinged).length;
  const loggedOk    = results.filter(r => r.logged).length;
  console.log(`\nSummary: ${indexnowOk}/${articles.length} IndexNow pinged · ${loggedOk}/${articles.length} logged to Supabase`);
  if (results.some(r => r.errors.length > 0)) {
    console.log("\nErrors:");
    for (const r of results) if (r.errors.length) console.log(`  ${r.url}: ${r.errors.join("; ")}`);
  }
})();
