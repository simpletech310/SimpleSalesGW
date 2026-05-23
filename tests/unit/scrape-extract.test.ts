import { describe, expect, it } from "vitest";
import { extractFromHtml } from "@/lib/scrape/extract";

describe("extractFromHtml", () => {
  it("pulls title, meta tags, and plain text", () => {
    const html = `<!doctype html>
<html><head>
  <title>Pacific Coast Medical Group</title>
  <meta name="description" content="A multi-site medical practice.">
  <meta property="og:title" content="PCMG">
  <meta property="og:image" content="https://example.com/og.png">
</head>
<body>
  <script>alert(1)</script>
  <style>.x{color:red}</style>
  <h1>Welcome</h1>
  <p>We are a 3-location physician group serving San Diego County.</p>
</body></html>`;
    const out = extractFromHtml(html);
    expect(out.title).toBe("Pacific Coast Medical Group");
    expect(out.metaTags.description).toBe("A multi-site medical practice.");
    expect(out.metaTags["og:title"]).toBe("PCMG");
    expect(out.metaTags["og:image"]).toBe("https://example.com/og.png");
    expect(out.plainText).toContain("Welcome");
    expect(out.plainText).toContain("3-location physician group");
    expect(out.plainText).not.toContain("alert(1)");
    expect(out.plainText).not.toContain("color:red");
  });

  it("respects maxTextChars cap", () => {
    const big = "<html><body>" + "x".repeat(50_000) + "</body></html>";
    const out = extractFromHtml(big, 2000);
    expect(out.plainText.length).toBeLessThanOrEqual(2000);
  });

  it("handles HTML with no head gracefully", () => {
    const out = extractFromHtml("<p>just a body</p>");
    expect(out.title).toBe("");
    expect(out.plainText).toContain("just a body");
  });
});
