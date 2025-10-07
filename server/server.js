/**
 * server.js
 *
 * Single-file server implementing:
 *  - Express REST API: /api/wallet, /api/calls
 *  - Socket.IO for realtime call lifecycle + per-second billing
 *  - Mongoose models (User, Transaction, CallRecord) (embedded below)
 *  - Firebase Admin token verification
 *
 * Usage: node server.js
 *
 * Env variables (put in server/.env):
 *  - PORT=4000
 *  - MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/appdb
 *  - FIREBASE_ADMIN_KEY_PATH=./firebase-admin-key.json
 *  - CALL_RATE_PER_SECOND=0.0033
 *  - MIN_START_BALANCE=0.5
 */

import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import fs from 'fs';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// ---------- Config ----------
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const FIREBASE_KEY_PATH = process.env.FIREBASE_ADMIN_KEY_PATH;
const CALL_RATE_PER_SECOND = parseFloat(process.env.CALL_RATE_PER_SECOND || '0.0033');
const MIN_START_BALANCE = parseFloat(process.env.MIN_START_BALANCE || '0.5');

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}
if (!FIREBASE_KEY_PATH || !fs.existsSync(FIREBASE_KEY_PATH)) {
  console.error('Missing or invalid FIREBASE_ADMIN_KEY_PATH in .env');
  process.exit(1);
}

// ---------- Firebase Admin ----------
try {
  const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_KEY_PATH, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✅ Firebase Admin initialized');
} catch (err) {
  console.error('Failed to initialize Firebase Admin:', err);
  process.exit(1);
}

// ---------- MongoDB (Mongoose) ----------
mongoose.set('strictQuery', true);
await mongoose.connect(MONGODB_URI, {});

console.log('🟢 MongoDB connected');

// ---------- Define Mongoose Schemas / Models ----------

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  name: String,
  email: String,
  balance: { type: Number, default: 0 }, // USD
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // uid
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  reason: String,
  meta: Object,
  createdAt: { type: Date, default: Date.now },
});
const Transaction = mongoose.model('Transaction', transactionSchema);

const callRecordSchema = new mongoose.Schema({
  callId: { type: String, required: true, unique: true },
  callerId: String,
  calleeId: String,
  callerName: String,
  calleeName: String,
  type: { type: String, enum: ['voice', 'video'], default: 'video' },
  status: { type: String, enum: ['ongoing', 'ended', 'missed', 'declined'], default: 'ongoing' },
  duration: { type: Number, default: 0 }, // seconds
  cost: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  endedAt: Date,
});
const CallRecord = mongoose.model('CallRecord', callRecordSchema);

// ---------- Helper: Firebase token verify ----------
async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Missing id token');
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded; // contains uid, email, name, etc.
  } catch (err) {
    const e = new Error('Invalid auth token');
    e.original = err;
    throw e;
  }
}

// ---------- Helper: atomic charge via MongoDB transaction ----------
async function chargeCallerAtomic(uid, amount) {
  /**
   * Atomically deduct `amount` from user's balance and record a Transaction.
   * Throws when insufficient funds or user not found.
   */
  if (amount <= 0) return { before: null, after: null };
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const user = await User.findOne({ uid }).session(session);
    if (!user) {
      throw new Error('Wallet / user not found');
    }
    const before = Number(user.balance || 0);
    if (before < amount) {
      throw new Error('Insufficient funds');
    }
    const after = Number((before - amount).toFixed(6));
    user.balance = after;
    await user.save({ session });

    await Transaction.create(
      [
        {
          userId: uid,
          type: 'debit',
          amount,
          reason: 'Call per-second charge',
          createdAt: new Date(),
        },
      ],
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

// ---------- In-memory session store for active calls ----------
/**
 * sessions: Map<callId, {
 *   callId,
 *   callerUid,
 *   calleeUid,
 *   seconds,
 *   chargedSoFar,
 *   intervalId
 * }>
 */
const sessions = new Map();

// ---------- Express + Socket.IO Setup ----------
const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: {
    origin: '*', // adjust for production
    methods: ['GET', 'POST'],
  },
});

