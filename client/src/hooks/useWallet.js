// /src/hooks/useWallet.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseClient";

// Assumes wallet stored in Firestore at: users/{uid}/wallet (object with balanceUsd)
export default function useWallet() {
  const [wallet, setWallet] = useState({ balanceUsd: 0, loading: true });

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (!u) {
        setWallet({ balanceUsd: 0, loading: false });
        return;
      }
      const wRef = doc(db, "users", u.uid, "wallet", "balance");
      const unsub = onSnapshot(
        wRef,
        (snap) => {
          if (!snap.exists()) {
            setWallet({ balanceUsd: 0, loading: false });
          } else {
            const d = snap.data();
            setWallet({ balanceUsd: Number(d.balanceUsd || 0), loading: false });
          }
        },
        (err) => {
          console.error("wallet listener:", err);
          setWallet((s) => ({ ...s, loading: false }));
        }
      );
      // cleanup inner
      return () => unsub();
    });

    return () => unsubAuth();
  }, []);

  return wallet;
}