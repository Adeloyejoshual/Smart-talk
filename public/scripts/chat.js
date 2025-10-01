document.addEventListener("DOMContentLoaded", async () => {
  const socket = io({ auth: { token: localStorage.getItem("token") } });
  const token = localStorage.getItem("token");
  if (!token) return window.location.href = "/home";

  let myEmail = null;
  try {
    myEmail = JSON.parse(atob(token.split(".")[1])).email;
  } catch (err) {
    return window.location.href = "/home";
  }

  const urlParams = new URLSearchParams(window.location.search);
  const receiverEmail = urlParams.get("user");
  if (!receiverEmail) return window.location.href = "/home";

  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  let typingTimeout;
  let isAtBottom = true;

  socket.emit("joinPrivateRoom", { receiverEmail });

  messageList.addEventListener("scroll", () => {
    const threshold = 100;
    isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
  });

  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/history/${receiverEmail}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.messages) {
        messageList.innerHTML = "";
        data.messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  await loadMessages();

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;
    const msgData = { toEmail: receiverEmail, content };
    socket.emit("private message", msgData);
    appendMessage({ ...msgData, senderEmail: myEmail, createdAt: new Date() });
    messageInput.value = "";
  });

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { toEmail: receiverEmail });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit("stop typing", { toEmail: receiverEmail }), 2000);
  });

  socket.on("typing", ({ fromEmail }) => {
    if (fromEmail === receiverEmail && !messageList.contains(typingIndicator)) {
      messageList.appendChild(typingIndicator);
      scrollToBottom();
    }
  });

  socket.on("stop typing", ({ fromEmail }) => {
    if (fromEmail === receiverEmail && messageList.contains(typingIndicator)) {
      messageList.removeChild(typingIndicator);
    }
  });

  socket.on("private message", msg => {
    if (msg.senderEmail === receiverEmail || msg.receiverEmail === receiverEmail) {
      appendMessage(msg);
    }
  });

  async function handleFileUpload(files) {
    if (!files.length) return;
    const formData = new FormData();
    formData.append("recipientEmail", receiverEmail);
    formData.append("file", files[0]);
    try {
      const res = await fetch("/api/messages/file", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data) appendMessage(data);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  }

  imageInput.addEventListener("change", e => handleFileUpload(e.target.files));
  fileInput.addEventListener("change", e => handleFileUpload(e.target.files));

  function appendMessage(msg) {
    const isMine = msg.senderEmail === myEmail;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent" : "received"} mb-1`;
    const bubble = document.createElement("div");
    bubble.className = "bubble p-2 rounded-xl bg-gray-200 dark:bg-gray-800";
    bubble.innerHTML = `
      ${!isMine ? `<strong>${msg.senderEmail}</strong><br>` : ""}
      ${msg.content || ""}
      ${msg.fileUrl ? `<a href="${msg.fileUrl}" target="_blank">${msg.fileType || "File"}</a>` : ""}
      <div class="meta text-xs opacity-60 text-right">${new Date(msg.createdAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);
    if (isAtBottom) scrollToBottom();
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }
});