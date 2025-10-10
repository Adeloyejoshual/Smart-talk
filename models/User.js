import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  name: { type: String },
  email: { type: String },
  avatar: { type: String },
  walletBalance: { type: Number, default: 0 },
  theme: { type: String, default: "light" }, // Global theme control
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);