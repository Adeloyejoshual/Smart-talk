require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

// Options with deprecation fixes
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // useCreateIndex and useFindAndModify are no longer needed in Mongoose 6+
};

mongoose.connect(MONGO_URI, options)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Optional: listen for connection errors after initial connection
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB runtime error:', err);
});

module.exports = mongoose;