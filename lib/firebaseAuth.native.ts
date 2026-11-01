import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FirebaseAuth from "@firebase/auth";
import type { Persistence } from "@firebase/auth";
import { firebaseApp } from "./firebaseApp";

const nativeAuthApi = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

function createNativeAuth() {
  try {
    return nativeAuthApi.initializeAuth(firebaseApp, {
      persistence: nativeAuthApi.getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if ((error as { code?: string }).code === "auth/already-initialized") {
      return nativeAuthApi.getAuth(firebaseApp);
    }
    throw error;
  }
}

export const firebaseAuth = createNativeAuth();

export async function signOutFirebase() {
  await nativeAuthApi.signOut(firebaseAuth);
}
