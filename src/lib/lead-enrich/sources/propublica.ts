/**
 * v3.3.28 — ProPublica Nonprofit Explorer.
 *
 * Free public API over Form 990 data for every 501(c) registered with
 * the IRS. No key.
 *   https://projects.propublica.org/nonprofits/api/v2
 */

const PROPUBLICA_SEARCH = "https://projects.propublica.org/nonprofits/api/v2/search.json";
const PROPUBLICA_ORG = "https://projects.propublica.org/nonprofits/api/v2/organizations";
const REQUEST_TIMEOUT_MS = 10_000;

export type NonprofitLookupResult =
  | {
      ok: true;
      ein: string;
      legalName: string;
      city?: string | null;
      state?: string | null;
      ntee?: string | null;
      latestRevenueUsd?: number | null;
      latestYear?: number | null;
      assetsUsd?: number | null;
      employeeCount?: number | null;
      raw: unknown;
    }
  | { ok: false; reason: string };

type PpOrgSearchHit = {
  ein?: number | string;
  name?: string;
  city?: string;
  state?: string;
  ntee_code?: string;
};

type PpOrgDetail = {
  organization?: { ein?: number | string; name?: string; city?: string; state?: string };
  filings_with_data?: Array<{
    tax_prd_yr?: number;
    totrevenue?: number;
    totassetsend?: number;
    totemployee?: number;
  }>;
};

export async function lookupNonprofit(opts: {
  einOrName: string;
}): Promise<NonprofitLookupResult> {
  const q = opts.einOrName.trim();
  if (!q) return { ok: false, reason: "missing_query" };

  // Detect a raw EIN (NN-NNNNNNN or 9 digits) — skip the search hop.
  const einDigits = q.replace(/\D/g, "");
  let ein: string | null = einDigits.length === 9 ? einDigits : null;
  let name: string | null = null;

  if (!ein) {
    let res: Response;
    try {
      const u = new URL(PROPUBLICA_SEARCH);
      u.searchParams.set("q", q);
      res = await fetch(u.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      return { ok: false, reason: `search_failed: ${(err as Error).message}` };
    }
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const data = (await res.json()) as { organizations?: PpOrgSearchHit[] };
    const rows = data.organizations ?? [];
    if (rows.length === 0) return { ok: false, reason: "no_results" };
    const pick = rows[0]!;
    ein = String(pick.ein ?? "").padStart(9, "0");
    name = pick.name ?? null;
  }
  if (!ein) return { ok: false, reason: "no_ein_resolved" };

  // Pull the detail record (most recent filing).
  let dres: Response;
  try {
    dres = await fetch(`${PROPUBLICA_ORG}/${ein}.json`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, reason: `detail_failed: ${(err as Error).message}` };
  }
  if (!dres.ok) return { ok: false, reason: `detail_http_${dres.status}` };
  const detail = (await dres.json()) as PpOrgDetail;

  const org = detail.organization ?? {};
  const latest = detail.filings_with_data?.[0];

  return {
    ok: true,
    ein,
    legalName: org.name ?? name ?? "(unknown)",
    city: org.city ?? null,
    state: org.state ?? null,
    ntee: null,
    latestRevenueUsd: latest?.totrevenue ?? null,
    latestYear: latest?.tax_prd_yr ?? null,
    assetsUsd: latest?.totassetsend ?? null,
    employeeCount: latest?.totemployee ?? null,
    raw: detail,
  };
}
