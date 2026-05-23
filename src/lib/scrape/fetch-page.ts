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

const DEFAULT_UA =
  process.env.SCRAPE_USER_AGENT ??
  "Mozilla/5.0 (compatible; GatewayTelNetSalesBot/1.0; +https://gatewaytelnet.com)";
const DEFAULT_TIMEOUT_MS = 6_000;
const MAX_BYTES = 384 * 1024;
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

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
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
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
