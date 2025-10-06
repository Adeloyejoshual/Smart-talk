// /server/socket/callHandler.js
import { getAuth } from "firebase-admin/auth";
import User from "../models/User.js"; // your user model with wallet.balance
import { Server } from "socket.io";

// 💰 Billing rates
const CALL_RATE_PER_MIN = 0.05; // $0.05/minute
const DEDUCTION_INTERVAL = 10 * 1000; // every 10 seconds
const COST_PER_INTERVAL = CALL_RATE_PER_MIN / 6; // $0.0083 per 10 sec (0.05/6)
const MIN_BALANCE = 0.0033; // call cutoff point

// ✅ Initialize Socket.IO on server (usually in server.js)
export function setupCallSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No auth token"));

      // Verify Firebase token
      const decoded = await getAuth().verifyIdToken(token);
      socket.user = decoded;
      next();
    } catch (err) {
      console.error("Auth failed:", err);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`📞 ${socket.user.uid} connected`);

    socket.on("call:initiate", async ({ to, type }) => {
      const caller = socket.user.uid;
      console.log(`📲 ${caller} is calling ${to} (${type})`);

      // Find callee’s socket if connected
      const calleeSocket = [...io.sockets.sockets.values()].find(
        (s) => s.user?.uid === to
      );

      if (!calleeSocket) {
        socket.emit("call:end", { reason: "user_offline" });
        return;
      }

      // Notify callee
      calleeSocket.emit("call:incoming", { from: caller, type });

      // Save both participants in a room
      const roomId = [caller, to].sort().join("_");
      socket.join(roomId);
      calleeSocket.join(roomId);

      // Notify caller that callee connected
      socket.emit("call:connected");
      calleeSocket.emit("call:connected");

      // Start billing cycle
      startBillingLoop(io, roomId, caller, to);
    });

    socket.on("call:end", async ({ reason }) => {
      console.log(`📴 Call ended: ${socket.user.uid} (${reason})`);
      endCall(io, socket.user.uid, reason);
    });

    socket.on("disconnect", () => {
      console.log(`❌ Disconnected: ${socket.user.uid}`);
      endCall(io, socket.user.uid, "disconnect");
    });
  });
}

// --------------------
// 💰 Billing Logic
// --------------------
const activeCalls = new Map();

async function startBillingLoop(io, roomId, caller, callee) {
  console.log(`💵 Billing started for room ${roomId}`);
  if (activeCalls.has(roomId)) return;

  const interval = setInterval(async () => {
    const callerUser = await User.findOne({ uid: caller });
    const calleeUser = await User.findOne({ uid: callee });

    if (!callerUser || callerUser.wallet.balance < MIN_BALANCE) {
      console.log("❗ Low balance, ending call for", caller);
      io.to(roomId).emit("call:low_balance");
      return endCall(io, caller, "low_balance");
    }

    // Deduct from both users
    await Promise.all([
      User.updateOne(
        { uid: caller },
        { $inc: { "wallet.balance": -COST_PER_INTERVAL } }
      ),
      User.updateOne(
        { uid: callee },
        { $inc: { "wallet.balance": -COST_PER_INTERVAL } }
      ),
    ]);

    console.log(`💰 Deducted $${COST_PER_INTERVAL.toFixed(4)} per user in ${roomId}`);
  }, DEDUCTION_INTERVAL);

  activeCalls.set(roomId, interval);
}

function endCall(io, uid, reason = "ended") {
  const roomId = [...activeCalls.keys()].find((r) => r.includes(uid));
  if (!roomId) return;

  clearInterval(activeCalls.get(roomId));
  activeCalls.delete(roomId);

  io.to(roomId).emit("call:end", { reason });
  io.socketsLeave(roomId);
}