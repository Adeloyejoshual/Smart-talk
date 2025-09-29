const socket = io();
const token = localStorage.getItem("token");
const receiverId = localStorage.getItem("chatUserId"); 
const senderId = localStorage.getItem("userId");
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const fileInput = document.getElementById("fileInput");

// 📜 Load old messages
async function loadMessages() {
  const res = await fetch(`/api/messages/history/${receiverId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const messages = await res.json();

  chatBox.innerHTML = "";
  messages.forEach(msg => renderMessage(msg));
  scrollToBottom();
}

// 📝 Render message
function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message", msg.sender._id === senderId ? "sent" : "received");

  let content = `<p>${msg.content}</p>`;
  if (msg.type === "image") content = `<img src="${msg.fileUrl}" class="chat-img" />`;
  if (msg.type === "file") content = `<a href="${msg.fileUrl}" target="_blank">📂 File</a>`;

  div.innerHTML = `
    <span class="username">${msg.sender.username}</span>
    ${content}
    <span class="time">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
  `;

  chatBox.appendChild(div);
}

// 📩 Send text
sendBtn.addEventListener("click", async () => {
  const content = messageInput.value.trim();
  if (!content) return;

  const res = await fetch("/api/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receiverId, content, type: "text" })
  });
  const msg = await res.json();

  socket.emit("sendMessage", msg);
  renderMessage(msg);
  messageInput.value = "";
  scrollToBottom();
});

// 📂 Send file
fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const fileUrl = URL.createObjectURL(file);
  const type = file.type.startsWith("image/") ? "image" : "file";

  const res = await fetch("/api/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receiverId, content: file.name, type, fileUrl })
  });
  const msg = await res.json();

  socket.emit("sendMessage", msg);
  renderMessage(msg);
  scrollToBottom();
});

// 🔄 Receive real-time
socket.on("receiveMessage", (msg) => {
  if (msg.sender._id === receiverId) {
    renderMessage(msg);
    scrollToBottom();
  }
});

// Auto-scroll
function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Load on start
loadMessages();