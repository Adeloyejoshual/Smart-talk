import { auth, provider, db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { signInWithPopup } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const statusEl = document.getElementById("status");
const walletEl = document.getElementById("wallet");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const refreshBtn = document.getElementById("refresh-btn");

loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    statusEl.textContent = `Welcome, ${user.displayName}`;
    await ensureWallet(user.uid);
    await showWalletBalance(user.uid);
  } catch (err) {
    console.error(err);
    alert("Login failed. Check console.");
  }
});

logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
  statusEl.textContent = "Logged out";
  walletEl.textContent = "$0.00";
});

refreshBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Please log in first");
  await showWalletBalance(user.uid);
});

async function ensureWallet(uid) {
  const ref = doc(db, "wallets", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { balance: 5.0, createdAt: Date.now() });
    alert("🎁 New wallet created with $5 bonus!");
  }
}

async function showWalletBalance(uid) {
  const ref = doc(db, "wallets", uid);
  const snap = await getDoc(ref);
  walletEl.textContent = snap.exists() ? `$${snap.data().balance.toFixed(2)}` : "$0.00";
}