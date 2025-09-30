require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env');
  process.exit(1);
}

// Options compatible with Mongoose 6+
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

mongoose.connect(MONGO_URI, options)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Listen for runtime errors
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB runtime error:', err);
});

// Optional: log when disconnected
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected. Trying to reconnect...');
});

module.exports = mongoose;