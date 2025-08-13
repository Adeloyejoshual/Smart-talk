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
  const chatHeader = document.getElementById("chat-header");
  const usernameHeader = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");
  const scrollDownBtn = document.getElementById("scrollDownBtn");
  const exportBtn = document.getElementById("exportBtn");

  // More menu buttons
  const btnSearchChat = document.getElementById("menu-search-chat");
  const btnMuteNotif = document.getElementById("menu-mute-notif");
  const btnMediaDocs = document.getElementById("menu-media-docs");
  const btnChatTheme = document.getElementById("menu-chat-theme");
  const btnMore = document.getElementById("menu-more");
  const btnBlockUser = document.getElementById("more-block");
  const btnClearChat = document.getElementById("more-clear-chat");
  const btnExportChat = document.getElementById("more-export-chat");
  const btnReportUser = document.getElementById("more-report-user");

  // Contact modal
  const contactModal = document.getElementById("contact-modal");
  const contactBackBtn = document.getElementById("contact-back-btn");
  const contactBio = document.getElementById("contact-bio");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  // SETTINGS
  function applyChatSettings() {
    const fontSize = localStorage.getItem("fontSize") || "medium";
    messageList.style.fontSize = fontSize === "small" ? "14px" :
                                 fontSize === "large" ? "18px" : "16px";
  }
  window.addEventListener("storage", (e) => {
    if (e.key === "settingsUpdatedAt") applyChatSettings();
  });

  // Get current user ID
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

    applyChatSettings();
  });

  // SCROLL
  messageList.addEventListener("scroll", () => {
    const threshold = 100;
    isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
    scrollDownBtn.classList.toggle("hidden", isAtBottom);

    if (!isGroupChat && messageList.scrollTop === 0 && !loading) loadMessages(false);
  });
  scrollDownBtn.addEventListener("click", scrollToBottom);

  // SEND MESSAGE
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    if (isGroupChat) {
      socket.emit("groupMessage", { groupId, senderId: myUserId, content });
      appendMessage({ sender: "You", content, timestamp: Date.now() }, true, true);
    } else {
      await sendPrivateMessage(content);
    }
    messageInput.value = "";
  });

  // TYPING
  if (!isGroupChat) {
    messageInput.addEventListener("input", () => {
      socket.emit("typing", { to: receiverId, from: myUserId });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => socket.emit("stopTyping", { to: receiverId, from: myUserId }), 2000);
    });
  }

  // IMAGE UPLOAD
  async function handleFileUpload(files, endpoint) {
    if (!files.length) return;
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success && data.messages) {
      data.messages.forEach(msg => appendMessage(msg, true, !isGroupChat));
      scrollToBottom();
    }
  }

  imageInput.addEventListener("change", e => handleFileUpload([...e.target.files], isGroupChat ? `/api/messages/group/upload/${groupId}` : `/api/messages/private/upload`));
  fileInput.addEventListener("change", e => handleFileUpload([...e.target.files], isGroupChat ? `/api/messages/group/upload/${groupId}` : `/api/messages/private/upload`));

  // SOCKET LISTENERS
  socket.on("privateMessage", msg => {
    if (!isGroupChat && (msg.senderId === receiverId || msg.sender === receiverId)) {
      appendMessage(msg, isAtBottom, true);
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

  // EXPORT
  exportBtn.addEventListener("click", () => {
    const messages = [...messageList.querySelectorAll("li")].map(li => li.innerText).join("\n");
    const blob = new Blob([messages], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = isGroupChat ? `Group_${groupId}_Chat.txt` : `Private_${receiverId}_Chat.txt`;
    link.click();
  });

  // MENU BUTTONS
  btnSearchChat.addEventListener("click", () => {
    const term = prompt("Search chat messages:");
    if (!term) return;
    const messages = messageList.querySelectorAll("li .bubble");
    messages.forEach(bubble => {
      bubble.innerHTML = bubble.textContent.replace(
        new RegExp(term, "gi"),
        match => `<mark>${match}</mark>`
      );
    });
  });

  btnMuteNotif.addEventListener("click", () => {
    const choice = prompt("Mute notifications:\n1) 8 hours\n2) 1 week\n3) Always\nEnter choice number:");
    if (!choice) return;
    alert(`Notifications muted for option ${choice}`);
  });

  btnMediaDocs.addEventListener("click", () => alert("Show media, links and docs screen (to be implemented)"));
  btnChatTheme.addEventListener("click", () => alert("Theme picker modal (to be implemented)"));
  btnMore.addEventListener("click", () => document.getElementById("more-menu").classList.toggle("hidden"));

  btnBlockUser?.addEventListener("click", () => { if(confirm("Block this user?")) alert("Blocked (to implement)"); });
  btnClearChat?.addEventListener("click", () => { if(confirm("Clear chat?")) clearMyMessages(); });
  btnExportChat?.addEventListener("click", () => exportBtn.click());
  btnReportUser?.addEventListener("click", () => alert("Reported (to implement)"));

  // CONTACT MODAL
  usernameHeader.addEventListener("click", () => {
    if (isGroupChat) return; // no contact for group
    fetch(`/api/users/${receiverId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(user => {
        contactBio.textContent = user.bio || "No bio available";
        contactModal.classList.remove("hidden");
      }).catch(() => { contactBio.textContent = "Failed to load bio"; contactModal.classList.remove("hidden"); });
  });
  contactBackBtn.addEventListener("click", () => contactModal.classList.add("hidden"));

  // FUNCTIONS
  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;

    try {
      if (isGroupChat) {
        const res = await fetch(`/api/messages/group-history/${groupId}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok && data.messages) {
          messageList.innerHTML = "";
          data.messages.forEach(msg => appendMessage(msg, false, true, true));
          scrollToBottom();
        }
      } else {
        const res = await fetch(`/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.success && data.messages.length) {
          if (initial) messageList.innerHTML = "";
          let lastDate = null;
          data.messages.reverse().forEach(msg => {
            const msgDate = new Date(msg.timestamp || msg.createdAt).toDateString();
            if (msgDate !== lastDate) {
              lastDate = msgDate;
              const dateSeparator = document.createElement("li");
              dateSeparator.className = "text-center text-gray-400 text-xs my-2";
              dateSeparator.textContent = formatDateForSeparator(new Date(msgDate));
              messageList.appendChild(dateSeparator);
            }
            appendMessage(msg, false, true);
          });
          if (initial) scrollToBottom();
          skip += data.messages.length;
        }
      }
    } catch (err) { console.error("Failed to load messages:", err); }
    finally { loading = false; }
  }

  function appendMessage(msg, scroll = true, playSound = false, isGroup = false) {
    const isMine = msg.senderId === myUserId || msg.sender === myUserId;
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
      const kind = localStorage.getItem("notificationSoundKind") || "builtin";
      const src = kind === "custom" ? localStorage.getItem("notificationCustomUrl") : `/sounds/${localStorage.getItem("notificationSound") || "sound01.mp3"}`;
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
    if (data.success && data.message) appendMessage(data.message, true, false);
  }

  async function clearMyMessages() {
    [...messageList.children].forEach(li => { if (li.classList.contains("sent")) li.remove(); });
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
      updateOnlineStatus(data.status, data.lastSeen);
    } catch { statusIndicator.textContent = "Unknown"; }
  }

  function updateOnlineStatus(status, lastSeen) {
    if (status === "online") statusIndicator.textContent = "🟢 Online";
    else if (status === "offline" && lastSeen) {
      const diffMs = new Date() - new Date(lastSeen);
      if (diffMs < 60000) statusIndicator.textContent = "Online 🟢";
      else if (diffMs < 3600000) statusIndicator.textContent = `${Math.floor(diffMs / 60000)} min ago`;
      else if (diffMs < 86400000) statusIndicator.textContent = `${Math.floor(diffMs / 3600000)} hr ago`;
      else statusIndicator.textContent = new Date(lastSeen).toLocaleDateString();
    } else statusIndicator.textContent = "Offline";
  }

  function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }
  function formatDateForSeparator(date) {
    const today = new Date(), yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  }
});