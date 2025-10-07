/**
 * SmartTalk Billing + Call Server
 *
 * Features:
 *  - Express REST API: /api/wallet, /api/calls
 *  - Socket.IO realtime call lifecycle + per-second billing
 *  - Firebase Admin token verification
 *  - MongoDB with Mongoose models (User, Transaction, CallRecord)
 *
 * Usage: node server.js
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

// ---------- CONFIG ----------
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const FIREBASE_KEY_PATH = process.env.FIREBASE_ADMIN_KEY_PATH || './firebase-admin-key.json';
const CALL_RATE_PER_SECOND = parseFloat(process.env.CALL_RATE_PER_SECOND || '0.0033');
const MIN_START_BALANCE = parseFloat(process.env.MIN_START_BALANCE || '0.5');

if (!MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI in .env');
  process.exit(1);
}

// ---------- FIREBASE ADMIN ----------
try {
  const serviceAccountPath = FIREBASE_KEY_PATH;

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Firebase key file not found at path: ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log(`✅ Firebase Admin initialized using key at ${serviceAccountPath}`);
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

// ---------- MONGODB ----------
mongoose.set('strictQuery', true);
await mongoose.connect(MONGODB_URI, {});
console.log('🟢 MongoDB connected');

// ---------- MONGOOSE MODELS ----------
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  name: String,
  email: String,
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

const transactionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
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
  duration: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  endedAt: Date,
});
const CallRecord = mongoose.model('CallRecord', callRecordSchema);

// ---------- HELPERS ----------
async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Missing id token');
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    throw new Error('Invalid auth token');
  }
}

async function chargeCallerAtomic(uid, amount) {
  if (amount <= 0) return { before: null, after: null };
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const user = await User.findOne({ uid }).session(session);
    if (!user) throw new Error('User not found');
    const before = user.balance;
    if (before < amount) throw new Error('Insufficient funds');

    user.balance = Number((before - amount).toFixed(6));
    await user.save({ session });

    await Transaction.create([{ userId: uid, type: 'debit', amount, reason: 'Call charge' }], {
      session,
    });

    await session.commitTransaction();
    session.endSession();
    return { before, after: user.balance };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
}

// ---------- IN-MEMORY CALL SESSIONS ----------
const sessions = new Map();

// ---------- EXPRESS + SOCKET.IO ----------
const app = express();
app.use(cors());
app.use(bodyParser.json());

const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ---------- REST API ----------
app.get('/api/wallet/balance/:uid', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/wallet/credit', async (req, res) => {
  try {
    const { uid, amount, reason = 'Top-up' } = req.body;
    if (!uid || !amount) return res.status(400).json({ message: 'Missing uid or amount' });
    const user = await User.findOneAndUpdate(
      { uid },
      { $inc: { balance: amount } },
      { upsert: true, new: true }
    );
    await Transaction.create({ userId: uid, type: 'credit', amount, reason });
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/wallet/debit', async (req, res) => {
  try {
    const { uid, amount } = req.body;
    if (!uid || !amount) return res.status(400).json({ message: 'Missing uid or amount' });

    const user = await User.findOne({ uid });
    if (!user || user.balance < amount)
      return res.status(400).json({ message: 'Insufficient balance' });

    user.balance = Number((user.balance - amount).toFixed(6));
    await user.save();
    await Transaction.create({ userId: uid, type: 'debit', amount, reason: 'Manual debit' });

    res.json({ balance: user.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/calls/start', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    const decoded = await verifyIdToken(token);
    const callerUid = decoded.uid;
    const { calleeUid, calleeName = '', type = 'video' } = req.body;

    let caller = await User.findOne({ uid: callerUid });
    if (!caller)
      caller = await User.create({ uid: callerUid, name: decoded.name, email: decoded.email });

    if (caller.balance < MIN_START_BALANCE)
      return res
        .status(402)
        .json({ error: 'INSUFFICIENT_FUNDS', message: `Need at least $${MIN_START_BALANCE}` });

    const callId = uuidv4();
    const callDoc = await CallRecord.create({
      callId,
      callerId: callerUid,
      calleeId: calleeUid,
      callerName: decoded.name || decoded.email,
      calleeName,
      type,
    });

    sessions.set(callId, { callId, callerUid, calleeUid, seconds: 0, chargedSoFar: 0 });

    io.to(callerUid).emit('server:call-created', { callId, call: callDoc });
    io.to(calleeUid).emit('server:incoming-call', { callId, call: callDoc });

    res.json({ success: true, callId, call: callDoc });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

app.post('/api/calls/end', async (req, res) => {
  try {
    const { callId } = req.body;
    const session = sessions.get(callId);
    if (session?.intervalId) clearInterval(session.intervalId);
    sessions.delete(callId);

    const callDoc = await CallRecord.findOne({ callId });
    if (callDoc) {
      callDoc.status = 'ended';
      callDoc.duration = session?.seconds || 0;
      callDoc.cost = session?.chargedSoFar || 0;
      callDoc.endedAt = new Date();
      await callDoc.save();
    }
    io.to(callId).emit('call:ended', { callId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ---------- SOCKET.IO ----------
io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('auth', async (data) => {
    try {
      const decoded = await verifyIdToken(data.idToken);
      socket.uid = decoded.uid;
      socket.join(socket.uid);
      socket.emit('auth:ok', { uid: socket.uid });
    } catch (err) {
      socket.emit('error', { code: 'AUTH_FAILED', message: err.message });
    }
  });

  socket.on('call:join', ({ callId }) => socket.join(callId));

  socket.on('billing:start', async ({ callId }) => {
    const session = sessions.get(callId);
    if (!session) return socket.emit('error', { code: 'NO_SESSION' });
    if (session.intervalId) return socket.emit('billing:started', { callId });

    session.intervalId = setInterval(async () => {
      try {
        await chargeCallerAtomic(session.callerUid, CALL_RATE_PER_SECOND);
        session.seconds++;
        session.chargedSoFar = Number((session.chargedSoFar + CALL_RATE_PER_SECOND).toFixed(6));
        io.to(callId).emit('billing:update', {
          callId,
          seconds: session.seconds,
          charged: session.chargedSoFar,
        });
      } catch {
        clearInterval(session.intervalId);
        sessions.delete(callId);
        io.to(callId).emit('call:force-end', { reason: 'INSUFFICIENT_FUNDS' });
      }
    }, 1000);
    socket.emit('billing:started', { callId });
  });

  socket.on('billing:stop', ({ callId }) => {
    const session = sessions.get(callId);
    if (session?.intervalId) clearInterval(session.intervalId);
    sessions.delete(callId);
    io.to(callId).emit('call:ended', { callId });
  });
});

// ---------- HEALTH ----------
app.get('/', (req, res) => res.send('✅ SmartTalk Billing Server Running'));

// ---------- START SERVER ----------
server.listen(PORT, () => {
  console.log(`⚡ Server listening on port ${PORT}`);
  console.log(`⚡ CALL_RATE_PER_SECOND=${CALL_RATE_PER_SECOND}, MIN_START_BALANCE=${MIN_START_BALANCE}`);
});