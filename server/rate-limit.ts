import * as db from "./db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export class LoginRateLimitError extends Error {
  constructor() {
    super("Too many failed attempts. Please wait 15 minutes and try again.");
    this.name = "LoginRateLimitError";
  }
}

// Reserve attempts atomically before password verification so concurrent requests
// cannot all pass the same pre-check and exceed the configured limit.
export async function assertLoginAllowed(email: string) {
  const attemptCount = await db.registerLoginAttempt(email, WINDOW_MS);
  if (attemptCount > MAX_FAILURES) throw new LoginRateLimitError();
}

export async function clearLoginFailures(email: string) {
  await db.clearLoginFailureAttempts(email);
}
