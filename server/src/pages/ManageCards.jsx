// /src/pages/ManageCards.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from "@stripe/react-stripe-js";
import { auth } from "../firebaseClient";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
const API = import.meta.env.VITE_API_URL || "/api";

// --- Add Card Form Component ---
function AddCardForm({ onAdded }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const cardElement = elements.getElement(CardElement);
      const { paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });
      const uid = auth.currentUser.uid;
      await axios.post(`${API}/payment/card-stored`, {
        uid,
        paymentMethodId: paymentMethod.id,
        makeDefault: true, // always default new cards
      });
      alert("Card saved successfully!");
      onAdded();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleAddCard} style={{ maxWidth: 400, margin: "20px auto" }}>
      <CardElement
        options={{
          style: {
            base: { fontSize: "16px", color: "#424770" },
            invalid: { color: "#9e2146" },
          },
        }}
      />
      <button disabled={!stripe || loading} style={{ marginTop: 20 }}>
        {loading ? "Saving..." : "Save Card"}
      </button>
    </form>
  );
}

// --- Manage Cards Main Component ---
function ManageCardsMain() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadCards() {
    try {
      const uid = auth.currentUser.uid;
      const res = await axios.get(`${API}/payment/cards/${uid}`);
      setCards(res.data.cards || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth.currentUser) loadCards();
  }, [auth.currentUser]);

  const makeDefault = async (cardId) => {
    try {
      const uid = auth.currentUser.uid;
      await axios.post(`${API}/payment/card-default`, { uid, cardId });
      alert("Default card updated!");
      loadCards();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>
      <h3>Saved Cards</h3>
      {loading ? (
        <p>Loading cards...</p>
      ) : cards.length === 0 ? (
        <p>No cards yet. Add one below.</p>
      ) : (
        cards.map((c) => (
          <div
            key={c._id}
            style={{
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div>
              <b>{c.cardBrand?.toUpperCase()}</b> •••• {c.last4}
              <br />
              <small>Expires {c.expMonth}/{c.expYear}</small>
            </div>
            <div>
              {c.default ? (
                <span style={{ color: "green" }}>Default</span>
              ) : (
                <button onClick={() => makeDefault(c._id)}>Make Default</button>
              )}
            </div>
          </div>
        ))
      )}

      <hr />
      <h4>Add New Card</h4>
      <AddCardForm onAdded={loadCards} />
    </div>
  );
}

export default function ManageCards() {
  return (
    <Elements stripe={stripePromise}>
      <ManageCardsMain />
    </Elements>
  );
}