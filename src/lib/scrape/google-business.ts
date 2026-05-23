/**
 * Fetch a Google Business listing URL (e.g. https://www.google.com/maps/place/...).
 * No Places API key — we just grab the og:* tags and text. Google often
 * returns enough in the share/preview to confirm hours, address, and rating.
 */

import { fetchPage } from "@/lib/scrape/fetch-page";

export type GoogleBusinessPayload = {
  source: "google_business";
  url: string;
  finalUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  plainText: string | null;
};

export async function fetchGoogleBusiness(url: string): Promise<{ ok: true; payload: GoogleBusinessPayload } | { ok: false; reason: string }> {
  const result = await fetchPage(url);
  if (!result.ok) return { ok: false, reason: result.reason };
  const meta = result.page.metaTags;
  return {
    ok: true,
    payload: {
      source: "google_business",
      url,
      finalUrl: result.finalUrl,
      title: meta["og:title"] ?? result.page.title ?? null,
      description: meta["og:description"] ?? meta.description ?? null,
      imageUrl: meta["og:image"] ?? null,
      plainText: result.page.plainText || null,
    },
  };
}
