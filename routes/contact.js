const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

router.post('/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const newMsg = new Message({ name, email, message });
    await newMsg.save();
    res.json({ message: 'Message received successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error saving message.' });
  }
});

module.exports = router;
