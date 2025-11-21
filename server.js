// ------------------------------
//      IMPORTS & SETUP
// ------------------------------
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import admin from "firebase-admin";
import dotenv from "dotenv";
import Wallet from "./models/Wallet.js";
import Transaction from "./models/Transaction.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------
//     FIREBASE ADMIN INIT
// ------------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE)),
  });
}

// ------------------------------
// VERIFY FIREBASE TOKEN
// ------------------------------
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "No token provided" });

    const token = header.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.authUID = decoded.uid;
    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

// ------------------------------
// CONNECT MONGO
// ------------------------------
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected ⚡"))
  .catch((err) => console.error("Mongo Error:", err));

// ------------------------------
//  HELPERS
// ------------------------------
function generateTxnId() {
  return "TXN-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ------------------------------
//      GET WALLET + TRANSACTIONS
// ------------------------------
app.get("/api/wallet", verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.authUID;

    let wallet = await Wallet.findOne({ uid });
    if (!wallet) wallet = await Wallet.create({ uid, balance: 0 });

    const transactions = await Transaction.find({ uid }).sort({ createdAt: -1 });

    res.json({
      balance: wallet.balance,
      transactions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
});

// ------------------------------
//      DAILY REWARD
// ------------------------------
app.post("/api/wallet/daily", verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.authUID;

    let wallet = await Wallet.findOne({ uid });
    if (!wallet) wallet = await Wallet.create({ uid, balance: 0 });

    const DAILY_AMOUNT = 0.25;

    const newBalance = wallet.balance + DAILY_AMOUNT;

    const txn = await Transaction.create({
      uid,
      type: "credit",
      amount: DAILY_AMOUNT,
      description: "Daily Reward",
      status: "Success",
      balanceAfter: newBalance,
      txnId: generateTxnId(),
    });

    await Wallet.updateOne({ uid }, { $inc: { balance: DAILY_AMOUNT } });

    res.json({ success: true, balance: newBalance, txn });
  } catch (err) {
    console.error("DAILY ERROR:", err);
    res.status(500).json({ error: "Failed to update daily reward" });
  }
});

// ------------------------------
//        TASK REWARD
// ------------------------------
app.post("/api/wallet/task", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const uid = req.authUID;

    if (!amount || typeof amount !== "number")
      return res.status(400).json({ error: "Invalid amount" });

    let wallet = await Wallet.findOne({ uid });
    if (!wallet) wallet = await Wallet.create({ uid, balance: 0 });

    const newBalance = wallet.balance + amount;

    const txn = await Transaction.create({
      uid,
      type: "credit",
      amount,
      description: description || "Task Reward",
      status: "Success",
      balanceAfter: newBalance,
      txnId: generateTxnId(),
    });

    await Wallet.updateOne({ uid }, { $inc: { balance: amount } });

    res.json({ success: true, balance: newBalance, txn });
  } catch (err) {
    console.error("TASK ERROR:", err);
    res.status(500).json({ error: "Failed to update balance" });
  }
});

// ------------------------------
//       WITHDRAW (placeholder)
// ------------------------------
app.post("/api/wallet/withdraw", verifyFirebaseToken, async (req, res) => {
  res.json({
    success: false,
    message: "Withdraw is coming soon. Continue using the app 😊",
  });
});

// ------------------------------
//         SERVER START
// ------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running 🔥 on port ${PORT}`));