const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");

router.get("/history/:from/:to", async (req, res) => {
  const { from, to } = req.params;
  try {
    const messages = await Chat.find({
      $or: [
        { from, to },
        { from: to, to: from }
      ]
    }).sort("timestamp");
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: "Failed to load chat history" });
  }
});

module.exports = router;