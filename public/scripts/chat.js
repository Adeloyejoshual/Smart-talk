
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

  // ✅ Guard: redirect if not logged in
  if (!token || !user || !receiverId) {
    window.location.href = "/login.html";
    return;
  }

  // ✅ Display who you're chatting with
  chatWith.textContent = `Chat with ${receiverName}`;

  // ✅ Join a private room for real-time chat
  socket.emit("joinPrivate", {
    senderId: user._id,
    receiverId,
  });

  // ✅ Load chat history from backend API
  fetch(`/api/messages/${receiverId}`, {
    headers: {
      Authorization: token,
    },
  })
    .then((res) => res.json())
    .then((messages) => {
      if (Array.isArray(messages)) {
        messages.forEach((msg) => {
          const senderName = msg.sender === user._id ? "You" : receiverName;
          appendMessage(msg.content, senderName);
        });
      }
    })
    .catch((err) => console.error("History load error:", err));

  // ✅ Handle sending messages
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
          Authorization: token,
        },
        body: JSON.stringify(messageData),
      });

      const savedMsg = await res.json();
      appendMessage(savedMsg.content || content, "You");

      // Emit the message to the server for real-time delivery
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

  // ✅ Show typing indicator when input changes
  messageInput.addEventListener("input", () => {
    socket.emit("typing", {
      from: user._id,
      to: receiverId,
      username: user.username,
    });
  });

  // ✅ Listen for typing event from the other user
  socket.on("typing", (data) => {
    if (data.from === receiverId) {
      typingStatus.textContent = `${receiverName} is typing...`;
      setTimeout(() => (typingStatus.textContent = ""), 2000);
    }
  });

  // ✅ Receive message in real time
  socket.on("privateMessage", (msg) => {
    if (msg.from === receiverId) {
      appendMessage(msg.content, receiverName);
    }
  });

  // ✅ Append a message to chat container
  function appendMessage(content, senderName) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "message";
    msgDiv.innerHTML = `<strong>${senderName}:</strong> ${content}`;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ✅ Logout and clear session
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login.html";
  });

  // ✅ Clean disconnect on page leave
  window.addEventListener("beforeunload", () => {
    socket.disconnect();
  });
});
</script>