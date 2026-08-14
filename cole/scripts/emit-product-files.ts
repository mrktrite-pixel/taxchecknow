// cole/scripts/emit-product-files.ts
//
// Write ONLY the 8 deliverable-document pages for one product.
//
//   npx ts-node --project cole/tsconfig.json cole/scripts/emit-product-files.ts <config-file-id>
//
// WHY THIS EXISTS RATHER THAN `cole-generate.ts <slug>`: the full generator also rewrites the
// gate page, the calculator and the success pages. For an engineNative product it REFUSES the
// calculator (GuardRefusal), and the success pages are hand-maintained behind the R-A2/R-A3
// tripwire — so running the full generator to refresh the documents would either abort or
// clobber work it does not know about. This does the one surface, deliberately.

import * as fs from "fs";
import * as path from "path";
import type { ProductConfig } from "../types/product-config";
import { generateAllProductFiles } from "../generators/generate-product-files";

function main(): void {
  const id = process.argv[2];
  if (!id) {
    console.error("usage: emit-product-files.ts <config-file-id>");
    process.exit(1);
  }
  const configPath = path.resolve(__dirname, "..", "config", `${id}.ts`);
  if (!fs.existsSync(configPath)) {
    console.error(`config not found: ${configPath}`);
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = (require(configPath) as { PRODUCT_CONFIG: ProductConfig }).PRODUCT_CONFIG;
  const repoRoot = path.resolve(__dirname, "..", "..");

  for (const artefact of generateAllProductFiles(config)) {
    const full = path.join(repoRoot, artefact.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, artefact.content, "utf8");
    console.log(`wrote ${artefact.path}`);
  }
}

main();
