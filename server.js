require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const admin = require("firebase-admin");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- MIDDLEWARE ----------------
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------------- FIREBASE ADMIN INIT ----------------
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ---------------- DATABASE ----------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// ---------------- ROUTES ----------------
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const walletRoutes = require("./routes/wallet");
const paymentRoutes = require("./routes/payment");

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payment", paymentRoutes);

// ---------------- DEFAULT ROUTE ----------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.listen(PORT, () => console.log(`🚀 SmartTalk running on port ${PORT}`));