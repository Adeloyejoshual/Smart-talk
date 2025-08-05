document.addEventListener("DOMContentLoaded", () => {
  const messageForm = document.getElementById("groupMessageForm");
  const messageInput = document.getElementById("groupMessageInput");
  const messageList = document.getElementById("groupMessages");
  const backButton = document.getElementById("backButton");
  const exportBtn = document.getElementById("exportGroup");

  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const groupId = urlParams.get("group");

  if (!token || !groupId) {
    window.location.href = "/home.html";
    return;
  }

  const myUserId = getMyUserId();
  const socket = io();

  socket.emit("joinGroup", { groupId, userId: myUserId });

  // Load previous messages
  loadMessages();

  // Export messages
  exportBtn.addEventListener("click", () => {
    const messages = [...messageList.querySelectorAll("li")].map(li => li.innerText).join("\n");
    const blob = new Blob([messages], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SmartTalk_Group_${groupId}_Chat.txt`;
    link.click();
  });

  // Send message
  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    socket.emit("groupMessage", {
      groupId,
      senderId: myUserId,
      content,
    });

    appendMessage({ sender: "You", content, timestamp: Date.now() });
    messageInput.value = "";
    scrollToBottom();
  });

  // Receive message
  socket.on("groupMessage", (msg) => {
    if (msg.groupId === groupId && msg.senderId !== myUserId) {
      appendMessage({
        sender: msg.senderName || "User",
        content: msg.content,
        timestamp: Date.now()
      });
      scrollToBottom();
    }
  });

  // Back button
  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  // Load message history
  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/group-history/${groupId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await res.json();
      if (res.ok && result.messages) {
        messageList.innerHTML = "";
        result.messages.forEach(msg => {
          appendMessage({
            sender: msg.senderName || "User",
            content: msg.content,
            timestamp: msg.createdAt
          });
        });
        scrollToBottom();
      }
    } catch (err) {
      console.error("Error loading group messages:", err);
    }
  }

  function appendMessage({ sender, content, timestamp }) {
    const li = document.createElement("li");
    li.className = "bg-white text-sm p-2 rounded shadow max-w-xs self-start";
    li.innerHTML = `
      <div><strong>${sender}</strong>: ${content}</div>
      <div class="text-gray-400 text-xs text-right mt-1">
        ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    `;
    messageList.appendChild(li);
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  function getMyUserId() {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id || payload.userId;
    } catch {
      return null;
    }
  }
});