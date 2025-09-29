document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");

  if (!token || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  let myUserId = null;
  let skip = 0, limit = 20, loading = false, isAtBottom = true;
  let typingTimeout;

  // DOM Elements
  const chatUsername = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const scrollDownBtn = document.getElementById("scrollDownBtn");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  // --- GET MY USER ID FROM TOKEN ---
  function getMyUserId(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id || payload.userId;
    } catch {
      return null;
    }
  }

  myUserId = getMyUserId(token);
  socket.emit("join", myUserId);

  // --- FETCH RECEIVER INFO ---
  fetch(`/api/users/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(user => {
      chatUsername.textContent = user.username || "Chat";
      statusIndicator.textContent = "Online"; // Optionally fetch last seen
    }).catch(() => { chatUsername.textContent = "Chat"; });

  // --- SCROLL ---
  messageList.addEventListener("scroll", () => {
    const threshold = 100;
    isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
    scrollDownBtn.classList.toggle("hidden", isAtBottom);

    if (messageList.scrollTop === 0 && !loading) loadMessages();
  });

  scrollDownBtn.addEventListener("click", () => {
    messageList.scrollTop = messageList.scrollHeight;
  });

  // --- LOAD MESSAGE HISTORY ---
  async function loadMessages() {
    if (loading) return;
    loading = true;

    try {
      const res = await fetch(`/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.messages.length) {
        data.messages.reverse().forEach(msg => appendMessage(msg, false));
        skip += data.messages.length;
        if (skip === data.messages.length) scrollToBottom();
      }
    } catch (err) { console.error("Failed to load messages", err); }
    finally { loading = false; }
  }

  // --- APPEND MESSAGE ---
  function appendMessage(msg, scroll = true) {
    const isMine = msg.senderId === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent" : "received"} relative group mb-1`;

    const bubble = document.createElement("div");
    bubble.className = "bubble rounded-xl p-2 max-w-[75%]";
    bubble.style.backgroundColor = isMine ? "#3b82f6" : "#e5e7eb";
    bubble.style.color = isMine ? "#fff" : "#000";
    bubble.innerHTML = `
      ${msg.content || ""}
      <div class="meta text-xs mt-1 opacity-60 text-right">
        ${new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);
    if (scroll) scrollToBottom();
  }

  function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }

  // --- SEND MESSAGE ---
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    // Emit via Socket.IO
    socket.emit("privateMessage", {
      senderId: myUserId,
      receiverId,
      content
    });

    // Optimistic append
    appendMessage({ senderId: myUserId, content, timestamp: Date.now() });
    messageInput.value = "";
  });

  // --- RECEIVE MESSAGE ---
  socket.on("privateMessage", (msg) => {
    if (msg.senderId === receiverId) appendMessage(msg);
  });

  // --- TYPING INDICATOR ---
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { senderId: myUserId, receiverId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { senderId: myUserId, receiverId });
    }, 2000);
  });

  socket.on("typing", ({ senderId }) => {
    if (senderId === receiverId && !messageList.contains(typingIndicator)) {
      messageList.appendChild(typingIndicator);
      scrollToBottom();
    }
  });

  socket.on("stopTyping", ({ senderId }) => {
    if (senderId === receiverId && messageList.contains(typingIndicator)) {
      messageList.removeChild(typingIndicator);
    }
  });

  // --- INITIAL LOAD ---
  loadMessages();
});