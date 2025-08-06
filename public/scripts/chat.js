// /public/scripts/chat.js
const socket = io(); let userId = null; let otherUserId = null; let token = localStorage.getItem("token");

const chatBox = document.getElementById("chat-box"); const messageForm = document.getElementById("message-form"); const messageInput = document.getElementById("message-input"); const imageUpload = document.getElementById("image-upload"); const usernameHeader = document.getElementById("chat-username"); const typingIndicator = document.getElementById("typing-indicator");

// Parse URL to get otherUserId const urlParams = new URLSearchParams(window.location.search); otherUserId = urlParams.get("id");

// Get current user async function getCurrentUser() { const res = await fetch("/api/users/me", { headers: { Authorization: Bearer ${token} }, }); const user = await res.json(); userId = user._id; socket.emit("join", userId); return user; }

// Load messages async function loadMessages() { try { const res = await fetch(/api/messages/history/${otherUserId}, { headers: { Authorization: Bearer ${token} }, }); const data = await res.json(); const messages = data.messages || [];

chatBox.innerHTML = "";
let currentDate = null;

messages.forEach((msg) => {
  const date = new Date(msg.createdAt).toDateString();
  if (date !== currentDate) {
    const dateDiv = document.createElement("div");
    dateDiv.className = "sticky top-0 text-center text-xs bg-blue-200 dark:bg-blue-700 py-1 rounded";
    dateDiv.textContent = date;
    chatBox.appendChild(dateDiv);
    currentDate = date;
  }

  const msgDiv = document.createElement("div");
  msgDiv.className = `p-2 rounded max-w-[75%] mb-1 ${
    msg.sender === userId
      ? "bg-blue-500 text-white self-end ml-auto"
      : "bg-blue-200 dark:bg-blue-600 text-black dark:text-white"
  }`;

  if (msg.image) {
    const img = document.createElement("img");
    img.src = msg.image;
    img.className = "w-40 h-auto rounded";
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

} catch (err) { console.error("❌ Failed to load messages:", err); } }

// Send message messageForm.addEventListener("submit", async (e) => { e.preventDefault(); const content = messageInput.value; if (!content.trim()) return;

socket.emit("privateMessage", { senderId: userId, receiverId: otherUserId, content, });

await fetch(/api/messages/private/send, { method: "POST", headers: { "Content-Type": "application/json", Authorization: Bearer ${token}, }, body: JSON.stringify({ recipientId: otherUserId, content }), });

messageInput.value = ""; loadMessages(); });

// Handle image upload imageUpload?.addEventListener("change", async () => { const file = imageUpload.files[0]; if (!file) return; const formData = new FormData(); formData.append("file", file); formData.append("receiverId", otherUserId);

await fetch("/api/messages/file", { method: "POST", headers: { Authorization: Bearer ${token}, }, body: formData, });

imageUpload.value = ""; loadMessages(); });

// Receive new message socket.on("privateMessage", (data) => { if (data.senderId === otherUserId || data.receiverId === otherUserId) { loadMessages(); } });

// Navigation document.getElementById("backButton")?.addEventListener("click", () => { window.location.href = "/home.html"; });

// Init getCurrentUser().then(async (me) => { const res = await fetch(/api/users/${otherUserId}, { headers: { Authorization: Bearer ${token} }, }); const user = await res.json(); usernameHeader.textContent = user.username || user.name || "Chat"; loadMessages(); });

