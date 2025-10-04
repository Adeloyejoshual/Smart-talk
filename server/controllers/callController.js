// server/controllers/callController.js
import { nanoid } from "nanoid";
import CallSession from "../models/CallSession.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";

/**
 * Pricing rate per second
 */
const RATE_PER_SECOND = Number(process.env.CALL_RATE_PER_SECOND || 0.0035);

/**
 * Start a call session
 * Protected: verifyFirebaseToken
 * Body: { participants: [uid], hostUid }  // hostUid is billed
 */
export async function startCall(req, res) {
  try {
    const { participants = [], hostUid } = req.body;
    if (!hostUid) return res.status(400).json({ message: "hostUid required" });

    const sessionId = nanoid(12);
    const doc = await CallSession.create({
      sessionId,
      hostUid,
      participants,
      startedAt: new Date()
    });

    return res.json({ success: true, sessionId: doc.sessionId, startedAt: doc.startedAt });
  } catch (err) {
    console.error("startCall err:", err);
    return res.status(500).json({ message: err.message });
  }
}

/**
 * End a call session
 * Protected: verifyFirebaseToken
 * Body: { sessionId }
 * Calculates duration and charges host's wallet
 */
export async function endCall(req, res) {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "sessionId required" });

    const session = await CallSession.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: "session not found" });
    if (session.endedAt) return res.status(400).json({ message: "already ended" });

    const endedAt = new Date();
    const started = session.startedAt || session.createdAt;
    const durationSec = Math.max(0, Math.ceil((endedAt - started) / 1000));
    const charge = Number((durationSec * RATE_PER_SECOND).toFixed(4)); // keep 4 decimals

    // Transaction: deduct from host
    const hostUid = session.hostUid;
    const mongoSession = await Wallet.startSession();
    mongoSession.startTransaction();
    try {
      const hostWallet = await Wallet.findOneAndUpdate({ uid: hostUid }, { $inc: { balance: -charge } }, { new: true, session: mongoSession });
      if (!hostWallet) throw new Error("host wallet not found or insufficient funds");
      // Optional: check negative balance not allowed
      if (hostWallet.balance < 0) {
        // rollback
        throw new Error("insufficient funds");
      }

      // update session doc
      session.endedAt = endedAt;
      session.durationSeconds = durationSec;
      session.billedAmount = charge;
      session.billed = true;
      await session.save({ session: mongoSession });

      await Transaction.create([{ uid: hostUid, type: "call_charge", amount: charge, currency: "USD", meta: { sessionId } }], { session: mongoSession });

      await mongoSession.commitTransaction();
      mongoSession.endSession();

      return res.json({ success: true, session: { sessionId, durationSec, charge }, wallet: hostWallet });
    } catch (err) {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
      throw err;
    }
  } catch (err) {
    console.error("endCall err:", err);
    return res.status(500).json({ message: err.message });
  }
}
