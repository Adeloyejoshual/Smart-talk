/**
 * Deducts call cost from wallet using backend API.
 * @param {string} userId - Firebase UID
 * @param {number} duration - Duration in seconds
 * @returns {number} cost charged
 */
export async function deductCallCost(userId, duration) {
  if (!userId) return 0;
  const auth = getAuth();
  const user = auth.currentUser;
  const token = await user.getIdToken();

  const rate = 0.0033; // $ per second (adjust if needed)
  const cost = duration * rate;

  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/wallet/deduct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, cost }),
  });

  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Failed to deduct wallet balance");

  return cost;
}