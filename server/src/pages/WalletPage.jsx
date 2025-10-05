// /src/pages/WalletPage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { auth } from "../firebaseClient";

export default function WalletPage() {
  const [wallet, setWallet] = useState({ balance: 0 });
  const [amount, setAmount] = useState(5);
  const [defaultCard, setDefaultCard] = useState(null);
  const [modal, setModal] = useState(null);
  const API = import.meta.env.VITE_API_URL || "/api";

  useEffect(() => {
    async function load() {
      if (!auth.currentUser) return;
      const uid = auth.currentUser.uid;
      const [w, c] = await Promise.all([
        axios.get(`${API}/wallet/${uid}`),
        axios.get(`${API}/payment/cards/${uid}`)
      ]);
      setWallet(w.data.wallet || { balance: 0 });
      setDefaultCard(c.data.cards.find((x) => x.default));
    }
    load();
  }, [auth.currentUser]);

  const addCredit = async () => {
    try {
      const uid = auth.currentUser.uid;
      if (defaultCard) {
        // ✅ Instant charge from default saved card
        const r = await axios.post(`${API}/payment/charge-default`, {
          uid,
          amount,
        });
        setWallet(r.data.wallet);
        setModal({ type: "success", msg: "Credit added successfully!" });
      } else {
        // 🔁 Fallback to hosted checkout
        const r = await axios.post(`${API}/payment/stripe-session`, {
          amount,
          uid,
        });
        window.location.href = r.data.url;
      }
    } catch (err) {
      setModal({
        type: "error",
        msg: err.response?.data?.message || err.message,
      });
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "20px auto" }}>
      <h3>Wallet</h3>

      <div
        style={{
          padding: 16,
          border: "1px solid #eee",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 24 }}>
            ${wallet.balance ? wallet.balance.toFixed(2) : "0.00"}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>
            Bonus expires in 3 months
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{
              width: 80,
              padding: 6,
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />
          <button onClick={addCredit}>Add Credit</button>
        </div>
      </div>

      {defaultCard ? (
        <p style={{ marginTop: 10, color: "#666" }}>
          Using default card: **** {defaultCard.last4}
        </p>
      ) : (
        <p style={{ marginTop: 10, color: "#999" }}>
          No saved card. Add one in Settings → Manage Cards.
        </p>
      )}

      {modal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: "80%",
              maxWidth: 300,
              textAlign: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            }}
          >
            <h4
              style={{
                color: modal.type === "success" ? "green" : "red",
              }}
            >
              {modal.type === "success" ? "Success" : "Error"}
            </h4>
            <p>{modal.msg}</p>
          </div>
        </div>
      )}
    </div>
  );
}