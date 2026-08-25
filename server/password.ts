import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

type ScryptOptions = { N: number; r: number; p: number; maxmem: number };

function deriveKey(password: string, salt: Buffer, length: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived as Buffer);
    });
  });
}

function encode(buffer: Buffer) {
  return buffer.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: 32 * 1024 * 1024,
  });

  return ["scrypt", COST, BLOCK_SIZE, PARALLELIZATION, encode(salt), encode(derived)].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, costText, blockText, parallelText, saltText, hashText] = encoded.split("$");
  if (algorithm !== "scrypt" || !costText || !blockText || !parallelText || !saltText || !hashText) {
    return false;
  }

  const cost = Number(costText);
  const blockSize = Number(blockText);
  const parallelization = Number(parallelText);
  if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(blockSize) || !Number.isSafeInteger(parallelization)) {
    return false;
  }

  try {
    const expected = decode(hashText);
    const actual = await deriveKey(password, decode(saltText), expected.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: 32 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
