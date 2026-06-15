/**
 * v3.5 — ConnectWise Manage (PSA) REST client.
 *
 * Server-only. ConnectWise is the system of record (see the v3.5 integration
 * plan): the portal pushes tickets/quotes/company-conversions here and pulls
 * CW-originated leads + the reps' tickets back.
 *
 * Auth (API-member keys): the Authorization header is
 *   Basic base64("<companyId>+<publicKey>:<privateKey>")
 * plus a `clientId` header registered at developer.connectwise.com. See
 * https://developer.connectwise.com/Authentication.
 *
 * This module is the transport layer only — typed entity mappers live in
 * `./mappers/*`. Every call degrades cleanly: if CW isn't configured, callers
 * get a `ConnectWiseNotConfiguredError` they translate into a queued sync row
 * rather than a user-facing failure.
 */

import { env } from "@/lib/env";

/** API version segment of the CW REST path. */
const CW_API_PATH = "/v4_6_release/apis/3.0";

export class ConnectWiseNotConfiguredError extends Error {
  constructor() {
    super("ConnectWise is not configured (set CW_SITE_URL + CW_COMPANY_ID + CW_PUBLIC_KEY + CW_PRIVATE_KEY + CW_CLIENT_ID)");
    this.name = "ConnectWiseNotConfiguredError";
  }
}

/** Thrown on a non-2xx CW response. `status` mirrors the HTTP status so route
 *  handlers can map it onto an ApiError. `body` is the raw CW error payload. */
export class ConnectWiseApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, context: string) {
    super(`ConnectWise ${context} failed (${status}): ${body}`);
    this.name = "ConnectWiseApiError";
    this.status = status;
    this.body = body;
  }
}

export type ConnectWiseCredentials = {
  siteUrl: string;
  companyId: string;
  publicKey: string;
  privateKey: string;
  clientId: string;
};

/** Reads credentials from env. Returns null if any required field is blank. */
export function connectWiseCredentials(): ConnectWiseCredentials | null {
  const e = env();
  if (!e.CW_SITE_URL || !e.CW_COMPANY_ID || !e.CW_PUBLIC_KEY || !e.CW_PRIVATE_KEY || !e.CW_CLIENT_ID) {
    return null;
  }
  return {
    siteUrl: e.CW_SITE_URL,
    companyId: e.CW_COMPANY_ID,
    publicKey: e.CW_PUBLIC_KEY,
    privateKey: e.CW_PRIVATE_KEY,
    clientId: e.CW_CLIENT_ID,
  };
}

export function isConnectWiseConfigured(): boolean {
  return connectWiseCredentials() !== null;
}

/**
 * Pure auth-header builder — takes explicit creds so it's unit-testable
 * without env. The CW Basic credential is "companyId+publicKey:privateKey".
 */
export function buildAuthHeaders(creds: ConnectWiseCredentials): Record<string, string> {
  const basic = Buffer.from(`${creds.companyId}+${creds.publicKey}:${creds.privateKey}`).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    clientId: creds.clientId,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/** Normalize the base URL so `siteUrl` may be given with or without a trailing
 *  slash and with or without the api path already appended. */
export function buildRequestUrl(siteUrl: string, path: string, query?: Record<string, string | number | undefined>): string {
  const base = siteUrl.replace(/\/+$/, "");
  const root = base.endsWith(CW_API_PATH) ? base : `${base}${CW_API_PATH}`;
  const rel = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${root}${rel}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export type CwRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Query-string params (CW conditions, pageSize, page, fields, etc.). */
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** Max retry attempts on 429 / 5xx (default 3). */
  maxRetries?: number;
  /** Override the configured credentials (used in tests). */
  creds?: ConnectWiseCredentials;
};

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Backoff in ms for attempt N (0-based): 0.5s, 1s, 2s … capped at 8s. */
function backoffMs(attempt: number): number {
  return Math.min(8000, 500 * 2 ** attempt);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Low-level CW request with retry/backoff on transient failures. Throws
 * `ConnectWiseNotConfiguredError` when creds are absent and the caller didn't
 * pass an explicit override, and `ConnectWiseApiError` on a non-2xx response.
 */
export async function cwRequest<T = unknown>(path: string, opts: CwRequestOptions = {}): Promise<T> {
  const creds = opts.creds ?? connectWiseCredentials();
  if (!creds) throw new ConnectWiseNotConfiguredError();

  const method = opts.method ?? "GET";
  const url = buildRequestUrl(creds.siteUrl, path, opts.query);
  const headers = buildAuthHeaders(creds);
  const maxRetries = opts.maxRetries ?? 3;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (networkErr) {
      // Network-level failure — retry if attempts remain.
      lastErr = networkErr;
      if (attempt < maxRetries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw networkErr;
    }

    if (res.ok) {
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }

    const text = await res.text().catch(() => "");
    if (RETRYABLE.has(res.status) && attempt < maxRetries) {
      lastErr = new ConnectWiseApiError(res.status, text, `${method} ${path}`);
      await sleep(backoffMs(attempt));
      continue;
    }
    throw new ConnectWiseApiError(res.status, text, `${method} ${path}`);
  }
  // Unreachable in practice; satisfies the type checker.
  throw lastErr ?? new Error("ConnectWise request failed");
}

// ---------------------------------------------------------------------------
// Minimal typed read helpers (used by the Phase 0 read-only smoke test and the
// Member↔User mapping). Mutations (tickets, company convert, quotes) live in
// their per-step modules once the CW boards/statuses are confirmed.
// ---------------------------------------------------------------------------

export type CwMember = {
  id: number;
  identifier: string;
  firstName?: string;
  lastName?: string;
  primaryEmail?: string;
  inactiveFlag?: boolean;
};

export type CwCompany = {
  id: number;
  identifier: string;
  name: string;
  status?: { id: number; name: string };
  types?: Array<{ id: number; name: string }>;
};

/** List CW members (paged). Used to map portal Users → CW members by email. */
export function listMembers(query?: Record<string, string | number | undefined>): Promise<CwMember[]> {
  return cwRequest<CwMember[]>("/system/members", { query: { pageSize: 100, ...query } });
}

/** List CW companies (paged). `conditions` is CW's query DSL,
 *  e.g. `types/name="Prospect"`. */
export function listCompanies(query?: Record<string, string | number | undefined>): Promise<CwCompany[]> {
  return cwRequest<CwCompany[]>("/company/companies", { query: { pageSize: 100, ...query } });
}
