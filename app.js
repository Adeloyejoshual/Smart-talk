// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// ==========================
// 🔹 Firebase Configuration
// ==========================
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
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ==========================
// 🔹 DOM Elements
// ==========================
const statusEl = document.getElementById("status");
const walletEl = document.getElementById("wallet");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const refreshBtn = document.getElementById("refresh-btn");

// ==========================
// 🔹 Helper Functions
// ==========================
async function fetchWallet(uid) {
  try {
    const res = await fetch(`/api/wallet/${uid}`);
    const data = await res.json();
    if (data.success) {
      walletEl.textContent = `$${data.balance.toFixed(2)}`;
    } else {
      walletEl.textContent = "$0.00";
    }
  } catch (err) {
    console.error("Error fetching wallet:", err);
    walletEl.textContent = "$0.00";
  }
}

async function createWallet(uid) {
  try {
    const res = await fetch("/api/wallet/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, amount: 5 }) // New user bonus
    });
    const data = await res.json();
    if (data.success) {
      alert("🎁 New wallet created with $5 bonus!");
      walletEl.textContent = `$${data.balance.toFixed(2)}`;
    }
  } catch (err) {
    console.error("Error creating wallet:", err);
  }
}

// ==========================
// 🔹 Event Listeners
// ==========================
loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    statusEl.textContent = `Welcome, ${user.displayName}`;
    
    // Fetch wallet or create new
    const res = await fetch(`/api/wallet/${user.uid}`);
    const data = await res.json();
    if (data.success && data.balance === 0) {
      await createWallet(user.uid);
    } else {
      walletEl.textContent = `$${data.balance.toFixed(2)}`;
    }
  } catch (err) {
    console.error("Login failed:", err);
    alert("Login failed. Try again.");
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  statusEl.textContent = "Logged out.";
  walletEl.textContent = "$0.00";
});

refreshBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Please login first.");
  await fetchWallet(user.uid);
});

// Automatically update UI if user is already logged in
onAuthStateChanged(auth, async (user) => {
  if (user) {
    statusEl.textContent = `Welcome back, ${user.displayName}`;
    await fetchWallet(user.uid);
  } else {
    statusEl.textContent = "Please login.";
    walletEl.textContent = "$0.00";
  }
});