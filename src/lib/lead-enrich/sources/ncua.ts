/**
 * v3.3.28 — NCUA (National Credit Union Administration) lookup.
 *
 * The NCUA publishes quarterly Call Report data for every federal +
 * state credit union in the US as bulk downloads — there's no
 * authoritative free per-credit-union JSON API. So we use the public
 * "Research a Credit Union" search page (https://mapping.ncua.gov)
 * which serves a JSON-backed search endpoint we can call directly.
 *
 * If that endpoint ever moves, the tool degrades gracefully (returns
 * ok: false) and the agent loop routes around via web_search.
 *
 * Free. Anonymous. Critical for LAPFCU-class targets where the
 * homepage is Cloudflare-protected — NCUA gives us authoritative
 * employee count + branch count + assets without ever touching the
 * credit union's website.
 */

const NCUA_SEARCH_URL = "https://mapping.ncua.gov/Lookup/LookupCreditUnions";
const REQUEST_TIMEOUT_MS = 10_000;

export type NcuaLookupResult =
  | {
      ok: true;
      charterNumber: string;
      legalName: string;
      shortName?: string | null;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
      websiteUrl?: string | null;
      employeeCount?: number | null;
      memberCount?: number | null;
      branchCount?: number | null;
      totalAssetsUsd?: number | null;
      assetSizeBand?: string | null;
      raw: unknown;
    }
  | { ok: false; reason: string };

type NcuaRow = {
  ID?: string | number;
  CharterNumber?: string | number;
  CharterID?: string | number;
  Name?: string;
  Web?: string;
  Website?: string;
  Address?: string;
  City?: string;
  State?: string;
  Zip?: string;
  ZipCode?: string;
  TotalEmployees?: number;
  Employees?: number;
  TotalMembers?: number;
  Members?: number;
  TotalBranches?: number;
  Branches?: number;
  TotalAssets?: number;
  Assets?: number;
};

export async function lookupCreditUnion(opts: {
  name: string;
  state?: string | null;
}): Promise<NcuaLookupResult> {
  const name = opts.name.trim();
  if (!name) return { ok: false, reason: "missing_name" };

  // NCUA's search accepts a partial name + optional state filter.
  // Endpoint expects a POST with form-urlencoded fields.
  const body = new URLSearchParams();
  body.set("searchType", "name");
  body.set("searchValue", name);
  if (opts.state) body.set("state", opts.state.toUpperCase().slice(0, 2));

  let res: Response;
  try {
    res = await fetch(NCUA_SEARCH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, reason: `fetch_failed: ${(err as Error).message}` };
  }
  if (!res.ok) return { ok: false, reason: `http_${res.status}` };

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: "non_json_response" };
  }

  const rows: NcuaRow[] = Array.isArray(data)
    ? (data as NcuaRow[])
    : Array.isArray((data as { d?: NcuaRow[] })?.d)
    ? (data as { d: NcuaRow[] }).d
    : [];

  if (rows.length === 0) return { ok: false, reason: "no_results" };

  // Best match: exact (case-insensitive) → state-bound → first row.
  const lowered = name.toLowerCase();
  const exact = rows.find((r) => (r.Name ?? "").toLowerCase() === lowered);
  const byState = opts.state
    ? rows.find((r) => (r.State ?? "").toUpperCase() === opts.state!.toUpperCase())
    : null;
  const pick = exact ?? byState ?? rows[0]!;

  const charterNumber = String(pick.CharterNumber ?? pick.CharterID ?? pick.ID ?? "").trim();
  const legalName = (pick.Name ?? "").trim();
  if (!charterNumber || !legalName) return { ok: false, reason: "malformed_row" };

  const assets = pick.TotalAssets ?? pick.Assets ?? null;

  return {
    ok: true,
    charterNumber,
    legalName,
    shortName: null,
    city: pick.City ?? null,
    state: pick.State ?? null,
    zip: pick.Zip ?? pick.ZipCode ?? null,
    websiteUrl: pick.Web ?? pick.Website ?? null,
    employeeCount: pick.TotalEmployees ?? pick.Employees ?? null,
    memberCount: pick.TotalMembers ?? pick.Members ?? null,
    branchCount: pick.TotalBranches ?? pick.Branches ?? null,
    totalAssetsUsd: typeof assets === "number" ? assets : null,
    assetSizeBand: bandForAssets(typeof assets === "number" ? assets : null),
    raw: pick,
  };
}

/** Turn raw assets in USD into a sales-readable band string. */
function bandForAssets(assets: number | null): string | null {
  if (assets == null || !Number.isFinite(assets) || assets <= 0) return null;
  if (assets < 50_000_000) return "<$50M";
  if (assets < 250_000_000) return "$50M-$250M";
  if (assets < 1_000_000_000) return "$250M-$1B";
  if (assets < 10_000_000_000) return "$1B-$10B";
  return ">$10B";
}
