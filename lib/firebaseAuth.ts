import { getAuth, signOut } from "firebase/auth";
import { firebaseApp } from "./firebaseApp";

export const firebaseAuth = getAuth(firebaseApp);

export async function signOutFirebase() {
  await signOut(firebaseAuth);
}
