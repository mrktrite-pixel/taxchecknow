// ─────────────────────────────────────────────────────────────────────────────
// COLE — verify-engine-native.ts   (R-A2)
//
// The product config DECLARES `engineNative`. This module VERIFIES that claim
// against the product's actual app directory at generate time.
//
// Why both: a declaration alone rots silently the moment a calculator is
// migrated and its config is not; a sniff alone is invisible in review — nobody
// can see, in a diff, which shape the generator decided to emit. Declared AND
// verified means the declaration is authoritative and cannot drift from the
// truth without the build stopping.
//
// THE LOAD-BEARING SIGNAL IS THE CALCULATOR MOUNT, NOT engine.json.
// engine.json is emitted by the engine pipeline and can legitimately exist
// before the calculator wrapper lands (rental-property-deduction-audit is in
// exactly that state today: engine.json present, still a bespoke calculator).
// Treating engine.json as sufficient would flip such a product to the
// engine-native input shape while its calculator still writes the legacy keys —
// the precise failure R-A2 exists to prevent.
// ─────────────────────────────────────────────────────────────────────────────
import * as fs from "fs";
import * as path from "path";
import type { ProductConfig } from "../types/product-config";

/** Repo root, resolved from this file (cole/generators/ → two up). */
const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** The one import that makes a calculator engine-native. */
const ENGINE_IMPORT = "@/app/_components/EngineCalculator";

export interface EngineNativeVerdict {
  declared: boolean;
  mountsEngineCalculator: boolean;
  hasEngineJson: boolean;
  appDir: string;
  appDirExists: boolean;
  /** Files that were actually inspected for the mount — evidence, not a guess. */
  inspected: string[];
  mountedBy: string | null;
}

/**
 * Inspect the product's app directory.
 *
 * NON-RECURSIVE by design. The generated success pages live under
 * `<appDir>/success/**` and contain the string "EngineCalculator" inside a
 * comment ("the keys EngineCalculator actually wrote"). A recursive substring
 * search reports those as a mount and is wrong. We look only at the files that
 * sit directly in the product directory, and we match the IMPORT SPECIFIER
 * rather than the bare identifier — the NZ product's component is *named*
 * InterestReinstatementEngineCalculator and matches a bare-name search while
 * importing nothing of the sort.
 */
export function inspectEngineNative(config: ProductConfig): EngineNativeVerdict {
  const appDir = path.join(REPO_ROOT, "app", config.slug);
  const appDirExists = fs.existsSync(appDir);

  const inspected: string[] = [];
  let mountedBy: string | null = null;

  if (appDirExists) {
    for (const entry of fs.readdirSync(appDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
      inspected.push(entry.name);
      const src = fs.readFileSync(path.join(appDir, entry.name), "utf8");
      if (src.includes(ENGINE_IMPORT)) mountedBy = mountedBy ?? entry.name;
    }
  }

  return {
    declared: config.engineNative === true,
    mountsEngineCalculator: mountedBy !== null,
    hasEngineJson: appDirExists && fs.existsSync(path.join(appDir, "engine.json")),
    appDir,
    appDirExists,
    inspected,
    mountedBy,
  };
}

/**
 * Verify, and THROW on any disagreement. Returns the (verified) declared value.
 *
 * Fails loudly rather than picking a shape, because both wrong answers are
 * silent at runtime: the legacy shape on an engine-native product yields an
 * assessment built from template defaults, and the engine-native shape on a
 * legacy product yields an empty inputs object. Neither throws, neither logs,
 * and both look fine on the page.
 */
export function verifyEngineNative(config: ProductConfig): boolean {
  const v = inspectEngineNative(config);
  const where = `product "${config.id}" (${v.appDir})`;

  if (!v.appDirExists) {
    throw new Error(
      `[R-A2 verify] Cannot verify engineNative for ${where}: the app directory does not exist. ` +
      `Refusing to emit either input shape on an unverifiable claim. ` +
      `(A missing directory must never read as "not engine-native" — that is a zero from a wrong ` +
      `target, which looks identical to a real answer.)`
    );
  }

  if (v.declared && !v.mountsEngineCalculator) {
    throw new Error(
      `[R-A2 verify] ${where} DECLARES engineNative: true, but no file directly in its app directory ` +
      `imports "${ENGINE_IMPORT}". Inspected: ${v.inspected.join(", ") || "(no .tsx files)"}. ` +
      `Emitting buildComposerInputsFromSession() here would read <id>_answers, which this ` +
      `calculator never writes → an EMPTY inputs object on the /api/assess fallback. ` +
      `Either the calculator was not migrated, or the declaration is wrong. Generating nothing.`
    );
  }

  if (!v.declared && v.mountsEngineCalculator) {
    throw new Error(
      `[R-A2 verify] ${where} mounts EngineCalculator (in ${v.mountedBy}) but does NOT declare ` +
      `engineNative: true. This is the drift R-A2 exists to catch: the template would emit the ` +
      `legacy phantom sessionStorage reads for a calculator that writes <id>_answers, so every ` +
      `read would miss and the customer's assessment would be built from the template's hardcoded ` +
      `defaults. Add "engineNative: true" to the config. Generating nothing.`
    );
  }

  if (v.declared && !v.hasEngineJson) {
    throw new Error(
      `[R-A2 verify] ${where} declares engineNative: true and mounts EngineCalculator, but ` +
      `engine.json is missing from its app directory. The engine payload is what the mounted ` +
      `component runs; without it the declaration cannot be considered verified. Generating nothing.`
    );
  }

  return v.declared;
}
