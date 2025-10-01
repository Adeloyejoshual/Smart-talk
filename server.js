// server.js
const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const AgoraRTC = require('agora-rtc-sdk');

// Create a new Agora.io client
const client = AgoraRTC.createClient({
  mode: 'rtc',
  codec: 'vp8',
});

// In-memory user storage (replace with a database in production)
const users = {
  user1: {
    password: bcrypt.hashSync('password1', 10),
  },
  user2: {
    password: bcrypt.hashSync('password2', 10),
  },
};

// Middleware to authenticate requests
const authenticate = (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || !password) {
    return res.status(401).send('Invalid credentials');
  }

  const user = users[username];

  if (!user) {
    return res.status(401).send('Invalid credentials');
  }

  const isValidPassword = bcrypt.compareSync(password, user.password);

  if (!isValidPassword) {
    return res.status(401).send('Invalid credentials');
  }

  next();
};

// Start screen sharing
app.post('/start-screen-sharing', authenticate, (req, res) => {
  client.publish(screenTrack, (err) => {
    if (err) {
      console.error('Error starting screen sharing:', err);
      res.status(500).send('Error starting screen sharing');
    } else {
      console.log('Screen sharing started successfully!');
      res.send('Screen sharing started successfully!');
    }
  });
});

// Start recording
app.post('/start-recording', authenticate, (req, res) => {
  const recordingFormat = req.body.format; // Get the recording format from the request body
  const fileName = `recording.${recordingFormat === 'mp4' ? 'mp4' : 'webm'}`;

  client.startRecording({
    fileName,
    (err) => {
      if (err) {
        console.error('Error starting recording:', err);
        res.status(500).send('Error starting recording');
      } else {
        console.log('Recording started successfully!');
        res.send('Recording started successfully!');
      }
    },
  });
});

// Login endpoint
app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (!username || !password) {
    return res.status(401).send('Invalid credentials');
  }

  const user = users[username];

  if (!user) {
    return res.status(401).send('Invalid credentials');
  }

  const isValidPassword = bcrypt.compareSync(password, user.password);

  if (!isValidPassword) {
    return res.status(401).send('Invalid credentials');
  }

  res.send('Logged in successfully!');
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
});