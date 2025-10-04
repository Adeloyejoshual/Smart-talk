// server/controllers/webhookController.js
import Stripe from "stripe";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import { verifyPaystack, verifyFlutterwave } from "../services/paystackService.js"; // reuse verify
import { verifyFlutterwave as verifyFW } from "../services/flutterwaveService.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

/**
 * Stripe webhook: expects raw body. Set STRIPE_WEBHOOK_SECRET in .env.
 * On a successful checkout.session.completed -> credit wallet (use metadata.uid)
 */
export async function stripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ message: "Stripe webhook secret not configured" });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook construct error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    // metadata.uid must be set when creating session
    const uid = session.metadata?.uid;
    const amountTotal = (session.amount_total || 0) / 100.0; // in USD
    if (uid && amountTotal > 0) {
      try {
        const w = await Wallet.findOneAndUpdate({ uid }, {
          $inc: { balance: amountTotal },
          $setOnInsert: { createdAt: new Date(), expiresAt: new Date(Date.now() + (process.env.BONUS_EXPIRY_DAYS||90)*24*60*60*1000) }
        }, { upsert: true, new: true });
        await Transaction.create({ uid, type: "add", amount: amountTotal, currency: "USD", meta: { gateway: "stripe", sessionId: session.id } });
        console.log(`Stripe credited ${amountTotal} to ${uid}`);
      } catch (e) { console.error("Stripe credit error:", e); }
    }
  }

  res.json({ received: true });
}

/**
 * Paystack webhook (POST JSON)
 * Paystack sends event.data.reference -> verify via API to ensure success
 * Body should contain reference and event
 */
export async function paystackWebhook(req, res) {
  try {
    const body = req.body || {};
    // paystack webhook payload may contain data.reference
    const reference = body?.data?.reference || body?.reference;
    if (!reference) return res.status(400).json({ message: "no reference" });

    const v = await verifyPaystack(reference);
    if (v && v.data && v.data.status === "success") {
      // For reliable USD amount: you must map NGN -> USD; here we assume frontend provided amountUSD in metadata or use a conversion (not included)
      // Best practice: store mapping when initializing transaction. For demo, we will accept metadata.reference contains uid and amountUSD.
      const metadata = v.data?.metadata || {};
      const uid = metadata?.uid;
      const amountKobo = v.data.amount; // in kobo
      const amountNGN = amountKobo / 100;
      // Simple conversion approach: use a fixed rate or expect frontend to pass amountUSD. For demo, use a naive conversion rate env var:
      const rate = Number(process.env.NGN_TO_USD_RATE || 0.0026); // example rate (approx)
      const amountUSD = Number((amountNGN * rate).toFixed(2));
      if (uid && amountUSD > 0) {
        const w = await Wallet.findOneAndUpdate({ uid }, {
          $inc: { balance: amountUSD },
          $setOnInsert: { createdAt: new Date(), expiresAt: new Date(Date.now() + (process.env.BONUS_EXPIRY_DAYS||90)*24*60*60*1000) }
        }, { upsert: true, new: true });
        await Transaction.create({ uid, type: "add", amount: amountUSD, currency: "USD", meta: { gateway: "paystack", reference } });
        console.log(`Paystack credited ${amountUSD} USD to ${uid}`);
      }
    }
    return res.json({ received: true });
  } catch (err) {
    console.error("Paystack webhook error:", err);
    return res.status(500).json({ message: err.message });
  }
}

/**
 * Flutterwave webhook
 * We get data.id or tx_ref, verify via API (server-side)
 */
export async function flutterwaveWebhook(req, res) {
  try {
    const body = req.body || {};
    const id = body?.data?.id || body?.id;
    if (!id) return res.status(400).json({ message: "no id" });

    const v = await verifyFW(id); // this calls Flutterwave verify endpoint
    // verifyFW should return a structure with status === 'success'
    if (v && (v.status === "success" || v.data?.status === "successful")) {
      // extract meta
      const metadata = v.data?.meta || {};
      const uid = metadata?.uid || v.data?.customer?.email; // depends on initialization
      // conversion approach: expect amountUSD in metadata or convert
      const amount = Number(v.data?.amount || v.data?.transaction_amount || 0);
      const currency = v.data?.currency || "NGN";
      // naive conversion if needed
      let amountUSD = amount;
      if (currency !== "USD") {
        const rate = Number(process.env.NGN_TO_USD_RATE || 0.0026);
        amountUSD = Number((amount * rate).toFixed(2));
      }
      if (uid && amountUSD > 0) {
        const w = await Wallet.findOneAndUpdate({ uid }, {
          $inc: { balance: amountUSD },
          $setOnInsert: { createdAt: new Date(), expiresAt: new Date(Date.now() + (process.env.BONUS_EXPIRY_DAYS||90)*24*60*60*1000) }
        }, { upsert: true, new: true });
        await Transaction.create({ uid, type: "add", amount: amountUSD, currency: "USD", meta: { gateway: "flutterwave", id } });
        console.log(`Flutterwave credited ${amountUSD} USD to ${uid}`);
      }
    }
    return res.json({ received: true });
  } catch (err) {
    console.error("Flutterwave webhook error:", err);
    return res.status(500).json({ message: err.message });
  }
}
