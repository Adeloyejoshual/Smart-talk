// routes/payments.js
const express = require("express");
const router = express.Router();
const Wallet = require("../models/Wallet");

// POST /api/payments/checkout
router.post("/checkout", async (req, res) => {
  // Body: { amount, currency, gateway }
  // Create payment intent/record, return redirect/inline data for client to continue.
  const { amount, currency, gateway } = req.body;
  if (!amount || !currency || !gateway) return res.status(400).json({ error: "Missing fields" });

  // Create a transaction record on DB (pending)
  // In production set reference and integrate with gateway SDKs
  const reference = `LOCAL-${Date.now()}`;
  // Save in DB / Wallet.transactions ideally
  return res.json({
    reference,
    redirectUrl: null,
    inlineHtml: null,
    message: "Checkout created (stub). Integrate gateway server-side.",
  });
});

// GET /api/payments/status?ref=...
router.get("/status", async (req, res) => {
  const ref = req.query.ref;
  if (!ref) return res.status(400).json({ error: "ref required" });

  // In production read transaction by ref and return actual status
  // Here we return pending as stub
  return res.json({ status: "pending" });
});

module.exports = router;