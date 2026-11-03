import { describe, expect, it } from "vitest";

const apiKey = process.env.GIPHY_API_KEY;

describe("GIPHY API credentials", () => {
  it.skipIf(!apiKey)("accepts the configured API key for a lightweight trending request", async () => {
    if (!apiKey) return;

    const url = new URL("https://api.giphy.com/v1/gifs/trending");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("limit", "1");
    url.searchParams.set("rating", "g");

    const response = await fetch(url);
    expect(response.ok, `GIPHY returned HTTP ${response.status}`).toBe(true);

    const payload = (await response.json()) as {
      meta?: { status?: number };
      data?: unknown[];
    };
    expect(payload.meta?.status).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
  }, 15_000);
});
