const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

// POST /api/support/contact
router.post("/contact", async (req, res) => {
  const { subject, message } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!subject || !message) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Setup nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMARTTALK_EMAIL,
        pass: process.env.SMARTTALK_EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"SmartTalk Support" <${process.env.SMARTTALK_EMAIL}>`,
      to: process.env.SMARTTALK_EMAIL,
      subject: `User Support: ${subject}`,
      text: `Support Message:\n\n${message}\n\nToken: ${token}`,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: "Support message sent successfully" });
  } catch (err) {
    console.error("Email Error:", err);
    return res.status(500).json({ message: "Failed to send message" });
  }
});

module.exports = router;