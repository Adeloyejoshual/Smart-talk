import mongoose from "mongoose";

// Sub-schema for reports inside a group
const reportSub = new mongoose.Schema(
  {
    reason: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    image: { type: String, default: "" }, // Cloudinary group image
    reports: [reportSub], // embedded reports
  },
  { timestamps: true } // auto createdAt & updatedAt
);

const Group = mongoose.model("Group", groupSchema);
export default Group;