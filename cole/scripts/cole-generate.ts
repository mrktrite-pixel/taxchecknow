// ─────────────────────────────────────────────────────────────────────────────
// COLE — Main Generation Script
// Usage: npx ts-node cole/scripts/cole-generate.ts [product-id]
// Example: npx ts-node cole/scripts/cole-generate.ts uk-03
//
// What this does:
// 1. Loads config from cole/config/[product-id].ts
// 2. Calls all 5 generators in sequence
// 3. Writes all files to correct paths
// 4. Logs the run to Supabase cole_log table
// 5. Outputs next steps (Stripe, Vercel vars, monitor URLs)
// ─────────────────────────────────────────────────────────────────────────────

import * as fs   from "fs";
import * as path from "path";

import { generateGatePage,      getGatePagePath      } from "../generators/generate-gate-page";
import { generateCalculator,    getCalculatorPath     } from "../generators/generate-calculator";
import { generateSuccessAssess, getSuccessAssessPath,
         generateSuccessPlan,   getSuccessPlanPath   } from "../generators/generate-success-pages";
import { generateAllProductFiles, getProductFilePath  } from "../generators/generate-product-files";
import { generateRulesRoute,    getRulesRoutePath     } from "../generators/generate-rules-route";

import type { ProductConfig } from "../types/product-config";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const APP_ROOT     = path.join(__dirname, "../../app");
const CONFIG_DIR   = path.join(__dirname, "../config");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function cole(productId: string) {
  const startTime = Date.now();
  const filesGenerated: string[] = [];
  const errors: string[] = [];

  console.log(`\n🤖 COLE starting: ${productId}`);
  console.log(`   ${new Date().toISOString()}\n`);

  // ── STEP 1: Load config ───────────────────────────────────────────────────
  let config: ProductConfig;
  try {
    const configPath = path.join(CONFIG_DIR, `${productId}.ts`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config not found: ${configPath}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(configPath);
    config    = mod.PRODUCT_CONFIG;
    if (!config) throw new Error("Config file must export PRODUCT_CONFIG");
    console.log(`   ✅ Config loaded: ${config.name}`);
  } catch (err) {
    console.error(`   ❌ Config error: ${err}`);
    process.exit(1);
  }

  // ── STEP 2: Generate gate page ────────────────────────────────────────────
  try {
    const filePath = getGatePagePath(config, APP_ROOT);
    const content  = generateGatePage(config);
    writeFile(filePath, content);
    filesGenerated.push(filePath);
    console.log(`   ✅ Gate page`);
    console.log(`      → ${relativePath(filePath)}`);
  } catch (err) {
    const msg = `Gate page: ${err}`;
    errors.push(msg);
    console.error(`   ❌ ${msg}`);
  }

  // ── STEP 3: Generate calculator ───────────────────────────────────────────
  try {
    const filePath = getCalculatorPath(config, APP_ROOT);
    const content  = generateCalculator(config);
    writeFile(filePath, content);
    filesGenerated.push(filePath);
    console.log(`   ✅ Calculator`);
    console.log(`      → ${relativePath(filePath)}`);
  } catch (err) {
    const msg = `Calculator: ${err}`;
    errors.push(msg);
    console.error(`   ❌ ${msg}`);
  }

  // ── STEP 4: Generate success pages ────────────────────────────────────────
  try {
    const assessPath = getSuccessAssessPath(config, APP_ROOT);
    const assessContent = generateSuccessAssess(config);
    writeFile(assessPath, assessContent);
    filesGenerated.push(assessPath);
    console.log(`   ✅ Success page (tier 1 — ${config.tier1.successPath})`);
    console.log(`      → ${relativePath(assessPath)}`);
  } catch (err) {
    const msg = `Success assess: ${err}`;
    errors.push(msg);
    console.error(`   ❌ ${msg}`);
  }

  try {
    const planPath    = getSuccessPlanPath(config, APP_ROOT);
    const planContent = generateSuccessPlan(config);
    writeFile(planPath, planContent);
    filesGenerated.push(planPath);
    console.log(`   ✅ Success page (tier 2 — ${config.tier2.successPath})`);
    console.log(`      → ${relativePath(planPath)}`);
  } catch (err) {
    const msg = `Success plan: ${err}`;
    errors.push(msg);
    console.error(`   ❌ ${msg}`);
  }

  // ── STEP 5: Generate product files ────────────────────────────────────────
  try {
    const productFiles = generateAllProductFiles(config);
    for (const { path: filePath, content } of productFiles) {
      const fullPath = path.join(path.dirname(APP_ROOT), filePath);
      writeFile(fullPath, content);
      filesGenerated.push(fullPath);
    }
    console.log(`   ✅ Product files (${config.files.length} files)`);
    config.files.forEach(f => {
      console.log(`      → app/files/${config.country}/${config.id}/${f.slug}/page.tsx`);
    });
  } catch (err) {
    const msg = `Product files: ${err}`;
    errors.push(msg);
    console.error(`   ❌ ${msg}`);
  }

  // ── STEP 6: Generate rules route ──────────────────────────────────────────
  try {
    const filePath = getRulesRoutePath(config, APP_ROOT);
    const content  = generateRulesRoute(config);
    writeFile(filePath, content);
    filesGenerated.push(filePath);
    console.log(`   ✅ Rules API route`);
    console.log(`      → ${relativePath(filePath)}`);
  } catch (err) {
    const msg = `Rules route: ${err}`;
    errors.push(msg);
    console.error(`   ❌ ${msg}`);
  }

  // ── STEP 7: Log to Supabase ───────────────────────────────────────────────
  const duration = Date.now() - startTime;
  const success  = errors.length === 0;

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/cole_log`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "apikey":        SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer":        "return=minimal",
        },
        body: JSON.stringify({
          product_id:      productId,
          trigger:         "manual",
          files_generated: filesGenerated.map(relativePath),
          errors:          errors.length > 0 ? errors : null,
          duration_ms:     duration,
          success,
          notes:           `Generated by cole-generate.ts`,
        }),
      });
      console.log(`\n   ✅ Logged to Supabase cole_log`);
    } catch (err) {
      console.log(`\n   ⚠️  Supabase logging failed (non-blocking): ${err}`);
    }
  } else {
    console.log(`\n   ⚠️  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping log`);
  }

  // ── STEP 8: Output summary ────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);

  if (!success) {
    console.log(`\n⚠️  COLE completed with ${errors.length} error(s):`);
    errors.forEach(e => console.log(`   • ${e}`));
  } else {
    console.log(`\n✅ COLE complete: ${productId}`);
    console.log(`   ${filesGenerated.length} files generated in ${duration}ms`);
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`\n📋 NEXT STEPS:\n`);

  // Checkout route additions
  console.log(`1. Add to app/api/create-checkout-session/route.ts:`);
  console.log(`   if (key === "${config.tier1.productKey}") return process.env.${config.tier1.envVar};`);
  console.log(`   if (key === "${config.tier2.productKey}") return process.env.${config.tier2.envVar};\n`);

  // Vercel env vars
  console.log(`2. Add to Vercel environment variables:`);
  console.log(`   ${config.tier1.envVar} = price_live_...  (Stripe tier 1 price ID)`);
  console.log(`   ${config.tier2.envVar} = price_live_...  (Stripe tier 2 price ID)\n`);

  // Stripe products
  console.log(`3. Create Stripe products:`);
  console.log(`   Tier 1: ${config.tier1.name} — £${config.tier1.price}`);
  console.log(`   Tier 2: ${config.tier2.name} — £${config.tier2.price}\n`);

  // changedetection.io
  console.log(`4. Add to changedetection.io monitoring:`);
  config.monitorUrls.forEach(url => console.log(`   ${url}`));
  console.log(`   Webhook: https://taxchecknow.com/api/cole/monitor\n`);

  // Git
  console.log(`5. Push to Vercel:`);
  console.log(`   git add .`);
  console.log(`   git commit -m "feat: ${productId} — generated by COLE"`);
  console.log(`   git push\n`);

  console.log(`${"─".repeat(60)}\n`);
}

// ── FILE WRITER ───────────────────────────────────────────────────────────────

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function relativePath(absolutePath: string): string {
  return absolutePath.replace(path.join(__dirname, "../../"), "");
}

// ── ENTRY POINT ───────────────────────────────────────────────────────────────

const productId = process.argv[2];

if (!productId) {
  console.error("\n❌ Usage: npx ts-node cole/scripts/cole-generate.ts [product-id]");
  console.error("   Example: npx ts-node cole/scripts/cole-generate.ts uk-03\n");
  console.error("   Available configs:");
  try {
    fs.readdirSync(CONFIG_DIR)
      .filter(f => f.endsWith(".ts"))
      .forEach(f => console.error(`   · ${f.replace(".ts", "")}`));
  } catch { /* ignore */ }
  process.exit(1);
}

cole(productId).catch(err => {
  console.error(`\n❌ COLE fatal error: ${err}\n`);
  process.exit(1);
});
