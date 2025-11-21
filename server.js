// server.js  
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import Stripe from "stripe";
import mongoose from "mongoose";
import fetch from "node-fetch";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());

// ------------------- Firebase Admin -------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.VITE_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.VITE_FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  console.log("✅ Firebase Admin initialized");
}

// ------------------- Stripe -------------------
const stripe = new Stripe(process.env.VITE_STRIPE_SECRET_KEY);

// ------------------- MongoDB -------------------
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.VITE_MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ------------------- Models -------------------
const transactionSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, index: true },
    type: { type: String, enum: ["credit", "debit", "checkin", "deposit", "withdraw"], required: true },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["Pending", "Success", "Failed"], default: "Success" },
    txnId: { type: String, unique: true, index: true },
    balanceAfter: { type: Number },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
const Transaction = mongoose.model("Transaction", transactionSchema);

const walletSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true, index: true },
  balance: { type: Number, default: 0 },
  lastCheckIn: { type: String, default: null },
});
const Wallet = mongoose.model("Wallet", walletSchema);

// ------------------- Utilities -------------------
const generateTxnId = () => `txn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// Firebase token verification
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!idToken) return res.status(401).json({ error: "Missing Authorization" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    req.authUID = decoded.uid;
    next();
  } catch (err) {
    console.error("Firebase token verify error:", err);
    return res.status(401).json({ error: "Invalid auth token" });
  }
};

// ------------------- Routes -------------------

// Stripe Payment Intent
app.post("/api/payment/stripe", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount, currency = "usd" } = req.body;
    const uid = req.authUID;
    if (!amount || typeof amount !== "number") return res.status(400).json({ error: "Invalid amount" });

    const paymentIntent = await stripe.paymentIntents.create({ amount: Math.round(amount), currency });

    const txn = await Transaction.create({
      uid,
      type: "deposit",
      amount: amount / 100,
      description: "Stripe Payment Intent",
      status: "Pending",
      txnId: generateTxnId(),
    });

    res.json({ clientSecret: paymentIntent.client_secret, txnId: txn.txnId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Flutterwave Payment
app.post("/api/payment/flutterwave", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount, currency = "USD", email } = req.body;
    const uid = req.authUID;

    if (!amount || typeof amount !== "number") return res.status(400).json({ error: "Invalid amount" });

    const txRef = generateTxnId();

    const flutterRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VITE_FLW_SECRET_KEY}`,
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency,
        redirect_url: process.env.VITE_FLW_REDIRECT_URL,
        customer: { email },
        payment_type: "card",
      }),
    });

    const data = await flutterRes.json();
    if (!data.status) return res.status(500).json({ error: "Flutterwave error" });

    await Transaction.create({
      uid,
      type: "deposit",
      amount,
      description: "Flutterwave Payment",
      status: "Pending",
      txnId: txRef,
    });

    res.json({ link: data.data.link, txnId: txRef });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get wallet history
app.get("/api/wallet/:uid", verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.params;
    if (req.authUID !== uid) return res.status(403).json({ error: "Forbidden" });

    const history = await Transaction.find({ uid }).sort({ createdAt: -1 }).limit(100);
    const walletDoc = await Wallet.findOne({ uid });
    const balance = walletDoc ? walletDoc.balance : history.reduce((sum, t) => sum + t.amount, 0);

    res.json({ transactions: history, balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Daily reward
app.post("/api/wwallet/daily", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const uid = req.authUID;

    const today = new Date().toISOString().split("T")[0];
    let wallet = await Wallet.findOne({ uid });
    if (!wallet) wallet = await Wallet.create({ uid, balance: 0 });

    if (wallet.lastCheckIn === today) return res.status(400).json({ error: "Already claimed today" });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const newBalance = wallet.balance + amount;

      const txn = await Transaction.create(
        [
          {
            uid,
            type: "checkin",
            amount,
            description: "Daily Check-In",
            status: "Success",
            txnId: generateTxnId(),
            balanceAfter: newBalance,
          },
        ],
        { session }
      );

      await Wallet.findOneAndUpdate({ uid }, { $set: { lastCheckIn: today }, $inc: { balance: amount } }, { session });

      await session.commitTransaction();
      session.endSession();

      res.json({ success: true, balance: newBalance, txn: txn[0] });
    } catch (txErr) {
      await session.abortTransaction();
      session.endSession();
      throw txErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ⭐⭐⭐ TASK REWARD — NEW ⭐⭐⭐
app.post("/api/wallet/task", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const uid = req.authUID;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    let wallet = await Wallet.findOne({ uid });
    if (!wallet) wallet = await Wallet.create({ uid, balance: 0 });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const newBalance = wallet.balance + amount;

      const txn = await Transaction.create(
        [
          {
            uid,
            type: "credit",
            amount,
            description: description || "Task reward",
            status: "Success",
            txnId: generateTxnId(),
            balanceAfter: newBalance,
          },
        ],
        { session }
      );

      await Wallet.findOneAndUpdate({ uid }, { $inc: { balance: amount } }, { session });

      await session.commitTransaction();
      session.endSession();

      return res.json({
        success: true,
        balance: newBalance,
        txn: txn[0],
      });
    } catch (txErr) {
      await session.abortTransaction();
      session.endSession();
      throw txErr;
    }
  } catch (err) {
    console.error("Task reward error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Withdraw
app.post("/api/wallet/withdraw", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount, destination } = req.body;
    const uid = req.authUID;

    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const wallet = await Wallet.findOne({ uid }).session(session);
      if (!wallet || wallet.balance < amount) throw new Error("Insufficient funds");

      const newBalance = wallet.balance - amount;

      await Wallet.findOneAndUpdate({ uid }, { $inc: { balance: -amount } }, { session });

      const txn = await Transaction.create(
        [
          {
            uid,
            type: "withdraw",
            amount: -amount,
            description: destination ? `Withdraw to ${destination}` : "Withdraw request",
            status: "Pending",
            txnId: generateTxnId(),
            balanceAfter: newBalance,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      res.json({ success: true, balance: newBalance, txn: txn[0] });
    } catch (txErr) {
      await session.abortTransaction();
      session.endSession();
      throw txErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "dist/index.html"));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));