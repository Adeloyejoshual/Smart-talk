document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");

  if (!token || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  let myUserId = null;
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");

  // Get current user ID from JWT
  async function getMyUserId(token) {
    try { return JSON.parse(atob(token.split(".")[1])).id; }
    catch { return null; }
  }

  getMyUserId(token).then(id => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages(true);
  });

  // Send message
  messageForm.addEventListener("submit", async e => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const res = await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipientId: receiverId, content })
    });
    const data = await res.json();
    if (data._id) appendMessage(data, true);
    messageInput.value = "";
  });

  // Receive message
  socket.on("privateMessage", msg => {
    if (msg.senderId === receiverId || msg.sender === receiverId) appendMessage(msg, true);
  });

  function appendMessage(msg, scroll = true) {
    const isMine = msg.senderId === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent self-start" : "received self-end"} mb-1 relative`;

    const bubble = document.createElement("div");
    bubble.className = "bubble bg-white dark:bg-gray-800 rounded-xl p-2 max-w-[75%]";
    bubble.innerHTML = `
      ${msg.content || ""}
      <div class="text-xs mt-1 opacity-60 text-${isMine ? "left" : "right"}">
        ${new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);
    if (scroll) messageList.scrollTop = messageList.scrollHeight;
  }

  // Load history
  async function loadMessages(initial = false) {
    const res = await fetch(`/api/messages/history/${receiverId}?skip=0&limit=50`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.messages) {
      messageList.innerHTML = "";
      data.messages.reverse().forEach(msg => appendMessage(msg, false));
      messageList.scrollTop = messageList.scrollHeight;
    }
  }
});