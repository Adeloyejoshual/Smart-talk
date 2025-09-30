document.addEventListener("DOMContentLoaded", () => {
  const socket = io({ auth: { token: localStorage.getItem("token") } });
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);

  const receiverId = urlParams.get("user");
  const groupId = urlParams.get("group");
  const isGroupChat = !!groupId;
  const chatId = isGroupChat ? groupId : receiverId;

  if (!token || !chatId) return window.location.href = "/home.html";

  let myUserId = null;
  let skip = 0, limit = 20, loading = false, isAtBottom = true, typingTimeout;

  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  // Get current user ID from JWT
  async function getMyUserId(token) {
    try { return JSON.parse(atob(token.split(".")[1])).id; } catch { return null; }
  }

  getMyUserId(token).then(id => {
    myUserId = id;
    if (isGroupChat) socket.emit("joinGroup", { groupId, userId: myUserId });
    else socket.emit("joinPrivateRoom", { sender: myUserId, receiverId });

    loadMessages(true);
  });

  // Scroll handling
  messageList.addEventListener("scroll", () => {
    const threshold = 100;
    isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
    if (!isGroupChat && messageList.scrollTop === 0 && !loading) loadMessages(false);
  });

  // Sending messages
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const msgData = { senderId: myUserId, receiverId, content, timestamp: Date.now() };

    if (isGroupChat) socket.emit("groupMessage", { groupId, senderId: myUserId, content });
    else socket.emit("private message", msgData);

    appendMessage({ ...msgData, senderName: "You" }, true);
    messageInput.value = "";
  });

  // Typing indicators
  if (!isGroupChat) {
    messageInput.addEventListener("input", () => {
      socket.emit("typing", { to: receiverId, from: myUserId });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => socket.emit("stopTyping", { to: receiverId, from: myUserId }), 2000);
    });
  }

  // File/Image uploads
  async function handleFileUpload(files, endpoint) {
    if (!files.length) return;
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));
    const res = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
    const data = await res.json();
    if (data.success && data.messages) data.messages.forEach(msg => appendMessage(msg, true));
  }
  imageInput.addEventListener("change", e => handleFileUpload([...e.target.files], isGroupChat ? `/api/messages/group/upload/${groupId}` : `/api/messages/private/upload`));
  fileInput.addEventListener("change", e => handleFileUpload([...e.target.files], isGroupChat ? `/api/messages/group/upload/${groupId}` : `/api/messages/private/upload`));

  // Socket listeners
  socket.on("private message", msg => {
    if (!isGroupChat && (msg.senderId === receiverId || msg.receiverId === receiverId)) {
      appendMessage(msg, isAtBottom);
    }
  });

  socket.on("groupMessage", msg => {
    if (isGroupChat && msg.groupId === groupId && msg.senderId !== myUserId) appendMessage(msg, isAtBottom);
  });

  socket.on("typing", ({ from }) => {
    if (!isGroupChat && from === receiverId && !messageList.contains(typingIndicator)) {
      messageList.appendChild(typingIndicator);
      scrollToBottom();
    }
  });
  socket.on("stopTyping", ({ from }) => {
    if (!isGroupChat && from === receiverId && messageList.contains(typingIndicator)) messageList.removeChild(typingIndicator);
  });

  // Append messages
  function appendMessage(msg, scroll = true) {
    const isMine = msg.senderId === myUserId || msg.senderName === "You";
    const li = document.createElement("li");
    li.className = `${isMine ? "sent" : "received"} mb-1`;

    const bubble = document.createElement("div");
    bubble.className = "bubble p-2 rounded-xl bg-gray-200 dark:bg-gray-800";
    bubble.innerHTML = `
      ${!isMine && msg.senderName ? `<strong>${msg.senderName}</strong><br>` : ""}
      ${msg.content || ""}
      ${msg.file ? `<a href="${msg.file}" target="_blank">${msg.fileType || "File"}</a>` : ""}
      <div class="meta text-xs opacity-60 text-right">${new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);
    if (scroll) scrollToBottom();
  }

  // Load messages
  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;
    try {
      const endpoint = isGroupChat ? `/api/messages/group-history/${groupId}` : `/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`;
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.messages?.length) {
        if (initial) messageList.innerHTML = "";
        data.messages.forEach(msg => appendMessage(msg, false));
        scrollToBottom();
        skip += data.messages.length;
      }
    } catch (err) { console.error(err); }
    finally { loading = false; }
  }

  function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }
});