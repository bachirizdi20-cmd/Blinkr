import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
} from "react-native-nitro-google-signin";

export const googleStatusCodes = statusCodes;

export function configureGoogleNative(webClientId: string) {
  if (!webClientId.trim()) {
    throw new Error("Google Web OAuth client ID is missing.");
  }
  GoogleOneTapSignIn.configure({
    webClientId: webClientId.trim(),
    scopes: ["openid", "profile", "email"],
  });
}

export async function signInWithGoogleNative(): Promise<string | null> {
  await GoogleOneTapSignIn.checkPlayServices();
  // Credential Manager first tries a saved credential. If none exists, fall
  // back to the account picker instead of calling createAccount directly.
  // Calling createAccount alone can return a non-session response on Android.
  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.createAccount();
  }
  if (isNoSavedCredentialFoundResponse(response)) {
    response = await GoogleOneTapSignIn.presentExplicitSignIn();
  }
  if (isCancelledResponse(response)) return null;
  if (!isSuccessResponse(response)) {
    throw new Error("Google did not return a successful sign-in response.");
  }
  const idToken = response.data?.idToken;
  if (typeof idToken !== "string" || idToken.length < 100) {
    throw new Error("Google sign-in completed without returning an ID token. Check the Web OAuth client ID and Android OAuth SHA-1 configuration.");
  }
  return idToken;
}
