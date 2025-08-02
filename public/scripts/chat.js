document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const receiverId = localStorage.getItem("receiverId");
  const receiverUsername = localStorage.getItem("receiverUsername") || "Unknown";

  const chatWith = document.getElementById("chatWith");
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const typingStatus = document.getElementById("typingStatus");

  if (!token || !user || !receiverId) {
    alert("Unauthorized. Redirecting to login...");
    return (window.location.href = "/login.html");
  }

  chatWith.textContent = `Chat with ${receiverUsername}`;

  socket.emit("joinRoom", { senderId: user._id, receiverId });

  // Load previous messages
  fetch(`/api/messages/${receiverId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((res) => res.json())
    .then((messages) => {
      messages.forEach(displayMessage);
      scrollToBottom();
    });

  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    socket.emit("privateMessage", {
      senderId: user._id,
      receiverId,
      content: message,
      senderName: user.username,
    });

    messageInput.value = "";
    socket.emit("stopTyping", { receiverId });
  });

  socket.on("privateMessage", (msg) => {
    displayMessage(msg);
    scrollToBottom();
  });

  socket.on("typing", ({ senderName }) => {
    typingStatus.textContent = `${senderName} is typing...`;
  });

  socket.on("stopTyping", () => {
    typingStatus.textContent = "";
  });

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { receiverId, senderName: user.username });
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { receiverId });
    }, 1000);
  });

  function displayMessage(msg) {
    const li = document.createElement("li");
    const timestamp = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    li.innerHTML = `<strong>${msg.senderName}:</strong> ${msg.content} <span class="timestamp">${timestamp}</span>`;
    messageList.appendChild(li);
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  // Leave room on unload
  window.addEventListener("beforeunload", () => {
    socket.emit("leaveRoom", { receiverId });
  });
});