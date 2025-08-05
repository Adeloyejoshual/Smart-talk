// js/private-chat.js

const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const otherUserId = urlParams.get("id");
const chatBox = document.getElementById("chat-box");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const typingIndicator = document.getElementById("typing-indicator");
const chatUsername = document.getElementById("chat-username");
const imageUpload = document.getElementById("image-upload");

let userId = null;
let lastDate = null;
let typingTimeout;

function goHome() {
  window.location.href = "/home.html";
}

function openSettingsModal() {
  document.getElementById("chat-settings-modal").classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("chat-settings-modal").classList.add("hidden");
}

// Simulated edit/delete (replace with real API later)
function editMessage() {
  alert("Edit functionality coming soon!");
}
function deleteMessage() {
  alert("Delete functionality coming soon!");
}

// === Load user info and chat ===
async function loadChat() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/users/me", {
    headers: { Authorization: "Bearer " + token },
  });
  const user = await res.json();
  userId = user._id;

  socket.emit("join", userId);

  // Load other user's name
  const friendRes = await fetch(`/api/users/chats`, {
    headers: { Authorization: "Bearer " + token },
  });
  const friends = await friendRes.json();
  const otherUser = friends.find((f) => f._id === otherUserId);
  if (otherUser) chatUsername.textContent = otherUser.username;

  // Load chat messages
  const msgRes = await fetch(`/api/messages/private/${otherUserId}`, {
    headers: { Authorization: "Bearer " + token },
  });
  const messages = await msgRes.json();
  messages.forEach(renderMessage);
  scrollToBottom();
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

// === Render message ===
function renderMessage(msg) {
  const date = new Date(msg.createdAt).toDateString();
  if (lastDate !== date) {
    const dateDiv = document.createElement("div");
    dateDiv.className = "sticky top-0 text-center text-xs bg-gray-300 dark:bg-gray-700 py-1 rounded";
    dateDiv.textContent = date;
    chatBox.appendChild(dateDiv);
    lastDate = date;
  }

  const msgDiv = document.createElement("div");
  msgDiv.className = `flex ${msg.sender === userId ? "justify-end" : "justify-start"}`;
  const bubble = document.createElement("div");
  bubble.className = `max-w-xs px-3 py-2 rounded-lg ${
    msg.sender === userId
      ? "bg-blue-600 text-white"
      : "bg-gray-300 dark:bg-gray-700 text-black dark:text-white"
  }`;

  if (msg.fileUrl) {
    const img = document.createElement("img");
    img.src = msg.fileUrl;
    img.className = "rounded max-w-[200px] max-h-[200px]";
    bubble.appendChild(img);
  }

  if (msg.content) {
    const p = document.createElement("p");
    p.textContent = msg.content;
    bubble.appendChild(p);
  }

  const time = document.createElement("div");
  time.className = "text-xs mt-1 text-right opacity-70";
  time.textContent = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  bubble.appendChild(time);

  msgDiv.appendChild(bubble);
  chatBox.appendChild(msgDiv);
}

// === Send message ===
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text && !imageUpload.files[0]) return;

  const formData = new FormData();
  formData.append("receiverId", otherUserId);
  if (text) formData.append("content", text);
  if (imageUpload.files[0]) formData.append("file", imageUpload.files[0]);

  const token = localStorage.getItem("token");
  const res = await fetch("/api/messages/private/send", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: formData,
  });

  const data = await res.json();
  socket.emit("privateMessage", {
    senderId: userId,
    receiverId: otherUserId,
    content: data.content,
    fileUrl: data.fileUrl,
    createdAt: data.createdAt,
  });

  renderMessage({
    ...data,
    sender: userId,
    createdAt: data.createdAt || new Date().toISOString(),
  });

  messageInput.value = "";
  imageUpload.value = "";
  scrollToBottom();
});

// === Typing Indicator ===
messageInput.addEventListener("input", () => {
  socket.emit("typing", { from: userId, to: otherUserId });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stopTyping", { from: userId, to: otherUserId });
  }, 1000);
});

socket.on("typing", ({ from }) => {
  if (from === otherUserId) {
    typingIndicator.classList.remove("hidden");
  }
});

socket.on("stopTyping", ({ from }) => {
  if (from === otherUserId) {
    typingIndicator.classList.add("hidden");
  }
});

// === Receive Message ===
socket.on("privateMessage", (msg) => {
  if (msg.senderId === otherUserId) {
    renderMessage({
      sender: msg.senderId,
      content: msg.content,
      fileUrl: msg.fileUrl,
      createdAt: msg.timestamp || new Date().toISOString(),
    });
    scrollToBottom();
  }
});

loadChat();