// /functions/index.js

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

initializeApp();
const db = getFirestore();

/**
 * Called when user initiates a voice/video call
 * Deducts balance periodically and auto-ends if insufficient
 */
export const startCallBilling = onCall(async (req) => {
  const { callerId, calleeId, callId, callType } = req.data;

  if (!callerId || !calleeId || !callId)
    throw new HttpsError("invalid-argument", "Missing parameters");

  const callerRef = db.collection("wallets").doc(callerId);
  const calleeRef = db.collection("wallets").doc(calleeId);
  const callRef = db.collection("calls").doc(callId);

  const callerSnap = await callerRef.get();
  const callerData = callerSnap.data() || { balance: 0 };

  if (callerData.balance < 0.5) {
    throw new HttpsError("failed-precondition", "Insufficient balance to start call");
  }

  // Create call doc
  await callRef.set({
    callerId,
    calleeId,
    callType, // "voice" | "video"
    startTime: new Date(),
    active: true,
    durationSec: 0,
    lastDeductedAt: new Date(),
  });

  // Schedule background deduction loop (simulated interval)
  deductLoop(callId, callerId).catch(console.error);

  return { success: true, message: "Call started and billing initialized" };
});

/**
 * Deduct $0.0033 every second until call ends or balance too low
 */
async function deductLoop(callId, callerId) {
  const RATE_PER_SEC = 0.0033;
  const INTERVAL_MS = 1000;

  while (true) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS));

    const callRef = db.collection("calls").doc(callId);
    const walletRef = db.collection("wallets").doc(callerId);

    const [callSnap, walletSnap] = await Promise.all([callRef.get(), walletRef.get()]);
    const call = callSnap.data();
    const wallet = walletSnap.data();

    if (!call?.active) break;

    if (!wallet || wallet.balance < RATE_PER_SEC) {
      await callRef.update({
        active: false,
        endedReason: "Insufficient balance",
        endTime: new Date(),
      });
      break;
    }

    // Deduct and log
    const newBalance = wallet.balance - RATE_PER_SEC;
    await walletRef.update({ balance: newBalance });
    await db.collection("billing_logs").add({
      userId: callerId,
      callId,
      amount: RATE_PER_SEC,
      newBalance,
      timestamp: new Date(),
      type: "call_deduction",
    });

    // Update duration
    await callRef.update({
      durationSec: (call.durationSec || 0) + 1,
      lastDeductedAt: new Date(),
    });
  }
}

/**
 * Called when call ends manually
 */
export const endCallBilling = onCall(async (req) => {
  const { callId } = req.data;
  if (!callId) throw new HttpsError("invalid-argument", "Missing callId");

  const callRef = db.collection("calls").doc(callId);
  const callSnap = await callRef.get();
  if (!callSnap.exists) throw new HttpsError("not-found", "Call not found");

  await callRef.update({
    active: false,
    endTime: new Date(),
    endedReason: "User ended",
  });

  return { success: true, message: "Call ended successfully" };
});