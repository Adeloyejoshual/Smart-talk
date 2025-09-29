document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");

  if (!token || !receiverId) window.location.href = "/home.html";

  let myUserId = null;
  let typingTimeout;
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  async function getMyUserId(token) {
    try { return JSON.parse(atob(token.split(".")[1])).id; }
    catch { return null; }
  }

  getMyUserId(token).then(id => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages(true);
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
    if (data._id) appendMessage(data, true);
    messageInput.value = "";
  });

  // SEND FILES
  async function sendFiles(files) {
    if (!files.length) return;
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
    formData.append("receiverId", receiverId);

    const res = await fetch(`/api/messages/private/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) data.messages.forEach(msg => appendMessage(msg, true));
  }

  imageInput.addEventListener("change", e => sendFiles([...e.target.files]));
  fileInput.addEventListener("change", e => sendFiles([...e.target.files]));

  // TYPING INDICATOR
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit("stopTyping", { to: receiverId, from: myUserId }), 1500);
  });

  socket.on("typing", ({ from }) => {
    if (from === receiverId && !messageList.contains(typingIndicator)) messageList.appendChild(typingIndicator);
  });
  socket.on("stopTyping", ({ from }) => {
    if (from === receiverId && messageList.contains(typingIndicator)) messageList.removeChild(typingIndicator);
  });

  // RECEIVE MESSAGE
  socket.on("privateMessage", msg => {
    if (msg.senderId === receiverId || msg.sender === receiverId) appendMessage(msg, true);
  });

  function appendMessage(msg, scroll = true) {
    const isMine = msg.senderId === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent self-start" : "received self-end"} mb-1 relative`;

    const bubble = document.createElement("div");
    bubble.className = "bubble rounded-xl p-2 max-w-[75%]";

    if (isMine) bubble.classList.add("bg-blue-600", "text-white", "border-tl-0");
    else bubble.classList.add("bg-gray-200", "text-black", "border-tr-0");

    bubble.innerHTML = `
      ${msg.content || ""}
      ${msg.image ? `<img src="${msg.image}" class="max-w-40 mt-1 rounded"/>` : ""}
      ${msg.file ? `<a href="${msg.file}" target="_blank" class="block mt-1 text-blue-600 underline">${msg.fileType || "File"}</a>` : ""}
      <div class="text-xs mt-1 opacity-60 text-right">${new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);
    if (scroll) messageList.scrollTop = messageList.scrollHeight;
  }

  // LOAD HISTORY
  async function loadMessages() {
    const res = await fetch(`/api/messages/history/${receiverId}?skip=0&limit=50`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) data.messages.reverse().forEach(msg => appendMessage(msg, false));
    messageList.scrollTop = messageList.scrollHeight;
  }
});