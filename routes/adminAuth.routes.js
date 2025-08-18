// routes/adminAuth.routes.js
import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/login", (req, res) => {
  const { username, passcode } = req.body;
  const validUser = username === process.env.ADMIN_USERNAME;
  const validPass = passcode === process.env.ADMIN_PASSCODE;

  if (!validUser || !validPass) {
    return res.status(401).json({ success: false, message: "Invalid admin credentials" });
  }

  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1d" });
  res.json({ success: true, token });
});

export default router;
