// 📁 /src/pages/WalletPage.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { auth } from "../firebaseClient";

export default function WalletPage() {
  const [wallet, setWallet] = useState({ balance: 0 });
  const [cards, setCards] = useState([]);
  const [amount, setAmount] = useState(5);
  const API = import.meta.env.VITE_API_URL || "/api";

  // 🪙 Load wallet balance + saved cards
  useEffect(() => {
    async function load() {
      if (!auth.currentUser) return;
      const uid = auth.currentUser.uid;

      const [walletRes, cardRes] = await Promise.all([
        axios.get(`${API}/wallet/${uid}`),
        axios.get(`${API}/cards/${uid}`),
      ]);

      setWallet(walletRes.data.wallet || { balance: 0 });
      setCards(cardRes.data.cards || []);
    }
    load();
  }, [auth.currentUser]);

  // ➕ Add Credit (Stripe Checkout)
  const addCredit = async () => {
    const uid = auth.currentUser.uid;
    const res = await axios.post(`${API}/payment/stripe-session`, { amount, uid });
    window.location.href = res.data.url;
  };

  // 💳 Set Default Card
  const setDefault = async (cardId) => {
    const uid = auth.currentUser.uid;
    await axios.post(`${API}/cards/set-default`, { uid, cardId });
    const updated = cards.map((c) => ({ ...c, default: c._id === cardId }));
    setCards(updated);
    alert("✅ Default card updated!");
  };

  // 🗑️ Delete Card
  const deleteCard = async (cardId) => {
    if (!window.confirm("Delete this saved card?")) return;
    await axios.delete(`${API}/cards/${cardId}`);
    setCards(cards.filter((c) => c._id !== cardId));
  };

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", padding: 16 }}>
      <h2 style={{ textAlign: "center" }}>💼 Wallet</h2>

      {/* 💰 Balance */}
      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: "bold" }}>
          ${wallet.balance?.toFixed(2) || "0.00"}
        </div>
        <div style={{ color: "#777", fontSize: 13 }}>Expires in 3 months (bonus)</div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={addCredit}>Add Credit</button>
          <button onClick={() => alert("Withdraw coming soon 🚀")}>Withdraw</button>
        </div>
      </div>

      {/* 💳 Saved Cards Section */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fafafa",
        }}
      >
        <h3 style={{ marginBottom: 10 }}>💳 Saved Cards</h3>
        {cards.length === 0 ? (
          <p style={{ color: "#777" }}>No saved cards yet</p>
        ) : (
          cards.map((card) => (
            <div
              key={card._id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {card.details?.brand?.toUpperCase() || card.brand} •••• {card.details?.last4 || card.last4}
                </div>
                <div style={{ color: "#666", fontSize: 13 }}>
                  Exp: {card.details?.exp_month || card.exp_month}/{card.details?.exp_year || card.exp_year} • {card.gateway}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {card.default ? (
                  <span
                    style={{
                      background: "#2ecc71",
                      color: "#fff",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    Default
                  </span>
                ) : (
                  <button onClick={() => setDefault(card._id)}>Set Default</button>
                )}
                <button onClick={() => deleteCard(card._id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}