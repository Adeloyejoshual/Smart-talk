import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

/* get balance */
export async function getBalance(req, res) {
  try {
    const uid = req.params.uid;
    const w = await Wallet.findOne({ uid });
    res.json({ success: true, wallet: w || { balance: 0 } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/* add credit (server-side) */
export async function addCredit(req, res) {
  try {
    const { uid, amount } = req.body;
    if (!uid || typeof amount !== "number") return res.status(400).json({ message: "uid and amount required" });
    const wallet = await Wallet.findOneAndUpdate({ uid }, {
      $inc: { balance: amount },
      $setOnInsert: { createdAt: new Date(), expiresAt: new Date(Date.now() + (process.env.BONUS_EXPIRY_DAYS||90)*24*60*60*1000) }
    }, { new: true, upsert: true });
    await Transaction.create({ uid, type: 'add', amount, currency: 'USD' });
    res.json({ success: true, wallet });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/* send credit */
export async function sendCredit(req, res) {
  try {
    const { fromUid, toUid, amount } = req.body;
    if (!fromUid || !toUid || !amount) return res.status(400).json({ message: "missing fields" });
    if (fromUid === toUid) return res.status(400).json({ message: "cannot send to yourself" });

    const session = await Wallet.startSession();
    session.startTransaction();
    try {
      const from = await Wallet.findOneAndUpdate({ uid: fromUid }, { $inc: { balance: -amount } }, { new: true, session });
      if (!from || from.balance < 0) throw new Error("insufficient funds");
      const to = await Wallet.findOneAndUpdate({ uid: toUid }, { $inc: { balance: amount }, $setOnInsert: { createdAt: new Date(), expiresAt: new Date(Date.now() + (process.env.BONUS_EXPIRY_DAYS||90)*24*60*60*1000) } }, { new: true, upsert: true, session });
      await Transaction.create([{ uid: fromUid, type: 'send', amount, currency: 'USD', meta: { to: toUid } }, { uid: toUid, type: 'receive', amount, currency: 'USD', meta: { from: fromUid } }], { session });
      await session.commitTransaction();
      session.endSession();
      res.json({ success: true, from, to });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
