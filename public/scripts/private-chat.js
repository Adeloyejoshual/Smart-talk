document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");
  if (!token || !receiverId) { window.location.href = "/home.html"; return; }

  let myUserId = null;
  let skip = 0, limit = 20, loading = false, isAtBottom = true, typingTimeout;

  // DOM
  const chatHeader = document.getElementById("chat-header");
  const usernameHeader = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  // Get current user ID
  async function getMyUserId(token) {
    try { const payload = JSON.parse(atob(token.split(".")[1])); return payload.id || payload.userId; } 
    catch { return null; }
  }

  getMyUserId(token).then(id => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages(true);
    fetchUsername();
    fetchUserStatus();
  });

  // Scroll
  messageList.addEventListener("scroll", () => {
    const threshold = 100;
    isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
    if (messageList.scrollTop === 0 && !loading) loadMessages(false);
  });

  // Send message
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;
    await sendPrivateMessage(content);
    messageInput.value = "";
  });

  // Typing
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit("stopTyping", { to: receiverId, from: myUserId }), 2000);
  });

  // Socket listeners
  socket.on("privateMessage", msg => {
    if (msg.senderId === receiverId || msg.sender === receiverId) appendMessage(msg, isAtBottom, true);
  });
  socket.on("typing", ({ from }) => {
    if (from === receiverId && !messageList.contains(typingIndicator)) {
      messageList.appendChild(typingIndicator); scrollToBottom();
    }
  });
  socket.on("stopTyping", ({ from }) => {
    if (from === receiverId && messageList.contains(typingIndicator)) messageList.removeChild(typingIndicator);
  });

  // Functions
  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;
    try {
      const res = await fetch(`/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.messages.length) {
        if (initial) messageList.innerHTML = "";
        data.messages.reverse().forEach(msg => appendMessage(msg, false, true));
        if (initial) scrollToBottom();
        skip += data.messages.length;
      }
    } catch (err) { console.error(err); }
    finally { loading = false; }
  }

  function appendMessage(msg, scroll = true, playSound = false) {
    const isMine = msg.senderId === myUserId || msg.sender === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent" : "received"} relative mb-1`;

    const bubble = document.createElement("div");
    bubble.className = "bubble p-2 rounded max-w-[75%] bg-white dark:bg-gray-800";
    bubble.innerHTML = `
      ${!isMine ? `<strong>${msg.senderName || "User"}</strong><br>` : ""}
      ${msg.content || ""}
      <div class="meta text-xs mt-1 opacity-60 text-right">
        ${new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);
    if (scroll) scrollToBottom();
  }

  async function sendPrivateMessage(content) {
    const res = await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipientId: receiverId, content })
    });
    const data = await res.json();
    if (data.success && data.message) appendMessage(data.message, true, false);
  }

  async function fetchUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const user = await res.json();
      usernameHeader.textContent = user.username || "Chat";
    } catch { usernameHeader.textContent = "Chat"; }
  }

  async function fetchUserStatus() {
    try {
      const res = await fetch(`/api/users/status/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      statusIndicator.textContent = data.status === "online" ? "🟢 Online" : "Offline";
    } catch { statusIndicator.textContent = "Unknown"; }
  }

  function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }
});