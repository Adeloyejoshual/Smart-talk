const socket = io();
let from = localStorage.getItem('userId'); // from settings or login
let to = localStorage.getItem('chatWith'); // selected user ID
let fromUsername = localStorage.getItem('username'); // your display name

const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// Join room
socket.emit('joinRoom', { from, to });

// Load message history
fetch(`/api/messages/${from}/${to}`)
  .then(res => res.json())
  .then(messages => {
    messages.forEach(msg => {
      const sender = msg.from._id === from ? 'You' : msg.from.username;
      appendMessage(sender, msg.message);
    });
  });

// Send message
sendBtn.addEventListener('click', () => {
  const message = messageInput.value.trim();
  if (!message) return;

  socket.emit('privateMessage', { from, to, message });
  appendMessage("You", message);
  messageInput.value = "";
});

// Receive messages
socket.on('privateMessage', ({ from: senderId, fromName, message }) => {
  if (senderId !== from) {
    appendMessage(fromName, message);
  }
});

function appendMessage(sender, message) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}