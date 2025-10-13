import React, { createContext, useState, useEffect } from "react";
import { db, auth } from "../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("light"); 
  const [wallpaper, setWallpaper] = useState(""); 

  useEffect(() => {
    const loadSettings = async () => {
      if (!auth.currentUser) return;
      const docRef = doc(db, "users", auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.theme) setTheme(data.theme);
        if (data.wallpaper) setWallpaper(data.wallpaper);
      }
    };
    loadSettings();
  }, [auth.currentUser]);

  const updateSettings = async (newTheme, newWallpaper) => {
    setTheme(newTheme);
    setWallpaper(newWallpaper);
    if (auth.currentUser) {
      const docRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(docRef, { theme: newTheme, wallpaper: newWallpaper }, { merge: true });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, wallpaper, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
};