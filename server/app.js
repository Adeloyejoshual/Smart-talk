import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import stripeWebhook from "./routes/stripeWebhook.js";

dotenv.config();

const app = express();
app.use(cors());

// ⚠️ Important: Stripe webhook must be added *before* JSON middleware
app.use("/api", stripeWebhook);

// Normal JSON parsing for other routes
app.use(express.json());

// other routes (wallet, payment, etc.) go here...

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("✅ MongoDB connected");
  app.listen(process.env.PORT || 5000, () =>
    console.log("🚀 Server running...")
  );
});
