import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import admin from "firebase-admin";
import cors from "cors";
import bodyParser from "body-parser";
import { v4 as uuidv4 } from "uuid";

const PORT = process.env.PORT || 4000;
const COST_PER_SECOND = parseFloat(process.env.COST_PER_SECOND || "0.0035");
const MIN_START_BALANCE = parseFloat(process.env.MIN_START_BALANCE || "0.5");

try {
  admin.initializeApp(); // expects GOOGLE_APPLICATION_CREDENTIALS env var set
} catch (err) {
  console.error("Firebase admin initialization error:", err);
  process.exit(1);
}
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: "*" } });

const sessions = new Map();

async function verifyIdToken(idToken) {
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    throw new Error("Invalid auth token");
  }
}

async function chargeCallerAtomic(uid, amount) {
  const walletRef = db.collection("wallet").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    if (!snap.exists) throw new Error("Wallet not found");
    const balance = Number(snap.data().balance || 0);
    if (balance < amount) throw new Error("Insufficient funds");
    const newBal = Number((balance - amount).toFixed(6));
    tx.update(walletRef, { balance: newBal });
    const txRef = walletRef.collection("transactions").doc();
    tx.set(txRef, {
      type: "debit",
      amount,
      reason: "Call per-second charge",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      meta: {},
    });
    return { before: balance, after: newBal };
  });
}

// POST /calls/start - create call doc, verify balance, emit to sockets
app.post("/calls/start", async (req, res) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : req.body.idToken;
    if (!token) return res.status(401).json({ error: "Missing id token" });

    const decoded = await verifyIdToken(token);
    const callerUid = decoded.uid;
    const { calleeUid, calleeName = "", type = "video" } = req.body;

    if (!calleeUid) return res.status(400).json({ error: "Missing calleeUid" });

    const walletSnap = await db.collection("wallet").doc(callerUid).get();
    const balance = walletSnap.exists ? Number(walletSnap.data().balance || 0) : 0;

    if (balance < MIN_START_BALANCE)
      return res.status(402).json({ error: "INSUFFICIENT_FUNDS", message: `Need at least $${MIN_START_BALANCE}` });

    const callId = uuidv4();
    const callRef = db.collection("calls").doc(callId);

    const callDoc = {
      callerId: callerUid,
      callerName: decoded.name || decoded.email || callerUid,
      calleeId: calleeUid,
      calleeName,
      type,
      status: "ongoing",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      duration: 0,
      cost: 0
    };
    await callRef.set(callDoc, { merge: true });

    io.to(callerUid).emit("server:call-created", { callId, call: callDoc });
    io.to(calleeUid).emit("server:incoming-call", { callId, call: callDoc });

    sessions.set(callId, {
      callerUid,
      calleeUid,
      seconds: 0,
      chargedSoFar: 0,
      intervalId: null
    });

    res.json({ success: true, callId, call: callDoc });
  } catch (err) {
    console.error("/calls/start error:", err);
    res.status(500).json({ error: "server_error", message: err.message });
  }
});

// POST /calls/end - end call, clear billing interval, finalize call doc, emit ended
app.post("/calls/end", async (req, res) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : req.body.idToken;
    if (!token) return res.status(401).json({ error: "Missing id token" });

    const decoded = await verifyIdToken(token);
    const requesterUid = decoded.uid;
    const { callId } = req.body;

    if (!callId) return res.status(400).json({ error: "Missing callId" });

    const session = sessions.get(callId);
    if (session?.intervalId) clearInterval(session.intervalId);
    sessions.delete(callId);

    const callRef = db.collection("calls").doc(callId);
    const snap = await callRef.get();
    const callData = snap.exists ? snap.data() : null;
    const duration = session?.seconds || callData?.duration || 0;
    const cost = session?.chargedSoFar || callData?.cost || 0;

    await callRef.update({
      status: "ended",
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      duration,
      cost,
    });

    io.to(callId).emit("call:ended", { callId, endedBy: requesterUid, duration, cost });
    if (session) {
      io.to(session.callerUid).emit("call:ended", { callId, endedBy: requesterUid, duration, cost });
      io.to(session.calleeUid).emit("call:ended", { callId, endedBy: requesterUid, duration, cost });
    }

    res.json({ success: true, callId, duration, cost });
  } catch (err) {
    console.error("/calls/end error:", err);
    res.status(500).json({ error: "server_error", message: err.message });
  }
});

// Socket handlers
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("auth", async (data) => {
    try {
      const token = data?.idToken;
      if (!token) return;
      const decoded = await verifyIdToken(token);
      socket.uid = decoded.uid;
      socket.join(socket.uid);
      console.log("socket authenticated for uid:", socket.uid);
    } catch (err) {
      console.warn("socket auth failed:", err.message);
      socket.emit("error", { code: "AUTH_FAILED" });
    }
  });

  socket.on("call:join", ({ callId }) => {
    if (!callId) return;
    socket.join(callId);
  });

  socket.on("billing:start", async ({ callId }) => {
    try {
      const session = sessions.get(callId);
      if (!session) return socket.emit("error", { code: "NO_SESSION" });
      if (socket.uid !== session.callerUid) return socket.emit("error", { code: "NOT_CALLER" });

      if (session.intervalId) return socket.emit("billing:started", { callId });

      session.intervalId = setInterval(async () => {
        try {
          await chargeCallerAtomic(session.callerUid, COST_PER_SECOND);
          session.seconds += 1;
          session.chargedSoFar = Number((session.chargedSoFar + COST_PER_SECOND).toFixed(6));
          io.to(callId).emit("billing:update", {
            callId,
            seconds: session.seconds,
            charged: session.chargedSoFar,
          });
        } catch (err) {
          console.warn("billing tick failed:", err.message);
          clearInterval(session.intervalId);
          sessions.delete(callId);

          try {
            const callRef = db.collection("calls").doc(callId);
            const callSnap = await callRef.get();
            const callData = callSnap.exists ? callSnap.data() : {};
            const duration = session.seconds || callData.duration || 0;
            const cost = session.chargedSoFar || callData.cost || 0;
            await callRef.update({
              status: "ended",
              endedAt: admin.firestore.FieldValue.serverTimestamp(),
              duration,
              cost,
            });
          } catch (e2) {
            console.error("finalize call doc failed:", e2.message);
          }

          io.to(callId).emit("call:force-end", { reason: "INSUFFICIENT_FUNDS" });
        }
      }, 1000);

      sessions.set(callId, session);
      socket.emit("billing:started", { callId });
    } catch (err) {
      console.error("billing:start error:", err);
      socket.emit("error", { code: "BILLING_START_ERROR", message: err.message });
    }
  });

  socket.on("billing:stop", async ({ callId, endedBy }) => {
    try {
      const session = sessions.get(callId);
      if (session?.intervalId) clearInterval(session.intervalId);
      sessions.delete(callId);

      const callRef = db.collection("calls").doc(callId);
      const callSnap = await callRef.get();
      const callData = callSnap.exists ? callSnap.data() : {};
      const duration = session?.seconds || callData.duration || 0;
      const cost = session?.chargedSoFar || callData.cost || 0;

      await callRef.update({
        status: "ended",
        endedAt: admin.firestore.FieldValue.serverTimestamp(),
        duration,
        cost,
      });

      io.to(callId).emit("call:ended", { callId, endedBy, duration, cost });
    } catch (err) {
      console.error("billing:stop error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => console.log(`Billing server listening on ${PORT}`));