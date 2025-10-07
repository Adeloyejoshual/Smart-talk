// server/server.js
/**
 * Unified SmartTalk server entry
 * - Express REST endpoints
 * - Mongoose (MongoDB)
 * - Firebase Admin (verify ID tokens)
 * - Optional route mounting (wallet, calls, payments, admin) if files exist
 * - Socket.IO + optional call handler wiring
 *
 * This file uses ES module style (type: "module" in package.json).
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

// ---------- Basic config ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 5000);
const MONGODB_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const CALL_RATE_PER_SECOND = parseFloat(process.env.CALL_RATE_PER_SECOND || '0.0033');
const MIN_START_BALANCE = parseFloat(process.env.MIN_START_BALANCE || '0.5');

// ---------- Validate required env ----------
if (!MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI environment variable. Aborting.');
  process.exit(1);
}

// ---------- Initialize Firebase Admin ----------
// Support two methods:
// 1) service account file path via FIREBASE_ADMIN_KEY_PATH (e.g. /etc/secrets/firebase-admin-key.json)
// 2) inline env variables using FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
function initFirebase() {
  try {
    // prefer file path if provided and exists
    const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
    if (keyPath && fs.existsSync(keyPath)) {
      const raw = fs.readFileSync(keyPath, 'utf8');
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log(`✅ Firebase Admin initialized from file: ${keyPath}`);
      return;
    }

    // fallback to inline env secret
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      // In Render/GitHub Actions you often need to replace literal "\n" with newlines
      privateKey = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey;

      const serviceAccount = {
        project_id: projectId,
        client_email: clientEmail,
        private_key: privateKey,
      };

      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log('✅ Firebase Admin initialized from environment variables');
      return;
    }

    throw new Error('Firebase admin credentials not provided (set FIREBASE_ADMIN_KEY_PATH or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY)');
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin:', err.message || err);
    throw err;
  }
}

try {
  initFirebase();
} catch (err) {
  console.error('Exiting due to Firebase initialization failure.');
  process.exit(1);
}

// ---------- Connect to MongoDB ----------
mongoose.set('strictQuery', true);
mongoose
  .connect(MONGODB_URI, {})
  .then(() => console.log('🟢 MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ---------- Create basic models (used if your models folder is not mounted) ----------
import mongoosePkg from 'mongoose';
const { Schema } = mongoosePkg;

const userSchema = new Schema({
  uid: { type: String, required: true, unique: true },
  name: String,
  email: String,
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model?.('User') || mongoose.model('User', userSchema);

const transactionSchema = new Schema({
  userId: { type: String, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  reason: String,
  meta: Object,
  createdAt: { type: Date, default: Date.now },
});
const Transaction = mongoose.model?.('Transaction') || mongoose.model('Transaction', transactionSchema);

const callRecordSchema = new Schema({
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
const CallRecord = mongoose.model?.('CallRecord') || mongoose.model('CallRecord', callRecordSchema);

// ---------- Helpers ----------
async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Missing id token');
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    throw new Error('Invalid id token');
  }
}

// Atomic charge using Mongo session
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

// ---------- App & Socket ----------
const app = express();
const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: FRONTEND_URL === '*' ? '*' : FRONTEND_URL, methods: ['GET', 'POST'] } });

// middlewares
app.use(cors({ origin: FRONTEND_URL === '*' ? '*' : FRONTEND_URL, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ---------- Mount external route modules if they exist ----------
function tryRequireRoute(relPath) {
  const full = path.join(__dirname, relPath);
  if (fs.existsSync(full)) {
    try {
      const mod = awaitImport(full);
      if (mod && mod.default) return mod.default;
      return mod;
    } catch (err) {
      console.warn(`⚠️ Error importing module ${full}:`, err.message || err);
      return null;
    }
  } else {
    return null;
  }
}

// helper: dynamic import with ESM path
async function awaitImport(fullPath) {
  // Node ESM import requires a file:// URL
  return import(pathToFileUrl(fullPath));
}
function pathToFileUrl(p) {
  const resolved = path.resolve(p);
  return `file://${resolved}`;
}

// try to mount server/routes/*.js or server/controllers/*.js
(async function mountOptionalRoutes() {
  const candidates = [
    'server/routes/wallet.js',
    'server/routes/walletRoutes.js',
    'server/routes/callRoutes.js',
    'server/routes/paymentRoutes.js',
    'server/routes/adminRoutes.js',
    'server/controllers/walletController.js',
    'server/controllers/callController.js',
    'server/controllers/paymentController.js',
  ];

  for (const rel of candidates) {
    const full = path.join(__dirname, '..', rel); // attempt repo-root/server/...
    if (fs.existsSync(full)) {
      try {
        const imported = await import(`file://${full}`);
        // prefer express Router export default or named router
        const router = imported.default || imported.router || imported.routes || imported;
        if (typeof router === 'function') {
          // assume it's a router function, mount at path derived from filename
          const mountPath = '/' + path.basename(rel, path.extname(rel)).replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
          app.use(mountPath, router);
          console.log(`🔌 Mounted route ${rel} -> ${mountPath}`);
        } else if (router && router.stack) {
          // probably an express router
          const mountPath = '/' + path.basename(rel, path.extname(rel)).replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
          app.use(mountPath, router);
          console.log(`🔌 Mounted router ${rel} -> ${mountPath}`);
        } else {
          console.log(`⚠️ Loaded module ${rel} but couldn't mount automatically (not a router)`);
        }
      } catch (err) {
        console.warn(`⚠️ Could not load ${rel}:`, err.message || err);
      }
    }
  }
})().catch((e) => {
  // do not crash mounting; just log
  console.warn('⚠️ mountOptionalRoutes error:', e.message || e);
});

// ---------- Minimal default routes ----------
app.get('/', (req, res) => {
  res.send('🚀 SmartTalk API is running successfully!');
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Simple wallet endpoints (in case dedicated routes are not mounted)
app.get('/api/wallet/balance/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({ balance: Number(user.balance || 0) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post('/api/wallet/credit', async (req, res) => {
  try {
    const { uid, amount, reason = 'Top-up' } = req.body;
    if (!uid || !amount) return res.status(400).json({ message: 'Missing uid or amount' });
    const user = await User.findOneAndUpdate({ uid }, { $inc: { balance: Number(amount) } }, { upsert: true, new: true });
    await Transaction.create({ userId: uid, type: 'credit', amount: Number(amount), reason, createdAt: new Date() });
    return res.json({ balance: Number(user.balance || 0) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ---------- Socket.IO: Basic auth, call rooms, billing ----------
// in-memory sessions map { callId -> { callerUid, calleeUid, seconds, chargedSoFar, intervalId } }
const sessions = new Map();

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('auth', async (data) => {
    try {
      const token = data?.idToken;
      if (!token) return socket.emit('error', { code: 'AUTH_REQUIRED' });
      const decoded = await verifyIdToken(token);
      socket.uid = decoded.uid;
      socket.join(socket.uid);
      socket.emit('auth:ok', { uid: socket.uid });
      console.log(`🔐 socket authenticated: ${socket.uid}`);
    } catch (err) {
      console.warn('socket auth failed:', err.message || err);
      socket.emit('error', { code: 'AUTH_FAILED', message: err.message });
    }
  });

  socket.on('call:join', ({ callId }) => {
    if (!callId) return;
    socket.join(callId);
    console.log(`socket ${socket.id} joined call room ${callId}`);
  });

  socket.on('billing:start', async ({ callId }) => {
    try {
      const session = sessions.get(callId);
      if (!session) return socket.emit('error', { code: 'NO_SESSION' });
      if (socket.uid !== session.callerUid) return socket.emit('error', { code: 'NOT_CALLER' });

      if (session.intervalId) return socket.emit('billing:started', { callId });

      session.intervalId = setInterval(async () => {
        try {
          await chargeCallerAtomic(session.callerUid, CALL_RATE_PER_SECOND);
          session.seconds += 1;
          session.chargedSoFar = Number((session.chargedSoFar + CALL_RATE_PER_SECOND).toFixed(6));
          io.to(callId).emit('billing:update', { callId, seconds: session.seconds, charged: session.chargedSoFar });
        } catch (err) {
          console.warn('billing tick failed:', err.message || err);
          clearInterval(session.intervalId);
          sessions.delete(callId);
          io.to(callId).emit('call:force-end', { reason: 'INSUFFICIENT_FUNDS' });
        }
      }, 1000);

      sessions.set(callId, session);
      socket.emit('billing:started', { callId });
    } catch (err) {
      console.error('billing:start error', err.message || err);
      socket.emit('error', { code: 'BILLING_START_ERROR', message: err.message });
    }
  });

  socket.on('billing:stop', ({ callId, endedBy }) => {
    const session = sessions.get(callId);
    if (session?.intervalId) clearInterval(session.intervalId);
    sessions.delete(callId);
    io.to(callId).emit('call:ended', { callId, endedBy });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

// ---------- Utility: create a session via REST (so front-end can request start call) ----------
app.post('/api/calls/start', async (req, res) => {
  try {
    // Accept Authorization: Bearer <idToken> OR idToken in body
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.idToken;
    if (!token) return res.status(401).json({ error: 'Missing id token' });
    const decoded = await verifyIdToken(token);
    const callerUid = decoded.uid;
    const { calleeUid, calleeName = '', type = 'video' } = req.body;
    if (!calleeUid) return res.status(400).json({ error: 'Missing calleeUid' });

    // ensure user exists in DB
    let caller = await User.findOne({ uid: callerUid });
    if (!caller) caller = await User.create({ uid: callerUid, name: decoded.name || decoded.email, email: decoded.email });

    if ((caller.balance || 0) < MIN_START_BALANCE) {
      return res.status(402).json({ error: 'INSUFFICIENT_FUNDS', message: `Need at least $${MIN_START_BALANCE}` });
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

    // in-memory session
    sessions.set(callId, { callId, callerUid, calleeUid, seconds: 0, chargedSoFar: 0, intervalId: null });

    // notify users if they are connected via socket.io
    io.to(callerUid).emit('server:call-created', { callId, call: callDoc });
    io.to(calleeUid).emit('server:incoming-call', { callId, call: callDoc });

    return res.json({ success: true, callId, call: callDoc });
  } catch (err) {
    console.error('/api/calls/start error', err.message || err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

app.post('/api/calls/end', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.body.idToken;
    if (!token) return res.status(401).json({ error: 'Missing id token' });
    const decoded = await verifyIdToken(token);
    const requesterUid = decoded.uid;
    const { callId } = req.body;
    if (!callId) return res.status(400).json({ error: 'Missing callId' });

    const session = sessions.get(callId);
    if (session?.intervalId) clearInterval(session.intervalId);
    sessions.delete(callId);

    const callDoc = await CallRecord.findOne({ callId });
    const duration = session?.seconds || callDoc?.duration || 0;
    const cost = session?.chargedSoFar || callDoc?.cost || 0;

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
    console.error('/api/calls/end error', err.message || err);
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
});

// ---------- Start server ----------
server.listen(PORT, () => {
  console.log(`⚡ SmartTalk Billing + Socket server listening on port ${PORT}`);
  console.log(`⚡ CALL_RATE_PER_SECOND=${CALL_RATE_PER_SECOND} MIN_START_BALANCE=${MIN_START_BALANCE}`);
});