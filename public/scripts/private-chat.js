const socket = io();
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const chatBox = document.getElementById("chat-box");
const typingIndicator = document.getElementById("typing-indicator");
const imageUpload = document.getElementById("image-upload");

let currentUser = null;
let otherUserId = null;
let lastDate = null;

// ✅ Load JWT and User
const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

const urlParams = new URLSearchParams(window.location.search);
otherUserId = urlParams.get("id");

// ✅ Get current user info
async function getCurrentUser() {
  const res = await fetch("/api/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  currentUser = await res.json();
  socket.emit("join", currentUser._id);
}

// ✅ Fetch other user's username
async function setUsername() {
  const res = await fetch(`/api/users/search?q=${otherUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const users = await res.json();
  const user = users.find(u => u._id === otherUserId);
  if (user) {
    document.getElementById("chat-username").textContent = user.username;
  }
}

// ✅ Load messages
async function loadMessages() {
  const res = await fetch(`/api/messages/private/${otherUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const messages = await res.json();
  chatBox.innerHTML = "";
  lastDate = null;

  messages.forEach(displayMessage);
  scrollToBottom();
}

// ✅ Display message
function displayMessage(msg) {
  const msgDate = new Date(msg.createdAt).toDateString();
  if (msgDate !== lastDate) {
    const dateEl = document.createElement("div");
    dateEl.className = "sticky top-0 text-center text-xs bg-gray-300 dark:bg-gray-700 py-1 rounded";
    dateEl.textContent = msgDate;
    chatBox.appendChild(dateEl);
    lastDate = msgDate;
  }

  const div = document.createElement("div");
  div.className = `p-2 rounded-md max-w-[70%] ${
    msg.sender === currentUser._id
      ? "bg-blue-500 text-white self-end ml-auto"
      : "bg-gray-300 dark:bg-gray-700 text-black dark:text-white self-start"
  }`;

  if (msg.fileUrl) {
    const img = document.createElement("img");
    img.src = msg.fileUrl;
    img.className = "rounded max-w-full max-h-52";
    div.appendChild(img);
  }

  if (msg.content) {
    const text = document.createElement("p");
    text.textContent = msg.content;
    div.appendChild(text);
  }

  chatBox.appendChild(div);
}

// ✅ Scroll chat to bottom
function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ✅ Submit message
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  const file = imageUpload.files[0];

  if (!text && !file) return;

  const formData = new FormData();
  formData.append("receiverId", otherUserId);
  if (text) formData.append("content", text);
  if (file) formData.append("file", file);

  const res = await fetch("/api/messages/private/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await res.json();
  if (res.ok) {
    displayMessage(data);
    socket.emit("privateMessage", {
      senderId: currentUser._id,
      receiverId: otherUserId,
      content: text,
    });
    messageInput.value = "";
    imageUpload.value = "";
    scrollToBottom();
  }
});

// ✅ Typing indicator
let typingTimeout;
messageInput.addEventListener("input", () => {
  socket.emit("typing", { to: otherUserId });
});

socket.on("typing", () => {
  typingIndicator.classList.remove("hidden");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typingIndicator.classList.add("hidden");
  }, 1000);
});

// ✅ Incoming message
socket.on("privateMessage", (msg) => {
  if (msg.senderId === otherUserId) {
    displayMessage({
      sender: msg.senderId,
      content: msg.content,
      createdAt: new Date().toISOString(),
    });
    scrollToBottom();
  }
});

// ✅ Go home & chat settings
function goHome() {
  window.location.href = "/home.html";
}
function openSettingsModal() {
  document.getElementById("chat-settings-modal").classList.remove("hidden");
}
function closeSettingsModal() {
  document.getElementById("chat-settings-modal").classList.add("hidden");
}

// ✅ Initialize
getCurrentUser().then(() => {
  setUsername();
  loadMessages();
});