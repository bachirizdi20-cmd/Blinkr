import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
} from "react-native-nitro-google-signin";

export const googleStatusCodes = statusCodes;

export function configureGoogleNative(webClientId: string) {
  GoogleOneTapSignIn.configure({
    webClientId,
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
  return response.data.idToken;
}
