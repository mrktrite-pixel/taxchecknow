// One-shot wrapper to fire lib/distribution-bee for a single URL.
// Loads .env.local + injects INDEXNOW_KEY (not normally in local env).
// Usage: npx ts-node --project cole/tsconfig.json scripts/fire-distribution-bee.ts
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

// IndexNow key — rotated key from earlier in this session.
// In production this should live in Vercel env (and ideally also .env.local).
process.env.INDEXNOW_KEY ??= "879c5718e8ab4114a247c1b85552331a";

import { distributionBee } from "../lib/distribution-bee";

distributionBee({
  url:         "https://www.taxchecknow.com/au/check/frcgw-clearance-certificate",
  pageType:    "product",
  slug:        "frcgw-clearance-certificate",
  productKey:  "au-19-frcgw-clearance-certificate",
  country:     "AU",
  description: "FRCGW clearance certificate — ATO 15% withholding on Australian property sales from 1 Jan 2025",
}).then(r => {
  console.log(JSON.stringify(r, null, 2));
}).catch(e => {
  console.error(e);
  process.exit(1);
});
