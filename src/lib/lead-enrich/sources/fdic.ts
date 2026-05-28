/**
 * v3.3.28 — FDIC BankFind lookup.
 *
 * FDIC's public BankFind Suite API serves all insured US banks +
 * thrifts. No key, no auth, JSON, well-documented:
 *   https://banks.data.fdic.gov/docs/
 *
 * We hit the /institutions endpoint with a name filter, then return
 * the best match's key facts.
 */

const FDIC_API = "https://banks.data.fdic.gov/api/institutions";
const REQUEST_TIMEOUT_MS = 10_000;

export type FdicLookupResult =
  | {
      ok: true;
      certNumber: string;
      legalName: string;
      city?: string | null;
      state?: string | null;
      websiteUrl?: string | null;
      employeeCount?: number | null;
      branchCount?: number | null;
      totalAssetsUsd?: number | null;
      assetSizeBand?: string | null;
      establishedYear?: number | null;
      raw: unknown;
    }
  | { ok: false; reason: string };

type FdicInstitution = {
  CERT?: string | number;
  NAME?: string;
  CITY?: string;
  STALP?: string; // state postal
  WEBADDR?: string;
  ASSET?: number;
  STMULT?: number;
  OFFICES?: number;
  NUMEMP?: number;
  ESTYMD?: string; // YYYYMMDD
};

export async function lookupBank(opts: {
  name: string;
  state?: string | null;
}): Promise<FdicLookupResult> {
  const name = opts.name.trim();
  if (!name) return { ok: false, reason: "missing_name" };

  // BankFind uses a Solr-like query string. Escape quotes; field=value
  // restricts to active institutions.
  const filters: string[] = [`NAME:*${escapeSolr(name)}*`, "ACTIVE:1"];
  if (opts.state) filters.push(`STALP:${opts.state.toUpperCase().slice(0, 2)}`);
  const url = new URL(FDIC_API);
  url.searchParams.set("filters", filters.join(" AND "));
  url.searchParams.set(
    "fields",
    "CERT,NAME,CITY,STALP,WEBADDR,ASSET,OFFICES,NUMEMP,ESTYMD",
  );
  url.searchParams.set("limit", "5");
  url.searchParams.set("sort_by", "ASSET");
  url.searchParams.set("sort_order", "DESC");

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

  let data: { data?: Array<{ data?: FdicInstitution }> };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, reason: "non_json_response" };
  }
  const rows = (data.data ?? []).map((r) => r.data).filter((r): r is FdicInstitution => !!r);
  if (rows.length === 0) return { ok: false, reason: "no_results" };

  const lowered = name.toLowerCase();
  const exact = rows.find((r) => (r.NAME ?? "").toLowerCase() === lowered);
  const pick = exact ?? rows[0]!;

  const cert = String(pick.CERT ?? "").trim();
  const legalName = (pick.NAME ?? "").trim();
  if (!cert || !legalName) return { ok: false, reason: "malformed_row" };

  const establishedYear =
    typeof pick.ESTYMD === "string" && /^\d{4}/.test(pick.ESTYMD)
      ? Number(pick.ESTYMD.slice(0, 4))
      : null;

  return {
    ok: true,
    certNumber: cert,
    legalName,
    city: pick.CITY ?? null,
    state: pick.STALP ?? null,
    websiteUrl: pick.WEBADDR ?? null,
    employeeCount: pick.NUMEMP ?? null,
    branchCount: pick.OFFICES ?? null,
    totalAssetsUsd: typeof pick.ASSET === "number" ? pick.ASSET * 1000 : null, // FDIC reports in $thousands
    assetSizeBand: bandForAssets(typeof pick.ASSET === "number" ? pick.ASSET * 1000 : null),
    establishedYear,
    raw: pick,
  };
}

function escapeSolr(s: string): string {
  return s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}

function bandForAssets(assets: number | null): string | null {
  if (assets == null || !Number.isFinite(assets) || assets <= 0) return null;
  if (assets < 100_000_000) return "<$100M";
  if (assets < 1_000_000_000) return "$100M-$1B";
  if (assets < 10_000_000_000) return "$1B-$10B";
  if (assets < 100_000_000_000) return "$10B-$100B";
  return ">$100B";
}
