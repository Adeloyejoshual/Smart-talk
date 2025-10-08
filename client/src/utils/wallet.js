import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseClient";

/**
 * Deduct call cost from user's wallet balance.
 */
export async function deductCallCost(userId, duration) {
  if (!userId) return 0;
  const walletRef = doc(db, "wallets", userId);
  const snap = await getDoc(walletRef);
  if (!snap.exists()) return 0;

  const { balance } = snap.data();
  const rate = 0.0033; // $ per second
  const cost = duration * rate;
  const newBalance = Math.max(balance - cost, 0);

  await updateDoc(walletRef, { balance: newBalance });
  return cost;
}