// /server/callBilling.js
import { Server } from "socket.io";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

// 💵 Billing constants
const RATE_PER_SECOND = 0.0033; // $0.0033 per second
const MIN_BALANCE_TO_START = 0.5; // $0.50 required to start

export function createCallServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  // Track all active calls
  const activeCalls = new Map();

  io.on("connection", (socket) => {
    console.log("📞 New connection:", socket.id);

    // ───────────────────────────────
    // ▶️ Caller initiates a call
    // ───────────────────────────────
    socket.on("call:initiate", async ({ callerId, calleeId, callType }) => {
      try {
        const callerRef = db.collection("users").doc(callerId);
        const callerSnap = await callerRef.get();

        if (!callerSnap.exists) {
          socket.emit("call:error", "Caller not found");
          return;
        }

        const balance = callerSnap.data().walletBalance || 0;
        if (balance < MIN_BALANCE_TO_START) {
          socket.emit("call:error", "Insufficient balance to start a call");
          return;
        }

        // Register call session
        const callSession = {
          callerId,
          calleeId,
          callType,
          startTime: Date.now(),
          billingTimer: null,
        };
        activeCalls.set(socket.id, callSession);

        console.log(`📲 ${callerId} calling ${calleeId} (${callType})`);

        // Notify both users
        socket.emit("call:connected", { calleeId, callType });
        io.emit("call:ringing", { callerId, calleeId, callType });

        // 🧮 Start billing every second (caller only)
        callSession.billingTimer = setInterval(async () => {
          const callerDoc = db.collection("users").doc(callerId);
          const snap = await callerDoc.get();
          const currentBalance = snap.data()?.walletBalance ?? 0;

          // Stop call if balance too low
          if (currentBalance <= RATE_PER_SECOND) {
            clearInterval(callSession.billingTimer);
            activeCalls.delete(socket.id);
            io.to(socket.id).emit("call:end", { reason: "Low balance" });
            console.log(`💸 Call ended (low balance): ${callerId}`);
            return;
          }

          // Deduct rate
          await callerDoc.update({
            walletBalance: Math.max(currentBalance - RATE_PER_SECOND, 0),
          });
        }, 1000);
      } catch (err) {
        console.error("call:initiate error:", err);
        socket.emit("call:error", "Unable to start call");
      }
    });

    // ───────────────────────────────
    // ⏹️ Call manually ended
    // ───────────────────────────────
    socket.on("call:end", ({ reason }) => {
      const session = activeCalls.get(socket.id);
      if (session) {
        clearInterval(session.billingTimer);
        activeCalls.delete(socket.id);
        io.to(socket.id).emit("call:end", { reason: reason || "user_hangup" });
        console.log(`📴 Call manually ended by ${session.callerId}`);
      }
    });

    // ───────────────────────────────
    // 📴 Disconnect cleanup
    // ───────────────────────────────
    socket.on("disconnect", () => {
      const session = activeCalls.get(socket.id);
      if (session) {
        clearInterval(session.billingTimer);
        activeCalls.delete(socket.id);
        io.emit("call:end", { reason: "disconnect" });
        console.log(`❌ Disconnected: ${session.callerId}`);
      }
    });
  });

  console.log("📡 Call billing server running...");
  return io;
}