// Ginagawa ang Firebase setup dito para madaling ma-access sa buong app.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Ang Firebase config na ginagamit para kumonekta sa project.
const firebaseConfig = {
  apiKey: "AIzaSyB1fqOdy2Ns6p0rhBaT_Dz1FI0XX0UaSQA",
  authDomain: "trackvis-c9599.firebaseapp.com",
  projectId: "trackvis-c9599",
  storageBucket: "trackvis-c9599.appspot.com",
  messagingSenderId: "997949731568",
  appId: "1:997949731568:web:da5ac8e7e3a188efba0835",
  measurementId: "G-4LT1HP2SE1"
};

// Inisyalisa ang Firebase app.
const app = initializeApp(firebaseConfig);

// Inilalabas ang services para magamit sa ibang file.
export const auth = getAuth(app);
export const db = getFirestore(app);

// Optional ang analytics, pero pinapanatili para hindi magbago ang feature.
export const analytics = getAnalytics(app);