import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebaseClient";
import { calculateCost } from "./billing";

export const deductCallCost = async (userId, durationInSeconds) => {
  const cost = calculateCost(durationInSeconds);
  const walletRef = doc(db, "wallets", userId);

  await updateDoc(walletRef, {
    balance: increment(-cost),
    lastUpdated: new Date().toISOString(),
  });

  return cost;
};