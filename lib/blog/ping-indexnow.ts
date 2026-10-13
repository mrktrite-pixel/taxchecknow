// lib/blog/ping-indexnow.ts
// ─────────────────────────────────────────────────────────────────────────────
// BLOG ENGINE P1 — THE PURE INDEXNOW PING. One network call, nothing else.
//
// WHY THIS EXISTS RATHER THAN A CALL TO distributionBee(). RULED.
// lib/distribution-bee.ts is NOT a pinger: distributionBee() also pings Google
// and INSERTS a row into public.content_performance, a table the social lanes
// read. Its only pure part, pingIndexNow, is not exported, and its PageType
// union ("story" | "question" | "product" | "gpt" | "other") has no "blog" —
// so using it would have meant either mislabelling every post as "other" or
// editing a module this phase is forbidden to touch. This function does the one
// thing the blog needs and writes nothing anywhere.
//
// WHAT IT RETURNS, AND WHY THAT SHAPE. F68 cost an hour on a 403 because the
// code recorded "FAILED HTTP 403" and discarded the response body — while
// IndexNow had returned a body explaining itself. So the body comes back on any
// non-2xx, trimmed and capped, and the caller logs it.
//
// 2xx IS THE CONDITION, not 200/202 specifically. IndexNow documents both and
// the range is what "accepted" means; anything else is a refusal that must not
// be reported as submitted.
//
// .trim() ON THE KEY, because the secret is pasted by hand. A value carrying a
// trailing newline is sent verbatim and 403s, and nothing in a log can tell that
// apart from a wrong key unless the trim is reported. An IndexNow key is PUBLIC
// by design — it is served at https://<host>/<key>.txt for anyone to fetch — so
// echoing its length and first4…last4 leaks nothing; the masking is courtesy.
//
// keyLocation IS SENT EXPLICITLY. The default is already
// https://<host>/<key>.txt, so this changes nothing about which file IndexNow
// checks — it puts the expectation in the request, where a 403 can be read
// against it instead of inferred from the spec.
// ─────────────────────────────────────────────────────────────────────────────

export const INDEXNOW_HOST = "www.taxchecknow.com";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export interface IndexNowResult {
  /** true only on a 2xx. A missing key, a refusal and a throw are all false. */
  accepted: boolean;
  /** null when the request was never made (no key, or the fetch threw). */
  status: number | null;
  /** The URLs submitted, as sent. */
  urls: string[];
  /** The keyLocation sent, so a 403 can be read against it. */
  keyLocation: string | null;
  /** IndexNow's own words on a refusal. Empty when 2xx or unavailable. */
  body: string;
  /** A one-line, log-safe account of what happened. Always populated. */
  detail: string;
}

/**
 * Submit URLs to IndexNow. PURE: no database, no filesystem, no process.exit.
 *
 * The only input from the environment is INDEXNOW_KEY. A missing key is NOT an
 * error — it is a reported refusal, so a generator run without the secret
 * completes and says the ping did not happen, rather than failing a build.
 */
export async function pingIndexNow(
  urls: string[],
  opts: { host?: string; key?: string; endpoint?: string } = {},
): Promise<IndexNowResult> {
  const host = opts.host ?? INDEXNOW_HOST;
  const endpoint = opts.endpoint ?? INDEXNOW_ENDPOINT;
  const rawKey = opts.key ?? process.env.INDEXNOW_KEY ?? "";
  const key = rawKey.trim();

  if (urls.length === 0) {
    return { accepted: false, status: null, urls: [], keyLocation: null, body: "", detail: "no URLs to submit — nothing was sent" };
  }
  if (!key) {
    return { accepted: false, status: null, urls, keyLocation: null, body: "", detail: "INDEXNOW_KEY is not set — no ping was sent" };
  }

  const keyLocation = `https://${host}/${key}.txt`;
  const trimmedNote = key !== rawKey
    ? ` (the INDEXNOW_KEY secret had surrounding whitespace: ${rawKey.length} chars -> ${key.length}; the trimmed value was sent)`
    : "";
  const keyNote = `key ${key.length} chars ${key.slice(0, 4)}…${key.slice(-4)}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, key, keyLocation, urlList: urls }),
    });
    const accepted = res.status >= 200 && res.status < 300;
    // The body is what the pre-F68 version discarded. IndexNow's own words:
    //   403  "key not valid (e.g. key not found, file found but key not in the file)"
    //   422  "URLs which don't belong to the host or the key is not matching the schema"
    const body = accepted ? "" : (await res.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 200);

    let detail = `HTTP ${res.status}${accepted ? "" : " — NOT 2xx"} · ${urls.length} URL(s) · host ${host} · ${keyNote}${trimmedNote}`;
    if (body) detail += ` · ${body}`;
    if (res.status === 403) detail += ` · 403 means the key sent is not the key at ${keyLocation}`;
    if (res.status === 422) detail += ` · 422 means a URL does not belong to host ${host}, or the key fails the schema`;

    return { accepted, status: res.status, urls, keyLocation, body, detail };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { accepted: false, status: null, urls, keyLocation, body: "", detail: `request threw: ${msg} · ${urls.length} URL(s) · ${keyNote}${trimmedNote}` };
  }
}
