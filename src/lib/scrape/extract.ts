/**
 * HTML → { title, metaTags, plainText } extractor.
 * Strips <script>, <style>, <noscript>, <svg>, comments. Trims whitespace.
 */

import { parse } from "node-html-parser";

export type ExtractedPage = {
  title: string;
  metaTags: Record<string, string>;
  plainText: string;
};

export function extractFromHtml(html: string, maxTextChars = 8000): ExtractedPage {
  const root = parse(html, {
    blockTextElements: { script: false, noscript: false, style: false, pre: true },
  });

  // Strip noise
  root.querySelectorAll("script, style, noscript, svg, iframe, link, head > meta").forEach((n) => n.remove());

  const title = (root.querySelector("title")?.text ?? "").trim().slice(0, 300);

  const metaTags: Record<string, string> = {};
  // Re-parse just the head for meta tags since we stripped them above
  const headOnly = parse(html, { blockTextElements: { script: false, noscript: false, style: false } });
  for (const m of headOnly.querySelectorAll("meta")) {
    const name = m.getAttribute("name") || m.getAttribute("property") || "";
    const content = m.getAttribute("content");
    if (name && content && metaTags[name] === undefined) metaTags[name] = content.slice(0, 500);
  }

  const text = root.text.replace(/\s+/g, " ").trim().slice(0, maxTextChars);
  return { title, metaTags, plainText: text };
}
