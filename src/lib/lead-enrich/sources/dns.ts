/**
 * v3.3.28 — DNS lookup tool.
 *
 * Pure Node `dns/promises` — zero external API. Gives us:
 *   - MX records → reveals Google Workspace / Microsoft 365 / on-prem
 *     mail (huge VoIP+IT signal: M365 customers are already comfortable
 *     paying for managed services).
 *   - SPF (from TXT) → which mail senders the domain authorizes; reveals
 *     CRM platform (Salesforce, HubSpot), marketing tools (Mailchimp,
 *     SendGrid), etc.
 *   - NS → hosting provider (Cloudflare, GoDaddy, AWS, etc.)
 *
 * Free, fast, and never blocked by Cloudflare.
 */

import { promises as dns } from "node:dns";

const RESOLVE_TIMEOUT_MS = 5_000;

export type DnsLookupResult =
  | {
      ok: true;
      domain: string;
      mxRecords: Array<{ exchange: string; priority: number }>;
      mxProvider: string | null;
      txtRecords: string[];
      spfSenders: string[];
      nsRecords: string[];
      nsProvider: string | null;
    }
  | { ok: false; reason: string };

/** Map MX hostnames to a recognizable provider label. */
function mxProvider(mxHosts: string[]): string | null {
  const joined = mxHosts.join(" ").toLowerCase();
  if (/google|gmail/.test(joined)) return "Google Workspace";
  if (/outlook|protection\.outlook|office365/.test(joined)) return "Microsoft 365";
  if (/zoho/.test(joined)) return "Zoho Mail";
  if (/proofpoint/.test(joined)) return "Proofpoint";
  if (/mimecast/.test(joined)) return "Mimecast";
  if (/barracudanetworks/.test(joined)) return "Barracuda";
  if (/messagelabs/.test(joined)) return "Symantec MessageLabs";
  if (/fastmail/.test(joined)) return "FastMail";
  if (/yahoo|aol/.test(joined)) return "Yahoo / AOL";
  return null;
}

/** Map NS hostnames to a recognizable hosting / DNS provider. */
function nsProvider(nsHosts: string[]): string | null {
  const joined = nsHosts.join(" ").toLowerCase();
  if (/cloudflare/.test(joined)) return "Cloudflare";
  if (/awsdns/.test(joined)) return "AWS Route 53";
  if (/azure-dns/.test(joined)) return "Azure DNS";
  if (/googledomains|google-domains|nsone\.net.*google/.test(joined)) return "Google Cloud DNS";
  if (/godaddy|domaincontrol/.test(joined)) return "GoDaddy";
  if (/dnsmadeeasy/.test(joined)) return "DNS Made Easy";
  if (/registrar-servers\.com/.test(joined)) return "Namecheap";
  if (/wordpress\.com|wpengine/.test(joined)) return "WordPress.com / WP Engine";
  if (/squarespace/.test(joined)) return "Squarespace";
  if (/wixdns/.test(joined)) return "Wix";
  if (/shopify/.test(joined)) return "Shopify";
  return null;
}

/** Extract `include:`/`a:`/`ip4:` tokens out of an SPF TXT record. */
function parseSpfSenders(txtRecords: string[]): string[] {
  const out = new Set<string>();
  for (const t of txtRecords) {
    if (!/^v=spf1/i.test(t)) continue;
    for (const m of t.matchAll(/\b(include|a|ip4|ip6|exists|redirect):([^\s]+)/gi)) {
      out.add(`${m[1]}:${m[2]}`);
    }
  }
  return Array.from(out).slice(0, 12);
}

export async function lookupDns(opts: { domain: string }): Promise<DnsLookupResult> {
  const domain = opts.domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "");
  if (!domain || !/\./.test(domain)) {
    return { ok: false, reason: "bad_domain" };
  }

  const withTimeout = <T>(p: Promise<T>, label: string): Promise<T | Error> =>
    Promise.race([
      p.catch((e: Error) => e),
      new Promise<Error>((resolve) =>
        setTimeout(() => resolve(new Error(`${label}_timeout`)), RESOLVE_TIMEOUT_MS),
      ),
    ]);

  const [mxRaw, txtRaw, nsRaw] = await Promise.all([
    withTimeout(dns.resolveMx(domain), "mx"),
    withTimeout(dns.resolveTxt(domain), "txt"),
    withTimeout(dns.resolveNs(domain), "ns"),
  ]);

  const mxRecords = Array.isArray(mxRaw)
    ? (mxRaw as Array<{ exchange: string; priority: number }>).sort((a, b) => a.priority - b.priority)
    : [];
  const txtRecords = Array.isArray(txtRaw)
    ? (txtRaw as string[][]).map((a) => a.join("")).filter(Boolean)
    : [];
  const nsRecords = Array.isArray(nsRaw) ? (nsRaw as string[]) : [];

  return {
    ok: true,
    domain,
    mxRecords,
    mxProvider: mxProvider(mxRecords.map((m) => m.exchange)),
    txtRecords,
    spfSenders: parseSpfSenders(txtRecords),
    nsRecords,
    nsProvider: nsProvider(nsRecords),
  };
}
