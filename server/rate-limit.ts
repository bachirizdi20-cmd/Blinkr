const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const failures = new Map<string, { count: number; firstAt: number }>();

function keyFor(email: string) {
  return email.trim().toLowerCase();
}

export function assertLoginAllowed(email: string) {
  const key = keyFor(email);
  const record = failures.get(key);
  if (!record) return;
  if (Date.now() - record.firstAt >= WINDOW_MS) {
    failures.delete(key);
    return;
  }
  if (record.count >= MAX_FAILURES) {
    throw new Error('Too many failed attempts. Please wait 15 minutes and try again.');
  }
}

export function recordLoginFailure(email: string) {
  const key = keyFor(email);
  const current = failures.get(key);
  const now = Date.now();
  if (!current || now - current.firstAt >= WINDOW_MS) {
    failures.set(key, { count: 1, firstAt: now });
  } else {
    failures.set(key, { ...current, count: current.count + 1 });
  }
}

export function clearLoginFailures(email: string) {
  failures.delete(keyFor(email));
}
