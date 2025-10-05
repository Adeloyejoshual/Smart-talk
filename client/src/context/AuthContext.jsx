// /src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  auth,
  db,
  onAuthChange,
  signInWithGoogle,
  logout,
  now,
} from "../firebaseClient";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

// Create Context
const AuthContext = createContext();

// ------------------------------
// 🔥 Provider Component
// ------------------------------
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Authenticated Firebase user
  const [profile, setProfile] = useState(null); // Firestore user document
  const [loading, setLoading] = useState(true);

  // Watch Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // Listen to Firestore profile changes live
        const userRef = doc(db, "users", firebaseUser.uid);
        const unsubProfile = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) setProfile(snapshot.data());
        });

        // Update last seen
        await updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(async () => {
          // If user doc doesn't exist yet
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || "User",
            email: firebaseUser.email || "",
            photoURL: firebaseUser.photoURL || "",
            createdAt: now,
            lastSeen: now,
          });
        });

        return () => unsubProfile();
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ------------------------------
  // ⚙️ Methods exposed to all components
  // ------------------------------
  const handleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      alert("Sign-in failed!");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error(err);
    }
  };

  // Update user profile (used in Settings page)
  const updateProfile = async (updates) => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { ...updates, lastUpdated: now });
  };

  // ------------------------------
  // ✅ Context Value
  // ------------------------------
  const value = {
    user,
    profile,
    loading,
    signIn: handleSignIn,
    logout: handleLogout,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// ------------------------------
// 🪄 Custom Hook
// ------------------------------
export const useAuth = () => useContext(AuthContext);