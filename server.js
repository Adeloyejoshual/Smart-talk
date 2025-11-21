// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import Stripe from "stripe";
import mongoose from "mongoose";
import fetch from "node-fetch"; // for Flutterwave API calls

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
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  console.log("✅ Firebase Admin initialized");
}

// ------------------- Stripe -------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ------------------- MongoDB -------------------
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI)
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

// Firebase token verification middleware
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!idToken) return res.status(401).json({ error: "Missing or invalid Authorization header" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    req.authUID = decoded.uid;
    next();
  } catch (err) {
    console.error("Firebase token verify error:", err);
    return res.status(401).json({ error: "Invalid auth token" });
  }
};

// ------------------- API Routes -------------------

// Stripe payment
app.post("/api/payment/stripe", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount, currency = "usd" } = req.body;
    const uid = req.authUID;

    if (!amount || typeof amount !== "number") return res.status(400).json({ error: "Invalid amount" });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // cents
      currency,
    });

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

// Flutterwave payment
app.post("/api/payment/flutterwave", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount, currency = "NGN", redirect_url } = req.body;
    const uid = req.authUID;

    if (!amount || typeof amount !== "number") return res.status(400).json({ error: "Invalid amount" });

    // create transaction in MongoDB as pending
    const txn = await Transaction.create({
      uid,
      type: "deposit",
      amount,
      description: "Flutterwave Payment",
      status: "Pending",
      txnId: generateTxnId(),
    });

    const payload = {
      tx_ref: txn.txnId,
      amount,
      currency,
      redirect_url: redirect_url || "https://yourapp.com/wallet",
      payment_options: "card,ussd,banktransfer",
      customer: {
        email: req.body.email || "user@example.com",
        phonenumber: req.body.phone || "08000000000",
        name: req.body.name || "Anonymous",
      },
      customizations: {
        title: "SmartTalk Wallet Top-up",
        description: "Add funds to wallet",
      },
    };

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.status !== "success") return res.status(400).json({ error: data.message });

    res.json({ checkout_url: data.data.link, txnId: txn.txnId });
  } catch (err) {
    console.error("Flutterwave error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Wallet history
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

// Wallet balance only
app.get("/api/wallet/balance/:uid", verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.params;
    if (req.authUID !== uid) return res.status(403).json({ error: "Forbidden" });

    const walletDoc = await Wallet.findOne({ uid });
    const balance = walletDoc ? walletDoc.balance : 0;
    res.json({ balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Daily check-in
app.post("/api/wallet/daily", verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, amount } = req.body;
    if (req.authUID !== uid) return res.status(403).json({ error: "Forbidden" });

    const today = new Date().toISOString().split("T")[0];
    let wallet = await Wallet.findOne({ uid });
    if (!wallet) wallet = await Wallet.create({ uid, balance: 0, lastCheckIn: null });

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

// Withdraw
app.post("/api/wallet/withdraw", verifyFirebaseToken, async (req, res) => {
  try {
    const { uid, amount, destination } = req.body;
    if (req.authUID !== uid) return res.status(403).json({ error: "Forbidden" });
    if (amount <= 0) return res.status(400).json({ error: "Invalid amount" });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const wallet = await Wallet.findOne({ uid }).session(session);
      if (!wallet || wallet.balance < amount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "Insufficient funds" });
      }

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
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));