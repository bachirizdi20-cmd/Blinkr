import { describe, expect, it } from "vitest";

describe("GIPHY public key configuration", () => {
  it("can call the lightweight trending endpoint", async () => {
    const apiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch(
      `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(apiKey!)}&limit=1&rating=pg-13`,
    );
    const payload = (await response.json()) as { meta?: { status?: number } };

    expect(response.ok).toBe(true);
    expect(payload.meta?.status).toBe(200);
  }, 30_000);
});
