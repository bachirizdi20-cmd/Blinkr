import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const projectId = "blinkr-c7f8d";
let privateKey: CryptoKey;
let verifyFirebaseIdToken: typeof import("../server/_core/firebase-auth").verifyFirebaseIdToken;

async function makeToken(emailVerified: boolean) {
  return new SignJWT({ email: "verified@example.com", email_verified: emailVerified })
    .setProtectedHeader({ alg: "RS256", kid: "test-firebase-key", typ: "JWT" })
    .setIssuer(`https://securetoken.google.com/${projectId}`)
    .setAudience(projectId)
    .setSubject("test-firebase-uid")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

beforeAll(async () => {
  vi.stubEnv("FIREBASE_PROJECT_ID", projectId);
  const keyPair = await generateKeyPair("RS256");
  privateKey = keyPair.privateKey;
  const publicJwk = {
    ...(await exportJWK(keyPair.publicKey)),
    kid: "test-firebase-key",
    alg: "RS256",
    use: "sig",
  };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
  })));
  vi.resetModules();
  ({ verifyFirebaseIdToken } = await import("../server/_core/firebase-auth"));
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Firebase ID token verification", () => {
  it("accepts a correctly signed token for this project with a verified email", async () => {
    await expect(verifyFirebaseIdToken(await makeToken(true))).resolves.toEqual({
      uid: "test-firebase-uid",
      email: "verified@example.com",
      emailVerified: true,
    });
  });

  it("rejects a correctly signed token until the email is verified", async () => {
    await expect(verifyFirebaseIdToken(await makeToken(false))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
