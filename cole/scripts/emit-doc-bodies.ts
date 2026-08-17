// cole/scripts/emit-doc-bodies.ts
//
// Emit a product's deliverable-document BODIES as data, next to the product.
//
//   npx ts-node --project cole/tsconfig.json cole/scripts/emit-doc-bodies.ts <config-file-id>
//   e.g. …/emit-doc-bodies.ts au-19-frcgw-clearance-certificate
//
// WHY. Until now each body existed in exactly one rendered place: baked into that file's
// own /files/<country>/<product>/<slug> page as an HTML string literal. That is fine while a
// document is only ever read on its own page. It stops working the moment two surfaces need
// the same body — which R4 requires, because the combined Save-PDF renders every one of the
// buyer's files inline on the success page.
//
// Duplicating the strings into the success page would give the product two divergent copies
// of its own paid content, which is precisely the class of bug this rebuild exists to remove.
// So the bodies are emitted ONCE as data and both surfaces import them.
//
// GENERIC: any product can be emitted. Nothing here knows about FRCGW.

import * as fs from "fs";
import * as path from "path";
import type { ProductConfig } from "../types/product-config";

function main(): void {
  const id = process.argv[2];
  if (!id) {
    console.error("usage: emit-doc-bodies.ts <config-file-id>   (e.g. au-19-frcgw-clearance-certificate)");
    process.exit(1);
  }

  const configPath = path.resolve(__dirname, "..", "config", `${id}.ts`);
  if (!fs.existsSync(configPath)) {
    console.error(`config not found: ${configPath}`);
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(configPath) as { PRODUCT_CONFIG: ProductConfig };
  const config = mod.PRODUCT_CONFIG;

  const outDir = path.resolve(__dirname, "..", "..", "app", ...config.slug.split("/"));
  if (!fs.existsSync(outDir)) {
    console.error(`product dir not found: ${outDir}`);
    process.exit(1);
  }

  // Shape: slug → { num, name, desc, tier, content }. Keyed by slug because that is what
  // both the /files route and lib/terminal-presentation.ts's spine address a document by.
  const docs: Record<string, { num: string; name: string; desc: string; tier: number; content: string }> = {};
  for (const f of config.files) {
    docs[f.slug] = { num: f.num, name: f.name, desc: f.desc, tier: f.tier, content: f.content };
  }

  const outPath = path.join(outDir, "docs.json");
  fs.writeFileSync(outPath, JSON.stringify(docs, null, 2) + "\n", "utf8");
  console.log(`wrote ${outPath} (${Object.keys(docs).length} documents)`);
}

main();
