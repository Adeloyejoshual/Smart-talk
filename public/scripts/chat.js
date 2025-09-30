document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) return window.location.href = "/";

  const socket = io({ auth: { token } });

  const urlParams = new URLSearchParams(window.location.search);
  const receiverIdentifier = urlParams.get("user"); // username or email
  if (!receiverIdentifier) return window.location.href = "/home";

  let myUserId = JSON.parse(atob(token.split(".")[1])).id;
  let isAtBottom = true;

  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  // Join private room
  socket.emit("joinPrivateRoom", { senderIdentifier: myUserId, receiverIdentifier });

  // Load chat history
  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/history/${receiverIdentifier}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.messages.length) {
        messageList.innerHTML = "";
        data.messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
      }
    } catch (err) { console.error(err); }
  }
  loadMessages();

  // Send message
  messageForm.addEventListener("submit", e => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const msgData = { toIdentifier: receiverIdentifier, message: content };
    socket.emit("private message", msgData);
    messageInput.value = "";
  });

  // Typing indicator
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { toIdentifier: receiverIdentifier, from: myUserId });
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => socket.emit("stopTyping", { toIdentifier: receiverIdentifier, from: myUserId }), 2000);
  });

  // Receive messages
  socket.on("private message", msg => {
    if (msg.sender._id === myUserId || msg.receiver._id === myUserId) appendMessage(msg);
  });

  socket.on("typing", ({ from }) => {
    if (from !== myUserId && !messageList.contains(typingIndicator)) {
      messageList.appendChild(typingIndicator);
      scrollToBottom();
    }
  });

  socket.on("stopTyping", ({ from }) => {
    if (messageList.contains(typingIndicator)) messageList.removeChild(typingIndicator);
  });

  // Append message to list
  function appendMessage(msg) {
    const li = document.createElement("li");
    const isMine = msg.sender._id === myUserId;
    li.className = isMine ? "sent" : "received";

    const bubble = document.createElement("div");
    bubble.className = "bubble p-2 rounded-xl bg-gray-200 dark:bg-gray-800";
    bubble.innerHTML = `
      ${!isMine ? `<strong>${msg.sender.username || msg.sender.email}</strong><br>` : ""}
      ${msg.content || ""}
      ${msg.fileUrl ? `<a href="${msg.fileUrl}" target="_blank">${msg.fileType || "File"}</a>` : ""}
      <div class="meta text-xs opacity-60 text-right">${new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);
    scrollToBottom();
  }

  function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }
});