const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  email: { type: String, required: true },
  displayName: String,
  photoURL: String,
  joinedAt: { type: Date, default: Date.now },
  role: { type: String, default: "user" },
  settings: {
    theme: { type: String, default: "light" },
    notifications: { type: Boolean, default: true },
    sounds: { type: Boolean, default: true },
  },
});

module.exports = mongoose.model("User", userSchema);