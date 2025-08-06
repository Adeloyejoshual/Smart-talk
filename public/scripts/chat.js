document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");
  const messageList = document.getElementById("messageList");
  const usernameHeader = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");
  const backButton = document.getElementById("backButton");

  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");
  let myUserId = null;
  let skip = 0;
  const limit = 20;
  let loading = false;
  let typingTimeout;

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  if (!token || !receiverId) return (window.location.href = "/home.html");

  getMyUserId(token).then((id) => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages(true);
    fetchUsername();
    fetchUserStatus();
  });

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    await sendMessage({ content });
    messageInput.value = "";
  });

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 2000);
  });

  imageInput.addEventListener("change", async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));

    const res = await fetch(`/api/messages/private/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (data.success && data.messages) {
      data.messages.forEach(async (msg) => {
        await sendMessage({ content: `<img src='${msg.image}' class='w-40 rounded'/>` });
      });
    }
  });

  fileInput.addEventListener("change", async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const res = await fetch(`/api/messages/private/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (data.success && data.messages) {
      data.messages.forEach(async (msg) => {
        await sendMessage({ content: `<a href="${msg.file}" target="_blank">${msg.fileType}</a>` });
      });
    }
  });

  socket.on("privateMessage", (msg) => {
    if (msg.senderId === receiverId || msg.sender === receiverId) {
      appendMessage(msg, true);
      scrollToBottom();
    }
  });

  socket.on("typing", ({ from }) => {
    if (from === receiverId && !messageList.contains(typingIndicator)) {
      messageList.appendChild(typingIndicator);
      scrollToBottom();
    }
  });

  socket.on("stopTyping", ({ from }) => {
    if (from === receiverId && messageList.contains(typingIndicator)) {
      messageList.removeChild(typingIndicator);
    }
  });

  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;
    try {
      const res = await fetch(`/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.messages) {
        if (initial) messageList.innerHTML = "";
        data.messages.reverse().forEach((msg) => {
          appendMessage(msg, false);
        });
        if (initial) scrollToBottom();
        skip += data.messages.length;
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      loading = false;
    }
  }

  messageList.addEventListener("scroll", () => {
    if (messageList.scrollTop === 0 && !loading) {
      loadMessages(false);
    }
  });

  async function fetchUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const user = await res.json();
      usernameHeader.textContent = user.username || user.name || "Chat";
    } catch (err) {
      usernameHeader.textContent = "Chat";
    }
  }

  async function fetchUserStatus() {
    try {
      const res = await fetch(`/api/users/status/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const statusText = data.status === 'online' ? '🟢 Online' : data.status === 'offline' ? `Last seen ${data.lastSeen}` : 'Unknown';
      statusIndicator.textContent = statusText;
    } catch (err) {
      console.error("Error fetching user status:", err);
    }
  }

  function appendMessage(msg, toBottom) {
    const isMine = msg.senderId === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent self-end" : "received self-start"} relative group`;

    const bubble = document.createElement("div");
    bubble.className = "bubble bg-white dark:bg-gray-800 rounded-xl p-2 max-w-[75%]";
    bubble.innerHTML = `
      ${msg.content || ''}
      <div class="meta text-xs mt-1 opacity-60 text-right">
        ${new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    `;

    li.appendChild(bubble);
    messageList.appendChild(li);
  }

  async function sendMessage({ content }) {
    await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipientId: receiverId, content }),
    });
  }

  async function getMyUserId(token) {
    try {
      const res = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      return user._id;
    } catch {
      return null;
    }
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }
});