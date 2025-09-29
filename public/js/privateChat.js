document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user"); // ?user=<id>
  if (!token || !receiverId) window.location.href = "/home.html";

  let myUserId = null;
  let skip = 0, limit = 20, loading = false, isAtBottom = true;
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");
  const scrollDownBtn = document.getElementById("scrollDownBtn");
  const chatUsername = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");
  const contactModal = document.getElementById("contact-modal");
  const contactBackBtn = document.getElementById("contact-back-btn");
  const contactBio = document.getElementById("contact-bio");

  const typingIndicator = document.createElement("li");
  typingIndicator.textContent = "Typing...";
  typingIndicator.className = "italic text-sm text-gray-500 px-2";

  // --- Get current userId from JWT ---
  async function getMyUserId(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id || payload.userId;
    } catch { return null; }
  }

  getMyUserId(token).then(async id => {
    myUserId = id;
    socket.emit("join", myUserId);
    await loadMessages(true);
    fetchUsername();
    fetchUserStatus();
  });

  // --- Load message history ---
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
        data.messages.reverse().forEach(msg => appendMessage(msg));
        if (initial) scrollToBottom();
        skip += data.messages.length;
      }
    } catch (err) { console.error(err); }
    finally { loading = false; }
  }

  // --- Append message to DOM ---
  function appendMessage(msg, scroll = true) {
    const li = document.createElement("li");
    const isMine = msg.senderId === myUserId;
    li.className = isMine ? "sent self-end mb-1" : "received self-start mb-1";

    const bubble = document.createElement("div");
    bubble.className = "bubble p-2 max-w-[75%] rounded-xl";
    bubble.style.backgroundColor = isMine ? "#3b82f6" : "#e5e7eb";
    bubble.style.color = isMine ? "white" : "black";
    bubble.innerHTML = `
      ${msg.content || ""}
      <div class="meta text-xs mt-1 opacity-60 text-right">
        ${new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
      </div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);
    if (scroll) scrollToBottom();
  }

  // --- Send message ---
  messageForm.addEventListener("submit", async e => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;
    socket.emit("privateMessage", { senderId: myUserId, receiverId, content });
    appendMessage({ senderId: myUserId, content, timestamp: Date.now() });
    messageInput.value = "";
  });

  // --- Receive message ---
  socket.on("privateMessage", msg => {
    if (msg.senderId === receiverId) appendMessage(msg);
  });

  // --- Typing indicator ---
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { receiverId, senderId: myUserId });
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

  // --- Scroll ---
  messageList.addEventListener("scroll", () => {
    const threshold = 100;
    isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
    scrollDownBtn.classList.toggle("hidden", isAtBottom);
    if (messageList.scrollTop === 0 && !loading) loadMessages(false);
  });
  scrollDownBtn.addEventListener("click", scrollToBottom);
  function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }

  // --- Fetch chat partner info ---
  async function fetchUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const user = await res.json();
      chatUsername.textContent = user.username || user.name || "Chat";
      contactBio.textContent = user.bio || "No bio available";
    } catch { chatUsername.textContent = "Chat"; }
  }
  async function fetchUserStatus() {
    try {
      const res = await fetch(`/api/users/status/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      statusIndicator.textContent = data.status === "online" ? "🟢 Online" : "Offline";
    } catch { statusIndicator.textContent = "Offline"; }
  }

  // --- Contact modal ---
  chatUsername.addEventListener("click", () => contactModal.classList.remove("hidden"));
  contactBackBtn.addEventListener("click", () => contactModal.classList.add("hidden"));

});