// ─────────────────────────────────────────────────────────────────────────────
// COLE Guard — geo-bake-guard.ts
// The GEO bake fails closed when the page already has what it is about to drop.
// ─────────────────────────────────────────────────────────────────────────────
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// MEASURED on allowance-sniper, 2026-10-28. A `--pages-only` run with no Supabase env in the
// shell regenerated the gate page and silently removed its VideoObject JSON-LD:
//
//     app/uk/check/allowance-sniper/page.tsx   videoSchema 2 -> 0 · VideoObject 1 -> 0
//
// generate-gate-page.ts emits that block ITSELF, from facts fetchGeoBake reads out of
// content_performance and content_jobs. Re-running WITH the env restored it BYTE-EQUAL: the facts
// were never missing, the generator could not see them.
//
// fetchGeoBake's contract — "any miss (no DB env, no match, fetch error) returns nulls → the page
// generates unchanged" — is true for a page that never had a video. It is FALSE for a page that
// HAS one: there, nulls do not leave the page unchanged, they strip crawler-visible structured
// data, and the diff reads like an intentional removal.
//
// So the empty bake is allowed only when there is nothing to lose. If the page on disk already
// carries a VideoObject or a transcript block and the database is unreachable, this REFUSES — the
// same shape as the corpus guard in generate-rules-route, and for the same reason.
//
// IT READS THE PAGE, NOT A CONFIG FLAG. The facts live in the database and the markup lives in the
// page, so the only honest question is "does the file I am about to overwrite have one".
// ═════════════════════════════════════════════════════════════════════════════════════════════

import * as fs from "fs";
import * as path from "path";

/**
 * Why this emit must not proceed, or null when it may.
 *
 * @param pagePath  the gate page about to be overwritten
 * @param hasDbEnv  whether the GEO bake can reach the database at all
 */
export function geoBakeRefusal(pagePath: string, hasDbEnv: boolean): string | null {
  if (hasDbEnv) return null;

  let existing = "";
  try {
    existing = fs.readFileSync(pagePath, "utf8");
  } catch {
    return null; // no page yet — a first emit must work offline
  }

  const hasVideo = existing.includes('"@type": "VideoObject"') || existing.includes("videoSchema");
  const hasTranscript = existing.includes('id="transcript"') || existing.includes("jsonld-video");
  if (!hasVideo && !hasTranscript) return null;

  const carries = [hasVideo ? "a VideoObject" : null, hasTranscript ? "a transcript block" : null]
    .filter(Boolean)
    .join(" and ");
  const where = `${path.basename(path.dirname(pagePath))}/page.tsx`;

  return (
    `REFUSED — ${where} already carries ${carries}, and the GEO bake cannot reach the database to`
    + ` re-derive it (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in this shell).`
    + ` Regenerating now would DELETE crawler-visible structured data and the diff would read as a`
    + ` deliberate removal. Set those two variables and re-run, or pass --allow-geo-loss if the`
    + ` removal is genuinely intended.`
  );
}
