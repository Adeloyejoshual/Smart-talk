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
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🧩 Firebase Config — stored in your .env file (make sure of the VITE_ prefix)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// 🔥 Initialize Firebase
const app = initializeApp(firebaseConfig);

// 🧠 Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

//
// 🆕 Register a new user
//
export const registerUser = async (name, email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update Firebase Auth profile
    await updateProfile(user, { displayName: name });

    // Create Firestore user document
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      name,
      email,
      photoURL: null,
      balance: 0,
      createdAt: serverTimestamp(),
      isOnline: true,
      lastSeen: serverTimestamp(),
    });

    return user;
  } catch (error) {
    console.error("Registration Error:", error);
    throw error;
  }
};

//
// 🔑 Login user
//
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update online status
    await updateDoc(doc(db, "users", user.uid), {
      isOnline: true,
      lastSeen: serverTimestamp(),
    });

    return user;
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};

//
// 🚪 Logout user
//
export const logout = async () => {
  const user = auth.currentUser;
  if (user) {
    await updateDoc(doc(db, "users", user.uid), {
      isOnline: false,
      lastSeen: serverTimestamp(),
    });
  }
  return signOut(auth);
};

//
// 🌍 Real-time online/offline tracking
//
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userRef = doc(db, "users", user.uid);

    // Mark as online
    await updateDoc(userRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
    });

    // When user closes the browser tab or reloads
    window.addEventListener("beforeunload", async () => {
      await updateDoc(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp(),
      });
    });
  }
});

export { app };