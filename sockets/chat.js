const users = {};

module.exports = function(io) {
  io.on('connection', socket => {
  socket.on('joinAdmin', ({ username }) => {
    socket.join('adminRoom');
    socket.username = username;
    console.log(`🛡️ Admin joined: ${username}`);
  });

  socket.on('sendAdminMessage', msg => {
    io.to('adminRoom').emit('adminMessage', {
      sender: socket.username,
      text: msg
    });
  });
});

    socket.on('disconnect', () => {
      const username = users[socket.id];
      delete users[socket.id];
      io.emit('message', { sender: 'System', text: `${username} left` });
    });
  });
};