// Firebase core
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Firebase config (from your project)
const firebaseConfig = {
  apiKey: "AIzaSyB1fqOdy2Ns6p0rhBaT_Dz1FI0XX0UaSQA",
  authDomain: "trackvis-c9599.firebaseapp.com",
  projectId: "trackvis-c9599",
  storageBucket: "trackvis-c9599.appspot.com",
  messagingSenderId: "997949731568",
  appId: "1:997949731568:web:da5ac8e7e3a188efba0835",
  measurementId: "G-4LT1HP2SE1"
};

// Init Firebase app
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics (optional, safe to keep)
export const analytics = getAnalytics(app);