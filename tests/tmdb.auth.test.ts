import { describe, expect, it } from "vitest";

const token = process.env.TMDB_API_READ_TOKEN;

describe("TMDB credentials", () => {
  it.skipIf(!token)("accepts the configured read token", async () => {
    if (!token) return;

    const response = await fetch("https://api.themoviedb.org/3/authentication", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as { success?: boolean; status_message?: string };

    expect(response.ok, body.status_message ?? "TMDB authentication failed").toBe(true);
    expect(body.success).toBe(true);
  }, 15_000);
});
