// /src/firebaseClient.js
// Firebase Modular SDK (v9+)
// Reads credentials from .env for security

import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from "firebase/auth";
import { 
  getFirestore, 
  serverTimestamp, 
  doc, 
  getDoc, 
  setDoc 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ------------------------------
// 🔥 Firebase Config via .env
// ------------------------------
// Create a .env file in your project root and add:
// VITE_FIREBASE_API_KEY=xxxxx
// VITE_FIREBASE_AUTH_DOMAIN=xxxxx
// VITE_FIREBASE_PROJECT_ID=xxxxx
// VITE_FIREBASE_STORAGE_BUCKET=xxxxx
// VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxx
// VITE_FIREBASE_APP_ID=xxxxx

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ------------------------------
// 🧠 Helper Functions
// ------------------------------

// Google Sign-In
export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Create user profile in Firestore if missing
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, { lastSeen: serverTimestamp() }, { merge: true });
    }

    return user;
  } catch (err) {
    console.error("Google Sign-In Error:", err);
    throw err;
  }
};

// Logout
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout Error:", err);
  }
};

// Listen to auth changes (handy for global context)
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Server timestamp helper
export const now = serverTimestamp();

// ------------------------------
// ✅ Export default (for convenience)
// ------------------------------
export default app;