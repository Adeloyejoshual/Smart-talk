import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  balance: { type: Number, default: 5.0 }, // new user $5
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});