<!-- <script src="/socket.io/socket.io.js"></script> should be loaded in HTML -->
<script>
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const receiverId = localStorage.getItem("receiverId");
  const receiverName = localStorage.getItem("receiverUsername") || "Unknown";

  const chatWith = document.getElementById("chatWith");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messagesContainer = document.getElementById("messagesContainer");
  const typingStatus = document.getElementById("typingStatus");

  // Guard
  if (!token || !user || !receiverId) {
    window.location.href = "/login.html";
    return;
  }

  chatWith.textContent = `Chat with ${receiverName}`;

  // Join private room
  socket.emit("joinPrivate", {
    senderId: user._id,
    receiverId,
  });

  // Load chat history
  fetch(`/api/messages/history/${receiverId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((res) => res.json())
    .then((messages) => {
      if (Array.isArray(messages)) {
        messages.forEach((msg) => {
          const senderName = msg.sender._id === user._id ? "You" : receiverName;
          appendMessage(msg.content, senderName);
        });
      }
    })
    .catch((err) => console.error("History load error:", err));

  // Send message
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const messageData = {
      receiverId,
      content,
    };

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(messageData),
      });

      const savedMsg = await res.json();
      appendMessage(savedMsg.data?.content || content, "You");

      socket.emit("privateMessage", {
        from: user._id,
        to: receiverId,
        content,
        username: user.username,
      });

      messageInput.value = "";
    } catch (err) {
      console.error("Send error:", err);
    }
  });

  // Typing indicator
  messageInput.addEventListener("input", () => {
    socket.emit("typing", {
      from: user._id,
      to: receiverId,
      username: user.username,
    });
  });

  socket.on("typing", (data) => {
    if (data.from === receiverId) {
      typingStatus.textContent = `${receiverName} is typing...`;
      setTimeout(() => (typingStatus.textContent = ""), 2000);
    }
  });

  // Receive message
  socket.on("privateMessage", (msg) => {
    if (msg.from === receiverId) {
      appendMessage(msg.content, receiverName);
    }
  });

  // Display message
  function appendMessage(content, senderName) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "message";
    msgDiv.innerHTML = `<strong>${senderName}:</strong> ${content}`;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login.html";
  });

  // Disconnect on unload
  window.addEventListener("beforeunload", () => {
    socket.disconnect();
  });
});
</script>