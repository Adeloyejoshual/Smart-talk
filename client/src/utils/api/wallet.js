import { getAuth } from "firebase/auth";

/**
 * Get current wallet balance of logged-in user.
 * Fetches from backend /api/wallet/balance
 */
export async function getWalletBalance() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");

  const token = await user.getIdToken();

  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/wallet/balance`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Failed to get balance");
  return data.balance; // e.g. 5.00
}

/**
 * Checks if user has enough credit for a call.
 * If balance < 0.50, throws an error.
 */
export async function ensureSufficientBalance(min = 0.5) {
  const balance = await getWalletBalance();
  if (balance < min) {
    throw new Error(`Insufficient balance ($${balance.toFixed(2)}). Please add credit.`);
  }
  return true;
}
