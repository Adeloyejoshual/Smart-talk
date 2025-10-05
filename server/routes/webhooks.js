// 📁 server/routes/webhooks.js
import express from "express";
import Stripe from "stripe";
import SavedCard from "../models/SavedCard.js";
import Wallet from "../models/Wallet.js";
import crypto from "crypto";

const router = express.Router();

// 🔑 Load environment keys
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const FLW_SECRET = process.env.FLW_SECRET_KEY;

/* 
=====================================================
🟦 STRIPE WEBHOOK
=====================================================
*/
router.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log("⚠️ Stripe webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const uid = session.metadata.uid;
    const amount = session.amount_total / 100;

    // ✅ Update wallet balance
    const wallet = await Wallet.findOneAndUpdate(
      { uid },
      { $inc: { balance: amount } },
      { upsert: true, new: true }
    );

    console.log(`💰 Stripe: Added $${amount} to wallet ${uid}`);

    // Save card (if details available)
    if (session.payment_method_types?.includes("card")) {
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent, {
        expand: ["payment_method"],
      });
      const pm = paymentIntent.payment_method;
      if (pm?.card) {
        const { brand, last4, exp_month, exp_year } = pm.card;
        const details = {
          brand,
          last4,
          exp_month,
          exp_year,
          paymentMethodId: pm.id,
          stripeCustomerId: session.customer,
        };

        await SavedCard.findOneAndUpdate(
          { uid, "details.last4": last4, gateway: "stripe" },
          { uid, gateway: "stripe", details },
          { upsert: true }
        );
      }
    }
  }

  res.json({ received: true });
});

/* 
=====================================================
🟩 PAYSTACK WEBHOOK
=====================================================
*/
router.post("/webhook/paystack", express.json(), async (req, res) => {
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"])
    return res.status(400).send("Invalid signature");

  const event = req.body;

  if (event.event === "charge.success") {
    const data = event.data;
    const uid = data.metadata?.uid;
    const amount = data.amount / 100;

    // ✅ Update wallet
    await Wallet.findOneAndUpdate(
      { uid },
      { $inc: { balance: amount } },
      { upsert: true, new: true }
    );

    console.log(`💰 Paystack: Added $${amount} to wallet ${uid}`);

    // ✅ Save card authorization for recurring charges
    if (data.authorization) {
      const { brand, last4, exp_month, exp_year, authorization_code } = data.authorization;
      await SavedCard.findOneAndUpdate(
        { uid, last4, gateway: "paystack" },
        {
          uid,
          gateway: "paystack",
          brand,
          last4,
          exp_month,
          exp_year,
          paystackAuthCode: authorization_code,
        },
        { upsert: true }
      );
    }
  }

  res.sendStatus(200);
});

/* 
=====================================================
🟨 FLUTTERWAVE WEBHOOK
=====================================================
*/
router.post("/webhook/flutterwave", express.json(), async (req, res) => {
  const signature = req.headers["verif-hash"];
  if (!signature || signature !== FLW_SECRET) {
    return res.status(401).send("Unauthorized");
  }

  const event = req.body;
  if (event.event === "charge.completed" && event.data.status === "successful") {
    const data = event.data;
    const uid = data.meta?.uid;
    const amount = data.amount;

    // ✅ Update wallet
    await Wallet.findOneAndUpdate(
      { uid },
      { $inc: { balance: amount } },
      { upsert: true, new: true }
    );

    console.log(`💰 Flutterwave: Added $${amount} to wallet ${uid}`);

    // ✅ Save card token
    if (data.card?.token) {
      const { type, last_4digits, expiry, token } = data.card;
      const [exp_month, exp_year] = expiry.split("/");

      await SavedCard.findOneAndUpdate(
        { uid, last4: last_4digits, gateway: "flutterwave" },
        {
          uid,
          gateway: "flutterwave",
          brand: type,
          last4: last_4digits,
          exp_month,
          exp_year,
          flwCardToken: token,
        },
        { upsert: true }
      );
    }
  }

  res.sendStatus(200);
});

export default router;