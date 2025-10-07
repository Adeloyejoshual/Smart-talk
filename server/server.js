// server.js
import 'dotenv/config';
import http from 'http';
import process from 'process';
import { fileURLToPath } from 'url';
import path from 'path';
import { Server as IOServer } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

// initialize/patch globals that other modules may expect
// (adjust if your app already initializes these)
import './src/utils/firebaseAdmin.js'; // initialize firebase admin (side-effect import)

// Import your app and infrastructure helpers
import app from './app.js'; // your express app (server/app.js in the repo)
import connectDB from './config/db.js'; // function that connects to MongoDB
import initCallHandler from './socket/callHandler.js'; // sets up socket events: (io) => {}
import initCallBilling from './callBilling.js'; // optional: (io) => {} or (server) => {}
// If your project stores connectors in server/src or server/, adjust the paths accordingly.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const NODE_ENV = process.env.NODE_ENV || 'development';

async function main() {
  try {
    // Connect to DB first (fail early)
    if (connectDB && typeof connectDB === 'function') {
      await connectDB(process.env.MONGO_URI);
      console.log('✅ MongoDB connected');
    } else {
      console.warn('⚠️ connectDB not found or not a function. Skipping DB connection.');
    }

    // Add some server-level middleware for security, compression, logging, rate-limiting
    app.use(helmet());
    app.use(compression());

    if (NODE_ENV === 'development') {
      app.use(morgan('dev'));
    } else {
      app.use(morgan('combined'));
    }

    // Basic rate limiting (adjust as needed)
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 300, // limit each IP to 300 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);

    // Serve static assets if client build exists
    const clientBuildPath = path.join(__dirname, 'public');
    app.use('/public', (await import('express')).default.static(clientBuildPath));

    // Create HTTP server and attach Socket.IO
    const server = http.createServer(app);
    const io = new IOServer(server, {
      cors: {
        origin: CLIENT_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
    });

    // Optional: simple auth middleware for sockets (token verification).
    // If you use Firebase Admin tokens, verify here in a socket middleware.
    // Example (uncomment and adapt if desired):
    /*
    io.use(async (socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!token) return next();
      try {
        const admin = (await import('./src/utils/firebaseAdmin.js')).default;
        const decoded = await admin.auth().verifyIdToken(token.replace('Bearer ', ''));
        socket.uid = decoded.uid;
        return next();
      } catch (err) {
        console.warn('Socket auth failed', err);
        return next(); // or next(new Error('Unauthorized'));
      }
    });
    */

    // Initialize Socket handlers (calls, signaling, etc.)
    if (initCallHandler && typeof initCallHandler === 'function') {
      initCallHandler(io);
      console.log('🔌 Call/socket handler initialized');
    } else {
      console.warn('⚠️ callHandler initializer not found or not a function.');
    }

    // Initialize call billing / per-second billing logic if exported
    if (initCallBilling && typeof initCallBilling === 'function') {
      try {
        initCallBilling(io, { server });
        console.log('💸 Call billing initialized');
      } catch (err) {
        console.warn('Call billing init raised an error (continuing):', err);
      }
    }

    // Global error handling for uncaught exceptions/rejections
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception — shutting down:', err);
      // Optionally perform cleanup here, then exit
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // depending on severity, you might want to stop the server:
      // process.exit(1);
    });

    // Start listening
    server.listen(PORT, () => {
      console.log(`🚀 Server running in ${NODE_ENV} on port ${PORT}`);
      console.log(`🌐 Allowed client origin: ${CLIENT_ORIGIN}`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      server.close((err) => {
        if (err) {
          console.error('Error during server close:', err);
          process.exit(1);
        }
        console.log('HTTP server closed.');
        // close DB connections if you have one exported from connectDB
        // e.g., mongoose.connection.close()
        if (process.env.NODE_ENV === 'production') {
          // any production-specific cleanup
        }
        // give exec a moment for cleanup then exit
        setTimeout(() => process.exit(0), 500);
      });

      // force close after 10s
      setTimeout(() => {
        console.error('Forcing shutdown after 10s');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Fatal error during server startup:', err);
    process.exit(1);
  }
}

main();