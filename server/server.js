// ==============================
// 🌍 SmartTalk Backend Server
// ==============================

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";

// ==============================
// 🔧 Config
// ==============================
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================
// 🧩 Middleware
// ==============================
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

// ==============================
// 🧠 MongoDB Connection
// ==============================
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ==============================
// 🔥 Firebase Admin SDK Setup
// ==============================
try {
  const serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("✅ Firebase Admin initialized");
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin:", error);
}

// ==============================
// 🧪 Routes
// ==============================
app.get("/", (req, res) => {
  res.send("🚀 SmartTalk API is running successfully!");
});

// Health check (for Render)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Example protected route (Firebase-authenticated)
app.get("/secure", async (req, res) => {
  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    res.json({ message: "Secure route accessed", user: decoded });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ==============================
// 🚀 Start Server
// ==============================
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});