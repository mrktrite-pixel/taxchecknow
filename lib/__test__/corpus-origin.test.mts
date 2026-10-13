// lib/__test__/corpus-origin.test.mts
//
// F57. Run: npx tsx lib/__test__/corpus-origin.test.mts
// Pure — the env is passed in, so every branch is reachable without setting process.env.
//
// WHAT THIS PINS: a preview reads ITS OWN corpus. The one-line version of this resolver sent every
// preview to production, so a branch's pages were tested against main's facts — measured on
// 2026-09-27, when production served the stale FEIE limit $126,500 seven times and a regeneration
// wrote it into a fresh pack with every local check passing.

import { resolveCorpusOrigin, corpusFetchHeaders, protectedResponse, looksLikeProtectionLoop, selfFetchIsProtection, protectionDetail } from "../assess-core.js";

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
  // WAS: check("with the cookie hint, for redirect hops", h["x-vercel-set-bypass-cookie"], "samesitenone")
  // That assertion pinned the bug. Asking Vercel for the bypass COOKIE is what created the redirect
  // hop its comment claimed to be surviving — see the F104 block at the end of this file.
  check("  and NO cookie-handshake header", "x-vercel-set-bypass-cookie" in h, false);
  check("  accept is still there", h.accept, "application/json");

  const pub = resolveCorpusOrigin({ NEXT_PUBLIC_SITE_URL: "https://taxchecknow.com" });
  const hp = corpusFetchHeaders(pub, { VERCEL_AUTOMATION_BYPASS_SECRET: "s3cr3t" });
  check("NOT sent to the public origin — a per-project secret does not belong there",
    hp["x-vercel-protection-bypass"], undefined);
  check("no secret in env -> no header", corpusFetchHeaders(self, {})["x-vercel-protection-bypass"], undefined);
  check("blank secret -> no header", corpusFetchHeaders(self, { VERCEL_AUTOMATION_BYPASS_SECRET: "  " })["x-vercel-protection-bypass"], undefined);
}

console.log("\n-- a protected deployment is recognised from the RESPONSE ----------------------");
{
  // Vercel's own 401 body, as the preview really serves it.
  const VERCEL_401 = JSON.stringify({
    error: { code: "not_authorized", message: "Protected by Vercel Authentication",
             vercel_auth_enabled: true, password_enabled: false },
  });
  check("a 401 with Vercel's body is protection", protectedResponse(401, VERCEL_401), true);
  check("a 403 with it too", protectedResponse(403, VERCEL_401), true);
  check("the plain-text form the preview also returns",
    protectedResponse(401, "Protected by Vercel Authentication\nTo access this deployment..."), true);

  // THE NEGATIVES, which matter more: a 401 the ROUTE returned must not be excused as protection,
  // and a 404/500 is never protection whatever the body says.
  check("a 401 whose body is the app's own is NOT protection",
    protectedResponse(401, JSON.stringify({ error: "Missing session_id" })), false);
  check("a 404 is not protection even with a protection-ish body",
    protectedResponse(404, VERCEL_401), false);
  check("a 500 is not protection", protectedResponse(500, VERCEL_401), false);
  check("a 200 is not protection", protectedResponse(200, VERCEL_401), false);
}

console.log("\n-- and from a thrown redirect loop, which is the same wall ---------------------");
{
  // MEASURED on the 2026-09-28 tier-147 buy: fetch threw TypeError with cause "redirect count
  // exceeded", because an unauthenticated request is sent to vercel.com/sso-api, which redirects.
  const thrown = Object.assign(new Error("fetch failed"), {
    cause: new Error("redirect count exceeded"),
  });
  check("the cause chain is read, not just the message", looksLikeProtectionLoop(thrown), true);
  check("a bare redirect-loop error", looksLikeProtectionLoop(new Error("too many redirects")), true);
  check("an sso-api mention", looksLikeProtectionLoop(new Error("redirected to vercel.com/sso-api")), true);
  check("an ordinary network failure is NOT a protection loop",
    looksLikeProtectionLoop(Object.assign(new Error("fetch failed"), { cause: new Error("ECONNRESET") })), false);
  check("a DNS failure is not either", looksLikeProtectionLoop(new Error("getaddrinfo ENOTFOUND")), false);
  check("a non-Error does not throw the detector", looksLikeProtectionLoop("redirect count exceeded"), true);
  check("null is safe", looksLikeProtectionLoop(null), false);
}

console.log("\n-- F104: the bypass header goes ALONE ------------------------------------------");
{
  const self = resolveCorpusOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "taxchecknow-hh29i88n2-x.vercel.app" });
  const h = corpusFetchHeaders(self, { VERCEL_AUTOMATION_BYPASS_SECRET: "s".repeat(32) });
  // THE REGRESSION THIS PINS, measured 2026-10-13 on one URL in one minute:
  //   bypass header only                 200, zero redirects
  //   bypass header + set-bypass-cookie  307 + Set-Cookie _vercel_jwt, Location = the same path
  //   the latter, following redirects    307 after 5 hops ("redirect count exceeded")
  check("the cookie-handshake header is NOT sent", "x-vercel-set-bypass-cookie" in h, false);
  check("  the bypass header still is", h["x-vercel-protection-bypass"], "s".repeat(32));
  check("  exactly two headers go out", Object.keys(h).sort(), ["accept", "x-vercel-protection-bypass"]);
}

console.log("\n-- F104: an ON-ORIGIN 3xx is NOT protection -------------------------------------");
{
  const U = "https://taxchecknow-hh29i88n2-x.vercel.app/api/rules/australia-smsf-residency";
  const P = (status: number, location: string | null, isSelf = true): boolean =>
    selfFetchIsProtection({ isSelf, status, location, corpusUrl: U });
  // THE EXACT RESPONSE misread for six days: 307 back to the same relative path.
  check("307 to the SAME relative path is NOT protection", P(307, "/api/rules/australia-smsf-residency"), false);
  check("307 to the same ABSOLUTE origin is NOT protection", P(307, U), false);
  check("302 on-origin is NOT protection", P(302, "/anything"), false);
  check("a 3xx with NO Location is NOT protection", P(307, null), false);
  // AND THE WALL IS STILL THE WALL.
  check("307 to vercel.com/sso-api IS protection", P(307, "https://vercel.com/sso-api?url=x&nonce=y"), true);
  check("401 IS protection", P(401, null), true);
  check("403 IS protection", P(403, null), true);
  check("an unparseable absolute Location is not waved through", P(307, "https://"), true);
  check("a non-self fetch is never protection here", P(401, null, false), false);
  check("200 / 404 / 500 are not protection", [P(200, null), P(404, null), P(500, null)], [false, false, false]);
}

console.log("\n-- F104: the message no longer speculates about the secret ----------------------");
{
  const d = protectionDetail("https://x.vercel.app/api/rules/y", { VERCEL_AUTOMATION_BYPASS_SECRET: "s".repeat(32) });
  check("it says the self-fetch was redirected", /the self-fetch was redirected/.test(d), true);
  check("  and names what to look at", /cookie-handshake header or an off-origin Location/.test(d), true);
  check("  it does NOT say regenerate", /regenerate/i.test(d), false);
  check("  it does NOT say redeploy", /redeploy/i.test(d), false);
  check("  the secret is reported, not blamed", /is set and was sent/.test(d), true);
  check("absent secret still reported as absent",
    /is NOT set in this deployment/.test(protectionDetail("https://x.vercel.app/api/rules/y", {})), true);
}

console.log(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILED`}\n`);
process.exitCode = failed === 0 ? 0 : 1;
