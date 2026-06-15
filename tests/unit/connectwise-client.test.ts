import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthHeaders,
  buildRequestUrl,
  ConnectWiseApiError,
  ConnectWiseNotConfiguredError,
  cwRequest,
  type ConnectWiseCredentials,
} from "@/lib/connectwise/client";
import {
  buildSellAuthHeaders,
  ConnectWiseSellNotConfiguredError,
  sellRequest,
} from "@/lib/connectwise/sell-client";

const CREDS: ConnectWiseCredentials = {
  siteUrl: "https://api-na.myconnectwise.net",
  companyId: "gateway",
  publicKey: "pub123",
  privateKey: "priv456",
  clientId: "client-guid",
};

describe("buildAuthHeaders", () => {
  it("encodes Basic credential as base64(companyId+publicKey:privateKey)", () => {
    const headers = buildAuthHeaders(CREDS);
    const expected = Buffer.from("gateway+pub123:priv456").toString("base64");
    expect(headers.Authorization).toBe(`Basic ${expected}`);
  });

  it("passes the clientId header through verbatim", () => {
    expect(buildAuthHeaders(CREDS).clientId).toBe("client-guid");
  });

  it("requests JSON", () => {
    const headers = buildAuthHeaders(CREDS);
    expect(headers.Accept).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

describe("buildRequestUrl", () => {
  it("appends the CW api path when the site url omits it", () => {
    expect(buildRequestUrl("https://api-na.myconnectwise.net", "/system/members")).toBe(
      "https://api-na.myconnectwise.net/v4_6_release/apis/3.0/system/members",
    );
  });

  it("tolerates a trailing slash on the site url", () => {
    expect(buildRequestUrl("https://api-na.myconnectwise.net/", "/system/members")).toBe(
      "https://api-na.myconnectwise.net/v4_6_release/apis/3.0/system/members",
    );
  });

  it("does not double-append when the api path is already present", () => {
    expect(
      buildRequestUrl("https://api-na.myconnectwise.net/v4_6_release/apis/3.0", "/company/companies"),
    ).toBe("https://api-na.myconnectwise.net/v4_6_release/apis/3.0/company/companies");
  });

  it("serializes query params and skips undefined / empty values", () => {
    const url = buildRequestUrl("https://api-na.myconnectwise.net", "/company/companies", {
      pageSize: 100,
      conditions: 'types/name="Prospect"',
      page: undefined,
      fields: "",
    });
    expect(url).toContain("pageSize=100");
    expect(url).toContain("conditions=types%2Fname%3D%22Prospect%22");
    expect(url).not.toContain("page=");
    expect(url).not.toContain("fields=");
  });
});

describe("cwRequest", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("throws ConnectWiseNotConfiguredError when no creds are available", async () => {
    // No creds override and env is unset in the test runtime.
    await expect(cwRequest("/system/members")).rejects.toBeInstanceOf(ConnectWiseNotConfiguredError);
  });

  it("returns parsed JSON on a 2xx response", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify([{ id: 1, identifier: "GW" }]), { status: 200 }),
    ) as unknown as typeof fetch;

    const out = await cwRequest<Array<{ id: number }>>("/system/members", { creds: CREDS });
    expect(out).toEqual([{ id: 1, identifier: "GW" }]);
  });

  it("maps a non-retryable error to ConnectWiseApiError with the HTTP status", async () => {
    globalThis.fetch = vi.fn(async () => new Response("bad request", { status: 400 })) as unknown as typeof fetch;

    const err = await cwRequest("/company/companies", { creds: CREDS, maxRetries: 0 }).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectWiseApiError);
    expect((err as ConnectWiseApiError).status).toBe(400);
    expect((err as ConnectWiseApiError).body).toContain("bad request");
  });

  it("retries on 429 then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = cwRequest<{ ok: boolean }>("/system/members", { creds: CREDS });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxRetries on persistent 503", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = cwRequest("/system/members", { creds: CREDS, maxRetries: 2 }).catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await promise;
    expect(err).toBeInstanceOf(ConnectWiseApiError);
    expect((err as ConnectWiseApiError).status).toBe(503);
    // initial attempt + 2 retries = 3 calls
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("Sell client", () => {
  it("builds a Bearer auth header", () => {
    const headers = buildSellAuthHeaders({ apiUrl: "https://sell.example", apiKey: "sk-test" });
    expect(headers.Authorization).toBe("Bearer sk-test");
  });

  it("throws ConnectWiseSellNotConfiguredError when no creds are available", async () => {
    await expect(sellRequest("/quotes")).rejects.toBeInstanceOf(ConnectWiseSellNotConfiguredError);
  });
});
