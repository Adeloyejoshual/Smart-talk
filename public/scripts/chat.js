document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const receiverId = localStorage.getItem("receiverId");
  const receiverUsername = localStorage.getItem("receiverUsername") || "Unknown";

  if (!token || !user || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  // DOM elements
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
  const loadMessages = async () => {
    try {
      const res = await fetch(`/api/messages/${receiverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      messagesList.innerHTML = "";
      data.forEach((msg) => {
        const li = document.createElement("li");
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const sender = msg.sender.username || "Unknown";
        li.textContent = `[${time}] ${sender}: ${msg.text}`;
        messagesList.appendChild(li);
      });

      scrollToBottom();
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

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
    };

    socket.emit("privateMessage", msg);
    messageInput.value = "";
  });

  // Receive message
  socket.on("privateMessage", (msg) => {
    const li = document.createElement("li");
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const sender = msg.sender.username || "Unknown";
    li.textContent = `[${time}] ${sender}: ${msg.text}`;
    messagesList.appendChild(li);
    scrollToBottom();
  });

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

  function scrollToBottom() {
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  // Back to home
  backHome.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  // Disconnect on page exit
  window.addEventListener("beforeunload", () => {
    socket.disconnect();
  });
});