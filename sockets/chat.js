const users = {};

module.exports = function(io) {
  io.on('connection', socket => {
    socket.on('join', ({ username }) => {
      users[socket.id] = username;
      socket.broadcast.emit('message', { sender: 'System', text: `${username} joined` });
    });

    socket.on('sendMessage', msg => {
      const sender = users[socket.id];
      io.emit('message', { sender, text: msg });
    });

    socket.on('disconnect', () => {
      const username = users[socket.id];
      delete users[socket.id];
      io.emit('message', { sender: 'System', text: `${username} left` });
    });
  });
};