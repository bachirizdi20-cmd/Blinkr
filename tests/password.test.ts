import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../server/password";

describe("password authentication", () => {
  it("hashes and verifies a password without storing the raw value", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("uses a different salt for repeated passwords", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");
    expect(first).not.toBe(second);
  });
});
