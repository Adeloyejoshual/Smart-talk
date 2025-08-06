document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const fileInput = document.getElementById("imageInput");
  const previewContainer = document.createElement("div");
  const messageList = document.getElementById("messageList");
  const backButton = document.getElementById("backButton");
  const exportBtn = document.getElementById("exportBtn");
  const usernameHeader = document.getElementById("chat-username");

  let myUserId = null;
  let skip = 0;
  const limit = 20;
  let loading = false;
  let typingTimeout;
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");
  const token = localStorage.getItem("token");

  if (!token || !receiverId) return (window.location.href = "/home.html");

  previewContainer.className = "flex flex-wrap gap-2 p-2";
  messageForm.parentNode.insertBefore(previewContainer, messageForm);

  getMyUserId(token).then((id) => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages(true);
    fetchUsername();
  });

  backButton.onclick = () => (window.location.href = "/home.html");

  exportBtn.onclick = () => {
    const messages = [...messageList.querySelectorAll("li")].map((li) => li.innerText).join("\n");
    const blob = new Blob([messages], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "SmartTalk_PrivateChat.txt";
    link.click();
  };

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (content) await sendText(content);
    await sendFiles();
    messageInput.value = "";
    previewContainer.innerHTML = "";
    fileInput.value = "";
  });

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 1500);
  });

  fileInput.addEventListener("change", async (e) => {
    previewContainer.innerHTML = "";
    [...e.target.files].forEach((file) => {
      const type = file.type;
      const preview = document.createElement("div");
      preview.className = "border p-1 rounded text-sm bg-gray-100";

      if (type.startsWith("image/")) {
        const img = document.createElement("img");
        img.className = "h-20 w-20 object-cover rounded";
        img.src = URL.createObjectURL(file);
        preview.appendChild(img);
      } else {
        preview.textContent = `📄 ${file.name}`;
      }

      previewContainer.appendChild(preview);
    });
  });

  async function sendText(content) {
    await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipientId: receiverId, content }),
    });
  }

  async function sendFiles() {
    const files = [...fileInput.files];
    if (!files.length) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    formData.append("receiverId", receiverId);

    const res = await fetch(`/api/messages/private/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (data.success && data.messages) {
      data.messages.forEach((msg) =>
        appendMessage({
          _id: msg._id,
          sender: msg.sender,
          content: msg.image
            ? `<img src="${msg.image}" class="w-40 rounded" />`
            : `📎 File`,
          timestamp: msg.createdAt,
          status: msg.status,
        }, true)
      );
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;
    try {
      const res = await fetch(`/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        if (initial) messageList.innerHTML = "";
        data.messages.reverse().forEach((msg) =>
          appendMessage(
            {
              _id: msg._id,
              sender: msg.sender,
              content: msg.content || `<img src="${msg.image}" class="w-40 rounded" />`,
              timestamp: msg.createdAt,
              status: msg.status,
            },
            false
          )
        );
        if (initial) scrollToBottom();
        skip += data.messages.length;
      }
    } catch (e) {
      console.error("Message load failed:", e);
    } finally {
      loading = false;
    }
  }

  function appendMessage({ _id, sender, content, timestamp, status }, toBottom) {
    const isMine = sender === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "self-end" : "self-start"} w-full`;

    const div = document.createElement("div");
    div.className = `bubble ${isMine ? "sent" : "received"}`;
    div.innerHTML = `
      ${content}
      <div class="meta">${new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })} ${status === "read" ? "<span class='seen'>Seen</span>" : ""}</div>
    `;

    li.appendChild(div);
    toBottom ? messageList.appendChild(li) : messageList.prepend(li);
  }

  async function getMyUserId(token) {
    const res = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data._id;
  }

  async function fetchUsername() {
    const res = await fetch(`/api/users/${receiverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    usernameHeader.textContent = data.username || "Chat";
  }

  socket.on("privateMessage", (msg) => {
    const isToOrFrom = msg.senderId === receiverId || msg.sender === receiverId;
    if (isToOrFrom) {
      appendMessage(
        {
          _id: msg._id,
          sender: msg.senderId || msg.sender,
          content: msg.content,
          timestamp: msg.timestamp || Date.now(),
          status: msg.status,
        },
        true
      );
      scrollToBottom();
    }
  });

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  socket.on("typing", ({ from }) => {
    if (from === receiverId && !messageList.contains(typingIndicator)) {
      messageList.appendChild(typingIndicator);
      scrollToBottom();
    }
  });

  socket.on("stopTyping", ({ from }) => {
    if (from === receiverId && messageList.contains(typingIndicator)) {
      messageList.removeChild(typingIndicator);
    }
  });

  messageList.addEventListener("scroll", () => {
    if (messageList.scrollTop === 0 && !loading) {
      loadMessages(false);
    }
  });
});