// firebase.js
// ==========================
// 🔹 Firebase Frontend Config
// ==========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBe2QkeEr9sfh0TUtj8Np-mU5WtYYOorYY",
  authDomain: "smarttalk-9fe4a.firebaseapp.com",
  projectId: "smarttalk-9fe4a",
  storageBucket: "smarttalk-9fe4a.firebasestorage.app",
  messagingSenderId: "103759612273",
  appId: "1:103759612273:web:311d39bf7af9d51fe30ed0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Auth
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };