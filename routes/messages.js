const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');

router.post('/save', async (req, res) => {
  try {
    const { from, to, message } = req.body;
    const newMsg = new Chat({ from, to, message });
    await newMsg.save();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save message' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { from, to } = req.query;
    const history = await Chat.find({
      $or: [
        { from, to },
        { from: to, to: from }
      ]
    }).sort({ timestamp: 1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;