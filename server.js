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

// -----------------------------
// Firebase Admin
// -----------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  console.log("🔥 Firebase Admin initialized");
}

// -----------------------------
// Stripe
// -----------------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// -----------------------------
// MongoDB
// -----------------------------
mongoose.set("strictQuery", true);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// -----------------------------
// Database Models
// -----------------------------
const transactionSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true },
    type: {
      type: String,
      enum: ["credit", "debit", "checkin", "deposit", "withdraw"],
    },
    amount: Number,
    description: String,
    status: { type: String, default: "Success" },
    txnId: { type: String, unique: true },
    balanceAfter: Number,
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

const walletSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  lastCheckIn: { type: String, default: null },
});

const Wallet = mongoose.model("Wallet", walletSchema);

// Utility
const generateTxnId = () =>
  `txn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// -----------------------------
// Token Verification Middleware
// -----------------------------
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const raw = req.headers.authorization || "";
    const token = raw.startsWith("Bearer ") ? raw.split(" ")[1] : null;

    if (!token) return res.status(401).json({ error: "Missing token" });

    const decoded = await admin.auth().verifyIdToken(token);
    req.authUID = decoded.uid;

    next();
  } catch (err) {
    console.error("❌ Firebase Auth Error:", err.message);
    res.status(401).json({ error: "Invalid token" });
  }
};

// -----------------------------
// Daily Check-In (0.25 or any amount)
// -----------------------------
app.post("/api/wallet/daily", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount } = req.body; // Example: 0.25
    const uid = req.authUID;

    const today = new Date().toISOString().split("T")[0];

    let wallet = await Wallet.findOne({ uid });

    if (!wallet)
      wallet = await Wallet.create({ uid, balance: 0, lastCheckIn: null });

    if (wallet.lastCheckIn === today)
      return res.status(400).json({ error: "Already claimed today" });

    const newBalance = wallet.balance + amount;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Save transaction
      const [txn] = await Transaction.create(
        [
          {
            uid,
            type: "checkin",
            amount,
            description: "Daily Reward",
            txnId: generateTxnId(),
            balanceAfter: newBalance,
          },
        ],
        { session }
      );

      // Update wallet
      await Wallet.findOneAndUpdate(
        { uid },
        { $set: { lastCheckIn: today }, $inc: { balance: amount } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      res.json({ success: true, balance: newBalance, txn });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    }
  } catch (err) {
    console.error("Daily reward error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Wallet History
// -----------------------------
app.get("/api/wallet/:uid", verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.params;

    if (req.authUID !== uid)
      return res.status(403).json({ error: "Forbidden" });

    const transactions = await Transaction.find({ uid }).sort({
      createdAt: -1,
    });

    const wallet = await Wallet.findOne({ uid });

    res.json({
      balance: wallet?.balance || 0,
      transactions,
    });
  } catch (err) {
    console.error("Wallet error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Withdraw
// -----------------------------
app.post("/api/wallet/withdraw", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount, destination } = req.body;
    const uid = req.authUID;

    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Bad amount" });

    const wallet = await Wallet.findOne({ uid });
    if (!wallet || wallet.balance < amount)
      return res.status(400).json({ error: "Insufficient funds" });

    const newBalance = wallet.balance - amount;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Wallet.updateOne({ uid }, { $inc: { balance: -amount } }, { session });

      const [txn] = await Transaction.create(
        [
          {
            uid,
            type: "withdraw",
            amount: -amount,
            description: destination || "Withdraw request",
            txnId: generateTxnId(),
            balanceAfter: newBalance,
            status: "Pending",
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      res.json({ success: true, balance: newBalance, txn });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    }
  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Frontend (React Build)
// -----------------------------
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "dist/index.html"))
);

// -----------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));