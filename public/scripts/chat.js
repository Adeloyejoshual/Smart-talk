<script>
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const receiverId = localStorage.getItem("receiverId");
  const receiverUsername = localStorage.getItem("receiverUsername") || "Unknown";

  // HTML Elements
  const chatWith = document.getElementById("chatWith");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messagesContainer = document.getElementById("messagesContainer");
  const typingStatus = document.getElementById("typingStatus");
  const backArrow = document.getElementById("backArrow");

  // ✅ Guard: redirect if not logged in
  if (!token || !user || !receiverId) {
    window.location.href = "/login.html";
    return;
  }

  // ✅ Display who you're chatting with
  if (chatWith) chatWith.textContent = `Chat with ${receiverUsername}`;

  // ✅ Back arrow handler
  backArrow?.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  // ✅ Join private room
  socket.emit("joinPrivate", {
    senderId: user._id,
    receiverId,
  });

  // ✅ Load chat history
  fetch(`/api/messages/${receiverId}`, {
    headers: {
      Authorization: token,
    },
  })
    .then((res) => res.json())
    .then((messages) => {
      if (Array.isArray(messages)) {
        messages.forEach((msg) => {
          const senderName = msg.sender === user._id ? "You" : receiverUsername;
          appendMessage(msg.content, senderName, msg.sender === user._id);
        });
      }
    })
    .catch((err) => console.error("History load error:", err));

  // ✅ Handle sending messages
  messageForm?.addEventListener("submit", async (e) => {
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
      appendMessage(savedMsg.content || content, "You", true);

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

  // ✅ Typing indicator
  messageInput.addEventListener("input", () => {
    socket.emit("typing", {
      from: user._id,
      to: receiverId,
      username: user.username,
    });
  });

  socket.on("typing", (data) => {
    if (data.from === receiverId) {
      typingStatus.textContent = `${receiverUsername} is typing...`;
      setTimeout(() => (typingStatus.textContent = ""), 2000);
    }
  });

  // ✅ Receive message in real time
  socket.on("privateMessage", (msg) => {
    if (msg.from === receiverId) {
      appendMessage(msg.content, receiverUsername, false);
    }
  });

  // ✅ Append message
  function appendMessage(content, senderName, isOwn) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${isOwn ? "sent" : "received"}`;
    msgDiv.innerHTML = `<strong>${senderName}:</strong> ${content}`;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // ✅ Disconnect cleanly
  window.addEventListener("beforeunload", () => {
    socket.disconnect();
  });
});
</script>