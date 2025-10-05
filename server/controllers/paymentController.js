import axios from "axios";
import { detectCurrency, convertToUSD } from "../utils/currency.js";
import Wallet from "../models/Wallet.js"; // your wallet model

export const createPaymentSession = async (req, res) => {
  try {
    const { amount, uid, method } = req.body;
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

    // 1️⃣ Detect currency by IP
    const localCurrency = await detectCurrency(ip);

    // 2️⃣ Convert amount to USD
    const amountUSD = await convertToUSD(amount, localCurrency);

    // 3️⃣ Choose processor
    let paymentUrl;
    if (method === "paystack") {
      const payRes = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: "user@example.com",
          amount: amount * 100, // Paystack expects kobo
          currency: localCurrency,
        },
        {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` },
        }
      );
      paymentUrl = payRes.data.data.authorization_url;
    } else if (method === "flutterwave") {
      const fwRes = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        {
          tx_ref: `tx-${Date.now()}`,
          amount,
          currency: localCurrency,
          redirect_url: `${process.env.FRONTEND_URL}/wallet`,
          customer: { email: "user@example.com" },
        },
        {
          headers: { Authorization: `Bearer ${process.env.FLW_SECRET}` },
        }
      );
      paymentUrl = fwRes.data.data.link;
    } else {
      // Stripe or fallback
      const stripe = new Stripe(process.env.STRIPE_SECRET);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "Wallet Credit" },
              unit_amount: amountUSD * 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.FRONTEND_URL}/wallet`,
        cancel_url: `${process.env.FRONTEND_URL}/wallet`,
      });
      paymentUrl = session.url;
    }

    res.json({
      url: paymentUrl,
      localCurrency,
      convertedUSD: amountUSD,
    });
  } catch (err) {
    console.error("Payment error:", err.message);
    res.status(500).json({ message: "Payment failed" });
  }
};