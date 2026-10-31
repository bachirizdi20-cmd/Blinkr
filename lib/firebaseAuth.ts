import { getAuth } from "firebase/auth";
import { firebaseApp } from "./firebaseApp";

export const firebaseAuth = getAuth(firebaseApp);
