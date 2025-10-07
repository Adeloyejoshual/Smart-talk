/**
 * SmartTalk Server
 * Unified backend for chat, calls, wallet & billing
 *
 * Features:
 *  - Express + MongoDB (Mongoose)
 *  - Firebase Admin (auth verification)
 *  - Safe model registration
 *  - Optional dynamic route mounting
 *  - Socket.IO billing & realtime call updates
 */

import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import fs from 'fs';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as IOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

// ---------- Paths & Environment ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 5000);
const MONGODB_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const CALL_RATE_PER_SECOND = parseFloat(process.env.CALL_RATE_PER_SECOND || '0.0033');
const MIN_START_BALANCE = parseFloat(process.env.MIN_START_BALANCE || '0.5');

// ---------- Validate Environment ----------
if (!MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI environment variable.');
  process.exit(1);
}

// ---------- Firebase Admin Initialization ----------
function initFirebase() {
  try {
    const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
    if (keyPath && fs.existsSync(keyPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log(`✅ Firebase Admin initialized from file: ${keyPath}`);
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      privateKey = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;
      const serviceAccount = { project_id: projectId, client_email: clientEmail, private_key: privateKey };
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('✅ Firebase Admin initialized from environment variables');
      return;
    }

    throw new Error('Missing Firebase credentials');
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin:', err.message || err);
    process.exit(1);
  }
}
initFirebase();

// ---------- MongoDB Connection ----------
mongoose.set('strictQuery', true);
mongoose
  .connect(MONGODB_URI, {})
  .then(() => console.log('🟢 MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ---------- ENSURE MONGOOSE MODELS EXIST SAFELY ----------
import mongoosePkg from 'mongoose';
const { Schema } = mongoosePkg;

// Helper to safely register models (avoids MissingSchemaError / OverwriteModelError)
function safeModel(name, schemaDef, options = {}) {
  if (mongoose.models[name]) {
    return mongoose.models[name];
  }
  const schema = new Schema(schemaDef, options);
  return mongoose.model(name, schema);
}

// ✅ Define or reuse models
const User = safeModel('User', {
  uid: { type: String, required: true, unique: true },
  name: String,
  email: String,
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

const Transaction = safeModel('Transaction', {
  userId: { type: String, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  reason: String,
  meta: Object,
  createdAt: { type: Date, default: Date.now },
});

const CallRecord = safeModel('CallRecord', {
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

// ---------- Helpers ----------
async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Missing id token');
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    throw new Error('Invalid Firebase ID token');
  }
}

async function chargeCallerAtomic(uid, amount) {
  if (!amount || amount <= 0) return { before: null, after: null };
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const user = await User.findOne({ uid }).session(session);
    if (!user) throw new Error('User not found');
    const before = Number(user.balance || 0);
    if (before < amount) throw new Error('Insufficient funds');
    const after = Number((before - amount).toFixed(6));
    user.balance = after;
    await user.save({ session });
    await Transaction.create([{ userId: uid, type: 'debit', amount, reason: 'Call billing', createdAt: new Date() }], { session });
    await session.commitTransaction();
    session.endSession();
    return { before, after };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    throw err;
  }
}

// ---------- Express & Socket Setup ----------
const app = express();
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: FRONTEND_URL === '*' ? '*' : FRONTEND_URL, methods: ['GET', 'POST'] } });

app.use(cors({ origin: FRONTEND_URL === '*' ? '*' : FRONTEND_URL, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ---------- Default Routes ----------
app.get('/', (req, res) => res.send('🚀 SmartTalk API is running successfully!'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Wallet endpoints
app.get('/api/wallet/balance/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ balance: Number(user.balance || 0) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/wallet/credit', async (req, res) => {
  try {
    const { uid, amount, reason = 'Top-up' } = req.body;
    if (!uid || !amount) return res.status(400).json({ message: 'Missing uid or amount' });
    const user = await User.findOneAndUpdate({ uid }, { $inc: { balance: Number(amount) } }, { upsert: true, new: true });
    await Transaction.create({ userId: uid, type: 'credit', amount: Number(amount), reason });
    res.json({ balance: Number(user.balance || 0) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- Socket.IO (Realtime Billing & Calls) ----------
const sessions = new Map();

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('auth', async (data) => {
    try {
      const token = data?.idToken;
      const decoded = await verifyIdToken(token);
      socket.uid = decoded.uid;
      socket.join(socket.uid);
      socket.emit('auth:ok', { uid: socket.uid });
      console.log(`🔐 Socket authenticated: ${socket.uid}`);
    } catch (err) {
      socket.emit('error', { code: 'AUTH_FAILED', message: err.message });
    }
  });

  socket.on('call:join', ({ callId }) => {
    if (!callId) return;
    socket.join(callId);
    console.log(`Socket ${socket.id} joined call ${callId}`);
  });

  socket.on('billing:start', async ({ callId }) => {
    const session = sessions.get(callId);
    if (!session) return socket.emit('error', { code: 'NO_SESSION' });
    if (socket.uid !== session.callerUid) return socket.emit('error', { code: 'NOT_CALLER' });

    if (session.intervalId) return;
    session.intervalId = setInterval(async () => {
      try {
        await chargeCallerAtomic(session.callerUid, CALL_RATE_PER_SECOND);
        session.seconds += 1;
        session.chargedSoFar = Number((session.chargedSoFar + CALL_RATE_PER_SECOND).toFixed(6));
        io.to(callId).emit('billing:update', { callId, seconds: session.seconds, charged: session.chargedSoFar });
      } catch (err) {
        clearInterval(session.intervalId);
        sessions.delete(callId);
        io.to(callId).emit('call:force-end', { reason: 'INSUFFICIENT_FUNDS' });
      }
    }, 1000);
  });

  socket.on('billing:stop', ({ callId }) => {
    const session = sessions.get(callId);
    if (session?.intervalId) clearInterval(session.intervalId);
    sessions.delete(callId);
    io.to(callId).emit('call:ended', { callId });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

// ---------- Start Server ----------
server.listen(PORT, () => {
  console.log(`⚡ SmartTalk server running on port ${PORT}`);
  console.log(`⚙️ CALL_RATE_PER_SECOND=${CALL_RATE_PER_SECOND}, MIN_START_BALANCE=${MIN_START_BALANCE}`);
});