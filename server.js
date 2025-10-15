// server.js
import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import Stripe from "stripe";
import fetch from "node-fetch"; // Used for Flutterwave verification
import admin from "firebase-admin";

dotenv.config();
const app = express();
const __dirname = path.resolve();

// ====== MIDDLEWARE ======
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist"))); // Serve React build

// ====== STRIPE SETUP ======
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ====== FIREBASE SETUP ======
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

// ====================================================
// 🚀 STRIPE PAYMENT ENDPOINT
// ====================================================
app.post("/api/createStripeSession", async (req, res) => {
  try {
    const { amount, uid } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Wallet Top-up" },
            unit_amount: amount * 100, // convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/payment-success?uid=${uid}&amount=${amount}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("❌ Stripe session error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================
// 💳 FLUTTERWAVE WEBHOOK + VERIFICATION
// ====================================================
app.post("/api/flutterwaveWebhook", async (req, res) => {
  try {
    const { tx_ref, uid, amount } = req.body;

    // ✅ Verify Flutterwave payment
    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${tx_ref}/verify`,
      {
        headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
      }
    );
    const verifyData = await verifyResponse.json();

    if (verifyData.status === "success") {
      console.log(`✅ Flutterwave payment verified for ${uid}: $${amount}`);

      // 🔥 Update Firebase wallet
      const userRef = db.collection("users").doc(uid);
      await db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        const currentBalance = doc.exists ? doc.data().wallet || 0 : 0;
        t.set(userRef, { wallet: currentBalance + Number(amount) }, { merge: true });
      });

      return res.status(200).json({ success: true });
    } else {
      console.error("❌ Flutterwave verification failed:", verifyData);
      return res.status(400).json({ error: "Payment verification failed" });
    }
  } catch (error) {
    console.error("❌ Flutterwave webhook error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================
// 🔥 FIREBASE MANUAL WALLET UPDATE (optional)
// ====================================================
app.post("/api/updateWallet", async (req, res) => {
  try {
    const { uid, amount } = req.body;
    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      const currentBalance = doc.exists ? doc.data().wallet || 0 : 0;
      t.set(userRef, { wallet: currentBalance + Number(amount) }, { merge: true });
    });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Wallet update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ====================================================
// 🌐 SERVE FRONTEND
// ====================================================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ====================================================
// 🚀 START SERVER
// ====================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));