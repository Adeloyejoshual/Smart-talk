document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);

  // Determine chat type
  const receiverId = urlParams.get("user");
  const groupId = urlParams.get("group");
  const isGroupChat = !!groupId;
  const chatId = isGroupChat ? groupId : receiverId;

  if (!token || !chatId) {
    window.location.href = "/home.html";
    return;
  }

  let myUserId = null;
  let skip = 0, limit = 20, loading = false, isAtBottom = true, typingTimeout;

  // DOM Elements
  const usernameHeader = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");
  const scrollDownBtn = document.getElementById("scrollDownBtn");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  // Get current user ID from token
  async function getMyUserId(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id || payload.userId;
    } catch { return null; }
  }

  getMyUserId(token).then(id => {
    myUserId = id;

    if (isGroupChat) {
      socket.emit("joinGroup", { groupId, userId: myUserId });
      loadMessages(true);
    } else {
      socket.emit("join", myUserId);
      loadMessages(true);
      fetchUsername();
      fetchUserStatus();
    }
  });

  // Scroll handling
  messageList.addEventListener("scroll", () => {
    const threshold = 100;
    isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
    scrollDownBtn.classList.toggle("hidden", isAtBottom);

    if (!isGroupChat && messageList.scrollTop === 0 && !loading) loadMessages(false);
  });

  scrollDownBtn.addEventListener("click", scrollToBottom);

  // Send message
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    if (isGroupChat) {
      socket.emit("groupMessage", { groupId, senderId: myUserId, content });
      appendMessage({ sender: "You", content, timestamp: Date.now() }, true, true, true);
    } else {
      await sendPrivateMessage(content);
    }
    messageInput.value = "";
  });

  // Typing
  if (!isGroupChat) {
    messageInput.addEventListener("input", () => {
      socket.emit("typing", { to: receiverId, from: myUserId });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => socket.emit("stopTyping", { to: receiverId, from: myUserId }), 2000);
    });
  }

  // File uploads
  async function handleFileUpload(files, endpoint) {
    if (!files.length) return;
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    if (!isGroupChat) formData.append("receiverId", receiverId);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success && data.messages) {
      data.messages.forEach(msg => appendMessage(msg, true, !isGroupChat, isGroupChat));
      scrollToBottom();
    }
  }

  imageInput.addEventListener("change", e => handleFileUpload([...e.target.files], isGroupChat ? `/api/messages/group/upload/${groupId}` : `/api/messages/private/upload`));
  fileInput.addEventListener("change", e => handleFileUpload([...e.target.files], isGroupChat ? `/api/messages/group/upload/${groupId}` : `/api/messages/private/upload`));

  // Socket listeners
  socket.on("privateMessage", msg => {
    if (!isGroupChat && (msg.senderId === receiverId || msg.sender === receiverId)) {
      appendMessage(msg, isAtBottom, true, false);
      if (isAtBottom) scrollToBottom();
    }
  });

  socket.on("groupMessage", msg => {
    if (isGroupChat && msg.groupId === groupId && msg.senderId !== myUserId) {
      appendMessage(msg, isAtBottom, true, true);
      if (isAtBottom) scrollToBottom();
    }
  });

  socket.on("typing", ({ from }) => {
    if (!isGroupChat && from === receiverId && !messageList.contains(typingIndicator)) {
      messageList.appendChild(typingIndicator);
      scrollToBottom();
    }
  });

  socket.on("stopTyping", ({ from }) => {
    if (!isGroupChat && from === receiverId && messageList.contains(typingIndicator)) {
      messageList.removeChild(typingIndicator);
    }
  });

  // Functions
  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;
    try {
      let res, data;
      if (isGroupChat) {
        res = await fetch(`/api/messages/group-history/${groupId}`, { headers: { Authorization: `Bearer ${token}` } });
        data = await res.json();
        if (data.success && data.messages) {
          messageList.innerHTML = "";
          data.messages.forEach(msg => appendMessage(msg, false, true, true));
          scrollToBottom();
        }
      } else {
        res = await fetch(`/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } });
        data = await res.json();
        if (data.success && data.messages.length) {
          if (initial) messageList.innerHTML = "";
          data.messages.reverse().forEach(msg => appendMessage(msg, false, true, false));
          if (initial) scrollToBottom();
          skip += data.messages.length;
        }
      }
    } catch (err) { console.error(err); }
    finally { loading = false; }
  }

  function appendMessage(msg, scroll = true, playSound = false, isGroup = false) {
    const isMine = msg.senderId === myUserId || msg.sender === myUserId || msg.sender === "You";
    const li = document.createElement("li");
    li.className = `${isMine ? "sent self-end" : "received self-start"} relative group mb-1`;

    const bubble = document.createElement("div");
    bubble.className = "bubble bg-white dark:bg-gray-800 rounded-xl p-2 max-w-[75%]";
    bubble.innerHTML = `
      ${isGroup && !isMine ? `<strong>${msg.senderName || "User"}</strong><br>` : ""}
      ${msg.content || ""}
      ${msg.image ? `<img src="${msg.image}" class="max-w-40 rounded mt-1"/>` : ""}
      ${msg.file ? `<a href="${msg.file}" target="_blank" class="block mt-1 text-blue-600 underline">${msg.fileType || "File"}</a>` : ""}
      <div class="meta text-xs mt-1 opacity-60 text-right">
        ${new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);

    if (scroll) scrollToBottom();
    if (!isMine && playSound && localStorage.getItem("notificationEnabled") === "true") {
      const src = `/sounds/${localStorage.getItem("notificationSound") || "sound01.mp3"}`;
      if (src) new Audio(src).play().catch(() => console.log("Notification sound blocked"));
    }
  }

  async function sendPrivateMessage(content) {
    const res = await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipientId: receiverId, content })
    });
    const data = await res.json();
    if (data.success && data.message) appendMessage(data.message, true, false, false);
  }

  async function fetchUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const user = await res.json();
      usernameHeader.textContent = user.username || user.name || "Chat";
    } catch { usernameHeader.textContent = "Chat"; }
  }

  async function fetchUserStatus() {
    try {
      const res = await fetch(`/api/users/status/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      statusIndicator.textContent = data.status || "Offline";
    } catch { statusIndicator.textContent = "Unknown"; }
  }

  function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }
});