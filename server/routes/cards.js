import express from "express";
import SavedCard from "../models/SavedCard.js";

const router = express.Router();

// 🟢 Get all cards for user
router.get("/cards/:uid", async (req, res) => {
  const cards = await SavedCard.find({ uid: req.params.uid });
  res.json({ cards });
});

// 🟢 Set default card
router.post("/cards/set-default", async (req, res) => {
  const { uid, cardId } = req.body;
  if (!uid || !cardId) return res.status(400).json({ message: "Missing parameters" });

  await SavedCard.updateMany({ uid }, { default: false });
  await SavedCard.findByIdAndUpdate(cardId, { default: true });

  res.json({ success: true });
});

export default router;