// functions/index.js
import functions from "firebase-functions";
import admin from "firebase-admin";
import Stripe from "stripe";
import express from "express";
import cors from "cors";
import Flutterwave from "flutterwave-node-v3";

// ✅ Initialize Firebase Admin
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ✅ Initialize Stripe & Flutterwave using Firebase environment config
const stripe = new Stripe(functions.config().stripe.secret_key);
const flw = new Flutterwave(
  functions.config().flutterwave.public_key,
  functions.config().flutterwave.secret_key
);

// ✅ Express app setup
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/* ============================================================
   🔹 STRIPE PAYMENT SESSION (for card payments)
   ============================================================ */
app.post("/createStripeSession", async (req, res) => {
  try {
    const { amount, uid } = req.body;

    if (!amount || !uid) {
      return res.status(400).json({ error: "Missing amount or uid" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "SmartTalk Wallet Top-up" },
            unit_amount: amount * 100, // Convert dollars to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://smarttalk.onrender.com/success",
      cancel_url: "https://smarttalk.onrender.com/cancel",
      metadata: { uid, amount },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe session error:", err);
    res.status(500).send({ error: err.message });
  }
});

/* ============================================================
   🔹 STRIPE WEBHOOK - Verify payment & update wallet balance
   ============================================================ */
app.post("/stripeWebhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = functions.config().stripe.webhook_secret;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("⚠️ Stripe Webhook signature verification failed:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const uid = session.metadata.uid;
    const amount = session.metadata.amount;

    // ✅ Update Firestore wallet
    await db.collection("wallets").doc(uid).set(
      {
        balance: admin.firestore.FieldValue.increment(Number(amount)),
        lastTransaction: new Date().toISOString(),
        lastProvider: "Stripe",
      },
      { merge: true }
    );

    console.log(`💰 Wallet updated for user ${uid} with $${amount}`);
  }

  res.json({ received: true });
});

/* ============================================================
   🔹 FLUTTERWAVE WEBHOOK (for local NGN payments)
   ============================================================ */
app.post("/flutterwaveWebhook", async (req, res) => {
  try {
    const payload = req.body;
    const txId = payload.data?.id;

    const response = await flw.Transaction.verify({ id: txId });
    const uid = response.data?.meta?.uid;
    const amount = response.data?.amount;

    if (response.data.status === "successful") {
      await db.collection("wallets").doc(uid).set(
        {
          balance: admin.firestore.FieldValue.increment(amount),
          lastTransaction: new Date().toISOString(),
          lastProvider: "Flutterwave",
        },
        { merge: true }
      );

      console.log(`💰 Flutterwave wallet update for ${uid}: ₦${amount}`);
      return res.status(200).send({ success: true });
    } else {
      console.error("❌ Transaction failed:", response.data);
      return res.status(400).send({ error: "Transaction failed" });
    }
  } catch (err) {
    console.error("Flutterwave webhook error:", err);
    res.status(500).send({ error: err.message });
  }
});

/* ============================================================
   🔹 Wallet Retrieval Endpoint
   ============================================================ */
app.get("/wallet/:uid", async (req, res) => {
  try {
    const docSnap = await db.collection("wallets").doc(req.params.uid).get();
    res.json(docSnap.exists ? docSnap.data() : { balance: 0 });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

/* ============================================================
   🔹 Export Express app as Firebase Function
   ============================================================ */
export const api = functions.https.onRequest(app);