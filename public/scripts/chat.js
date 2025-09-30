document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) return window.location.href = "/";

  const urlParams = new URLSearchParams(window.location.search);
  const receiverIdentifier = urlParams.get("user"); // email or username
  if (!receiverIdentifier) return window.location.href = "/home";

  // Decode token to get my info
  const me = JSON.parse(atob(token.split(".")[1]));
  const myEmail = me.email;

  const socket = io({ auth: { token } });

  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  let typingTimeout;

  // Typing indicator
  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  // --------- Load old messages ---------
  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/history/${receiverIdentifier}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) return;

      messageList.innerHTML = "";
      data.messages.forEach(msg => appendMessage(msg));
      scrollToBottom();
    } catch (err) {
      console.error("❌ Error loading messages:", err);
    }
  }
  await loadMessages();

  // --------- Append message ---------
  function appendMessage(msg, scroll = true) {
    const isMine = msg.senderEmail === myEmail;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent" : "received"} mb-1`;

    const bubble = document.createElement("div");
    bubble.className = "bubble p-2 rounded-xl bg-gray-200 dark:bg-gray-800";
    bubble.innerHTML = `
      ${!isMine ? `<strong>${msg.senderEmail}</strong><br>` : ""}
      ${msg.content || ""}
      ${msg.fileUrl ? `<a href="${msg.fileUrl}" target="_blank">${msg.fileType || "File"}</a>` : ""}
      <div class="meta text-xs opacity-60 text-right">
        ${new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);

    if (scroll) scrollToBottom();
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  // --------- Sending messages ---------
  messageForm.addEventListener("submit", e => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const msgData = { toEmail: receiverIdentifier, content };
    socket.emit("private message", msgData);

    appendMessage({ ...msgData, senderEmail: myEmail, createdAt: new Date() });
    messageInput.value = "";
  });

  // --------- Typing indicators ---------
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { toEmail: receiverIdentifier });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stop typing", { toEmail: receiverIdentifier });
    }, 2000);
  });

  socket.on("typing", ({ fromEmail }) => {
    if (fromEmail === receiverIdentifier && !messageList.contains(typingIndicator)) {
      messageList.appendChild(typingIndicator);
      scrollToBottom();
    }
  });
  socket.on("stop typing", ({ fromEmail }) => {
    if (fromEmail === receiverIdentifier && messageList.contains(typingIndicator)) {
      messageList.removeChild(typingIndicator);
    }
  });

  // --------- Receiving messages ---------
  socket.on("private message", msg => {
    if (msg.senderEmail === receiverIdentifier || msg.receiverEmail === receiverIdentifier) {
      appendMessage(msg);
    }
  });

  // --------- File/Image uploads ---------
  async function handleFileUpload(files) {
    if (!files.length) return;
    const formData = new FormData();
    formData.append("recipientEmail", receiverIdentifier);
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
      console.error("❌ File upload error:", err);
    }
  }

  imageInput.addEventListener("change", e => handleFileUpload(e.target.files));
  fileInput.addEventListener("change", e => handleFileUpload(e.target.files));
});