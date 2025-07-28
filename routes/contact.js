// routes/contact.js

const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

router.post('/', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ msg: 'All fields are required' });
  }

  try {
    // You can customize the transport with your real SMTP credentials
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'smarttalkgit@gmail.com', // your SmartTalk email
        pass: process.env.GMAIL_APP_PASSWORD, // stored in .env
      },
    });

    const mailOptions = {
      from: email,
      to: 'smarttalkgit@gmail.com',
      subject: `Contact Form from ${name}`,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ msg: 'Message sent successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Failed to send message' });
  }
});

module.exports = router;