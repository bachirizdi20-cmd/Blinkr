export const googleStatusCodes = {
  DEVELOPER_ERROR: "DEVELOPER_ERROR",
  PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
} as const;

export function configureGoogleNative(_webClientId: string) {
  // Native Google Sign-In is intentionally excluded from the web bundle.
}

export async function signInWithGoogleNative(): Promise<string | null> {
  throw new Error("Native Google Sign-In is only available in the Android app.");
}
