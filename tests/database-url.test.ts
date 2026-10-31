import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../server/db";

describe("database host overrides", () => {
  it("replaces only the host and port while preserving credentials and query options", () => {
    const original = "mysql://dbuser:dbpass@old.example:3306/defaultdb?ssl-mode=REQUIRED";
    const resolved = new URL(resolveDatabaseUrl(original, "mysql-1a784086-sulaimanthe78-5e29.d.aivencloud.com", "24158"));

    expect(resolved.hostname).toBe("mysql-1a784086-sulaimanthe78-5e29.d.aivencloud.com");
    expect(resolved.port).toBe("24158");
    expect(resolved.username).toBe("dbuser");
    expect(resolved.password).toBe("dbpass");
    expect(resolved.pathname).toBe("/defaultdb");
    expect(resolved.searchParams.get("ssl-mode")).toBe("REQUIRED");
  });

  it("rejects malformed host overrides and ports", () => {
    const original = "mysql://dbuser:dbpass@old.example:3306/defaultdb";
    expect(() => resolveDatabaseUrl(original, "https://wrong.example", "24158")).toThrow();
    expect(() => resolveDatabaseUrl(original, "new.example", "99999")).toThrow();
  });
});
