import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

export const getBalance = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const creditWallet = async (req, res) => {
  try {
    const { uid, amount } = req.body;
    const user = await User.findOneAndUpdate(
      { uid },
      { $inc: { balance: amount } },
      { new: true, upsert: true }
    );
    await Transaction.create({ userId: uid, type: "credit", amount, reason: "Top-up" });
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const debitWallet = async (req, res) => {
  try {
    const { uid, amount, reason } = req.body;
    const user = await User.findOne({ uid });
    if (!user || user.balance < amount)
      return res.status(400).json({ message: "Insufficient balance" });

    user.balance -= amount;
    await user.save();
    await Transaction.create({ userId: uid, type: "debit", amount, reason });
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};