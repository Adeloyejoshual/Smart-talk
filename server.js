import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import Stripe from "stripe";
import mongoose from "mongoose";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());

// ==================== Firebase Admin ====================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  console.log("✅ Firebase Admin initialized");
}

// ==================== Stripe ====================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ==================== MongoDB ====================
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Wallet History Schema
const transactionSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

// ==================== API Routes ====================

// 1️⃣ Create Stripe Payment Intent
app.post("/api/payment", async (req, res) => {
  try {
    const { amount, currency, uid } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({ amount, currency });

    // Log transaction
    if (uid) {
      await Transaction.create({
        uid,
        type: "credit",
        amount: amount / 100, // Stripe uses cents
        description: "Stripe Payment",
      });
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2️⃣ Wallet History
app.get("/api/wallet/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const history = await Transaction.find({ uid }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3️⃣ Add manual credit/debit
app.post("/api/wallet", async (req, res) => {
  try {
    const { uid, type, amount, description } = req.body;
    if (!uid || !type || !amount) return res.status(400).json({ error: "Missing fields" });

    const txn = await Transaction.create({ uid, type, amount, description });
    res.json(txn);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 4️⃣ Daily Check-In
app.post("/api/wallet/daily", async (req, res) => {
  try {
    const { uid, amount } = req.body;
    if (!uid || !amount) return res.status(400).json({ error: "Missing fields" });

    const today = new Date().toISOString().split("T")[0];
    const existing = await Transaction.findOne({
      uid,
      type: "credit",
      description: "Daily Check-In",
      createdAt: {
        $gte: new Date(today + "T00:00:00.000Z"),
        $lte: new Date(today + "T23:59:59.999Z"),
      },
    });

    if (existing) return res.status(400).json({ error: "Already claimed today" });

    const txn = await Transaction.create({
      uid,
      type: "credit",
      amount,
      description: "Daily Check-In",
    });

    res.json({ success: true, txn });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== Serve Frontend ====================
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

// ==================== Start Server ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));