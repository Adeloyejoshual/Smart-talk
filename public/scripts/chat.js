
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const receiverId = localStorage.getItem("receiverId");
  const receiverUsername = localStorage.getItem("receiverUsername") || "Unknown";

  if (!token || !user || !receiverId) {
    alert("Session expired. Please log in again.");
    window.location.href = "/login.html";
    return;
  }

  const chatWith = document.getElementById("chatWith");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messagesList = document.getElementById("messages");
  const typingStatus = document.getElementById("typingStatus");
  const backHome = document.getElementById("backHome");

  chatWith.textContent = `Chat with: ${receiverUsername}`;

  const roomId = [user._id, receiverId].sort().join("_");
  socket.emit("joinRoom", roomId);

  // Load chat history
  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/${receiverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        alert("Session expired. Please log in again.");
        localStorage.clear();
        return (window.location.href = "/login.html");
      }

      const data = await res.json();
      messagesList.innerHTML = "";

      data.forEach((msg) => {
        appendMessage(msg, msg.sender === user._id);
      });

      scrollToBottom();
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  }

  loadMessages();

  // Send message
  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    const msg = {
      text,
      senderId: user._id,
      receiverId,
      roomId,
      senderName: user.username,
    };

    socket.emit("privateMessage", msg);
    appendMessage(msg, true);
    messageInput.value = "";
  });

  // Receive message
  socket.on("privateMessage", (msg) => {
    appendMessage(msg, msg.senderId === user._id);
  });

  // Display message in chat
  function appendMessage(msg, isSender) {
    const div = document.createElement("div");
    const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString();
    const name = msg.senderName || (isSender ? user.username : receiverUsername);

    div.className = isSender ? "message sent" : "message received";
    div.innerHTML = `<span><strong>${name}:</strong></span> ${msg.text} <small>${time}</small>`;
    messagesList.appendChild(div);
    scrollToBottom();
  }

  // Typing indicator
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { roomId, username: user.username });
  });

  socket.on("typing", ({ username }) => {
    typingStatus.textContent = `${username} is typing...`;
    clearTimeout(typingStatus.timeout);
    typingStatus.timeout = setTimeout(() => {
      typingStatus.textContent = "";
    }, 1000);
  });

  // Back to home
  backHome.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  // Scroll to latest message
  function scrollToBottom() {
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  // Disconnect on unload
  window.addEventListener("beforeunload", () => {
    socket.disconnect();
  });
});