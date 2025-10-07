import CallBilling from "../models/CallBilling.js";
import User from "../models/User.js";
import { calculateCost } from "../utils/calculateBilling.js";

export const endCall = async (req, res) => {
  try {
    const { callerId, calleeId, duration } = req.body;

    const totalCost = calculateCost(duration);
    const caller = await User.findOne({ uid: callerId });

    if (!caller || caller.balance < totalCost) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    caller.balance -= totalCost;
    await caller.save();

    const record = await CallBilling.create({
      callerId,
      calleeId,
      duration,
      totalCost,
    });

    res.json({ success: true, record, newBalance: caller.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};