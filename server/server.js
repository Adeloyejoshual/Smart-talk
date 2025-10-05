// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";

import { connectDB } from "./config/db.js";
import { initFirebaseAdmin } from "./utils/firebaseAdmin.js";

import paymentRoutes from "./routes/paymentRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";

dotenv.config();

// Connect to MongoDB
await connectDB();

// Initialize Firebase Admin SDK
const admin = initFirebaseAdmin();

const app = express();

// Enable CORS and JSON parsing middleware globally
app.use(cors());
app.use(express.json());

// Stripe webhook route: uses raw body parser as required by Stripe
app.post(
  "/webhook/stripe",
  bodyParser.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body; // preserve raw body buffer for Stripe signature verification
    import("./controllers/webhookController.js")
      .then((mod) => mod.stripeWebhook(req, res))
      .catch(next);
  }
);

// Other webhook routes use JSON parser
app.use("/webhook", bodyParser.json(), webhookRoutes);

// Mount API routes
app.use("/api/payment", paymentRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/call", callRoutes);

// Serve static files from client build directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientBuildPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuildPath));

// Serve index.html for any other route (SPA fallback)
app.get("*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

// Optional quick root check route
app.get("/", (req, res) => res.send("SmartTalk server running"));

// Start the server on specified port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));