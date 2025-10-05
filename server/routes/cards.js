// 📁 server/routes/cards.js
import express from "express";
import SavedCard from "../models/SavedCard.js";

const router = express.Router();

/* 
--------------------------------------------------------
🟢 Get all saved cards for a user
--------------------------------------------------------
*/
router.get("/cards/:uid", async (req, res) => {
  try {
    const cards = await SavedCard.find({ uid: req.params.uid }).sort({ default: -1 });
    res.json({ cards });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* 
--------------------------------------------------------
🟢 Set a card as default
--------------------------------------------------------
*/
router.post("/cards/set-default", async (req, res) => {
  try {
    const { uid, cardId } = req.body;
    if (!uid || !cardId) return res.status(400).json({ message: "Missing parameters" });

    await SavedCard.updateMany({ uid }, { default: false });
    const card = await SavedCard.findByIdAndUpdate(cardId, { default: true }, { new: true });

    res.json({ success: true, card });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* 
--------------------------------------------------------
🟢 Save new card (Stripe / Paystack / Flutterwave)
--------------------------------------------------------
*/
router.post("/cards/save", async (req, res) => {
  try {
    const { uid, gateway, details } = req.body;

    if (!uid || !gateway || !details)
      return res.status(400).json({ message: "Missing parameters" });

    // Prevent duplicates (same fingerprint or card last4)
    const existing = await SavedCard.findOne({
      uid,
      "details.last4": details.last4,
      gateway,
    });
    if (existing) return res.status(200).json({ message: "Card already saved", card: existing });

    // If no default card exists, make this the default
    const hasDefault = await SavedCard.exists({ uid, default: true });

    const newCard = new SavedCard({
      uid,
      gateway,
      brand: details.brand,
      last4: details.last4,
      exp_month: details.exp_month,
      exp_year: details.exp_year,
      stripeCustomerId: details.stripeCustomerId || null,
      paymentMethodId: details.paymentMethodId || null,
      paystackAuthCode: details.paystackAuthCode || null,
      flwCardToken: details.flwCardToken || null,
      default: !hasDefault, // first card auto default
    });

    await newCard.save();
    res.json({ success: true, card: newCard });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;