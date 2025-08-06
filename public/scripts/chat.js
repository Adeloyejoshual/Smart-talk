document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const exportBtn = document.getElementById("exportBtn");
  const backButton = document.getElementById("backButton");
  const usernameHeader = document.getElementById("chat-username");

  const token = localStorage.getItem("token");
  const receiverId = new URLSearchParams(window.location.search).get("user");

  let myUserId = null;
  let skip = 0;
  const limit = 20;
  let loading = false;
  let replyToId = null;
  let typingTimeout;

  const previewBox = document.createElement("div");
  previewBox.id = "previewBox";
  previewBox.className = "flex flex-wrap gap-2 px-2 py-1";
  messageForm.prepend(previewBox);

  if (!token || !receiverId) return (window.location.href = "/home.html");

  init();

  async function init() {
    myUserId = await getMyUserId(token);
    socket.emit("join", myUserId);
    fetchUsername();
    loadMessages(true);
  }

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (content) await sendTextMessage(content);
    await sendAllMediaFiles();
    messageInput.value = "";
    previewBox.innerHTML = "";
    replyToId = null;
  });

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 1500);
  });

  imageInput.addEventListener("change", async (e) => {
    previewBox.innerHTML = "";
    [...e.target.files].forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = () => {
        const isImage = file.type.startsWith("image/");
        const preview = document.createElement("div");
        preview.className = "relative border rounded p-1";
        preview.innerHTML = isImage
          ? `<img src="${reader.result}" class="w-20 h-20 object-cover rounded"/>`
          : `<div class="w-20 h-20 flex flex-col justify-center items-center text-xs bg-gray-100 rounded">
               <span>📄</span><span>${file.name.slice(0, 10)}</span>
             </div>`;
        previewBox.appendChild(preview);
      };
      reader.readAsDataURL(file);
    });
  });

  socket.on("privateMessage", (msg) => {
    const relevant =
      [msg.senderId, msg.sender].includes(receiverId) &&
      [msg.recipient, msg.receiverId].includes(myUserId);

    if (relevant) {
      appendMessage(msg, true);
      scrollToBottom();
    }
  });

  socket.on("typing", ({ from }) => {
    if (from === receiverId && !document.getElementById("typing")) {
      const li = document.createElement("li");
      li.id = "typing";
      li.className = "italic text-sm text-gray-500 px-2";
      li.textContent = "Typing...";
      messageList.appendChild(li);
    }
  });

  socket.on("stopTyping", ({ from }) => {
    if (from === receiverId) {
      const li = document.getElementById("typing");
      if (li) li.remove();
    }
  });

  messageList.addEventListener("scroll", () => {
    if (messageList.scrollTop === 0 && !loading) {
      const currentHeight = messageList.scrollHeight;
      loadMessages(false).then(() => {
        messageList.scrollTop = messageList.scrollHeight - currentHeight;
      });
    }
  });

  exportBtn.addEventListener("click", () => {
    const text = [...messageList.querySelectorAll("li")]
      .map((li) => li.innerText)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "SmartTalk_Chat.txt";
    link.click();
  });

  backButton.addEventListener("click", () => (window.location.href = "/home.html"));

  async function getMyUserId(token) {
    const res = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data._id;
  }

  async function fetchUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      usernameHeader.textContent = user.username || "Chat";
    } catch {
      usernameHeader.textContent = "Chat";
    }
  }

  async function sendTextMessage(content) {
    await fetch("/api/messages/private/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipientId: receiverId,
        content,
        replyTo: replyToId,
      }),
    });
  }

  async function sendAllMediaFiles() {
    const files = imageInput.files;
    if (!files.length) return;
    const formData = new FormData();
    [...files].forEach((file) => formData.append("images", file));
    formData.append("receiverId", receiverId);
    if (replyToId) formData.append("replyTo", replyToId);

    const res = await fetch("/api/messages/private/image", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    imageInput.value = "";
  }

  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;
    try {
      const res = await fetch(
        `/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        if (initial) messageList.innerHTML = "";
        data.messages.reverse().forEach((msg) => appendMessage(msg, false));
        if (initial) scrollToBottom();
        skip += data.messages.length;
      }
    } catch (err) {
      console.error("Load failed", err);
    } finally {
      loading = false;
    }
  }

  function appendMessage(msg, toBottom) {
    const li = document.createElement("li");
    const isMine = msg.sender === myUserId;
    li.className = `${isMine ? "self-end" : "self-start"} relative group max-w-[80%]`;

    let content = msg.content;
    const isImage = /<img.+src=['"](.+)['"]/.test(content);
    const isFile = !isImage && msg.image;

    if (isFile) {
      content = `<a href="${msg.image}" target="_blank" class="text-blue-600 underline">📎 File</a>`;
    }

    let replyHtml = "";
    if (msg.replyTo && msg.replyContent) {
      replyHtml = `<div class="border-l-4 pl-2 mb-1 text-sm italic text-gray-600">
        ${msg.replyContent.length > 100 ? msg.replyContent.slice(0, 100) + "..." : msg.replyContent}
      </div>`;
    }

    li.innerHTML = `
      <div class="bubble bg-${isMine ? "blue-600 text-white" : "gray-200 text-black"} rounded-xl p-2 relative">
        ${replyHtml}
        ${content}
        <div class="meta text-xs text-right opacity-70 mt-1">
          ${new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          ${msg.status === "read" ? "✓✓" : msg.status === "delivered" ? "✓" : ""}
        </div>
        <div class="flex gap-2 mt-1 emoji-row">
          ${(msg.reactions || []).map((r) => `<span>${r}</span>`).join("")}
        </div>
        <div class="absolute top-0 right-0 hidden group-hover:flex gap-2 text-xs">
          ${isMine ? `<button onclick="editMessage('${msg._id}')">✏️</button>
          <button onclick="deleteMessage('${msg._id}')">🗑️</button>` : ""}
          <button onclick="reactMessage('${msg._id}', '❤️')">❤️</button>
          <button onclick="replyMessage('${msg._id}', \`${msg.content.replace(/[`$]/g, "")}\`)">↩️</button>
        </div>
      </div>
    `;

    if (toBottom) {
      messageList.appendChild(li);
    } else {
      messageList.prepend(li);
    }
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  window.editMessage = async (id) => {
    const newContent = prompt("Edit message:");
    if (!newContent) return;
    await fetch(`/api/messages/private/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: newContent }),
    });
    loadMessages(true);
  };

  window.deleteMessage = async (id) => {
    if (!confirm("Delete this message?")) return;
    await fetch(`/api/messages/private/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadMessages(true);
  };

  window.reactMessage = async (id, emoji) => {
    await fetch(`/api/messages/private/react/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ emoji }),
    });
    loadMessages(true);
  };

  window.replyMessage = (id, content) => {
    replyToId = id;
    messageInput.value = "";
    messageInput.placeholder = `Replying to: ${content.slice(0, 30)}...`;
    messageInput.focus();
  };
});