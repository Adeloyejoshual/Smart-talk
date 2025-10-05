// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

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

// For Stripe webhook we need raw body; use body-parser raw for that route
// Use JSON parser and CORS generally
app.use(cors());
app.use(express.json());

// Stripe webhook route with raw body parser (Stripe requires the raw request body)
app.post(
  "/webhook/stripe",
  bodyParser.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body; // body-parser.raw sets req.body as Buffer; preserve it
    // Dynamically import webhook controller to avoid hoisting issues
    import("./controllers/webhookController.js")
      .then((mod) => mod.stripeWebhook(req, res))
      .catch(next);
  }
);

// Other webhook routes, parsed as JSON
app.use("/webhook", bodyParser.json(), webhookRoutes);

// Mount API routes
app.use("/api/payment", paymentRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/call", callRoutes);

// Serve static client build if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientBuildPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuildPath));

// Catch-all route to serve the client index.html for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

// Optional root quick check route
app.get("/", (req, res) => res.send("SmartTalk server running"));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));