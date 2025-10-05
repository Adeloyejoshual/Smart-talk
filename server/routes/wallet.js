import express from "express";
import Wallet from "../models/Wallet.js";

const router = express.Router();

router.post("/update", async (req, res) => {
  const { uid, usdAmount } = req.body;

  let wallet = await Wallet.findOne({ uid });
  if (!wallet) wallet = new Wallet({ uid, balance: 0 });

  wallet.balance += usdAmount;
  await wallet.save();

  res.json({ wallet });
});

export default router;