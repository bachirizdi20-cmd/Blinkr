import * as db from "./db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export class LoginRateLimitError extends Error {
  constructor() {
    super("Too many failed attempts. Please wait 15 minutes and try again.");
    this.name = "LoginRateLimitError";
  }
}

export async function assertLoginAllowed(email: string) {
  const record = await db.getLoginFailureRecord(email);
  if (!record) return;
  if (Date.now() - record.windowStartedAt.getTime() >= WINDOW_MS) return;
  if (record.attemptCount >= MAX_FAILURES) throw new LoginRateLimitError();
}

export async function recordLoginFailure(email: string) {
  await db.recordLoginFailureAttempt(email, WINDOW_MS);
}

export async function clearLoginFailures(email: string) {
  await db.clearLoginFailureAttempts(email);
}
