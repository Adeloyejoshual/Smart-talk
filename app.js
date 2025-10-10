// app.js
import { auth, provider } from "./firebase.js";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";

const statusEl = document.getElementById("status");
const walletEl = document.getElementById("wallet");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const refreshBtn = document.getElementById("refresh-btn");

const API_BASE = "https://smart-talk-1-c80i.onrender.com"; // your backend

// Login with Google
loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    statusEl.textContent = `Welcome, ${user.displayName}`;
    await initWallet(user.uid);
    await showWalletBalance(user.uid);
  } catch (err) {
    console.error(err);
    alert("Login failed. Try again.");
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  statusEl.textContent = "Logged out.";
  walletEl.textContent = "$0.00";
});

// Refresh balance
refreshBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Please log in first.");
  await showWalletBalance(user.uid);
});

// Initialize wallet for new users
async function initWallet(uid) {
  try {
    await fetch(`${API_BASE}/api/wallet/${uid}`)
      .then(res => res.json())
      .then(async data => {
        if (!data.success) {
          await fetch(`${API_BASE}/api/wallet/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid, amount: 5 })
          });
          alert("🎁 Wallet created with $5 bonus!");
        }
      });
  } catch (err) {
    console.error(err);
  }
}

// Show wallet balance
async function showWalletBalance(uid) {
  try {
    const res = await fetch(`${API_BASE}/api/wallet/${uid}`);
    const data = await res.json();
    walletEl.textContent = data.success ? `$${data.balance.toFixed(2)}` : "$0.00";
  } catch (err) {
    console.error("Error fetching wallet:", err);
    walletEl.textContent = "$0.00";
  }
}

// Check if already logged in
onAuthStateChanged(auth, async user => {
  if (user) {
    statusEl.textContent = `Welcome, ${user.displayName}`;
    await showWalletBalance(user.uid);
  }
});