// ---------- REST API: Wallet endpoints ----------
app.get('/api/wallet/balance/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ balance: Number(user.balance || 0) });
  } catch (err) {
    console.error('/api/wallet/balance error', err);
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/wallet/credit', async (req, res) => {
  try {
    const { uid, amount, reason = 'Top-up', meta = {} } = req.body;
    if (!uid || !amount) return res.status(400).json({ message: 'Missing uid or amount' });

    const user = await User.findOneAndUpdate(
      { uid },
      { $inc: { balance: Number(amount) } },
      { upsert: true, new: true }
    );

    await Transaction.create({
      userId: uid,
      type: 'credit',
      amount: Number(amount),
      reason,
      meta,
      createdAt: new Date(),
    });

    return res.json({ balance: Number(user.balance || 0) });
  } catch (err) {
    console.error('/api/wallet/credit error', err);
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/wallet/debit', async (req, res) => {
  try {
    const { uid, amount, reason = 'Debit', meta = {} } = req.body;
    if (!uid || !amount) return res.status(400).json({ message: 'Missing uid or amount' });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await User.findOne({ uid }).session(session);
      if (!user || (user.balance || 0) < Number(amount)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Insufficient balance' });
      }
      user.balance = Number((user.balance - Number(amount)).toFixed(6));
      await user.save({ session });

      await Transaction.create(
        [
          {
            userId: uid,
            type: 'debit',
            amount: Number(amount),
            reason,
            meta,
            createdAt: new Date(),
          },
        ],
        { session }
      );
      await session.commitTransaction();
      session.endSession();
      return res.json({ balance: user.balance });
    } catch (errInner) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
      throw errInner;
    }
  } catch (err) {
    console.error('/api/wallet/debit error', err);
    return res.status(500).json({ message: err.message });
  }
});

