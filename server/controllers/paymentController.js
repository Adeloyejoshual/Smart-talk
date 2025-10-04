import { createStripeCheckout } from "../services/stripeService.js";
import { initializePaystackTransaction, verifyPaystack } from "../services/paystackService.js";
import { initializeFlutterwave, verifyFlutterwave } from "../services/flutterwaveService.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

/**
 * NOTE: For production, verify webhooks from Stripe / Paystack / Flutterwave and update wallet only after webhook confirmation.
 */

export async function stripeSession(req, res) {
  try {
    const { amount, uid } = req.body;
    if (!amount || !uid) return res.status(400).json({ message: "amount and uid required" });
    const session = await createStripeCheckout(amount, uid, req.headers.origin || req.body.origin || "http://localhost:5173");
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function paystackInit(req, res) {
  try {
    const { amountNGN, email, uid } = req.body;
    const callbackUrl = `${req.headers.origin}/wallet`;
    const r = await initializePaystackTransaction(amountNGN, email, callbackUrl);
    res.json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function paystackVerify(req, res) {
  try {
    const { reference, uid, amountUSD } = req.body;
    const data = await verifyPaystack(reference);
    if (data.status && data.data.status === "success") {
      // convert NGN->USD externally (for demo assume amountUSD provided)
      const wallet = await Wallet.findOneAndUpdate({ uid }, {
        $inc: { balance: amountUSD },
        $setOnInsert: { createdAt: new Date(), expiresAt: new Date(Date.now() + (process.env.BONUS_EXPIRY_DAYS||90)*24*60*60*1000) }
      }, { upsert: true, new: true });
      await Transaction.create({ uid, type: 'add', amount: amountUSD, currency: 'USD', meta: { gateway: 'paystack', reference }});
      return res.json({ success: true, wallet });
    } else {
      return res.status(400).json({ success: false, message: "payment not successful" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function flutterwaveInit(req, res) {
  try {
    const { amount, currency, customer } = req.body;
    const redirectUrl = `${req.headers.origin}/wallet`;
    const r = await initializeFlutterwave(amount, currency, redirectUrl, customer);
    res.json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function flutterwaveVerify(req, res) {
  try {
    const { id, uid, amountUSD } = req.body;
    const r = await verifyFlutterwave(id);
    if (r.status === "success") {
      const wallet = await Wallet.findOneAndUpdate({ uid }, {
        $inc: { balance: amountUSD },
        $setOnInsert: { createdAt: new Date(), expiresAt: new Date(Date.now() + (process.env.BONUS_EXPIRY_DAYS||90)*24*60*60*1000) }
      }, { upsert: true, new: true });
      await Transaction.create({ uid, type: 'add', amount: amountUSD, currency: 'USD', meta: { gateway: 'flutterwave', id }});
      return res.json({ success: true, wallet });
    } else {
      return res.status(400).json({ message: "not successful" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
