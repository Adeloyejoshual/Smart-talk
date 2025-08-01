<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SmartTalk - Chat</title>
  <link rel="stylesheet" href="/styles/chat.css">
  <script src="/socket.io/socket.io.js"></script>
</head>
<body>
  <header>
    <button id="backBtn">⬅ Back</button>
    <h2 id="chatWith">Chat</h2>
  </header>

  <main id="chatBox">
    <ul id="messages"></ul>
  </main>

  <form id="chatForm">
    <input type="text" id="messageInput" autocomplete="off" placeholder="Type a message..." required />
    <button type="submit">➤</button>
  </form>

  <script>
    const socket = io();
    const messages = document.getElementById('messages');
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const chatWith = document.getElementById('chatWith');
    const backBtn = document.getElementById('backBtn');

    const urlParams = new URLSearchParams(window.location.search);
    const to = urlParams.get('to');
    const toName = urlParams.get('name');
    const from = localStorage.getItem('userId');

    // Redirect to login if not authenticated
    if (!from) {
      window.location.href = '/login.html';
    }

    // Show username or fallback
    chatWith.textContent = 'Chat with ' + (toName || 'User');

    // Back button
    backBtn.onclick = () => {
      window.location.href = '/home.html';
    };

    // Join room for private chat
    socket.emit('joinRoom', { from, to });

    // Listen for incoming messages
    socket.on('privateMessage', ({ from: senderId, message }) => {
      const li = document.createElement('li');
      li.textContent = senderId === from ? `You: ${message}` : `${toName || 'User'}: ${message}`;
      li.className = senderId === from ? 'sent' : 'received';
      messages.appendChild(li);
      messages.scrollTop = messages.scrollHeight;
    });

    // Send message
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = messageInput.value.trim();
      if (!msg) return;
      socket.emit('privateMessage', { from, to, message: msg });
      messageInput.value = '';
    });
  </script>
</body>
</html>