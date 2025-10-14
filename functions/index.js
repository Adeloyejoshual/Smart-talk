// functions/index.js
import express from "express";
import cors from "cors";
import Stripe from "stripe";
import { onRequest } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import fetch from "node-fetch";

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ STRIPE PAYMENT SESSION
app.post("/createStripeSession", async (req, res) => {
  try {
    const { amount, uid } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      client_reference_id: uid,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Wallet Top-up" },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      success_url: "http://localhost:5173/settings?success=true",
      cancel_url: "http://localhost:5173/settings?canceled=true",
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ STRIPE WEBHOOK
app.post("/stripeWebhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const uid = session.client_reference_id;
    const amount = session.amount_total / 100;

    await updateUserBalance(uid, amount, "Stripe", "success");
  }

  res.sendStatus(200);
});

// ✅ FLUTTERWAVE WEBHOOK (manual callback)
app.post("/flutterwaveWebhook", async (req, res) => {
  const { uid, amount, tx_ref } = req.body;

  await updateUserBalance(uid, amount, "Flutterwave", "success", tx_ref);
  res.sendStatus(200);
});

// ✅ Function to update wallet & transaction history
async function updateUserBalance(uid, amount, gateway, status, ref = "") {
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  const oldBalance = userDoc.exists ? userDoc.data().balance || 0 : 0;
  const newBalance = oldBalance + amount;

  await userRef.set({ balance: newBalance }, { merge: true });

  await db.collection("transactions").add({
    uid,
    gateway,
    amount,
    status,
    ref,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export const api = onRequest(app);