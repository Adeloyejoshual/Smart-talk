document.addEventListener("DOMContentLoaded", () => {
  const socket = io({
    auth: { token: localStorage.getItem("token") }
  });

  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const chatUsername = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");

  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");
  const emojiButton = document.getElementById("emojiButton");

  const userId = localStorage.getItem("userId");      // logged-in user
  const chatUserId = localStorage.getItem("chatUserId"); // recipient

  let lastMessageDate = null; // track last date for separators

  // ---------------- Emoji Picker ----------------
  const picker = new EmojiButton();
  emojiButton.addEventListener("click", () => picker.togglePicker(emojiButton));
  picker.on("emoji", emoji => {
    messageInput.value += emoji;
    messageInput.focus();
  });

  // ---------------- Helpers ----------------
  function formatDateHeader(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function addDateSeparatorIfNeeded(messageDate) {
    if (!lastMessageDate || lastMessageDate.toDateString() !== messageDate.toDateString()) {
      const li = document.createElement("li");
      li.className = "date-separator";
      li.textContent = formatDateHeader(messageDate);
      messageList.appendChild(li);
      lastMessageDate = messageDate;
    }
  }

  function appendMessage(msg, isOwn) {
    addDateSeparatorIfNeeded(new Date(msg.createdAt));

    const li = document.createElement("li");
    li.className = `flex ${isOwn ? "justify-end" : "justify-start"} items-end`;

    const bubbleWrapper = document.createElement("div");
    bubbleWrapper.className = `${isOwn ? "sent" : "received"} max-w-xs`;

    const bubble = document.createElement("div");
    bubble.className = "bubble shadow";

    if (msg.fileUrl) {
      if (msg.fileType === "image") {
        const img = document.createElement("img");
        img.src = msg.fileUrl;
        img.className = "rounded-lg max-w-[200px] cursor-pointer";
        bubble.appendChild(img);
      } else {
        const a = document.createElement("a");
        a.href = msg.fileUrl;
        a.textContent = "📎 " + (msg.content || "File");
        a.target = "_blank";
        a.className = "underline text-blue-600";
        bubble.appendChild(a);
      }
    } else {
      bubble.textContent = msg.content;
    }

    const time = document.createElement("div");
    time.className = "msg-time text-right text-xs text-gray-500 mt-1";
    time.textContent = formatTime(new Date(msg.createdAt));

    bubbleWrapper.appendChild(bubble);
    bubbleWrapper.appendChild(time);
    li.appendChild(bubbleWrapper);
    messageList.appendChild(li);

    messageList.scrollTop = messageList.scrollHeight;
  }

  // ---------------- Load chat history ----------------
  fetch(`/api/messages/history/${chatUserId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
  })
    .then(res => res.json())
    .then(messages => {
      if (!Array.isArray(messages)) return;
      messages.forEach(msg => {
        appendMessage(
          msg,
          msg.sender._id?.toString() === userId || msg.sender.id?.toString() === userId
        );
      });
    })
    .catch(err => console.error("History load failed:", err));

  // ---------------- Send message ----------------
  messageForm.addEventListener("submit", e => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    socket.emit("private message", { to: chatUserId, message: content });
    messageInput.value = "";
    socket.emit("stop typing", { to: chatUserId });
  });

  // ---------------- File Upload ----------------
  function uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("recipient", chatUserId);

    fetch("/api/messages/file", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: formData,
    })
      .then(res => res.json())
      .then(msg => {
        appendMessage(msg, true);
      })
      .catch(err => console.error("Upload failed:", err));
  }

  imageInput.addEventListener("change", e => {
    [...e.target.files].forEach(file => uploadFile(file));
    e.target.value = "";
  });

  fileInput.addEventListener("change", e => {
    [...e.target.files].forEach(file => uploadFile(file));
    e.target.value = "";
  });

  // ---------------- Typing Indicator ----------------
  let typingTimeout;
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: chatUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stop typing", { to: chatUserId });
    }, 2000);
  });

  // ---------------- Socket Events ----------------
  socket.on("private message", msg => {
    appendMessage(msg, msg.sender.id === userId || msg.sender._id === userId);
  });

  socket.on("typing", ({ from }) => {
    if (from === chatUserId) statusIndicator.textContent = "typing...";
  });
  socket.on("stop typing", ({ from }) => {
    if (from === chatUserId) statusIndicator.textContent = "Online";
  });

  // Default status
  statusIndicator.textContent = "Online";
});