// server.js

// Load required modules
const express = require('express');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');

// MongoDB connection
const MONGO_URI = 'mongodb+srv://adeloyejoshua2020:<your_password>@smarttalk.3gxk7it.mongodb.net/smarttalk?retryWrites=true&w=majority&appName=Smarttalk';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// Set up Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Test route
app.get('/', (req, res) => {
  res.send('✅ SmartTalk backend running and connected to MongoDB');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
