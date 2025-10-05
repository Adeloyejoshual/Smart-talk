import express from "express";
import axios from "axios";
import Stripe from "stripe";
import Wallet from "../models/walletModel.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🟢 Get Wallet Balance
router.get("/:userId", async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId });
    if (!wallet)
      return res.status(404).json({ success: false, message: "Wallet not found" });
    res.json({ success: true, balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 🟢 Add Credit via Stripe
router.post("/add/stripe", async (req, res) => {
  try {
    const { userId, amount, currency, token } = req.body;

    const charge = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      payment_method: token,
      confirm: true,
    });

    await Wallet.updateOne(
      { userId },
      { $inc: { balance: amount } },
      { upsert: true }
    );

    res.json({ success: true, message: "Credit added successfully (Stripe)" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Stripe payment failed" });
  }
});

// 🟢 Add Credit via Paystack
router.post("/add/paystack", async (req, res) => {
  try {
    const { userId, email, amount } = req.body;
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: amount * 100,
        currency: "USD",
      },
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      }
    );
    res.json({
      success: true,
      authorization_url: response.data.data.authorization_url,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Paystack failed" });
  }
});

// 🟢 Add Credit via Flutterwave
router.post("/add/flutterwave", async (req, res) => {
  try {
    const { userId, email, amount } = req.body;
    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: `tx-${Date.now()}`,
        amount,
        currency: "USD",
        redirect_url: "https://yourapp.com/wallet",
        customer: { email },
      },
      {
        headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
      }
    );
    res.json({
      success: true,
      link: response.data.data.link,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Flutterwave failed" });
  }
});

export default router;