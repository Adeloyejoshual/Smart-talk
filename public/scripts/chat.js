const token = localStorage.getItem("token");
const userId = localStorage.getItem("userId");
const username = localStorage.getItem("username");

if (!token) {
  window.location.href = "/login.html";
}

// Connect to Socket.IO with userId
const socket = io({ query: { userId, username } });

// Example: Set your own name in the UI
document.getElementById("myName").textContent = username;

  // Load chat history
  async function loadChat() {
    try {
      const res = await fetch(`/api/messages/history?senderId=${currentUser._id}&receiverId=${receiverId}`);
      const messages = await res.json();
      messagesContainer.innerHTML = '';
      messages.forEach(msg => displayMessage(msg));
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  }

  // Display a message in chat
  function displayMessage(msg) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.classList.add(msg.sender._id === currentUser._id ? 'sent' : 'received');

    const timestamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<strong>${msg.sender.username}:</strong> ${msg.content} <span class="timestamp">${timestamp}</span>`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Send message
  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const messageData = {
      senderId: currentUser._id,
      receiverId,
      content
    };

    // Send to backend
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });

      const savedMessage = await res.json();
      displayMessage({
        ...savedMessage.data,
        sender: { _id: currentUser._id, username: currentUser.username }
      });

      // Send via socket
      socket.emit('private message', {
        to: receiverId,
        message: savedMessage.data
      });

      messageInput.value = '';
    } catch (err) {
      console.error('Message send error:', err);
    }
  });

  // Receive message
  socket.on('private message', (msg) => {
    if (msg.sender._id === receiverId || msg.receiver === currentUser._id) {
      displayMessage(msg);
    }
  });

  loadChat();
});