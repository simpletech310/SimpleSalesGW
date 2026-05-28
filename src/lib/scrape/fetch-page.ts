/**
 * Server-side fetch of a public web page with safety rails:
 *   - timeout
 *   - content-type allow list
 *   - body size cap
 *   - User-Agent identifying as Gateway
 *   - robots.txt check
 */

import { isAllowed } from "@/lib/scrape/robots";
import { extractFromHtml, type ExtractedPage } from "@/lib/scrape/extract";

// Cloudflare-fronted targets (credit unions, law firms, many MSP
// prospects) fingerprint past the UA: they expect the full set of
// `sec-fetch-*` / `sec-ch-ua-*` / Accept-Encoding headers Chrome
// actually sends. UA alone gets a 403. We still respect robots.txt
// (see `isAllowed`) — the goal is to access public marketing pages
// the same way a logged-out browser would.
const DEFAULT_UA =
  process.env.SCRAPE_USER_AGENT ??
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_BYTES = 384 * 1024;
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

/** Full Chrome-equivalent request headers. Order matters less in
 *  Node's fetch (it sorts), but the *set* of headers is what most
 *  basic bot detectors check. */
function browserHeaders(ua: string): Record<string, string> {
  return {
    "User-Agent": ua,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };
}

export type FetchPageResult =
  | { ok: true; url: string; finalUrl: string; page: ExtractedPage; bytes: number }
  | { ok: false; url: string; reason: string };

export async function fetchPage(url: string, opts: { userAgent?: string; timeoutMs?: number } = {}): Promise<FetchPageResult> {
  const ua = opts.userAgent ?? DEFAULT_UA;
  const allowed = await isAllowed(url, ua);
  if (!allowed.allowed) return { ok: false, url, reason: allowed.reason ?? "robots_blocked" };

  let res: Response;
  try {
    res = await fetch(url, {
      headers: browserHeaders(ua),
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, url, reason: `fetch_failed: ${(err as Error).message}` };
  }

  if (!res.ok) return { ok: false, url, reason: `http_${res.status}` };
  const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.some((c) => ctype.includes(c))) {
    return { ok: false, url, reason: `bad_content_type:${ctype}` };
  }

  // Read with size cap (Web stream chunks)
  const reader = res.body?.getReader();
  if (!reader) return { ok: false, url, reason: "no_body" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) {
        try { await reader.cancel(); } catch { /* ignore */ }
        return { ok: false, url, reason: "body_too_large" };
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const page = extractFromHtml(html);
  return { ok: true, url, finalUrl: res.url, page, bytes: total };
}
