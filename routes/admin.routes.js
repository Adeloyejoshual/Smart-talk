// routes/admin.routes.js
import express from "express";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import Report from "../models/Report.js";

const router = express.Router();

// summary for overview
router.get("/stats", verifyAdmin, async (req, res) => {
  const [users, groups, reports] = await Promise.all([
    User.countDocuments(),
    Group.countDocuments(),
    Report.countDocuments()
  ]);
  // messages count omitted (depends on your Message model). return 0 if unavailable.
  res.json({ users, groups, reports, recentActivity: [] });
});

// USERS
router.get("/users", verifyAdmin, async (req, res) => {
  const q = req.query.search || "";
  const filter = q ? { username: new RegExp(q, "i") } : {};
  const users = await User.find(filter).select("username email status createdAt");
  res.json(users);
});

router.delete("/users/:id", verifyAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "User deleted" });
});

// GROUPS
router.get("/groups", verifyAdmin, async (req, res) => {
  const groups = await Group.find().select("name members createdAt");
  res.json(groups);
});

router.get("/groups/reported", verifyAdmin, async (req, res) => {
  const groups = await Group.find({ reports: { $exists: true, $ne: [] } })
    .select("name reports createdAt");
  res.json(groups);
});

router.delete("/groups/:id", verifyAdmin, async (req, res) => {
  await Group.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "Group deleted successfully" });
});

// REPORTS
router.get("/reports/users", verifyAdmin, async (req, res) => {
  const reports = await Report.find({ type: "user" }).populate("reporter", "username");
  res.json(reports);
});
router.get("/reports/groups", verifyAdmin, async (req, res) => {
  const reports = await Report.find({ type: "group" });
  res.json(reports);
});
router.get("/reports/messages", verifyAdmin, async (req, res) => {
  const reports = await Report.find({ type: "message" });
  res.json(reports);
});

// BROADCAST
router.post("/broadcast", verifyAdmin, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ success: false, message: "Message required" });
  const io = req.app.get("io");
  if (io) io.emit("admin:broadcast", { message, ts: Date.now() });
  res.json({ success: true, message: "Broadcast sent" });
});

export default router;
