// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🔥 Firebase Config (use your .env values)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// 🚀 Initialize Firebase
const app = initializeApp(firebaseConfig);

// 📦 Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* --------------------------
 🧍 User Auth Helpers
--------------------------- */

// 🆕 Register new user with name, email, and password
export const registerUser = async (name, email, password) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Update Auth profile
  await updateProfile(user, { displayName: name });

  // Create Firestore user document
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    displayName: name,
    email: user.email,
    photoURL: user.photoURL || null,
    isOnline: true,
    lastSeen: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  return user;
};

// 🔑 Login existing user
export const loginUser = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Update online status
  await updateDoc(doc(db, "users", user.uid), {
    isOnline: true,
    lastSeen: serverTimestamp(),
  });

  return user;
};

// 🚪 Logout and set offline
export const logout = async () => {
  const user = auth.currentUser;
  if (user) {
    await updateDoc(doc(db, "users", user.uid), {
      isOnline: false,
      lastSeen: serverTimestamp(),
    });
  }
  await signOut(auth);
};

// 👀 Listen for auth changes (real-time user state)
export const onUserStateChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) callback({ ...userSnap.data(), id: userSnap.id });
      else callback(null);
    } else {
      callback(null);
    }
  });
};

export { app };