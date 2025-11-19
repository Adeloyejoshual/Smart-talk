// routes/call.js
import express from "express";
import CallHistory from "../models/CallHistory.js";

const router = express.Router();

// Record a new call
router.post("/add", async (req, res) => {
  try {
    const { chatId, participants, type, duration, status, startedAt, endedAt } = req.body;
    const call = new CallHistory({ chatId, participants, type, duration, status, startedAt, endedAt });
    await call.save();
    res.status(201).json({ success: true, call });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get call history for a chat
router.get("/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const calls = await CallHistory.find({ chatId }).sort({ startedAt: -1 });
    res.json(calls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
