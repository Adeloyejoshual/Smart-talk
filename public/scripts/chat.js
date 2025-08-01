// public/scripts/chat.js

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const messagesContainer = document.getElementById("messages");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");

  // User info from session/localStorage (set after login)
  const currentUser = localStorage.getItem("userId");
  const chatPartner = localStorage.getItem("chatWith"); // ID of the person you're chatting with

  if (!currentUser || !chatPartner) {
    window.location.href = "/"; // Redirect to login if info is missing
    return;
  }

  // Join the room for private chat
  socket.emit("joinRoom", { from: currentUser, to: chatPartner });

  // Receive messages
  socket.on("privateMessage", ({ from, message, timestamp }) => {
    const isOwn = from === currentUser;
    const msgEl = document.createElement("div");
    msgEl.className = isOwn ? "my-message" : "their-message";
    msgEl.innerHTML = `
      <div class="message-bubble">
        <strong>${isOwn ? "You" : "Them"}:</strong> ${message}
        <div class="timestamp">${new Date(timestamp).toLocaleTimeString()}</div>
      </div>
    `;
    messagesContainer.appendChild(msgEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  // Send message
  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    socket.emit("privateMessage", {
      from: currentUser,
      to: chatPartner,
      message,
    });

    messageInput.value = "";
  });

  // Optional: Load previous messages
  fetch(`/api/messages/${currentUser}/${chatPartner}`)
    .then((res) => res.json())
    .then((data) => {
      data.messages.forEach(({ from, message, timestamp }) => {
        const isOwn = from === currentUser;
        const msgEl = document.createElement("div");
        msgEl.className = isOwn ? "my-message" : "their-message";
        msgEl.innerHTML = `
          <div class="message-bubble">
            <strong>${isOwn ? "You" : "Them"}:</strong> ${message}
            <div class="timestamp">${new Date(timestamp).toLocaleTimeString()}</div>
          </div>
        `;
        messagesContainer.appendChild(msgEl);
      });
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
});