// app.js
import { auth, db, provider } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const statusEl = document.getElementById("status");
const walletEl = document.getElementById("wallet");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const refreshBtn = document.getElementById("refresh-btn");

// Login with Google
loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    statusEl.textContent = `Welcome, ${user.displayName}`;
    await ensureWallet(user.uid);
    await showWalletBalance(user.uid);
  } catch (err) {
    console.error("Login failed:", err);
    alert("Login error. Please try again.");
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  statusEl.textContent = "Logged out.";
  walletEl.textContent = "$0.00";
});

// Refresh wallet balance
refreshBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    alert("Please log in first.");
    return;
  }
  await showWalletBalance(user.uid);
});

// Initialize wallet for new users
async function ensureWallet(uid) {
  const ref = doc(db, "wallets", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { balance: 5.0, createdAt: Date.now() });
    alert("🎁 New wallet created with $5 bonus!");
  }
}

// Show wallet balance
async function showWalletBalance(uid) {
  const ref = doc(db, "wallets", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    walletEl.textContent = `$${data.balance.toFixed(2)}`;
  } else {
    walletEl.textContent = "$0.00";
  }
}

// Check backend connection (ping test)
async function checkBackend() {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ping`);
    const data = await res.json();
    console.log("✅ Backend connected:", data);
  } catch {
    console.warn("⚠️ Backend not reachable.");
  }
}

// Start on load
checkBackend();