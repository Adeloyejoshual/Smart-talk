const socket = io();

// Get current user from localStorage
const currentUser = JSON.parse(localStorage.getItem('user'));
if (!currentUser) {
  window.location.href = '/login.html';
}

const chatBox = document.getElementById('chat-box');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const usersList = document.getElementById('users-list');
const typingDiv = document.getElementById('typing');

let selectedUserId = null;

// Notify server that this user is online
socket.emit('userOnline', currentUser._id);

// Handle online users update
socket.on('updateOnlineUsers', (onlineUserIds) => {
  fetch('/api/users') // You can replace this with your own endpoint
    .then(res => res.json())
    .then(users => {
      usersList.innerHTML = '';
      users.forEach(user => {
        if (user._id !== currentUser._id && onlineUserIds.includes(user._id)) {
          const li = document.createElement('li');
          li.textContent = user.username;
          li.dataset.id = user._id;
          li.className = (selectedUserId === user._id) ? 'selected' : '';
          li.onclick = () => {
            selectedUserId = user._id;
            typingDiv.textContent = '';
            loadChatHistory(currentUser._id, selectedUserId);
          };
          usersList.appendChild(li);
        }
      });
    });
});

// Send a message
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();
  if (!content || !selectedUserId) return;

  socket.emit('privateMessage', {
    senderId: currentUser._id,
    receiverId: selectedUserId,
    content
  });

  messageInput.value = '';
  socket.emit('stopTyping', { senderId: currentUser._id, receiverId: selectedUserId });
});

// Listen for new messages
socket.on('newPrivateMessage', (message) => {
  if (
    (message.sender === currentUser._id && message.receiver === selectedUserId) ||
    (message.sender === selectedUserId && message.receiver === currentUser._id)
  ) {
    const msgDiv = document.createElement('div');
    msgDiv.className = message.sender === currentUser._id ? 'sent' : 'received';
    msgDiv.textContent = message.content;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

// Load chat history
function loadChatHistory(senderId, receiverId) {
  fetch(`/messages/${senderId}/${receiverId}`)
    .then(res => res.json())
    .then(messages => {
      chatBox.innerHTML = '';
      messages.forEach(message => {
        const msgDiv = document.createElement('div');
        msgDiv.className = message.sender === currentUser._id ? 'sent' : 'received';
        msgDiv.textContent = message.content;
        chatBox.appendChild(msgDiv);
      });
      chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// Typing indicator
messageInput.addEventListener('input', () => {
  if (selectedUserId) {
    socket.emit('typing', { senderId: currentUser._id, receiverId: selectedUserId });
  }
});

messageInput.addEventListener('blur', () => {
  if (selectedUserId) {
    socket.emit('stopTyping', { senderId: currentUser._id, receiverId: selectedUserId });
  }
});

socket.on('typing', ({ from }) => {
  if (from === selectedUserId) {
    typingDiv.textContent = 'Typing...';
  }
});

socket.on('stopTyping', ({ from }) => {
  if (from === selectedUserId) {
    typingDiv.textContent = '';
  }
});