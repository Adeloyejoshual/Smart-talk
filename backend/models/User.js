import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },

    wallet: { type: Number, default: 0 },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },

    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reports: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    role: { type: String, enum: ["user", "admin"], default: "user" },
    banned: { type: Boolean, default: false },

    lastSeen: { type: Date, default: Date.now },
    isEmailVerified: { type: Boolean, default: false },

    onlineStatus: {
      type: String,
      enum: ["online", "offline", "away", "busy"],
      default: "offline",
    },

    status: { type: String, enum: ["active", "banned"], default: "active" },
  },
  { timestamps: true }
);

// Hash password before save
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (plainPassword) {
  return await bcrypt.compare(plainPassword, this.password);
};

const User = mongoose.model("User", UserSchema);
export default User;