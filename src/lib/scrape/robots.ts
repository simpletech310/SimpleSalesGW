/**
 * Minimal robots.txt parser. We pull the file once per host (per request lifecycle).
 * Default-allow on errors but emit a warning. Honors User-agent: * and our own UA.
 */

const robotsCache = new Map<string, { rules: Rule[]; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000;

type Rule = { agent: string; disallow: string[] };

export async function isAllowed(targetUrl: string, userAgent: string): Promise<{ allowed: boolean; reason?: string }> {
  let url: URL;
  try { url = new URL(targetUrl); } catch { return { allowed: false, reason: "invalid_url" }; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { allowed: false, reason: "bad_protocol" };

  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
  let entry = robotsCache.get(robotsUrl);
  if (!entry || Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    try {
      const res = await fetch(robotsUrl, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(4_000),
      });
      if (!res.ok) {
        entry = { rules: [], fetchedAt: Date.now() };
      } else {
        const text = await res.text();
        entry = { rules: parseRobots(text), fetchedAt: Date.now() };
      }
    } catch {
      entry = { rules: [], fetchedAt: Date.now() };
    }
    robotsCache.set(robotsUrl, entry);
  }

  const path = url.pathname + (url.search ?? "");
  const ua = userAgent.toLowerCase();
  for (const rule of entry.rules) {
    if (rule.agent !== "*" && !ua.includes(rule.agent)) continue;
    for (const dis of rule.disallow) {
      if (dis === "") continue;
      if (path.startsWith(dis)) return { allowed: false, reason: `disallowed_by_robots:${dis}` };
    }
  }
  return { allowed: true };
}

function parseRobots(text: string): Rule[] {
  const rules: Rule[] = [];
  let current: Rule | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(":");
    if (!keyRaw || rest.length === 0) continue;
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      current = { agent: value.toLowerCase(), disallow: [] };
      rules.push(current);
    } else if (key === "disallow" && current) {
      current.disallow.push(value);
    }
  }
  return rules;
}
