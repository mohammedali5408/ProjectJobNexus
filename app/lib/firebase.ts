// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDUI9v9tcHeV0K8w-mSUb72xJXUDl9ms64",
  authDomain: "job-nexus-7a694.firebaseapp.com",
  projectId: "job-nexus-7a694",
  storageBucket: "job-nexus-7a694.firebasestorage.app",
  messagingSenderId: "215857343350",
  appId: "1:215857343350:web:ae2f2a3a4f158b239a6857",
  measurementId: "G-HKN6EWP9JK"
};

// Initialize Firebase only if it hasn't been initialized already
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase services
const auth = getAuth(app);

// Set persistent auth state - This is the key addition
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .catch((error) => {
      console.error("Firebase persistence error:", error);
    });
}

const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Analytics conditionally (only in browser environment)
let analytics = null;
if (typeof window !== 'undefined') {
  // Check if analytics is supported before initializing
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(error => {
    console.error("Analytics initialization error:", error);
  });
}

export { app, auth, db, storage, analytics };