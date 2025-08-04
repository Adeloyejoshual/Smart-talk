const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    image: { type: String, default: "" }, // group display picture (Cloudinary)
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);