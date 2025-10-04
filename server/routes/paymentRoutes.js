import express from "express";
import { stripeSession, paystackInit, paystackVerify, flutterwaveInit, flutterwaveVerify } from "../controllers/paymentController.js";
const router = express.Router();

router.post("/stripe-session", stripeSession);
router.post("/paystack/init", paystackInit);
router.post("/paystack/verify", paystackVerify);
router.post("/flutterwave/init", flutterwaveInit);
router.post("/flutterwave/verify", flutterwaveVerify);

export default router;
