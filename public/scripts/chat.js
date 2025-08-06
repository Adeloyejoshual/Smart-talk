// /public/scripts/chat.js
document.addEventListener("DOMContentLoaded", () => {
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const backButton = document.getElementById("backButton");
  const exportBtn = document.getElementById("exportBtn");

  const token = localStorage.getItem("token");
  const receiverId = new URLSearchParams(window.location.search).get("user");

  if (!token || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  const myUserId = getMyUserId(token);
  const socket = io();

  socket.emit("join", myUserId);
  loadMessages();

  // Send message
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    // Show instantly
    appendMessage({ sender: myUserId, content, timestamp: Date.now(), read: true });
    scrollToBottom();
    messageInput.value = "";

    // Send to backend
    try {
      await fetch("/api/messages/private/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId: receiverId, content }),
      });

      // Notify recipient in real-time
      socket.emit("privateMessage", {
        senderId: myUserId,
        receiverId,
        content,
      });
    } catch (err) {
      console.error("❌ Failed to send:", err);
      alert("Message not sent");
    }
  });

  // Receive message
  socket.on("privateMessage", (msg) => {
    if (msg.senderId === receiverId) {
      appendMessage({
        sender: receiverId,
        content: msg.content,
        timestamp: Date.now(),
        read: false,
      });
      scrollToBottom();
    }
  });

  // Export chat
  exportBtn.addEventListener("click", () => {
    const messages = [...messageList.querySelectorAll("li")].map(li => li.innerText).join("\n");
    const blob = new Blob([messages], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "SmartTalk_PrivateChat.txt";
    link.click();
  });

  // Back button
  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  // Load chat history
  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/private/${receiverId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      messageList.innerHTML = "";
      if (Array.isArray(data)) {
        data.forEach(msg => {
          appendMessage({
            sender: msg.sender,
            content: msg.content || msg.text,
            timestamp: msg.createdAt,
            read: msg.status === "read"
          });
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  // Append a message to the list
  function appendMessage({ sender, content, timestamp, read }) {
    const isMine = sender === myUserId;
    const li = document.createElement("li");
    li.className = isMine ? "sent self-end" : "received self-start";
    li.innerHTML = `
      <div class="bubble">
        ${content}
        <div class="meta">
          ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          ${isMine && read ? '<span class="seen">✔✔</span>' : ''}
        </div>
      </div>
    `;
    messageList.appendChild(li);
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  function getMyUserId(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id || payload.userId;
    } catch {
      return null;
    }
  }
});