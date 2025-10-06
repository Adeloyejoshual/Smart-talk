import { useEffect } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebaseClient";

/**
 * useCallBalanceListener
 * 
 * @param {string} callId - Active call document ID in Firestore
 * @param {() => void} onEnd - Called when the backend ends call
 * @param {() => void} onLowBalance - Optional toast warning callback
 */
export default function useCallBalanceListener(callId, onEnd, onLowBalance) {
  useEffect(() => {
    if (!callId) return;

    const unsub = onSnapshot(doc(db, "calls", callId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.remainingBalance !== undefined && data.remainingBalance < 0.01) {
        onLowBalance?.();
      }
      if (data.status === "ended") {
        onEnd?.();
      }
    });

    return () => unsub();
  }, [callId]);
}