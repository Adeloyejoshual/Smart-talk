import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  uid: { type: String, unique: true, required: true },
  name: String,
  email: String,
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);