// ─────────────────────────────────────────────────────────────────────────────
// COLE — Main Generation Script
// Status: PLACEHOLDER — not yet built
// Usage: npx ts-node cole/scripts/cole-generate.ts [product-id]
// Example: npx ts-node cole/scripts/cole-generate.ts uk-03
// ─────────────────────────────────────────────────────────────────────────────

// TODO: build this script
// It will:
// 1. Load config from cole/config/[product-id].ts
// 2. Call all 5 generators
// 3. Write all files to correct paths
// 4. Output Stripe env vars needed
// 5. Output Vercel env vars needed
// 6. Output monitor URLs for changedetection.io
// 7. Log the run to Supabase cole_log table

const productId = process.argv[2];

if (!productId) {
  console.error("Usage: npx ts-node cole/scripts/cole-generate.ts [product-id]");
  console.error("Example: npx ts-node cole/scripts/cole-generate.ts uk-03");
  process.exit(1);
}

console.log(`COLE generation not yet built for: ${productId}`);
console.log("Build the generators first — see cole/generators/");
