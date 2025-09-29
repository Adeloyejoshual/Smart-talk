document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");

  if (!token || !receiverId) window.location.href = "/home.html";

  let myUserId = null;
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  async function getMyUserId(token) {
    try { return JSON.parse(atob(token.split(".")[1])).id; } 
    catch { return null; }
  }

  getMyUserId(token).then(id => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages();
  });

  // SEND TEXT MESSAGE
  messageForm.addEventListener("submit", async e => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const res = await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipientId, content })
    });

    const data = await res.json();
    if (data.success) appendMessage(data.message);
    messageInput.value = "";
  });

  // SEND FILES
  async function sendFiles(files) {
    if (!files.length) return;
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    formData.append("receiverId", receiverId);

    const res = await fetch("/api/messages/private/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    if (data.success) data.messages.forEach(msg => appendMessage(msg));
  }

  imageInput.addEventListener("change", e => sendFiles([...e.target.files]));
  fileInput.addEventListener("change", e => sendFiles([...e.target.files]));

  // RECEIVE MESSAGE
  socket.on("privateMessage", msg => appendMessage(msg));

  function appendMessage(msg) {
    const isMine = msg.senderId === myUserId;
    const li = document.createElement("li");
    li.className = `mb-2 flex ${isMine ? "justify-start" : "justify-end"}`;

    li.innerHTML = `
      <div class="rounded-xl p-2 max-w-[70%] ${isMine ? "bg-blue-600 text-white" : "bg-gray-200 text-black"}">
        ${!isMine ? `<strong>${msg.senderName || "Unknown"}</strong><br>` : ""}
        ${msg.content || ""}
        ${msg.image ? `<img src="${msg.image}" class="max-w-40 mt-1 rounded"/>` : ""}
        ${msg.file ? `<a href="${msg.file}" target="_blank" class="block mt-1 text-blue-600 underline">${msg.fileType || "File"}</a>` : ""}
        <div class="text-xs opacity-50 mt-1 text-right">${new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
    `;
    messageList.appendChild(li);
    messageList.scrollTop = messageList.scrollHeight;
  }

  // LOAD CHAT HISTORY
  async function loadMessages() {
    const res = await fetch(`/api/messages/history/${receiverId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) data.messages.forEach(msg => appendMessage(msg));
  }
});