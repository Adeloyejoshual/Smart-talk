const socket = io();

// Get data from URL
const urlParams = new URLSearchParams(window.location.search);
const token = localStorage.getItem("token");
const otherUserId = urlParams.get("id");
const username = urlParams.get("username");

document.getElementById("chat-username").textContent = username;

// DOM
const chatBox = document.getElementById("chat-box");
const form = document.getElementById("message-form");
const input = document.getElementById("message-input");

// Fetch old messages
async function loadMessages() {
  const res = await fetch(`/api/messages/private/${otherUserId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  const messages = await res.json();
  messages.forEach(drawMessage);
  scrollToBottom();
}

// Render messages
function drawMessage(msg) {
  const div = document.createElement("div");
  const isMe = msg.sender === parseJwt(token).id;
  div.className = `max-w-[70%] px-4 py-2 rounded-lg text-sm ${isMe ? 'bg-blue-600 text-white self-end ml-auto' : 'bg-gray-300 dark:bg-gray-700 dark:text-white self-start mr-auto'}`
  div.textContent = msg.content;
  chatBox.appendChild(div);
}

// Submit message
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = input.value.trim();
  if (!content) return;

  const res = await fetch(`/api/messages/private/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ recipientId: otherUserId, content })
  });

  const msg = await res.json();
  drawMessage(msg);
  socket.emit("privateMessage", {
    senderId: msg.sender,
    receiverId: msg.recipient,
    content: msg.content
  });

  input.value = "";
  scrollToBottom();
});

// Receive messages
socket.on("privateMessage", (msg) => {
  if (msg.senderId === otherUserId) {
    drawMessage({ sender: msg.senderId, content: msg.content });
    scrollToBottom();
  }
});

function parseJwt(token) {
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload));
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

function goHome() {
  window.location.href = "home.html";
}

function openSettings() {
  alert("Chat settings coming soon...");
}

// Join socket room
const myId = parseJwt(token).id;
socket.emit("join", myId);

loadMessages();