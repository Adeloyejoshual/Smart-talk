// ==========================
// 🌐 SmartTalk Server (ESM)
// ==========================

import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import Stripe from "stripe";
import bodyParser from "body-parser";
import fetch from "node-fetch";

// ==========================
// 🧩 Import Models & Routes
// ==========================
import User from "./models/User.js";
import Message from "./models/Message.js";
import userRoutes from "./routes/user.js";
import walletRoutes from "./routes/wallet.js";

// ==========================
// 🔧 Basic Setup
// ==========================
dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// __dirname replacement (for ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files (Frontend)
app.use(express.static(path.join(__dirname, "public")));

// ==========================
// 💾 MongoDB Connection
// ==========================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// ==========================
// 🔥 Firebase Admin SDK
// ==========================
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  console.log("✅ Firebase Admin initialized");
} catch (error) {
  console.error("❌ Firebase initialization error:", error.message);
}

// ==========================
// 💰 Payment Setup (Stripe)
// ==========================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ==========================
// 🧭 API Routes
// ==========================
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);

// ==========================
// 💵 Wallet Routes (Direct)
// ==========================
app.get("/api/wallet/:uid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, balance: user.walletBalance || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/wallet/add", async (req, res) => {
  try {
    const { uid, amount } = req.body;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.walletBalance = (user.walletBalance || 0) + Number(amount);
    await user.save();

    res.json({ success: true, balance: user.walletBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================
// 💬 Chat & Messages API
// ==========================
app.get("/api/messages/:chatId", async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/messages/send", async (req, res) => {
  try {
    const { chatId, senderId, text } = req.body;
    const message = await Message.create({ chatId, senderId, text });
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================
// 🌍 Frontend Routes
// ==========================
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/home", (req, res) => res.sendFile(path.join(__dirname, "public", "home.html")));
app.get("/chat", (req, res) => res.sendFile(path.join(__dirname, "public", "chat.html")));

// ==========================
// ⚙️ System Health Check
// ==========================
app.get("/api/health", (req, res) => {
  res.json({
    status: "✅ SmartTalk running",
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    firebase: admin.apps.length ? "Active" : "Not Initialized",
  });
});

// ==========================
// 🚀 Start Server
// ==========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 SmartTalk live on port ${PORT}`));