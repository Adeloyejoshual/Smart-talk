// server/server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { connectDB } from "./config/db.js";
import { initFirebaseAdmin } from "./utils/firebaseAdmin.js";

dotenv.config();
await connectDB();
const admin = initFirebaseAdmin();

const app = express();

// For Stripe webhook we need raw body; we will later use body-parser raw for that route
import bodyParser from "body-parser";

// parse json for regular routes
app.use(cors());
app.use(express.json());

// mount webhook route with raw body (Stripe needs raw)
import webhookRoutes from "./routes/webhookRoutes.js";
app.post("/webhook/stripe", bodyParser.raw({ type: "application/json" }), (req, res, next) => {
  // pass through to controller (controller expects req.rawBody)
  req.rawBody = req.body; // bodyParser.raw sets req.body as Buffer; keep it
  // we need to call the controller directly; import inside to avoid hoisting issues
  import("./controllers/webhookController.js").then(mod => mod.stripeWebhook(req, res)).catch(next);
});

// mount other webhook routes using json parser
app.use("/webhook", bodyParser.json(), webhookRoutes);

// mount other api routes
import paymentRoutes from "./routes/paymentRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import callRoutes from "./routes/callRoutes.js";

app.use("/api/payment", paymentRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/call", callRoutes);

// serve client build if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientBuildPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuildPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));