// /public/scripts/chat.js

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const backButton = document.getElementById("backButton");
  const exportBtn = document.getElementById("exportBtn");
  const usernameHeader = document.getElementById("chat-username");
  const editBtn = document.getElementById("editUsernameBtn");
  const usernameModal = document.getElementById("usernameModal");
  const closeModalBtn = document.getElementById("closeUsernameModal");

  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");
  let myUserId = null;

  if (!token || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  getMyUserId(token).then((id) => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages();
    fetchUsername();
  });

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    try {
      await fetch(`/api/messages/private/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId: receiverId, content }),
      });
    } catch (err) {
      console.error("Message send error:", err);
    }

    messageInput.value = "";
  });

  socket.on("privateMessage", (msg) => {
    const isMine = msg.senderId === myUserId || msg.sender === myUserId;
    const isFromOrToReceiver = msg.senderId === receiverId || msg.sender === receiverId;

    if (isFromOrToReceiver) {
      appendMessage({
        sender: msg.senderId || msg.sender,
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
        read: false,
      });
      scrollToBottom();
    }
  });

  exportBtn.addEventListener("click", () => {
    const messages = [...messageList.querySelectorAll("li")]
      .map((li) => li.innerText)
      .join("\n");
    const blob = new Blob([messages], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "SmartTalk_PrivateChat.txt";
    link.click();
  });

  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  if (editBtn && usernameModal && closeModalBtn) {
    editBtn.addEventListener("click", () => {
      usernameModal.classList.remove("hidden");
    });

    closeModalBtn.addEventListener("click", () => {
      usernameModal.classList.add("hidden");
    });
  }

  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/history/${receiverId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success && data.messages) {
        messageList.innerHTML = "";
        data.messages.forEach((msg) => {
          appendMessage({
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.createdAt,
            read: msg.status === "read",
          });
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  async function fetchUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const user = await res.json();
      usernameHeader.textContent = user.username || user.name || "Chat";
    } catch (err) {
      usernameHeader.textContent = "Chat";
    }
  }

  function appendMessage({ sender, content, timestamp, read }) {
    const isMine = sender === myUserId;
    const li = document.createElement("li");
    li.className = isMine ? "sent" : "received";
    li.innerHTML = `
      <div class="bubble">
        ${content}
        <div class="meta">
          ${new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          ${isMine && read ? '<span class="seen">✔✔</span>' : ""}
        </div>
      </div>
    `;
    messageList.appendChild(li);
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  async function getMyUserId(token) {
    try {
      const res = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      return user._id;
    } catch {
      return null;
    }
  }
});