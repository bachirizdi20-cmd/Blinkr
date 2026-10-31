import { getApp, getApps, initializeApp } from "firebase/app";

// Firebase web-app configuration is public client configuration, not an Admin credential.
export const firebaseConfig = {
  apiKey: "AIzaSyBCWk_kh5mouJnzPejqLrMd30oirzXl0xY",
  authDomain: "blinkr-c7f8d.firebaseapp.com",
  projectId: "blinkr-c7f8d",
  storageBucket: "blinkr-c7f8d.firebasestorage.app",
  messagingSenderId: "358102487595",
  appId: "1:358102487595:web:4ec017bfefeaf434a0106e",
  measurementId: "G-RGJ80DW2JY",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
