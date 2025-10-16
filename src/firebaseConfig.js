import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🔐 Firebase config (from .env)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// 🚀 Initialize Firebase
const app = initializeApp(firebaseConfig);

// 📦 Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// 🌐 Google sign-in provider
const googleProvider = new GoogleAuthProvider();

// ✅ Add this — handles Google login
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("✅ Signed in:", result.user);
    return result.user;
  } catch (error) {
    console.error("❌ Google Sign-In Error:", error);
    alert("Google Sign-In Failed");
  }
};

// ✅ Optional logout helper
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout Error:", error);
  }
};

// 💳 Payment keys (optional)
export const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY;
export const FLUTTERWAVE_PUBLIC_KEY = process.env.REACT_APP_FLUTTERWAVE_PUBLIC_KEY;