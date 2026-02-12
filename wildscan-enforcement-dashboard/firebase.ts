import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCZtsOztWFKY35xZaudyKSGKy13IknU_lw",
  authDomain: "wildscan-487110.firebaseapp.com",
  projectId: "wildscan-487110",
  storageBucket: "wildscan-487110.firebasestorage.app",
  messagingSenderId: "1098649222627",
  appId: "1:1098649222627:web:9dff78d524b6f067b274d6",
  measurementId: "G-YZ21Q43Q52"
};

export const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export let db: Firestore | null = null;
try {
  db = getFirestore(app);
} catch (err) {
  console.warn("Firestore service is not available.", err);
}

export const analyticsPromise = analyticsSupported()
  .then((supported) => (supported ? getAnalytics(app) : null))
  .catch((err) => {
    console.warn("Analytics is not available.", err);
    return null;
  });