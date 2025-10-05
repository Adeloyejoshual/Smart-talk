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
    const cards = await SavedCard.find({ uid: req.params.uid }).sort({ default: -1, _id: 1 });
    res.json({ cards });
  } catch (err) {
    console.error("Get cards error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* 
--------------------------------------------------------
🟢 Set a card as default for the user
--------------------------------------------------------
*/
router.post("/cards/set-default", async (req, res) => {
  try {
    const { uid, cardId } = req.body;
    if (!uid || !cardId) return res.status(400).json({ message: "Missing parameters" });

    // Unset any default card for user
    await SavedCard.updateMany({ uid }, { $set: { default: false } });

    // Set the chosen card as default
    const card = await SavedCard.findByIdAndUpdate(cardId, { default: true }, { new: true });
    if (!card) return res.status(404).json({ message: "Card not found" });

    res.json({ success: true, message: "Default card updated", card });
  } catch (err) {
    console.error("Set default error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* 
--------------------------------------------------------
❌ Delete a saved card
--------------------------------------------------------
*/
router.delete("/cards/:cardId", async (req, res) => {
  try {
    const deletedCard = await SavedCard.findByIdAndDelete(req.params.cardId);
    if (!deletedCard) return res.status(404).json({ message: "Card not found" });

    res.json({ success: true, message: "Card deleted" });
  } catch (err) {
    console.error("Delete card error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* 
--------------------------------------------------------
💳 Save a new card (Stripe / Paystack / Flutterwave)
--------------------------------------------------------
*/
router.post("/cards/save", async (req, res) => {
  try {
    const {
      uid,
      gateway,
      cardId,
      details,
      stripeCustomerId,
      paymentMethodId,
      paystackAuthCode,
      flwCardToken,
      makeDefault,
    } = req.body;

    if (!uid || !gateway || !cardId || !details)
      return res.status(400).json({ message: "Missing parameters" });

    // Prevent duplicate cards by uid + last4 + gateway
    const existing = await SavedCard.findOne({
      uid,
      last4: details.last4,
      gateway,
    });

    if (existing) return res.status(200).json({ message: "Card already saved", card: existing });

    // Unset default cards if this is to be default
    if (makeDefault) {
      await SavedCard.updateMany({ uid }, { $set: { default: false } });
    } else {
      // Auto make default if user has no default saved (optional)
      const hasDefault = await SavedCard.exists({ uid, default: true });
      makeDefault = !hasDefault;
    }

    const newCard = await SavedCard.create({
      uid,
      gateway,
      cardId,
      brand: details.brand,
      last4: details.last4,
      exp_month: details.exp_month,
      exp_year: details.exp_year,
      stripeCustomerId: stripeCustomerId || null,
      paymentMethodId: paymentMethodId || null,
      paystackAuthCode: paystackAuthCode || null,
      flwCardToken: flwCardToken || null,
      default: makeDefault,
    });

    res.json({ success: true, card: newCard });
  } catch (err) {
    console.error("Save card error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;