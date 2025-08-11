document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");
  let myUserId = null;

  // DOM Elements
  const chatHeader = document.getElementById("chat-header");
  const usernameHeader = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");
  const scrollDownBtn = document.getElementById("scrollDownBtn");

  // Menu buttons
  const btnSearchChat = document.getElementById("menu-search-chat");
  const btnMuteNotif = document.getElementById("menu-mute-notif");
  const btnMediaDocs = document.getElementById("menu-media-docs");
  const btnChatTheme = document.getElementById("menu-chat-theme");
  const btnMore = document.getElementById("menu-more");

  // More submenu buttons
  const btnBlockUser = document.getElementById("more-block");
  const btnClearChat = document.getElementById("more-clear-chat");
  const btnExportChat = document.getElementById("more-export-chat");
  const btnReportUser = document.getElementById("more-report-user");

  // View Contact modal elements
  const contactModal = document.getElementById("contact-modal");
  const contactBackBtn = document.getElementById("contact-back-btn");
  const contactBio = document.getElementById("contact-bio");

  let skip = 0;
  const limit = 20;
  let loading = false;
  let isAtBottom = true;
  let typingTimeout;
  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  if (!token || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  // Join socket and load initial data
  getMyUserId(token).then((id) => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages(true);
    fetchUsername();
    fetchUserStatus();
  });

  // Scroll handling for showing scroll down button & loading more messages
  messageList.addEventListener("scroll", () => {
    // Show scroll down button if not near bottom
    const threshold = 100;
    isAtBottom =
      messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
    if (!isAtBottom) scrollDownBtn.classList.remove("hidden");
    else scrollDownBtn.classList.add("hidden");

    // Load more on scroll top
    if (messageList.scrollTop === 0 && !loading) loadMessages(false);
  });

  scrollDownBtn.addEventListener("click", () => {
    scrollToBottom();
  });

  // Message form submit (send text)
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    await sendMessage({ content });
    messageInput.value = "";
  });

  // Typing indicator events
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 2000);
  });

  // Image upload
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
      data.messages.forEach((msg) => {
        appendMessage(msg, true);
      });
      scrollToBottom();
    }
    imageInput.value = "";
  });

  // File upload
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
      data.messages.forEach((msg) => {
        appendMessage(msg, true);
      });
      scrollToBottom();
    }
    fileInput.value = "";
  });

  // Socket listeners
  socket.on("privateMessage", (msg) => {
    if (msg.senderId === receiverId || msg.sender === receiverId) {
      appendMessage(msg, isAtBottom);
      if (isAtBottom) scrollToBottom();
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

  // Menu buttons functionality

  btnSearchChat.addEventListener("click", () => {
    const term = prompt("Search chat messages:");
    if (!term) return;

    // Simple search + highlight
    const messages = messageList.querySelectorAll("li .bubble");
    messages.forEach((bubble) => {
      bubble.innerHTML = bubble.textContent.replace(
        new RegExp(term, "gi"),
        (match) => `<mark>${match}</mark>`
      );
    });
  });

  btnMuteNotif.addEventListener("click", () => {
    const choice = prompt("Mute notifications:\n1) 8 hours\n2) 1 week\n3) Always\nEnter choice number:");
    if (!choice) return;
    alert(`Notifications muted for option ${choice}`);
  });

  btnMediaDocs.addEventListener("click", () => {
    alert("Show media, links and docs screen (to be implemented)");
  });

  btnChatTheme.addEventListener("click", () => {
    alert("Theme picker modal (to be implemented)");
  });

  btnMore.addEventListener("click", () => {
    const moreMenu = document.getElementById("more-menu");
    moreMenu.classList.toggle("hidden");
  });

  btnBlockUser.addEventListener("click", () => {
    if (confirm("Block this user?")) alert("User blocked (to be implemented)");
  });

  btnClearChat.addEventListener("click", () => {
    if (confirm("Clear chat? This will only clear your messages.")) {
      clearMyMessages();
    }
  });

  btnExportChat.addEventListener("click", () => {
    alert("Export chat feature coming soon.");
  });

  btnReportUser.addEventListener("click", () => {
    alert("User reported (to be implemented).");
  });

  // View Contact Modal - open by clicking username header
  usernameHeader.addEventListener("click", () => {
    fetch(`/api/users/${receiverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((user) => {
        contactBio.textContent = user.bio || "No bio available";
        contactModal.classList.remove("hidden");
      })
      .catch(() => {
        contactBio.textContent = "Failed to load bio";
        contactModal.classList.remove("hidden");
      });
  });

  contactBackBtn.addEventListener("click", () => {
    contactModal.classList.add("hidden");
  });

  // Functions

  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;

    try {
      const res = await fetch(`/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.messages.length) {
        if (initial) messageList.innerHTML = "";

        // Insert date separators
        let lastDate = null;
        data.messages.reverse().forEach((msg) => {
          const msgDate = new Date(msg.timestamp || msg.createdAt).toDateString();
          if (msgDate !== lastDate) {
            lastDate = msgDate;
            const dateSeparator = document.createElement("li");
            dateSeparator.className = "text-center text-gray-400 text-xs my-2";
            dateSeparator.textContent = formatDateForSeparator(new Date(msgDate));
            messageList.appendChild(dateSeparator);
          }
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

  function appendMessage(msg, scroll = true) {
    const isMine = msg.senderId === myUserId || msg.sender === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent self-end" : "received self-start"} relative group mb-1`;

    const bubble = document.createElement("div");
    bubble.className = "bubble bg-white dark:bg-gray-800 rounded-xl p-2 max-w-[75%]";
    bubble.innerHTML = `
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
  }

  async function sendMessage({ content }) {
    const res = await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipientId: receiverId, content }),
    });
    const data = await res.json();
    return data;
  }

  async function clearMyMessages() {
    // This assumes backend has API to clear messages by user
    // Otherwise, simply clear from UI only:
    // Remove all messages sent by me from UI
    [...messageList.children].forEach((li) => {
      if (li.classList.contains("sent")) li.remove();
    });
  }

  async function fetchUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const user = await res.json();
      usernameHeader.textContent = user.username || user.name || "Chat";
    } catch {
      usernameHeader.textContent = "Chat";
    }
  }

  async function fetchUserStatus() {
    try {
      const res = await fetch(`/api/users/status/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      updateOnlineStatus(data.status, data.lastSeen);
    } catch (err) {
      console.error("Error fetching user status:", err);
      statusIndicator.textContent = "Unknown";
    }
  }

  function updateOnlineStatus(status, lastSeen) {
    if (status === "online") {
      statusIndicator.textContent = "🟢 Online";
    } else if (status === "offline" && lastSeen) {
      const lastSeenDate = new Date(lastSeen);
      const now = new Date();
      const diffMs = now - lastSeenDate;

      if (diffMs < 60000) {
        statusIndicator.textContent = "Online 🟢";
      } else if (diffMs < 3600000) {
        statusIndicator.textContent = `${Math.floor(diffMs / 60000)} min ago`;
      } else if (diffMs < 86400000) {
        statusIndicator.textContent = `${Math.floor(diffMs / 3600000)} hr ago`;
      } else {
        statusIndicator.textContent = lastSeenDate.toLocaleDateString();
      }
    } else {
      statusIndicator.textContent = "Offline";
    }
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  function formatDateForSeparator(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
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
});