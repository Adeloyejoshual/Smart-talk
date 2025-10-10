import { auth, provider } from "./firebase.js";
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const statusEl = document.getElementById("status");
const walletEl = document.getElementById("wallet");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const refreshBtn = document.getElementById("refresh-btn");

// ------------------
// Login with Google
// ------------------
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

// ------------------
// Logout
// ------------------
logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  statusEl.textContent = "Logged out.";
  walletEl.textContent = "$0.00";
});

// ------------------
// Refresh wallet balance
// ------------------
refreshBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    alert("Please log in first.");
    return;
  }
  await showWalletBalance(user.uid);
});

// ------------------
// Initialize wallet for new users
// ------------------
async function ensureWallet(uid) {
  try {
    const res = await fetch(`${window.ENV.API_BASE_URL}/api/wallet/${uid}`);
    const data = await res.json();

    if (!data.success) {
      // Wallet doesn't exist; create it with bonus
      await fetch(`${window.ENV.API_BASE_URL}/api/wallet/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, amount: 5 })  // NEW_USER_BONUS
      });
      alert("🎁 New wallet created with $5 bonus!");
    }
  } catch (err) {
    console.error("Error ensuring wallet:", err);
  }
}

// ------------------
// Show wallet balance
// ------------------
async function showWalletBalance(uid) {
  try {
    const res = await fetch(`${window.ENV.API_BASE_URL}/api/wallet/${uid}`);
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