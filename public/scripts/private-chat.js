// private-chat.js

const socket = io(); const chatBox = document.getElementById("chat-box"); const messageForm = document.getElementById("message-form"); const messageInput = document.getElementById("message-input"); const stickyDate = document.getElementById("sticky-date");

const params = new URLSearchParams(window.location.search); const otherUserId = params.get("id"); let currentUserId = null; let lastRenderedDate = null;

// Fetch current user fetch("/api/users/me", { headers: { Authorization: Bearer ${localStorage.getItem("token")} }, }) .then((res) => res.json()) .then((user) => { currentUserId = user._id; socket.emit("join", user._id); document.getElementById("chat-username").textContent = user.username || "User"; loadMessages(); });

// Load previous messages function loadMessages() { fetch(/api/messages/private/${otherUserId}, { headers: { Authorization: Bearer ${localStorage.getItem("token")} }, }) .then((res) => res.json()) .then((messages) => { messages.forEach((msg) => renderMessage(msg)); chatBox.scrollTop = chatBox.scrollHeight; }); }

// Submit new message messageForm.addEventListener("submit", (e) => { e.preventDefault(); const content = messageInput.value.trim(); if (!content) return;

const msg = { senderId: currentUserId, receiverId: otherUserId, content, };

socket.emit("privateMessage", msg); renderMessage({ ...msg, timestamp: new Date().toISOString() }); messageInput.value = ""; });

// Receive real-time private message socket.on("privateMessage", (msg) => { if (msg.senderId === otherUserId) { renderMessage(msg); chatBox.scrollTop = chatBox.scrollHeight; } });

// Convert to Today, Yesterday, or full date function getDateLabel(date) { const today = new Date(); const msgDate = new Date(date); const diff = today.setHours(0, 0, 0, 0) - msgDate.setHours(0, 0, 0, 0);

if (diff === 0) return "Today"; if (diff === 86400000) return "Yesterday"; return msgDate.toLocaleDateString(); }

// Render a single message function renderMessage(msg) { const msgDate = new Date(msg.createdAt || msg.timestamp || Date.now()); const dateLabel = getDateLabel(msgDate);

// Add date header if new day if (dateLabel !== lastRenderedDate) { const dateDiv = document.createElement("div"); dateDiv.className = "text-center text-xs text-gray-500 my-2"; dateDiv.textContent = dateLabel; dateDiv.dataset.date = dateLabel; chatBox.appendChild(dateDiv); lastRenderedDate = dateLabel; }

// Message bubble const div = document.createElement("div"); const time = msgDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

div.className = max-w-xs p-2 rounded-lg text-sm flex flex-col gap-1 ${ msg.senderId === currentUserId || msg.sender === currentUserId ? "bg-blue-600 text-white self-end ml-auto" : "bg-gray-300 text-black" }; div.dataset.date = dateLabel;

const content = document.createElement("div"); content.textContent = msg.content;

const timestamp = document.createElement("div"); timestamp.className = "text-xs text-gray-500 text-right"; timestamp.textContent = time;

div.appendChild(content); div.appendChild(timestamp); chatBox.appendChild(div); }

// Sticky date header on scroll chatBox.addEventListener("scroll", () => { const messages = Array.from(chatBox.children); let found = false;

for (let i = 0; i < messages.length; i++) { const el = messages[i]; const rect = el.getBoundingClientRect(); const top = rect.top - chatBox.getBoundingClientRect().top;

if (el.dataset.date && top > 0) {
  stickyDate.textContent = el.dataset.date;
  stickyDate.classList.remove("hidden");
  found = true;
  break;
}

}

if (!found) stickyDate.classList.add("hidden"); });

// Navigation function goHome() { window.location.href = "/home.html"; }

function openSettings() { window.location.href = private-chat-settings.html?id=${otherUserId}; }

