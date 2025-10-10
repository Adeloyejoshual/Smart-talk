// app.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

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
const analytics = getAnalytics(app);