import { describe, expect, it } from "vitest";

const apiKey = process.env.RESEND_API_KEY;

describe("Resend credentials", () => {
  it.skipIf(!apiKey)("authenticates against the domains endpoint without exposing the key", async () => {
    if (!apiKey) return;

    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
    expect(response.ok).toBe(true);
  }, 20_000);
});
