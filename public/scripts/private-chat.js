// /public/js/private-chat.js
const socket = io();
let userId = null;
let otherUserId = null;
let token = localStorage.getItem("token");

const chatBox = document.getElementById("chat-box");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const imageUpload = document.getElementById("image-upload");
const usernameHeader = document.getElementById("chat-username");
const typingIndicator = document.getElementById("typing-indicator");

// Parse URL to get otherUserId
const urlParams = new URLSearchParams(window.location.search);
otherUserId = urlParams.get("user");

// Get current user
async function getCurrentUser() {
  const res = await fetch("/api/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = await res.json();
  userId = user._id;
  socket.emit("join", userId);
  return user;
}

// Load messages
async function loadMessages() {
  const res = await fetch(`/api/messages/private/${otherUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const messages = await res.json();
  chatBox.innerHTML = "";
  let currentDate = null;

  messages.forEach((msg) => {
    const date = new Date(msg.createdAt).toDateString();
    if (date !== currentDate) {
      const dateDiv = document.createElement("div");
      dateDiv.className = "sticky top-0 text-center text-xs bg-gray-300 dark:bg-gray-700 py-1 rounded";
      dateDiv.textContent = date;
      chatBox.appendChild(dateDiv);
      currentDate = date;
    }

    const msgDiv = document.createElement("div");
    msgDiv.className = `p-2 rounded max-w-[75%] ${
      msg.sender._id === userId || msg.sender === userId
        ? "bg-blue-600 text-white ml-auto"
        : "bg-gray-300 dark:bg-gray-600 text-black dark:text-white"
    }`;

    if (msg.image) {
      const img = document.createElement("img");
      img.src = msg.image;
      img.className = "w-40 h-auto rounded mb-1";
      msgDiv.appendChild(img);
    }

    if (msg.content || msg.text) {
      const text = document.createElement("p");
      text.textContent = msg.content || msg.text;
      msgDiv.appendChild(text);
    }

    chatBox.appendChild(msgDiv);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send message
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = messageInput.value;
  if (!content.trim()) return;

  socket.emit("privateMessage", {
    senderId: userId,
    receiverId: otherUserId,
    content,
  });

  await fetch(`/api/messages/private/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recipientId: otherUserId, content }),
  });

  messageInput.value = "";
  loadMessages();
});

// Handle image upload
imageUpload.addEventListener("change", async () => {
  const files = imageUpload.files;
  if (!files.length) return;

  const formData = new FormData();
  for (let file of files) {
    formData.append("images", file);
  }
  formData.append("receiverId", otherUserId);

  await fetch("/api/messages/private/image", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  imageUpload.value = "";
  loadMessages();
});

// Typing indicator (optional enhancement)
let typingTimeout;
messageInput.addEventListener("input", () => {
  socket.emit("typing", { to: otherUserId });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stopTyping", { to: otherUserId });
  }, 2000);
});

socket.on("showTyping", () => {
  typingIndicator.classList.remove("hidden");
});
socket.on("hideTyping", () => {
  typingIndicator.classList.add("hidden");
});

// Receive new message
socket.on("privateMessage", (data) => {
  if (data.senderId === otherUserId) loadMessages();
});

// Navigation
function goHome() {
  window.location.href = "/home.html";
}

function openSettingsModal() {
  document.getElementById("chat-settings-modal").classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("chat-settings-modal").classList.add("hidden");
}

// Dummy actions
function editMessage() {
  alert("Edit message clicked");
}
function deleteMessage() {
  alert("Delete message clicked");
}

// Init
getCurrentUser().then(async () => {
  const res = await fetch(`/api/users/${otherUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const user = await res.json();
  usernameHeader.textContent = user.username || "Chat";
  loadMessages();
});