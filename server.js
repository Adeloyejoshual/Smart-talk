import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";
import Stripe from "stripe";
import mongoose from "mongoose";

dotenv.config();

// --- File path setup --- //
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// --- MongoDB Connection --- //
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// --- Mongo Schemas --- //
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  displayName: { type: String, default: "" },
  balance: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now },
});

const walletHistorySchema = new mongoose.Schema({
  uid: { type: String, required: true },
  type: { type: String, enum: ["credit", "debit"], required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const WalletHistory = mongoose.model("WalletHistory", walletHistorySchema);

// --- Firebase Admin --- //
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

// --- Stripe --- //
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ------------------ API ROUTES ------------------ //

// Create or get user
app.post("/api/user", async (req, res) => {
  const { uid, email, displayName } = req.body;
  try {
    let user = await User.findOne({ uid });
    if (!user) {
      user = await User.create({ uid, email, displayName });
      // Initial bonus
      await WalletHistory.create({ uid, type: "credit", amount: 5, description: "New user bonus" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get wallet balance + history
app.get("/api/wallet/:uid", async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ error: "User not found" });

    const history = await WalletHistory.find({ uid: req.params.uid }).sort({ createdAt: -1 });
    res.json({ balance: user.balance, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add wallet transaction
app.post("/api/wallet/add", async (req, res) => {
  const { uid, type, amount, description } = req.body;
  try {
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ error: "User not found" });

    const newBalance = user.balance + (type === "credit" ? amount : -amount);
    await User.updateOne({ uid }, { balance: newBalance });

    const tx = await WalletHistory.create({ uid, type, amount, description });
    res.json({ transaction: tx, balance: newBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe Payment Intent
app.post("/api/payment", async (req, res) => {
  try {
    const { amount, currency } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({ amount, currency });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

// ------------------ START SERVER ------------------ //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));