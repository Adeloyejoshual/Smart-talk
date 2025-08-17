// models/UserSettings.js
const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  // Basic settings
  darkMode: { type: String, enum: ["on", "off", "system"], default: "system" },
  language: { type: String, default: "en" },
  fontSize: { type: String, enum: ["small","medium","large"], default: "medium" },

  // Notifications
  notifMessages: { type: Boolean, default: true },
  notifCalls: { type: Boolean, default: true },
  dnd: { type: Boolean, default: false },
  notificationSoundKind: { type: String, enum: ["builtin","custom"], default: "builtin" },
  notificationSound: { type: String, default: "plastic-bat-hit.mp3" }, // default bat sound

  // Privacy
  showLastSeen: { type: Boolean, default: true },
  allowCallsFromEveryone: { type: Boolean, default: true },

  // Wallet preferences
  walletCurrency: { type: String, default: "USD" },
  lowBalanceThresholdUsd: { type: Number, default: 1.0 },

  // Security
  twoFA: { type: Boolean, default: false },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSettingsSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("UserSettings", userSettingsSchema);