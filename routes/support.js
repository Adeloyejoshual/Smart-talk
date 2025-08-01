const express = require('express');
const router = express.Router();

router.post('/contact', async (req, res) => {
  const { email, message } = req.body;
  // Optional: Save to DB or send email
  res.json({ message: "Thanks for contacting us!" });
});

router.post('/chat', async (req, res) => {
  const { email, issue } = req.body;
  // Optional: Save or log issue
  res.json({ message: "Customer service will respond shortly." });
});

module.exports = router;