import React, { useEffect, useState } from "react";
import axios from "axios";
import { auth } from "../firebaseClient";

export default function SavedCardsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(5);
  const API = import.meta.env.VITE_API_URL || "/api";

  useEffect(() => {
    async function load() {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const r = await axios.get(`${API}/cards/${uid}`);
      setCards(r.data.cards || []);
    }
    load();
  }, []);

  const setDefault = async (id) => {
    const uid = auth.currentUser.uid;
    await axios.post(`${API}/cards/set-default`, { uid, cardId: id });
    alert("Default card updated ✅");
    const r = await axios.get(`${API}/cards/${uid}`);
    setCards(r.data.cards);
  };

  const chargeDefault = async () => {
    if (!window.confirm(`Charge $${amount} to your default card?`)) return;
    setLoading(true);
    try {
      const uid = auth.currentUser.uid;
      const r = await axios.post(`${API}/payment/charge-default`, { uid, amount });
      alert(`Success ✅ - Charged $${amount}`);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 500, margin: "20px auto", padding: 16 }}>
      <h2>Saved Cards</h2>

      {cards.length === 0 && <p>No saved cards yet 💳</p>}

      {cards.map((card) => (
        <div
          key={card._id}
          style={{
            border: card.default ? "2px solid #007bff" : "1px solid #ccc",
            borderRadius: 10,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 16 }}>
            {card.brand?.toUpperCase()} •••• {card.last4}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>
            Exp: {card.exp_month}/{card.exp_year}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>Gateway: {card.gateway}</div>

          {!card.default && (
            <button
              style={{
                marginTop: 8,
                padding: "6px 12px",
                borderRadius: 6,
                background: "#eee",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => setDefault(card._id)}
            >
              Set Default
            </button>
          )}
          {card.default && (
            <div style={{ color: "#007bff", fontSize: 13, marginTop: 4 }}>✅ Default Card</div>
          )}
        </div>
      ))}

      {cards.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4>Charge Default Card</h4>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          />
          <button
            disabled={loading}
            onClick={chargeDefault}
            style={{
              background: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 12px",
              width: "100%",
            }}
          >
            {loading ? "Processing..." : "Charge Now"}
          </button>
        </div>
      )}
    </div>
  );
}