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

/* ---------------------------------
 🔥 Firebase Config (.env values)
---------------------------------- */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/* ---------------------------------
 🚀 Initialize Firebase
---------------------------------- */
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* ---------------------------------
 👤 User Authentication Helpers
---------------------------------- */

// 🆕 Register New User
export const registerUser = async (name, email, password) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Update Firebase Auth profile
  await updateProfile(user, { displayName: name });

  // Create Firestore user profile
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

// 🔑 Login User
export const loginUser = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Ensure user document exists
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || "New User",
      email: user.email,
      photoURL: user.photoURL || null,
      isOnline: true,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  } else {
    await updateDoc(userRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
    });
  }

  return user;
};

// 🚪 Logout
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

// 👀 Auth State Listener (real-time)
export const onUserStateChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        callback({ ...userSnap.data(), id: userSnap.id });
      } else {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};

/* ---------------------------------
 🌍 Auto Online/Offline Sync
---------------------------------- */
export const setUserPresence = (uid) => {
  const userRef = doc(db, "users", uid);
  const goOnline = async () => {
    await updateDoc(userRef, {
      isOnline: true,
      lastSeen: serverTimestamp(),
    });
  };
  const goOffline = async () => {
    await updateDoc(userRef, {
      isOnline: false,
      lastSeen: serverTimestamp(),
    });
  };

  // Update on tab open/close
  goOnline();
  window.addEventListener("beforeunload", goOffline);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") goOffline();
    else goOnline();
  });

  // Heartbeat to refresh timestamp
  const interval = setInterval(goOnline, 30000);

  return () => {
    clearInterval(interval);
    window.removeEventListener("beforeunload", goOffline);
  };
};

export { app };