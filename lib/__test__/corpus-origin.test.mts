// lib/__test__/corpus-origin.test.mts
//
// F57. Run: npx tsx lib/__test__/corpus-origin.test.mts
// Pure — the env is passed in, so every branch is reachable without setting process.env.
//
// WHAT THIS PINS: a preview reads ITS OWN corpus. The one-line version of this resolver sent every
// preview to production, so a branch's pages were tested against main's facts — measured on
// 2026-09-27, when production served the stale FEIE limit $126,500 seven times and a regeneration
// wrote it into a fresh pack with every local check passing.

import { resolveCorpusOrigin, corpusFetchHeaders } from "../assess-core.js";

let failed = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      got=${JSON.stringify(got)}\n     want=${JSON.stringify(want)}`}`);
}

console.log("\n-- preview reads its own deployment --------------------------------------------");
{
  const r = resolveCorpusOrigin({
    VERCEL_ENV: "preview",
    VERCEL_URL: "taxchecknow-qwb71uhig-mrktrite-6622s-projects.vercel.app",
    VERCEL_BRANCH_URL: "taxchecknow-git-feat-us-expat-tax-engine-native.vercel.app",
    NEXT_PUBLIC_SITE_URL: "https://taxchecknow.com",
  });
  check("origin is the immutable deployment host", r.origin, "https://taxchecknow-qwb71uhig-mrktrite-6622s-projects.vercel.app");
  check("  NOT production, even though NEXT_PUBLIC_SITE_URL is set", r.origin.includes("taxchecknow.com"), false);
  check("  source names the var", r.source, "VERCEL_URL (this deployment)");
  check("  flagged as self (so the bypass may be sent)", r.isSelf, true);
}
{
  // VERCEL_URL missing: the branch alias is right-branch but moving, so it is the fallback.
  const r = resolveCorpusOrigin({
    VERCEL_ENV: "preview",
    VERCEL_BRANCH_URL: "taxchecknow-git-feat-x.vercel.app",
  });
  check("falls back to the branch alias", r.origin, "https://taxchecknow-git-feat-x.vercel.app");
  check("  source says which", r.source, "VERCEL_BRANCH_URL (branch alias)");
}

console.log("\n-- production and local are unchanged ------------------------------------------");
check("production uses NEXT_PUBLIC_SITE_URL",
  resolveCorpusOrigin({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://taxchecknow.com", VERCEL_URL: "x.vercel.app" }).origin,
  "https://taxchecknow.com");
check("  and is not treated as self", resolveCorpusOrigin({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://taxchecknow.com" }).isSelf, false);
check("no env at all -> production default", resolveCorpusOrigin({}).origin, "https://taxchecknow.com");
check("  source says default", resolveCorpusOrigin({}).source, "default (production)");
check("a local run keeps its own origin",
  resolveCorpusOrigin({ NEXT_PUBLIC_SITE_URL: "http://localhost:3123" }).origin, "http://localhost:3123");
check("  http is preserved, not upgraded", resolveCorpusOrigin({ NEXT_PUBLIC_SITE_URL: "http://localhost:3123" }).origin.startsWith("http://"), true);

console.log("\n-- normalisation ---------------------------------------------------------------");
check("bare host gets https", resolveCorpusOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "x.vercel.app" }).origin, "https://x.vercel.app");
check("a trailing slash is dropped", resolveCorpusOrigin({ NEXT_PUBLIC_SITE_URL: "https://taxchecknow.com/" }).origin, "https://taxchecknow.com");
check("several trailing slashes too", resolveCorpusOrigin({ NEXT_PUBLIC_SITE_URL: "https://taxchecknow.com///" }).origin, "https://taxchecknow.com");
check("whitespace is trimmed", resolveCorpusOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "  x.vercel.app  " }).origin, "https://x.vercel.app");
check("an empty VERCEL_URL is not a host",
  resolveCorpusOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "   ", NEXT_PUBLIC_SITE_URL: "https://taxchecknow.com" }).origin,
  "https://taxchecknow.com");

console.log("\n-- the bypass secret goes ONLY to our own origin --------------------------------");
{
  const self = resolveCorpusOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "x.vercel.app" });
  const h = corpusFetchHeaders(self, { VERCEL_AUTOMATION_BYPASS_SECRET: "s3cr3t" });
  check("sent for a self origin", h["x-vercel-protection-bypass"], "s3cr3t");
  check("  with the cookie hint, for redirect hops", h["x-vercel-set-bypass-cookie"], "samesitenone");
  check("  accept is still there", h.accept, "application/json");

  const pub = resolveCorpusOrigin({ NEXT_PUBLIC_SITE_URL: "https://taxchecknow.com" });
  const hp = corpusFetchHeaders(pub, { VERCEL_AUTOMATION_BYPASS_SECRET: "s3cr3t" });
  check("NOT sent to the public origin — a per-project secret does not belong there",
    hp["x-vercel-protection-bypass"], undefined);
  check("no secret in env -> no header", corpusFetchHeaders(self, {})["x-vercel-protection-bypass"], undefined);
  check("blank secret -> no header", corpusFetchHeaders(self, { VERCEL_AUTOMATION_BYPASS_SECRET: "  " })["x-vercel-protection-bypass"], undefined);
}

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}\n`);
process.exitCode = failed === 0 ? 0 : 1;
