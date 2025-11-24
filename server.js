// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import mongoose from "mongoose";
import fs from "fs";
import B2 from "backblaze-b2";
import multer from "multer";

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
// MongoDB
// -----------------------------
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("🟢 MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// -----------------------------
// Models
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

const generateTxnId = () =>
  `txn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// -----------------------------
// Firebase Auth Middleware
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
// Wallet Endpoints
// -----------------------------
app.post("/api/wallet/daily", verifyFirebaseToken, async (req, res) => {
  try {
    const amount = 0.25;
    const uid = req.authUID;
    const today = new Date().toISOString().split("T")[0];

    let wallet = await Wallet.findOne({ uid });
    if (!wallet) wallet = await Wallet.create({ uid, balance: 0 });

    if (wallet.lastCheckIn === today)
      return res.status(400).json({ error: "Already claimed today" });

    const newBalance = wallet.balance + amount;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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

      await Wallet.updateOne(
        { uid },
        { $inc: { balance: amount }, $set: { lastCheckIn: today } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      res.json({ success: true, balance: newBalance, txn, lastDailyClaim: today });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    }
  } catch (err) {
    console.error("Daily reward error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/wallet/:uid", verifyFirebaseToken, async (req, res) => {
  try {
    const { uid } = req.params;
    if (req.authUID !== uid) return res.status(403).json({ error: "Forbidden" });

    const wallet = await Wallet.findOne({ uid });
    const transactions = await Transaction.find({ uid }).sort({ createdAt: -1 });

    res.json({
      balance: wallet?.balance || 0,
      transactions,
      lastDailyClaim: wallet?.lastCheckIn || null,
    });
  } catch (err) {
    console.error("Wallet error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/wallet/withdraw", verifyFirebaseToken, async (req, res) => {
  try {
    const { amount, destination } = req.body;
    const uid = req.authUID;

    if (!amount || amount <= 0) return res.status(400).json({ error: "Bad amount" });

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
// Backblaze B2 Integration
// -----------------------------
const b2 = new B2({
  accountId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});
await b2.authorize();
console.log("🔥 Backblaze B2 authorized");

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload-b2", verifyFirebaseToken, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const uploadUrlResp = await b2.getUploadUrl({ bucketId: process.env.B2_BUCKET_ID });
    const uploadRes = await b2.uploadFile({
      uploadUrl: uploadUrlResp.data.uploadUrl,
      uploadAuthToken: uploadUrlResp.data.authorizationToken,
      fileName: `uploads/${Date.now()}_${file.originalname}`,
      data: file.buffer,
      mime: file.mimetype,
    });

    const downloadUrl = `https://f002.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${uploadRes.data.fileName}`;
    res.json({ success: true, url: downloadUrl, fileName: file.originalname });
  } catch (err) {
    console.error("B2 Upload Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------
// Serve Frontend
// -----------------------------
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist/index.html")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));