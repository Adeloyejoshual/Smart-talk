<script>
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const receiverId = localStorage.getItem("receiverId");
  const receiverUsername = localStorage.getItem("receiverUsername") || "Unknown";

  const chatWith = document.getElementById("chatWith");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messagesContainer = document.getElementById("messagesContainer");
  const typingStatus = document.getElementById("typingStatus");
  const backArrow = document.getElementById("backArrow");

  if (!token || !user || !receiverId) {
    return (window.location.href = "/login.html");
  }

  if (chatWith) chatWith.textContent = `Chat with ${receiverUsername}`;
  backArrow?.addEventListener("click", () => window.location.href = "/home.html");

  socket.emit("joinPrivate", { senderId: user._id, receiverId });

  // Load chat history
  fetch(`/api/messages/history/${receiverId}`, {
    headers: { Authorization: token },
  })
    .then(res => res.json())
    .then(messages => {
      messages.forEach(msg => appendMessage(msg));
    });

  // Mark messages as read
  fetch(`/api/messages/read/${receiverId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ userId: user._id }),
  });

  // Send message
  messageForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const messageData = { receiverId, content };

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
      appendMessage(savedMsg);
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
      typingStatus.textContent = `${receiverUsername} is typing...`;
      setTimeout(() => (typingStatus.textContent = ""), 2000);
    }
  });

  // Receive messages in real time
  socket.on("privateMessage", (msg) => {
    if (msg.from === receiverId) {
      appendMessage(msg);
    }
  });

  // Append message to DOM
  function appendMessage(msg) {
    const isOwn = msg.sender === user._id;
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${isOwn ? "sent" : "received"}`;

    if (msg.deleted) {
      msgDiv.innerText = "Message deleted";
      msgDiv.classList.add("deleted-message");
    } else {
      msgDiv.innerHTML = `<strong>${isOwn ? "You" : receiverUsername}:</strong> ${msg.content}`;

      // ✓✓ Read status for sender
      if (isOwn && typeof msg.read !== "undefined") {
        const readStatus = document.createElement("span");
        readStatus.className = "read-status";
        readStatus.textContent = msg.read ? " ✓✓" : " ✓";
        msgDiv.appendChild(readStatus);
      }

      // 🗑️ Delete button
      if (isOwn) {
        const delBtn = document.createElement("button");
        delBtn.textContent = "🗑️";
        delBtn.onclick = () => {
          fetch(`/api/messages/${msg._id}`, {
            method: "DELETE",
            headers: { Authorization: token },
          })
            .then(() => {
              msgDiv.innerText = "Message deleted";
              msgDiv.classList.add("deleted-message");
            });
        };
        msgDiv.appendChild(delBtn);
      }
    }

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Disconnect on page unload
  window.addEventListener("beforeunload", () => {
    socket.disconnect();
  });
});
</script>