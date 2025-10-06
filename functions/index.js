// ------------------------------
// 📦 Imports
// ------------------------------
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

initializeApp();
const db = getFirestore();

// ------------------------------
// ⚙️ Constants
// ------------------------------
const RATE_PER_SECOND = 0.0033; // USD per second
const MIN_BALANCE = 0.0033;     // End call threshold

// ------------------------------
// 🪙 Helper: deduct wallet safely
// ------------------------------
async function deductWallet(userId, amount) {
  const walletRef = db.collection("wallets").doc(userId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    if (!snap.exists) throw new Error("Wallet not found");

    const balance = snap.data().balance || 0;
    if (balance < amount) throw new Error("Insufficient funds");

    tx.update(walletRef, { balance: balance - amount });
    return balance - amount;
  });
}

// ------------------------------
// 🔥 Trigger: on new call start
// ------------------------------
export const startBillingOnCall = onDocumentCreated("calls/{callId}", async (event) => {
  const call = event.data.data();
  if (!call) return;

  const { callerId, calleeId, status } = call;
  if (status !== "active") return;

  console.log(`📞 Started billing for call: ${event.params.callId}`);

  const callRef = db.collection("calls").doc(event.params.callId);
  let stopped = false;

  const interval = setInterval(async () => {
    try {
      // Check call state each second
      const snap = await callRef.get();
      const data = snap.data();

      if (!data || data.status !== "active") {
        console.log("🛑 Call ended externally.");
        clearInterval(interval);
        stopped = true;
        return;
      }

      // Deduct balance
      const remaining = await deductWallet(callerId, RATE_PER_SECOND);

      await callRef.update({
        remainingBalance: remaining,
        lastBilledAt: new Date(),
      });

      if (remaining <= MIN_BALANCE) {
        console.log("💰 Low balance — ending call");
        await callRef.update({
          status: "ended",
          endedAt: new Date(),
          reason: "low_balance",
        });
        clearInterval(interval);
        stopped = true;
      }
    } catch (err) {
      console.error("Billing error:", err.message);
      if (!stopped) clearInterval(interval);
    }
  }, 1000);
});

// ------------------------------
// ☎️ Callable: manually end call
// ------------------------------
export const endCallManually = onCall(async (req) => {
  const { callId, userId } = req.data;
  if (!callId || !userId) throw new HttpsError("invalid-argument", "Missing callId or userId");

  const callRef = db.collection("calls").doc(callId);
  const snap = await callRef.get();

  if (!snap.exists) throw new HttpsError("not-found", "Call not found");

  const data = snap.data();
  if (data.status !== "active") return { message: "Already ended" };

  await callRef.update({
    status: "ended",
    endedAt: new Date(),
    reason: "user_ended",
  });

  console.log(`☎️ ${userId} manually ended call ${callId}`);
  return { message: "Call ended successfully" };
});