/**
 * v3.5 — ConnectWise Sell (CPQ) client skeleton.
 *
 * Quotes are pushed here from the portal's Proposal builder (Phase 4). Sell may
 * live on the same instance as Manage or a separate CPQ surface, so it carries
 * its own base URL + key (CW_SELL_API_URL / CW_SELL_API_KEY).
 *
 * The exact Sell quote payload + product mapping depend on the customer's Sell
 * catalog (an open item in the plan), so the mutation surface is intentionally
 * left as a typed boundary here; the transport + config gate are implemented so
 * Phase 4 can fill in `createQuote` against confirmed catalog ids.
 */

import { env } from "@/lib/env";
import { ConnectWiseApiError } from "./client";

export class ConnectWiseSellNotConfiguredError extends Error {
  constructor() {
    super("ConnectWise Sell is not configured (set CW_SELL_API_URL + CW_SELL_API_KEY)");
    this.name = "ConnectWiseSellNotConfiguredError";
  }
}

export type ConnectWiseSellCredentials = {
  apiUrl: string;
  apiKey: string;
};

export function connectWiseSellCredentials(): ConnectWiseSellCredentials | null {
  const e = env();
  if (!e.CW_SELL_API_URL || !e.CW_SELL_API_KEY) return null;
  return { apiUrl: e.CW_SELL_API_URL, apiKey: e.CW_SELL_API_KEY };
}

export function isConnectWiseSellConfigured(): boolean {
  return connectWiseSellCredentials() !== null;
}

export function buildSellAuthHeaders(creds: ConnectWiseSellCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export type SellRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  creds?: ConnectWiseSellCredentials;
};

/** Low-level Sell request. Mirrors `cwRequest` but against the Sell base URL. */
export async function sellRequest<T = unknown>(path: string, opts: SellRequestOptions = {}): Promise<T> {
  const creds = opts.creds ?? connectWiseSellCredentials();
  if (!creds) throw new ConnectWiseSellNotConfiguredError();

  const base = creds.apiUrl.replace(/\/+$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${base}${rel}`, {
    method: opts.method ?? "GET",
    headers: buildSellAuthHeaders(creds),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ConnectWiseApiError(res.status, text, `Sell ${opts.method ?? "GET"} ${path}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
