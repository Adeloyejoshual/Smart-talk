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
  const chatUsername = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  async function getMyUserId(token) {
    try { return JSON.parse(atob(token.split(".")[1])).id; } catch { return null; }
  }

  getMyUserId(token).then(async id => {
    myUserId = id;
    socket.emit("join", myUserId);
    await fetchUsername();
    await fetchUserStatus();
    loadMessages();
  });

  async function fetchUsername() {
    const res = await fetch(`/api/users/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
    const user = await res.json();
    chatUsername.textContent = user.username || "Chat";
  }

  async function fetchUserStatus() {
    const res = await fetch(`/api/users/status/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    statusIndicator.textContent = data.status === "online" ? "🟢 Online" : "Offline";
  }

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
    if (data.success && data.message) appendMessage(data.message, true);
    messageInput.value = "";
  });

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

  socket.on("privateMessage", msg => {
    if (msg.senderId === receiverId || msg.senderId === myUserId) appendMessage(msg, true);
  });

  function appendMessage(msg, scroll = true) {
    const isMine = msg.senderId === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent self-start" : "received self-end"} mb-1 relative`;

    // Date separator
    const msgDate = new Date(msg.createdAt || msg.timestamp).toDateString();
    const lastMessageDate = messageList.lastChild?.dataset?.date;
    if (lastMessageDate !== msgDate) {
      const dateLi = document.createElement("li");
      dateLi.className = "text-center text-xs text-gray-400 my-1";
      dateLi.textContent = msgDate === new Date().toDateString() ? "Today" :
                           msgDate === new Date(Date.now()-86400000).toDateString() ? "Yesterday" :
                           msgDate;
      messageList.appendChild(dateLi);
    }
    li.dataset.date = msgDate;

    // Message bubble
    const bubble = document.createElement("div");
    bubble.className = "bubble rounded-xl p-2 max-w-[75%]";
    if (isMine) bubble.classList.add("bg-blue-600", "text-white", "border-tl-0");
    else bubble.classList.add("bg-gray-200", "text-black", "border-tr-0");

    if (!isMine) {
      const header = document.createElement("div");
      header.className = "text-xs opacity-70 mb-1";
      header.innerHTML = `<strong>${msg.senderName || "User"}</strong>`;
      bubble.appendChild(header);
    }

    if (msg.content) bubble.appendChild(document.createTextNode(msg.content));
    if (msg.image) {
      const img = document.createElement("img");
      img.src = msg.image;
      img.className = "max-w-full mt-1 rounded cursor-pointer";
      bubble.appendChild(img);
    }
    if (msg.file) {
      const a = document.createElement("a");
      a.href = msg.file;
      a.target = "_blank";
      a.textContent = msg.fileType || "File";
      a.className = "block mt-1 text-blue-600 underline";
      bubble.appendChild(a);
    }

    const timeDiv = document.createElement("div");
    timeDiv.className = "text-xs mt-1 opacity-60 text-right";
    const t = new Date(msg.createdAt || msg.timestamp);
    timeDiv.textContent = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    bubble.appendChild(timeDiv);

    li.appendChild(bubble);
    messageList.appendChild(li);
    if (scroll) messageList.scrollTop = messageList.scrollHeight;
  }

  async function loadMessages() {
    const res = await fetch(`/api/messages/history/${receiverId}?skip=0&limit=50`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) data.messages.reverse().forEach(msg => appendMessage(msg, false));
    messageList.scrollTop = messageList.scrollHeight;
  }
});