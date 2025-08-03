document.addEventListener("DOMContentLoaded", () => {
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const backButton = document.getElementById("backButton");

  const receiverId = localStorage.getItem("receiverId");
  const token = localStorage.getItem("token");
  const socket = io();

  if (!token || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  const myUserId = getMyUserId();

  socket.emit("join", myUserId);

  // Load chat history
  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/history/${receiverId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        messageList.innerHTML = "";
        data.messages.forEach((msg) => appendMessage(msg));
        scrollToBottom();
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  }

  // Send message via Socket.IO
  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    socket.emit("privateMessage", {
      senderId: myUserId,
      receiverId,
      content
    });

    appendMessage({ sender: myUserId, content });
    messageInput.value = "";
    scrollToBottom();
  });

  // Receive real-time messages
  socket.on("privateMessage", (msg) => {
    if (msg.senderId === receiverId) {
      appendMessage({ sender: receiverId, content: msg.content });
      scrollToBottom();
    }
  });

  // UI helpers
  function appendMessage(msg) {
    const messageEl = document.createElement("div");
    messageEl.className = msg.sender === myUserId ? "message sent" : "message received";
    messageEl.textContent = msg.content;
    messageList.appendChild(messageEl);
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  function getMyUserId() {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.id;
  }

  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  // Load initial messages
  loadMessages();
});