import { createRemoteJWKSet, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type FirebaseIdentity = {
  uid: string;
  email: string;
  emailVerified: true;
};

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseIdentity> {
  const projectId = ENV.firebaseProjectId;
  if (!projectId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Firebase authentication is not configured on the server" });
  }

  try {
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    });

    if (
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      typeof payload.email !== "string" ||
      payload.email.length === 0 ||
      payload.email_verified !== true
    ) {
      throw new Error("Required Firebase claims are missing");
    }

    return { uid: payload.sub, email: payload.email, emailVerified: true };
  } catch {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Firebase sign-in is invalid or the email is not verified" });
  }
}
