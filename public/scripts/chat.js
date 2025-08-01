document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const chatMessages = document.getElementById("chatMessages");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");

  const displayName = localStorage.getItem("displayName") || "Anonymous";

  // Receive new messages
  socket.on("chat message", (data) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");

    const timestamp = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    messageElement.innerHTML = `
      <strong>${data.sender}</strong> <span class="time">${timestamp}</span>
      <p>${data.message}</p>
    `;

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  // Send messages
  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (msg === "") return;

    const messageData = {
      sender: displayName,
      message: msg,
      timestamp: Date.now()
    };

    socket.emit("chat message", messageData);
    messageInput.value = "";
  });
});