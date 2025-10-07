// /server/server.js
import "dotenv/config";
import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import fs from "fs";
import admin from "firebase-admin";
import walletRoutes from "./routes/walletRoutes.js";
import Wallet from "./models/walletModel.js";
import Transaction from "./models/transactionModel.js";
import CallRecordModel from "./models/callRecordModel.js"; // we will create below
import { v4 as uuidv4 } from "uuid";

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const FIREBASE_KEY_PATH = process.env.FIREBASE_ADMIN_KEY_PATH; // recommended to provide secret file path
const CALL_RATE_PER_SECOND = parseFloat(process.env.CALL_RATE_PER_SECOND || "0.0033");
const MIN_START_BALANCE = parseFloat(process.env.MIN_START_BALANCE || "0.5");

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

// init firebase admin
try {
  let serviceAccount;
  if (FIREBASE_KEY_PATH && fs.existsSync(FIREBASE_KEY_PATH)) {
    serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_KEY_PATH, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin inited from key file", FIREBASE_KEY_PATH);
  } else if (process.env.FIREBASE_PRIVATE_KEY) {
    // alternative: use direct env vars (private key with \n)
    const svc = {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
    admin.initializeApp({
      credential: admin.credential.cert(svc),
    });
    console.log("Firebase Admin inited from env vars");
  } else {
    throw new Error("No firebase admin credentials provided");
  }
} catch (err) {
  console.error("Failed to initialize Firebase Admin:", err);
  process.exit(1);
}

// connect mongo
await mongoose.connect(MONGODB_URI);
console.log("MongoDB connected");

// express + socket
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json());

// wallet routes
app.use("/api/wallet", walletRoutes);

// simple health
app.get("/", (req, res) => res.send("✅ SmartTalk API is running"));

// ----- call model (simple) -----
/* create file /server/models/callRecordModel.js with the schema (provided further down) */
import CallRecord from "./models/callRecordModel.js";

/**
 * chargeCallerAtomic(uid, amount)
 * Uses Mongo transaction to atomically deduct and write transaction.
 */
async function chargeCallerAtomic(uid, amount) {
  if (amount <= 0) return { before: null, after: null };
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const wallet = await Wallet.findOne({ uid }).session(session);
    if (!wallet) throw new Error("Wallet not found");
    const before = Number(wallet.balance || 0);
    if (before < amount) throw new Error("Insufficient funds");
    const after = Number((before - amount).toFixed(6));
    wallet.balance = after;
    await wallet.save({ session });
    await Transaction.create(
      [{ userId: uid, type: "debit", amount, reason: "Call per-second charge", createdAt: new Date() }],
      { session }
    );
    await session.commitTransaction();
    session.endSession();
    return { before, after };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
}

// ---------- in-memory sessions ----------
const sessions = new Map();

// socket.io for call lifecycle & billing
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on("auth", async ({ idToken }) => {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      socket.uid = decoded.uid;
      socket.join(socket.uid);
      socket.emit("auth:ok", { uid: socket.uid });
    } catch (err) {
      socket.emit("error", { code: "AUTH_FAILED", message: err.message });
    }
  });

  socket.on("call:initiate", async ({ calleeUid, type = "video", idToken }) => {
    try {
      // verify caller from token (fallback if socket not authed)
      let callerUid = socket.uid;
      if (!callerUid) {
        const decoded = await admin.auth().verifyIdToken(idToken);
        callerUid = decoded.uid;
      }
      // check balance
      const w = await Wallet.findOne({ uid: callerUid });
      if (!w || w.balance < MIN_START_BALANCE) {
        return socket.emit("call:failed", { code: "INSUFFICIENT_FUNDS" });
      }
      // create record & session
      const callId = uuidv4();
      const call = await CallRecord.create({
        callId,
        callerId: callerUid,
        calleeId: calleeUid,
        callerName: socket.uid || callerUid,
        calleeName: calleeUid,
        type,
        status: "ongoing",
        createdAt: new Date(),
      });
      sessions.set(callId, { callId, callerUid, calleeUid, seconds: 0, chargedSoFar: 0, intervalId: null });
      io.to(callerUid).emit("server:call-created", { callId, call });
      io.to(calleeUid).emit("server:incoming-call", { callId, call });
      socket.emit("call:ok", { callId, call });
    } catch (err) {
      console.error("call:initiate error", err);
      socket.emit("call:failed", { message: err.message });
    }
  });

  socket.on("call:join", ({ callId }) => {
    if (!callId) return;
    socket.join(callId);
  });

  // billing:start — only caller can trigger
  socket.on("billing:start", async ({ callId }) => {
    const session = sessions.get(callId);
    if (!session) return socket.emit("error", { code: "NO_SESSION" });
    if (socket.uid !== session.callerUid) return socket.emit("error", { code: "NOT_CALLER" });
    if (session.intervalId) return socket.emit("billing:started", { callId });

    session.intervalId = setInterval(async () => {
      try {
        await chargeCallerAtomic(session.callerUid, CALL_RATE_PER_SECOND);
        session.seconds += 1;
        session.chargedSoFar = Number((session.chargedSoFar + CALL_RATE_PER_SECOND).toFixed(6));

        // persist every 10s to the DB
        if (session.seconds % 10 === 0) {
          await CallRecord.findOneAndUpdate({ callId }, { duration: session.seconds, cost: session.chargedSoFar });
        }

        io.to(callId).emit("billing:update", { callId, seconds: session.seconds, charged: session.chargedSoFar });
      } catch (err) {
        // stop call if insufficient funds
        clearInterval(session.intervalId);
        sessions.delete(callId);
        try {
          await CallRecord.findOneAndUpdate({ callId }, { status: "ended", duration: session.seconds, cost: session.chargedSoFar, endedAt: new Date() });
        } catch (e) {
          console.error("finalize error", e);
        }
        io.to(callId).emit("call:force-end", { reason: "INSUFFICIENT_FUNDS" });
      }
    }, 1000);

    sessions.set(callId, session);
    socket.emit("billing:started", { callId });
  });

  // stop billing
  socket.on("billing:stop", async ({ callId, endedBy }) => {
    const session = sessions.get(callId);
    if (session?.intervalId) clearInterval(session.intervalId);
    sessions.delete(callId);
    const duration = session?.seconds || 0;
    const cost = session?.chargedSoFar || 0;
    await CallRecord.findOneAndUpdate({ callId }, { status: "ended", duration, cost, endedAt: new Date() }, { upsert: true });
    io.to(callId).emit("call:ended", { callId, endedBy, duration, cost });
  });

  socket.on("disconnect", () => {
    // optionally tidy up
  });
});

server.listen(PORT, () => {
  console.log("Server listening on", PORT);
});