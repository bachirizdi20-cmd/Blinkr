import {
  GoogleOneTapSignIn,
  isCancelledResponse,
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
  const response = await GoogleOneTapSignIn.createAccount();
  if (isCancelledResponse(response)) return null;
  if (!isSuccessResponse(response)) {
    throw new Error("Google did not return a successful sign-in response.");
  }
  return response.data.idToken;
}
