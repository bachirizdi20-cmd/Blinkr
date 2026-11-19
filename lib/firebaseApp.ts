import { getApp, getApps, initializeApp } from "firebase/app";

// Firebase web-app configuration is public client configuration, not an Admin credential.
export const firebaseConfig = {
  apiKey: "AIzaSyAQf74xpdk2RHUKln6TSSFG7rJmu3qz19E",
  authDomain: "blinkr-c7f8d.firebaseapp.com",
  projectId: "blinkr-c7f8d",
  storageBucket: "blinkr-c7f8d.firebasestorage.app",
  messagingSenderId: "358102487595",
  appId: "1:358102487595:web:4ec017bfefeaf434a0106e",
  measurementId: "G-RGJ80DW2JY",
};

export const googleOAuthClientIds = {
  android: "358102487595-7m41bfff321t3relre04ab0gkf9o7mhb.apps.googleusercontent.com",
  web: "358102487595-i20cpabbj9evlekrk5a4escoubs209go.apps.googleusercontent.com",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
