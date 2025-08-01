document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username");
  const receiverId = localStorage.getItem("receiverId");
  const receiverUsername = localStorage.getItem("receiverUsername");

  if (!token || !userId || !receiverId) {
    window.location.href = "/login.html";
    return;
  }

  const socket = io({
    query: {
      userId,
      username
    }
  });

  const chatBox = document.getElementById("chatBox");
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");
  const typingIndicator = document.getElementById("typingIndicator");

  // Load chat history from API
  async function loadChat() {
    try {
      const res = await fetch(`/api/messages/history/${receiverId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        data.messages.forEach((msg) => displayMessage(msg));
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }

  function displayMessage(message) {
    const messageDiv = document.createElement("div");
    const isMine = message.sender === userId;
    const senderName = message.senderName || (isMine ? "You" : receiverUsername);

    messageDiv.className = isMine ? "message mine" : "message theirs";
    const time = new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
      <div class="sender-name">${senderName}</div>
      <div class="bubble">${message.text}</div>
      <div class="timestamp">${time}</div>
    `;

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  loadChat();

  // Send message
  sendButton.addEventListener("click", async () => {
    const text = messageInput.value.trim();
    if (!text) return;

    const message = {
      sender: userId,
      senderName: username,
      receiver: receiverId,
      text,
      timestamp: Date.now()
    };

    // Send to backend to store
    try {
      await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(message)
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }

    // Send via socket
    socket.emit("private message", {
      ...message,
      to: receiverId
    });

    displayMessage(message);
    messageInput.value = "";
  });

  // Typing indicator
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, sender: username });
  });

  socket.on("typing", (data) => {
    if (data && data.sender) {
      typingIndicator.textContent = `${data.sender} is typing...`;
      setTimeout(() => {
        typingIndicator.textContent = "";
      }, 2000);
    }
  });

  // Receive message
  socket.on("private message", (message) => {
    if (message.sender === receiverId) {
      displayMessage(message);
    }
  });

  // Update lastSeen on disconnect
  window.addEventListener("beforeunload", () => {
    socket.disconnect();
  });
});