// ---------- REST API: Call endpoints ----------
app.post('/api/calls/start', async (req, res) => {
  /**
   * Expected headers: Authorization: Bearer <idToken>
   * Body: { calleeUid, calleeName?, type?: 'voice'|'video' }
   */
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.idToken;
    if (!token) return res.status(401).json({ error: 'Missing id token' });

    const decoded = await verifyIdToken(token);
    const callerUid = decoded.uid;
    const { calleeUid, calleeName = '', type = 'video' } = req.body;
    if (!calleeUid) return res.status(400).json({ error: 'Missing calleeUid' });

    // ensure user record exists
    let caller = await User.findOne({ uid: callerUid });
    if (!caller) {
      caller = await User.create({ uid: callerUid, name: decoded.name || decoded.email || callerUid, email: decoded.email, balance: 0 });
    }

    if ((caller.balance || 0) < MIN_START_BALANCE) {
      return res.status(402).json({ error: 'INSUFFICIENT_FUNDS', message: `Need at least $${MIN_START_BALANCE} to start a call` });
    }

    const callId = uuidv4();
    const callDoc = await CallRecord.create({
      callId,
      callerId: callerUid,
      calleeId: calleeUid,
      callerName: decoded.name || decoded.email || callerUid,
      calleeName,
      type,
      status: 'ongoing',
      createdAt: new Date(),
    });

    // create in-memory session
    sessions.set(callId, {
      callId,
      callerUid,
      calleeUid,
      seconds: 0,
      chargedSoFar: 0,
      intervalId: null,
    });

    // notify via socket.io if users connected
    io.to(callerUid).emit('server:call-created', { callId, call: callDoc });
    io.to(calleeUid).emit('server:incoming-call', { callId, call: callDoc });

    return res.json({ success: true, callId, call: callDoc });
  } catch (err) {
    console.error('/api/calls/start error', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

app.post('/api/calls/end', async (req, res) => {
  /**
   * End call (HTTP fallback). Body: { callId }
   * Auth header same as start
   */
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.idToken;
    if (!token) return res.status(401).json({ error: 'Missing id token' });

    const decoded = await verifyIdToken(token);
    const requesterUid = decoded.uid;
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ error: 'Missing callId' });

    const session = sessions.get(callId);
    if (session?.intervalId) {
      clearInterval(session.intervalId);
    }
    sessions.delete(callId);

    // finalize call record
    const callDoc = await CallRecord.findOne({ callId });
    const duration = session?.seconds || (callDoc?.duration || 0);
    const cost = session?.chargedSoFar || (callDoc?.cost || 0);
    if (callDoc) {
      callDoc.status = 'ended';
      callDoc.duration = duration;
      callDoc.cost = cost;
      callDoc.endedAt = new Date();
      await callDoc.save();
    }

    io.to(callId).emit('call:ended', { callId, endedBy: requesterUid, duration, cost });
    if (session) {
      io.to(session.callerUid).emit('call:ended', { callId, endedBy: requesterUid, duration, cost });
      io.to(session.calleeUid).emit('call:ended', { callId, endedBy: requesterUid, duration, cost });
    }

    return res.json({ success: true, callId, duration, cost });
  } catch (err) {
    console.error('/api/calls/end error', err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ---------- Socket.IO handlers ----------
io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);

  // client should send: { idToken }
  socket.on('auth', async (data) => {
    try {
      const token = data?.idToken;
      if (!token) return;
      const decoded = await verifyIdToken(token);
      socket.uid = decoded.uid;
      socket.join(socket.uid);
      console.log('socket authenticated for uid:', socket.uid);
      socket.emit('auth:ok', { uid: socket.uid });
    } catch (err) {
      console.warn('socket auth failed:', err.message);
      socket.emit('error', { code: 'AUTH_FAILED', message: err.message });
    }
  });

  // client joins specific call room
  socket.on('call:join', ({ callId }) => {
    if (!callId) return;
    socket.join(callId);
  });

  // Start billing via socket: emits billing ticks each second
  socket.on('billing:start', async ({ callId } = {}) => {
    try {
      if (!callId) return socket.emit('error', { code: 'MISSING_CALLID' });
      const session = sessions.get(callId);
      if (!session) return socket.emit('error', { code: 'NO_SESSION' });

      // only allow caller socket to start billing
      if (socket.uid !== session.callerUid) return socket.emit('error', { code: 'NOT_CALLER' });

      if (session.intervalId) return socket.emit('billing:started', { callId });

      // tick every second: attempt to charge caller atomically each second
      session.intervalId = setInterval(async () => {
        try {
          // attempt to charge one second
          await chargeCallerAtomic(session.callerUid, CALL_RATE_PER_SECOND);

          session.seconds += 1;
          session.chargedSoFar = Number((session.chargedSoFar + CALL_RATE_PER_SECOND).toFixed(6));

          // also persist some progress occasionally (optional)
          if (session.seconds % 10 === 0) {
            await CallRecord.findOneAndUpdate(
              { callId },
              { duration: session.seconds, cost: session.chargedSoFar },
              { upsert: true }
            );
          }

          io.to(callId).emit('billing:update', {
            callId,
            seconds: session.seconds,
            charged: session.chargedSoFar,
          });
        } catch (err) {
          // insufficient funds or other error -> force end the call
          console.warn('billing tick failed for', session.callerUid, err.message);
          clearInterval(session.intervalId);
          sessions.delete(callId);

          // finalize call record
          try {
            const callDoc = await CallRecord.findOne({ callId });
            const duration = session.seconds;
            const cost = session.chargedSoFar;
            if (callDoc) {
              callDoc.status = 'ended';
              callDoc.duration = duration;
              callDoc.cost = cost;
              callDoc.endedAt = new Date();
              await callDoc.save();
            } else {
              await CallRecord.create({
                callId,
                callerId: session.callerUid,
                calleeId: session.calleeUid,
                duration,
                cost,
                status: 'ended',
                createdAt: new Date(),
                endedAt: new Date(),
              });
            }
          } catch (finalizeErr) {
            console.error('finalize call doc failed:', finalizeErr);
          }

          io.to(callId).emit('call:force-end', { reason: 'INSUFFICIENT_FUNDS' });
        }
      }, 1000);

      sessions.set(callId, session);
      socket.emit('billing:started', { callId });
    } catch (err) {
      console.error('billing:start error', err);
      socket.emit('error', { code: 'BILLING_START_ERROR', message: err.message });
    }
  });

  // Stop billing manually
  socket.on('billing:stop', async ({ callId, endedBy } = {}) => {
    try {
      const session = sessions.get(callId);
      if (session?.intervalId) clearInterval(session.intervalId);
      sessions.delete(callId);

      // finalize call doc
      const callDoc = await CallRecord.findOne({ callId });
      const duration = session?.seconds || (callDoc?.duration || 0);
      const cost = session?.chargedSoFar || (callDoc?.cost || 0);

      if (callDoc) {
        callDoc.status = 'ended';
        callDoc.duration = duration;
        callDoc.cost = cost;
        callDoc.endedAt = new Date();
        await callDoc.save();
      } else {
        await CallRecord.create({
          callId,
          callerId: session?.callerUid,
          calleeId: session?.calleeUid,
          duration,
          cost,
          status: 'ended',
          createdAt: new Date(),
          endedAt: new Date(),
        });
      }

      io.to(callId).emit('call:ended', { callId, endedBy, duration, cost });
    } catch (err) {
      console.error('billing:stop error', err);
      socket.emit('error', { code: 'BILLING_STOP_ERROR', message: err.message });
    }
  });

  socket.on('disconnect', () => {
    // optional: cleanup sessions where the only participant left, but we keep sessions
    console.log('socket disconnected', socket.id);
  });
});

// ---------- Basic health endpoint ----------
app.get('/', (req, res) => res.send('Billing server running ✅'));

// ---------- Start server ----------
server.listen(PORT, () => {
  console.log(`⚡ Billing + Socket server listening on port ${PORT}`);
  console.log(`⚡ CALL_RATE_PER_SECOND=${CALL_RATE_PER_SECOND} MIN_START_BALANCE=${MIN_START_BALANCE}`);
});