import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: window.ENV.FIREBASE_API_KEY,
  authDomain: window.ENV.FIREBASE_AUTH_DOMAIN,
  projectId: window.ENV.FIREBASE_PROJECT_ID,
  storageBucket: window.ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: window.ENV.FIREBASE_APP_ID,
  measurementId: window.ENV.FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();