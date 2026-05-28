/**
 * v3.3.28 — OpenCorporates business-registry lookup.
 *
 * Free tier of OpenCorporates exposes a public companies search:
 *   https://api.opencorporates.com/v0.4/companies/search?q=...
 *
 * Rate-limited but unauthenticated. We return the top hit's entity
 * type, status, incorporation date, and registered agent (if any).
 *
 * If the free tier ever requires a key, the call will start returning
 * non-200 and the tool degrades gracefully — agent routes around via
 * web_search.
 */

const OPENCORPORATES_API = "https://api.opencorporates.com/v0.4/companies/search";
const REQUEST_TIMEOUT_MS = 10_000;

export type BusinessRegistryResult =
  | {
      ok: true;
      jurisdictionCode: string;
      companyNumber: string;
      legalName: string;
      companyType?: string | null;
      currentStatus?: string | null;
      incorporationDate?: string | null;
      registeredAddress?: string | null;
      registryUrl?: string | null;
      raw: unknown;
    }
  | { ok: false; reason: string };

type OcCompany = {
  company?: {
    jurisdiction_code?: string;
    company_number?: string;
    name?: string;
    company_type?: string;
    current_status?: string;
    incorporation_date?: string;
    registered_address_in_full?: string;
    opencorporates_url?: string;
  };
};

export async function lookupBusinessRegistry(opts: {
  name: string;
  state?: string | null;
}): Promise<BusinessRegistryResult> {
  const q = opts.name.trim();
  if (!q) return { ok: false, reason: "missing_name" };

  const url = new URL(OPENCORPORATES_API);
  url.searchParams.set("q", q);
  if (opts.state) {
    // OpenCorporates jurisdiction codes for US states are us_<lower-state>.
    url.searchParams.set("jurisdiction_code", `us_${opts.state.toLowerCase().slice(0, 2)}`);
  }
  url.searchParams.set("per_page", "5");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, reason: `fetch_failed: ${(err as Error).message}` };
  }
  if (!res.ok) return { ok: false, reason: `http_${res.status}` };

  const data = (await res.json()) as {
    results?: { companies?: OcCompany[] };
  };
  const rows = data.results?.companies ?? [];
  if (rows.length === 0) return { ok: false, reason: "no_results" };

  // Prefer Active over Inactive, then take the first.
  const active = rows.find((r) => (r.company?.current_status ?? "").toLowerCase().includes("active"));
  const pick = active?.company ?? rows[0]!.company;
  if (!pick) return { ok: false, reason: "malformed_row" };

  return {
    ok: true,
    jurisdictionCode: pick.jurisdiction_code ?? "",
    companyNumber: pick.company_number ?? "",
    legalName: pick.name ?? "",
    companyType: pick.company_type ?? null,
    currentStatus: pick.current_status ?? null,
    incorporationDate: pick.incorporation_date ?? null,
    registeredAddress: pick.registered_address_in_full ?? null,
    registryUrl: pick.opencorporates_url ?? null,
    raw: pick,
  };
}
