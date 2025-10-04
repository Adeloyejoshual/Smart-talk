// server/routes/webhookRoutes.js
import express from "express";
import { stripeWebhook, paystackWebhook, flutterwaveWebhook } from "../controllers/webhookController.js";

const router = express.Router();

// NOTE: Stripe requires raw body; handled in server.js
router.post("/stripe", stripeWebhook);

// Paystack and Flutterwave can use JSON body
router.post("/paystack", paystackWebhook);
router.post("/flutterwave", flutterwaveWebhook);

export default router;
