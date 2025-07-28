const express = require('express');
const router = express.Router();

// Temporary contact route just for testing
router.post('/', (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Simulate success (without sending email)
  console.log('Contact form submitted:', { name, email, message });

  res.status(200).json({ message: 'Your message was received. Thank you!' });
});

module.exports = router;