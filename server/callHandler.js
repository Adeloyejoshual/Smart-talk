// /server/callHandler.js
import { db } from "./firebaseAdmin.js"; // Firestore Admin SDK instance
import { Server } from "socket.io";

export default function registerCallHandlers(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  const CALL_TIMEOUT_MS = 30 * 1000; // 30 seconds auto-decline

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // 💬 When a user initiates a call
    socket.on("call:initiate", async ({ fromUserId, toUserId, type }) => {
      const callId = db.collection("calls").doc().id;
      const callData = {
        id: callId,
        fromUserId,
        toUserId,
        type,
        status: "ringing",
        createdAt: Date.now(),
      };

      // Save to Firestore
      await db.collection("calls").doc(callId).set(callData);

      // Notify the callee
      io.to(toUserId).emit("call:incoming", callData);

      // Set up auto-timeout (if no answer in 30s)
      setTimeout(async () => {
        const snap = await db.collection("calls").doc(callId).get();
        const current = snap.data();
        if (current.status === "ringing") {
          await db.collection("calls").doc(callId).update({
            status: "missed",
            endedAt: Date.now(),
          });
          io.to(fromUserId).emit("call:missed", { callId });
          io.to(toUserId).emit("call:missed", { callId });
        }
      }, CALL_TIMEOUT_MS);
    });

    // ✅ Call accepted
    socket.on("call:accept", async ({ callId }) => {
      await db.collection("calls").doc(callId).update({
        status: "active",
        startedAt: Date.now(),
      });
      const call = (await db.collection("calls").doc(callId).get()).data();
      io.to(call.fromUserId).emit("call:connected", { callId });
      io.to(call.toUserId).emit("call:connected", { callId });
    });

    // ⛔ Call ended manually or by system
    socket.on("call:end", async ({ callId, reason }) => {
      const callRef = db.collection("calls").doc(callId);
      const snap = await callRef.get();
      const call = snap.data();
      if (!call) return;

      const duration =
        call.startedAt && call.status === "active"
          ? Math.floor((Date.now() - call.startedAt) / 1000)
          : 0;

      await callRef.update({
        status: "ended",
        reason,
        duration,
        endedAt: Date.now(),
      });

      // Billing: deduct from caller if call was active
      if (duration > 0) {
        const ratePerSecond = 0.0033 / 60; // ~0.0033 USD per minute
        const totalCost = duration * ratePerSecond;
        await deductBalance(call.fromUserId, totalCost);
      }

      io.to(call.fromUserId).emit("call:end", { callId, reason });
      io.to(call.toUserId).emit("call:end", { callId, reason });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
}

// 🔧 Helper: deduct wallet safely
async function deductBalance(userId, amount) {
  const userRef = db.collection("users").doc(userId);
  await db.runTransaction(async (t) => {
    const userSnap = await t.get(userRef);
    if (!userSnap.exists) return;

    const currentBalance = userSnap.data().wallet || 0;
    const newBalance = Math.max(0, currentBalance - amount);

    await t.update(userRef, { wallet: newBalance });
  });
}