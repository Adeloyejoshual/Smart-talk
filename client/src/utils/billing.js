import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebaseClient";

const RATE_PER_SECOND = 0.0033; // $1 per 5 min

// 💵 Check and deduct balance
export async function deductPerSecond(userId, seconds = 1) {
  const ref = doc(db, "wallets", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Wallet not found");
  const balance = snap.data().balance || 0;
  const cost = RATE_PER_SECOND * seconds;

  if (balance < cost) {
    return false; // insufficient funds
  }

  await updateDoc(ref, { balance: balance - cost });
  return true;
}