document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const receiverId = new URLSearchParams(window.location.search).get("user");

  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const messageList = document.getElementById("messageList");
  const backButton = document.getElementById("backButton");
  const exportBtn = document.getElementById("exportBtn");
  const usernameHeader = document.getElementById("chat-username");
  const previewContainer = document.createElement("div");
  previewContainer.className = "flex flex-wrap gap-2 p-2";
  messageForm.insertBefore(previewContainer, messageInput);

  let myUserId = null;
  let skip = 0;
  const limit = 20;
  let loading = false;
  let typingTimeout;
  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  if (!token || !receiverId) return (window.location.href = "/home.html");

  getMyUserId().then((id) => {
    myUserId = id;
    socket.emit("join", myUserId);
    fetchUsername();
    loadMessages(true);
  });

  backButton.onclick = () => (window.location.href = "/home.html");

  exportBtn.onclick = () => {
    const text = [...messageList.querySelectorAll("li")]
      .map((li) => li.innerText)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "chat.txt";
    link.click();
  };

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 2000);
  });

  imageInput?.addEventListener("change", handleFilePreview);

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content && !imageInput.files.length) return;

    // Send text message
    if (content) await sendMessage({ content });

    // Upload files
    if (imageInput.files.length) await sendFiles();

    messageInput.value = "";
    imageInput.value = "";
    previewContainer.innerHTML = "";
  });

  async function sendMessage({ content, replyTo }) {
    await fetch("/api/messages/private/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipientId: receiverId, content, replyTo }),
    });
  }

  async function sendFiles() {
    const formData = new FormData();
    [...imageInput.files].forEach((file) => formData.append("files", file));
    formData.append("receiverId", receiverId);

    const res = await fetch("/api/messages/private/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (data.success && data.urls) {
      for (const url of data.urls) {
        const ext = url.split(".").pop();
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(ext);
        const content = isImage
          ? `<img src="${url}" class="w-40 rounded" />`
          : `<a href="${url}" class="text-blue-500 underline" target="_blank">File</a>`;
        await sendMessage({ content });
      }
    }
  }

  function handleFilePreview(e) {
    previewContainer.innerHTML = "";
    const files = [...e.target.files];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const preview =
          file.type.startsWith("image/") ?
          `<img src="${reader.result}" class="w-20 h-20 object-cover rounded"/>` :
          `<div class="text-sm px-2 py-1 border rounded">${file.name}</div>`;
        const wrapper = document.createElement("div");
        wrapper.innerHTML = preview;
        previewContainer.appendChild(wrapper);
      };
      reader.readAsDataURL(file);
    });
  }

  socket.on("privateMessage", (msg) => {
    const isFromOrToReceiver =
      msg.senderId === receiverId || msg.sender === receiverId;
    if (!isFromOrToReceiver) return;

    appendMessage({
      _id: msg._id,
      sender: msg.senderId || msg.sender,
      content: msg.content,
      timestamp: msg.timestamp || Date.now(),
      status: msg.status,
    }, true);
    scrollToBottom();
  });

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

  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;
    try {
      const res = await fetch(
        `/api/messages/history/${receiverId}?skip=${skip}&limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (data.success && data.messages) {
        if (initial) messageList.innerHTML = "";
        const msgs = data.messages.reverse();
        msgs.forEach((msg) => appendMessage({
          _id: msg._id,
          sender: msg.sender,
          content: msg.content,
          timestamp: msg.createdAt,
          status: msg.status,
        }, false));
        if (initial) scrollToBottom();
        skip += msgs.length;
      }
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      loading = false;
    }
  }

  messageList.addEventListener("scroll", () => {
    if (messageList.scrollTop === 0 && !loading) loadMessages(false);
  });

  async function fetchUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      usernameHeader.textContent = user.username || user.name || "Chat";
    } catch {
      usernameHeader.textContent = "Chat";
    }
  }

  function appendMessage({ _id, sender, content, timestamp, status }, toBottom) {
    const isMine = sender === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent self-end text-right" : "received self-start text-left"} relative group`;

    const bubble = document.createElement("div");
    bubble.className = "bubble bg-white dark:bg-gray-800 rounded-xl p-2 max-w-[75%]";
    bubble.innerHTML = `
      ${content}
      <div class="meta text-xs mt-1 opacity-60 text-right">
        ${new Date(timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
        <span class="ml-2">${status === "delivered" ? "Delivered" : status === "read" ? "Seen" : ""}</span>
      </div>
    `;

    // Long-press or right click menu
    let pressTimer;
    bubble.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showEmojiMenu(li, _id, isMine);
    });
    bubble.addEventListener("touchstart", () => {
      pressTimer = setTimeout(() => showEmojiMenu(li, _id, isMine), 600);
    });
    ["touchend", "mouseup", "mouseleave"].forEach((ev) =>
      bubble.addEventListener(ev, () => clearTimeout(pressTimer))
    );

    li.appendChild(bubble);
    toBottom ? messageList.appendChild(li) : messageList.prepend(li);
  }

  function showEmojiMenu(li, messageId, isMine) {
    let existing = li.querySelector(".emoji-menu");
    if (existing) return existing.remove();

    const menu = document.createElement("div");
    menu.className = "emoji-menu absolute bottom-full mb-2 bg-white border rounded p-1 shadow text-sm flex gap-1 z-10";

    ["😂", "❤️", "👍"].forEach((emoji) => {
      const btn = document.createElement("button");
      btn.textContent = emoji;
      btn.onclick = () => {
        editMessageContent(messageId, emoji, true);
        menu.remove();
      };
      menu.appendChild(btn);
    });

    if (isMine) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️";
      editBtn.onclick = () => {
        const newText = prompt("Edit message:");
        if (newText) editMessageContent(messageId, newText, false);
        menu.remove();
      };
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.onclick = () => {
        if (confirm("Delete this message?")) deleteMessage(messageId);
        menu.remove();
      };
      menu.appendChild(editBtn);
      menu.appendChild(delBtn);
    }

    li.appendChild(menu);
  }

  async function editMessageContent(id, text, append = false) {
    try {
      await fetch(`/api/messages/private/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: text, append }),
      });
      loadMessages(true);
    } catch {
      alert("Failed to update");
    }
  }

  async function deleteMessage(id) {
    try {
      await fetch(`/api/messages/private/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      loadMessages(true);
    } catch {
      alert("Failed to delete");
    }
  }

  async function getMyUserId() {
    const res = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = await res.json();
    return user._id;
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }
});