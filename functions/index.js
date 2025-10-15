import functions from "firebase-functions";
import admin from "firebase-admin";
import Stripe from "stripe";
import express from "express";
import cors from "cors";
import Flutterwave from "flutterwave-node-v3";

admin.initializeApp();
const db = admin.firestore();

// Initialize Stripe and Flutterwave
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const flw = new Flutterwave(process.env.FLUTTERWAVE_PUBLIC_KEY, process.env.FLUTTERWAVE_SECRET_KEY);

// Setup Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/* 🔹 STRIPE PAYMENT SESSION */
app.post("/createStripeSession", async (req, res) => {
  try {
    const { amount, uid } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "SmartTalk Wallet Top-up" },
            unit_amount: amount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://smarttalk.onrender.com/success",
      cancel_url: "https://smarttalk.onrender.com/cancel",
      metadata: { uid },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err);
    res.status(500).send({ error: err.message });
  }
});

/* 🔹 FLUTTERWAVE PAYMENT WEBHOOK */
app.post("/flutterwaveWebhook", async (req, res) => {
  try {
    const { uid, amount, tx_ref } = req.body;

    // Verify transaction with Flutterwave
    const response = await flw.Transaction.verify({ id: tx_ref });

    if (response.status === "success") {
      await db.collection("wallets").doc(uid).set(
        {
          balance: admin.firestore.FieldValue.increment(amount),
          lastTransaction: new Date().toISOString(),
        },
        { merge: true }
      );
      res.status(200).send({ success: true });
    } else {
      res.status(400).send({ error: "Transaction failed" });
    }
  } catch (err) {
    console.error("Flutterwave webhook error:", err);
    res.status(500).send({ error: err.message });
  }
});

export const api = functions.https.onRequest(app);