// routes/callRoutes.js
const express = require("express");
const router = express.Router();
const CallHistory = require("../models/CallHistory");

// Add new call history
router.post("/add", async (req, res) => {
  try {
    const { chatId, participants, type, status, duration, startedAt, endedAt } = req.body;

    if (!chatId || !participants || !type || !startedAt || !endedAt) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newCall = new CallHistory({
      chatId,
      participants,
      type,
      status: status || "completed",
      duration: duration || 0,
      startedAt,
      endedAt
    });

    await newCall.save();
    res.status(201).json({ message: "Call history saved", call: newCall });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
