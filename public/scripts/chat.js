document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");
  const messagesContainer = document.getElementById("messages");
  const typingIndicator = document.getElementById("typingIndicator");
  const chatHeader = document.getElementById("chatHeader");

  const currentUserId = localStorage.getItem("userId");
  const currentUsername = localStorage.getItem("username");
  const friendId = localStorage.getItem("friendId");
  const friendUsername = localStorage.getItem("friendUsername");

  if (!currentUserId || !friendId || !currentUsername || !friendUsername) {
    alert("Missing chat info. Please return to home.");
    window.location.href = "/home.html";
  }

  // Show friend's name in header
  chatHeader.textContent = `Chatting with ${friendUsername}`;

  // Join private room
  const room = [currentUserId, friendId].sort().join("-");
  socket.emit("joinRoom", room);

  // Fetch message history
  fetch(`/api/messages/${friendId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  })
    .then(res => res.json())
    .then(data => {
      data.forEach(msg => addMessage(msg, msg.sender === currentUserId));
    })
    .catch(err => console.error("Failed to load messages", err));

  // Send message
  sendButton.addEventListener("click", () => {
    const text = messageInput.value.trim();
    if (!text) return;

    const messageData = {
      sender: currentUserId,
      receiver: friendId,
      text,
      room,
      timestamp: new Date().toISOString(),
    };

    socket.emit("privateMessage", messageData);
    addMessage(messageData, true);
    messageInput.value = "";
    typingIndicator.textContent = "";
  });

  // Listen for incoming messages
  socket.on("privateMessage", msg => {
    if (msg.sender === friendId && msg.receiver === currentUserId) {
      addMessage(msg, false);
    }
  });

  // Typing indicator
  let typingTimeout;
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { room, username: currentUsername });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", room);
    }, 2000);
  });

  socket.on("typing", ({ username }) => {
    typingIndicator.textContent = `${username} is typing...`;
  });

  socket.on("stopTyping", () => {
    typingIndicator.textContent = "";
  });

  function addMessage(msg, isSender) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", isSender ? "sent" : "received");

    const usernameLine = document.createElement("div");
    usernameLine.textContent = isSender ? "You" : friendUsername;
    usernameLine.style.fontSize = "0.75rem";
    usernameLine.style.opacity = "0.7";

    const textLine = document.createElement("div");
    textLine.textContent = msg.text;

    const timestampLine = document.createElement("div");
    timestampLine.classList.add("meta");
    const date = new Date(msg.timestamp);
    timestampLine.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.appendChild(usernameLine);
    messageDiv.appendChild(textLine);
    messageDiv.appendChild(timestampLine);

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
});