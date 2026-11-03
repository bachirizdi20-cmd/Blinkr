import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/_core/auth", () => ({
  getSessionToken: vi.fn(async () => "test-session-token"),
}));
vi.mock("@/constants/oauth", () => ({
  getApiBaseUrl: () => "https://api.example.test",
}));

import { ApiRequestError, getMe } from "@/lib/_core/api";

afterEach(() => vi.unstubAllGlobals());

describe("auth.getMe session validation", () => {
  it("returns null for an expired or invalid session (401)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "Not authenticated", user: null }),
      { status: 401, headers: { "content-type": "application/json" } },
    )));

    await expect(getMe()).resolves.toBeNull();
  });

  it("preserves server errors instead of treating them as logout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "Temporarily unavailable" }),
      { status: 503, headers: { "content-type": "application/json" } },
    )));

    await expect(getMe()).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 503,
    } satisfies Partial<ApiRequestError>);
  });

  it("preserves network errors so a cached session can remain available offline", async () => {
    const networkError = new TypeError("Network request failed");
    vi.stubGlobal("fetch", vi.fn(async () => { throw networkError; }));

    await expect(getMe()).rejects.toBe(networkError);
  });
});
