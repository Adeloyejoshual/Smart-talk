// /server/routes/callRoutes.js
import express from "express";
import { v4 as uuidv4 } from "uuid";
import admin from "firebase-admin";

const db = admin.firestore();
const router = express.Router();

// Configuration constants
const START_MIN_BALANCE = 0.5;
const STOP_THRESHOLD = 0.0033;
const RATE_PER_SECOND = 0.001; // $0.001 per second

// --- Helper ---
async function getWallet(uid) {
  const wDoc = db.collection("wallets").doc(uid);
  const snap = await wDoc.get();
  if (!snap.exists) return { balanceUsd: 0 };
  return snap.data();
}

async function updateWallet(uid, delta) {
  const wDoc = db.collection("wallets").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(wDoc);
    const bal = snap.exists ? Number(snap.data().balanceUsd || 0) : 0;
    const newBal = Math.max(0, bal + delta);
    tx.set(wDoc, { balanceUsd: newBal }, { merge: true });
  });
}

// --- POST /api/call/start ---
router.post("/start", async (req, res) => {
  try {
    const { calleeUid, type = "audio" } = req.body;
    const user = req.user; // from auth middleware (decoded Firebase token)
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const callerUid = user.uid;
    const wallet = await getWallet(callerUid);
    if (wallet.balanceUsd < START_MIN_BALANCE) {
      return res.status(402).json({ error: "Insufficient funds to start call." });
    }

    const callId = uuidv4();

    // Create call doc
    await db.collection("calls").doc(callId).set({
      caller: callerUid,
      callee: calleeUid,
      type,
      status: "ringing",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ratePerSecond: RATE_PER_SECOND,
      chargedTotal: 0,
    });

    // 🔹 Create inbox pointer for callee
    await db
      .collection("users")
      .doc(calleeUid)
      .collection("inbox")
      .doc("call")
      .set({
        callId,
        caller: callerUid,
        type,
        status: "ringing",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.json({ callId, ratePerSecond: RATE_PER_SECOND });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

// --- POST /api/call/accept ---
router.post("/accept", async (req, res) => {
  try {
    const { callId } = req.body;
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const callRef = db.collection("calls").doc(callId);
    const callSnap = await callRef.get();
    if (!callSnap.exists) return res.status(404).json({ error: "Call not found" });

    await callRef.update({
      status: "in_progress",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Optional: remove callee inbox pointer
    await db.collection("users").doc(user.uid).collection("inbox").doc("call").delete().catch(() => {});

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

// --- POST /api/call/heartbeat ---
router.post("/heartbeat", async (req, res) => {
  try {
    const { callId, seconds = 1 } = req.body;
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const callRef = db.collection("calls").doc(callId);
    const callSnap = await callRef.get();
    if (!callSnap.exists) return res.status(404).json({ error: "Call not found" });

    const call = callSnap.data();
    if (call.status !== "in_progress") {
      return res.status(400).json({ error: "Call not active" });
    }

    const cost = RATE_PER_SECOND * seconds;
    const walletSnap = await db.collection("wallets").doc(call.caller).get();
    const balance = walletSnap.exists ? walletSnap.data().balanceUsd : 0;

    if (balance <= STOP_THRESHOLD) {
      // End call
      await callRef.update({
        status: "ended",
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(402).json({ error: "Insufficient funds. Call ended." });
    }

    // Deduct charge
    await updateWallet(call.caller, -cost);
    await callRef.update({
      chargedTotal: admin.firestore.FieldValue.increment(cost),
      lastChargeAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const newBalance = balance - cost;
    res.json({ ok: true, charged: cost, chargedTotal: call.chargedTotal + cost, balance: newBalance });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

// --- POST /api/call/end ---
router.post("/end", async (req, res) => {
  try {
    const { callId } = req.body;
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const callRef = db.collection("calls").doc(callId);
    await callRef.update({
      status: "ended",
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;