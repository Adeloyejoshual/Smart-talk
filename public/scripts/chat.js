document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) return window.location.href = "/home.html";

  const socket = io({ auth: { token } });
  const urlParams = new URLSearchParams(window.location.search);
  const receiverEmail = urlParams.get("userEmail"); // Use email now
  if (!receiverEmail) return window.location.href = "/home.html";

  let myEmail = null;
  let skip = 0, limit = 20, loading = false, isAtBottom = true, typingTimeout;

  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  // Extract email from JWT
  async function getMyEmail(token) {
    try { return JSON.parse(atob(token.split(".")[1])).email; } catch { return null; }
  }

  getMyEmail(token).then(email => {
    myEmail = email;
    socket.emit("joinPrivateRoom", { receiverEmail }); // Join private room by email
    loadMessages(true);
  });

  // Scroll handling
  messageList.addEventListener("scroll", () => {
    const threshold = 100;
    isAtBottom = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight < threshold;
    if (messageList.scrollTop === 0 && !loading) loadMessages(false);
  });

  // Send message
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const msgData = { toEmail: receiverEmail, content };

    socket.emit("private message", msgData); // Send email-based message
    appendMessage({ ...msgData, senderName: "You", timestamp: Date.now() }, true);
    messageInput.value = "";
  });

  // Typing indicators
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { toEmail: receiverEmail });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit("stop typing", { toEmail: receiverEmail }), 2000);
  });

  // File/Image uploads
  async function handleFileUpload(files) {
    if (!files.length) return;
    const formData = new FormData();
    formData.append("recipientEmail", receiverEmail);
    formData.append("file", files[0]);
    const res = await fetch("/api/messages/file", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
    const data = await res.json();
    if (data) appendMessage(data, true);
  }
  imageInput.addEventListener("change", e => handleFileUpload([...e.target.files]));
  fileInput.addEventListener("change", e => handleFileUpload([...e.target.files]));

  // Socket listeners
  socket.on("private message", msg => {
    if (msg.senderEmail === receiverEmail || msg.receiverEmail === receiverEmail) {
      appendMessage(msg, isAtBottom);
    }
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

  // Append messages
  function appendMessage(msg, scroll = true) {
    const isMine = msg.senderEmail === myEmail || msg.senderName === "You";
    const li = document.createElement("li");
    li.className = `${isMine ? "sent" : "received"} mb-1`;

    const bubble = document.createElement("div");
    bubble.className = "bubble p-2 rounded-xl bg-gray-200 dark:bg-gray-800";
    bubble.innerHTML = `
      ${!isMine && msg.senderName ? `<strong>${msg.senderName || msg.senderEmail}</strong><br>` : ""}
      ${msg.content || ""}
      ${msg.fileUrl ? `<a href="${msg.fileUrl}" target="_blank">${msg.fileType || "File"}</a>` : ""}
      <div class="meta text-xs opacity-60 text-right">${new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    `;
    li.appendChild(bubble);
    messageList.appendChild(li);
    if (scroll) scrollToBottom();
  }

  // Load previous messages
  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;
    try {
      const res = await fetch(`/api/messages/history/${receiverEmail}?skip=${skip}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.messages?.length) {
        if (initial) messageList.innerHTML = "";
        data.messages.forEach(msg => appendMessage(msg, false));
        scrollToBottom();
        skip += data.messages.length;
      }
    } catch (err) { console.error(err); }
    finally { loading = false; }
  }

  function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }
});