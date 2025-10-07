import React, { useEffect, useState } from "react";
import { db, auth } from "../firebaseClient";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const me = auth.currentUser;

  useEffect(() => {
    if (!me) return;
    const ref = doc(db, "wallets", me.uid);
    getDoc(ref).then((snap) => {
      if (snap.exists()) setBalance(snap.data().balance || 0);
    });
  }, [me]);

  const addFunds = async (amount) => {
    const ref = doc(db, "wallets", me.uid);
    await updateDoc(ref, { balance: increment(amount) });
    setBalance((b) => b + amount);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Your Wallet</h2>
      <p>Balance: ${balance.toFixed(2)}</p>
      <button onClick={() => addFunds(5)}>Add $5</button>
    </div>
  );
}