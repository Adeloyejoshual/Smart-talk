document.addEventListener("DOMContentLoaded", () => {
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const backButton = document.getElementById("backButton");
  const exportBtn = document.getElementById("exportBtn");
  const usernameHeader = document.getElementById("chat-username");

  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");

  if (!token || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  const myUserId = getMyUserId(token);
  const socket = io();
  socket.emit("join", myUserId);

  loadMessages();
  loadUsername();

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    socket.emit("privateMessage", {
      senderId: myUserId,
      receiverId,
      content,
    });

    await saveMessageToServer(receiverId, content);
    appendMessage({ sender: myUserId, content, timestamp: Date.now(), read: true });
    messageInput.value = "";
    scrollToBottom();
  });

  socket.on("privateMessage", (msg) => {
    if (msg.senderId === receiverId) {
      appendMessage({
        sender: receiverId,
        content: msg.content,
        timestamp: Date.now(),
        read: false
      });
      scrollToBottom();
    }
  });

  exportBtn.addEventListener("click", () => {
    const messages = [...messageList.querySelectorAll("li")].map(li => li.innerText).join("\n");
    const blob = new Blob([messages], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "SmartTalk_PrivateChat.txt";
    link.click();
  });

  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/history/${receiverId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.messages) {
        messageList.innerHTML = "";
        data.messages.forEach(msg => {
          appendMessage({
            sender: msg.sender,
            content: msg.content || "",
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

  async function loadUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const user = await res.json();
      usernameHeader.textContent = user.username || user.name || "Chat";
    } catch (err) {
      console.error("Failed to load user:", err);
    }
  }

  function appendMessage({ sender, content, timestamp, read }) {
    const isMine = sender === myUserId;
    const li = document.createElement("li");
    li.className = isMine ? "sent" : "received";
    li.innerHTML = `
      <div class="bubble">
        <strong>${isMine ? "You" : "User"}</strong>: ${content}
        <div class="meta">
          ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          ${isMine && read ? '<span class="seen">✔✔</span>' : ''}
        </div>
      </div>
    `;
    messageList.appendChild(li);
  }

  async function saveMessageToServer(recipientId, content) {
    await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipientId, content }),
    });
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