document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user"); // target user for private chat

  if (!token || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  let myUserId = null;
  let typingTimeout;
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");
  const scrollDownBtn = document.getElementById("scrollDownBtn");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  // Extract userId from JWT
  function getMyUserId(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id || payload.userId;
    } catch {
      return null;
    }
  }

  myUserId = getMyUserId(token);

  // Join private room
  socket.emit("join", myUserId);

  // Send private message
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const msg = {
      senderId: myUserId,
      receiverId,
      content
    };

    socket.emit("privateMessage", msg);
    appendMessage({ senderId: myUserId, content, timestamp: Date.now() });
    messageInput.value = "";
  });

  // Typing indicator
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { receiverId, senderId: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("typing", { receiverId, senderId: null });
    }, 2000);
  });

  // Listen for incoming messages
  socket.on("privateMessage", (msg) => {
    if (msg.senderId === receiverId) {
      appendMessage(msg, true);
    }
  });

  socket.on("typing", ({ senderId }) => {
    if (senderId === receiverId) {
      if (!messageList.contains(typingIndicator)) {
        messageList.appendChild(typingIndicator);
        scrollToBottom();
      }
    } else {
      if (messageList.contains(typingIndicator)) {
        messageList.removeChild(typingIndicator);
      }
    }
  });

  // Append message to DOM
  function appendMessage(msg, scroll = true) {
    const li = document.createElement("li");
    const isMine = msg.senderId === myUserId;
    li.className = `${isMine ? "sent self-end" : "received self-start"} relative group mb-1`;

    const bubble = document.createElement("div");
    bubble.className = "bubble bg-white dark:bg-gray-800 rounded-xl p-2 max-w-[75%]";
    bubble.innerHTML = `
      ${msg.content || ""}
      <div class="meta text-xs mt-1 opacity-60 text-right">
        ${new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);

    if (scroll) scrollToBottom();
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  // Scroll button
  messageList.addEventListener("scroll", () => {
    const threshold = 100;
    const isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
    scrollDownBtn.classList.toggle("hidden", isAtBottom);
  });

  scrollDownBtn.addEventListener("click", scrollToBottom);

  // File/Image upload
  async function handleUpload(files) {
    if (!files.length) return;
    const formData = new FormData();
    files.forEach(f => formData.append("files", f));

    const res = await fetch(`/api/messages/private/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    if (data.success && data.messages) {
      data.messages.forEach(msg => appendMessage(msg));
    }
    scrollToBottom();
  }

  imageInput.addEventListener("change", e => handleUpload([...e.target.files]));
  fileInput.addEventListener("change", e => handleUpload([...e.target.files]));
});
