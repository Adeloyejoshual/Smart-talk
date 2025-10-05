// /src/controllers/paymentController.js
import Wallet from "../models/walletModel.js";
import convertToUSD from "../utils/currencyConverter.js";

/**
 * Add credit to user wallet in USD
 */
export const addCredit = async (req, res) => {
  try {
    const { userId, amount, currency } = req.body;

    // Convert amount to USD
    const usdAmount = await convertToUSD(amount, currency);

    // Update or create wallet record
    const wallet = await Wallet.findOneAndUpdate(
      { userId },
      {
        $inc: { balance: usdAmount },
        $set: { lastUpdated: new Date() }
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: `Added $${usdAmount} to wallet.`,
      balance: wallet.balance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add credit." });
  }
};

/**
 * Get user wallet balance
 */
export const getWallet = async (req, res) => {
  try {
    const { userId } = req.params;
    const wallet = await Wallet.findOne({ userId });
    if (!wallet)
      return res.status(404).json({ message: "Wallet not found" });

    res.status(200).json({
      balance: wallet.balance,
      currency: "USD"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching wallet" });
  }
};