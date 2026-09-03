
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyB1fqOdy2Ns6p0rhBaT_Dz1FI0XX0UaSQA",
  authDomain: "trackvis-c9599.firebaseapp.com",
  projectId: "trackvis-c9599",
  storageBucket: "trackvis-c9599.appspot.com",
  messagingSenderId: "997949731568",
  appId: "1:997949731568:web:da5ac8e7e3a188efba0835",
  measurementId: "G-4LT1HP2SE1"
};


const app = initializeApp(firebaseConfig);
const authService = getAuth(app);
const dbService = getFirestore(app);
const analyticsService = getAnalytics(app);


export const auth = authService;
export const db = dbService;


export const analytics = analyticsService;