import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "../server/db";
import { assertLoginAllowed, clearLoginFailures, LoginRateLimitError } from "../server/rate-limit";

vi.mock("../server/db", () => ({
  registerLoginAttempt: vi.fn(),
  clearLoginFailureAttempts: vi.fn(),
}));

const registerLoginAttempt = vi.mocked(db.registerLoginAttempt);
const clearLoginFailureAttempts = vi.mocked(db.clearLoginFailureAttempts);

describe("persistent login rate limiting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reserves each attempt using the shared 15-minute window", async () => {
    registerLoginAttempt.mockResolvedValue(1);

    await expect(assertLoginAllowed("person@example.com")).resolves.toBeUndefined();
    expect(registerLoginAttempt).toHaveBeenCalledWith("person@example.com", 15 * 60 * 1000);
  });

  it("rejects attempts after the eighth reservation", async () => {
    registerLoginAttempt.mockResolvedValue(9);

    await expect(assertLoginAllowed("person@example.com")).rejects.toBeInstanceOf(LoginRateLimitError);
  });

  it("does not hide database errors as rate-limit responses", async () => {
    registerLoginAttempt.mockRejectedValue(new Error("database unavailable"));

    await expect(assertLoginAllowed("person@example.com")).rejects.toThrow("database unavailable");
  });

  it("clears the stored counter after successful authentication", async () => {
    clearLoginFailureAttempts.mockResolvedValue(undefined);

    await expect(clearLoginFailures("person@example.com")).resolves.toBeUndefined();
    expect(clearLoginFailureAttempts).toHaveBeenCalledWith("person@example.com");
  });
});
