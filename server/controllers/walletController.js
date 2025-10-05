// controllers/walletController.js
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import mongoose from "mongoose";

/**
 * GET /api/wallet/:uid
 * returns wallet document (creates default if not exists)
 */
export async function getWallet(req, res) {
  try {
    const { uid } = req.params;
    if (!uid) return res.status(400).json({ message: "uid required" });

    let wallet = await Wallet.findOne({ uid });
    if (!wallet) {
      wallet = await Wallet.create({ uid }); // default bonus applied by schema
      await Transaction.create({ uid, type: "bonus", amount: wallet.balance, meta: { note: "New user bonus" } });
    }

    return res.json({ wallet });
  } catch (err) {
    console.error("getWallet error:", err);
    return res.status(500).json({ message: err.message });
  }
}

/**
 * POST /api/wallet/send
 * body: { fromUid, toUid, amount }
 * Transactional transfer (atomic)
 */
export async function sendCredit(req, res) {
  const { fromUid, toUid, amount } = req.body;
  if (!fromUid || !toUid || typeof amount !== "number") {
    return res.status(400).json({ message: "fromUid, toUid, amount required (amount numeric)" });
  }
  if (fromUid === toUid) return res.status(400).json({ message: "cannot send to yourself" });
  if (amount <= 0) return res.status(400).json({ message: "amount must be positive" });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // decrement sender
    const fromWallet = await Wallet.findOneAndUpdate(
      { uid: fromUid },
      { $inc: { balance: -amount } },
      { new: true, session }
    );

    if (!fromWallet) throw new Error("sender wallet not found");
    if (fromWallet.balance < 0) throw new Error("insufficient funds");

    // increment receiver (create if missing)
    const toWallet = await Wallet.findOneAndUpdate(
      { uid: toUid },
      { $inc: { balance: amount } },
      { upsert: true, new: true, session }
    );

    // save transactions
    await Transaction.create(
      [
        { uid: fromUid, type: "send", amount: -amount, meta: { to: toUid } },
        { uid: toUid, type: "receive", amount: amount, meta: { from: fromUid } }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({ success: true, from: fromWallet, to: toWallet });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("sendCredit error:", err);
    return res.status(500).json({ message: err.message || "transfer failed" });
  }
}