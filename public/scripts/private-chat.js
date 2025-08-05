// /public/js/private-chat.js const socket = io(); let userId = null; let otherUserId = null; let token = localStorage.getItem("token");

const chatBox = document.getElementById("chat-box"); const messageForm = document.getElementById("message-form"); const messageInput = document.getElementById("message-input"); const imageUpload = document.getElementById("image-upload"); const usernameHeader = document.getElementById("chat-username"); const typingIndicator = document.getElementById("typing-indicator");

// Parse URL to get otherUserId const urlParams = new URLSearchParams(window.location.search); otherUserId = urlParams.get("id");

// Get current user async function getCurrentUser() { const res = await fetch("/api/users/me", { headers: { Authorization: Bearer ${token} }, }); const user = await res.json(); userId = user._id; socket.emit("join", userId); return user; }

// Load messages async function loadMessages() { const res = await fetch(/api/messages/private/${otherUserId}, { headers: { Authorization: Bearer ${token} }, }); const messages = await res.json(); chatBox.innerHTML = ""; let currentDate = null;

messages.forEach((msg) => { const date = new Date(msg.createdAt).toDateString(); if (date !== currentDate) { const dateDiv = document.createElement("div"); dateDiv.className = "sticky top-0 text-center text-xs bg-gray-300 dark:bg-gray-700 py-1 rounded"; dateDiv.textContent = date; chatBox.appendChild(dateDiv); currentDate = date; }

const msgDiv = document.createElement("div");
msgDiv.className = `p-2 rounded max-w-[75%] whitespace-pre-line break-words mb-1 ${
  msg.sender === userId ? "bg-blue-500 text-white self-end ml-auto" : "bg-gray-300 dark:bg-gray-600 text-black dark:text-white"
}`;
msgDiv.dataset.messageId = msg._id;

if (msg.image) {
  const img = document.createElement("img");
  img.src = msg.image;
  img.className = "w-40 h-auto rounded mb-1 cursor-pointer";
  img.onclick = () => window.open(img.src, "_blank");
  msgDiv.appendChild(img);
}

if (msg.content) {
  const text = document.createElement("p");
  text.textContent = msg.content;
  msgDiv.appendChild(text);
}

// Right-click or long press to copy
msgDiv.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  navigator.clipboard.writeText(msg.content || "").then(() => {
    alert("Copied message to clipboard");
  });
});

// Swipe to delete (mobile)
let startX;
msgDiv.addEventListener("touchstart", (e) => startX = e.touches[0].clientX);
msgDiv.addEventListener("touchend", (e) => {
  const diff = e.changedTouches[0].clientX - startX;
  if (Math.abs(diff) > 50 && msg.sender === userId) {
    deleteMessage(msg._id);
  }
});

chatBox.appendChild(msgDiv);

});

chatBox.scrollTop = chatBox.scrollHeight; }

// Send message messageForm.addEventListener("submit", async (e) => { e.preventDefault(); const content = messageInput.value; if (!content.trim()) return;

socket.emit("privateMessage", { senderId: userId, receiverId: otherUserId, content, });

await fetch(/api/messages/private/send, { method: "POST", headers: { "Content-Type": "application/json", Authorization: Bearer ${token}, }, body: JSON.stringify({ recipientId: otherUserId, content }), });

messageInput.value = ""; loadMessages(); });

// Handle image upload imageUpload.addEventListener("change", async () => { const file = imageUpload.files[0]; if (!file) return; const formData = new FormData(); formData.append("file", file); formData.append("receiverId", otherUserId);

await fetch("/api/messages/file", { method: "POST", headers: { Authorization: Bearer ${token} }, body: formData, });

imageUpload.value = ""; loadMessages(); });

// Receive new message socket.on("privateMessage", (data) => { if (data.senderId === otherUserId) loadMessages(); });

// Navigation function goHome() { window.location.href = "/home.html"; }

// Delete message async function deleteMessage(id) { const ok = confirm("Delete this message?"); if (!ok) return; await fetch(/api/messages/${id}, { method: "DELETE", headers: { Authorization: Bearer ${token} }, }); loadMessages(); }

// Init getCurrentUser().then(async (me) => { const res = await fetch(/api/users/${otherUserId}); const user = await res.json(); usernameHeader.textContent = user.username || "Chat"; loadMessages(); });

