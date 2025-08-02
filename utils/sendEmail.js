const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text) => {
  // Configure your SMTP transporter here
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", // or your email provider SMTP
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,    // your email address
      pass: process.env.EMAIL_PASS,    // your email password or app password
    },
  });

  const mailOptions = {
    from: `"SmartTalk Support" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Email sending error:", error);
    throw new Error("Could not send email");
  }
};

module.exports = sendEmail;