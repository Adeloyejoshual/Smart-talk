const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const socketIO = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Socket.IO
const Chat = require('./models/Chat');
const User = require('./models/User');
const onlineUsers = {};

function getRoomId(user1, user2) {
  return [user1, user2].sort().join('_');
}

io.on('connection', (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on('userOnline', (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit('online-users', Object.keys(onlineUsers));
  });

  socket.on('joinRoom', ({ from, to }) => {
    const room = getRoomId(from, to);
    socket.join(room);
    console.log(`📥 User ${from} joined ${room}`);
  });

  socket.on('privateMessage', async ({ from, to, message }) => {
    const room = getRoomId(from, to);

    try {
      const newMsg = await new Chat({ from, to, message }).save();
      const sender = await User.findById(from);

      io.to(room).emit('privateMessage', {
        from,
        fromName: sender.username,
        to,
        message,
        timestamp: newMsg.timestamp
      });

      console.log(`📨 ${sender.username} sent message to ${to}`);
    } catch (e) {
      console.error("❌ Message send error:", e.message);
    }
  });

  socket.on('disconnect', () => {
    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    io.emit('online-users', Object.keys(onlineUsers));
    console.log("🔴 Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));