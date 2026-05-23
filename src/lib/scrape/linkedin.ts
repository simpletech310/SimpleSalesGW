/**
 * Best-effort LinkedIn company page fetch. LinkedIn often returns og:* tags
 * for company URLs even when behind an auth wall. We never try to bypass auth.
 */

import { fetchPage } from "@/lib/scrape/fetch-page";

export type LinkedInPayload = {
  source: "linkedin";
  url: string;
  finalUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  plainText: string | null;
  loginWall: boolean;
};

export async function fetchLinkedInCompany(url: string): Promise<{ ok: true; payload: LinkedInPayload } | { ok: false; reason: string }> {
  const result = await fetchPage(url);
  if (!result.ok) return { ok: false, reason: result.reason };
  const meta = result.page.metaTags;
  const ogTitle = meta["og:title"] ?? meta["twitter:title"] ?? null;
  const ogDesc = meta["og:description"] ?? meta["twitter:description"] ?? null;
  const ogImage = meta["og:image"] ?? meta["twitter:image"] ?? null;

  // LinkedIn auth wall pages often only render og:* tags and very little body.
  const loginWall = result.page.plainText.length < 600;

  return {
    ok: true,
    payload: {
      source: "linkedin",
      url,
      finalUrl: result.finalUrl,
      title: ogTitle ?? result.page.title,
      description: ogDesc,
      imageUrl: ogImage,
      plainText: loginWall ? null : result.page.plainText,
      loginWall,
    },
  };
}
