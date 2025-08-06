document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");

  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const fileInput = document.getElementById("fileInput");
  const backButton = document.getElementById("backButton");
  const usernameHeader = document.getElementById("chat-username");
  const previewBox = document.getElementById("previewBox");

  let myUserId = null;
  let skip = 0;
  const limit = 20;
  let loading = false;
  let typingTimeout;
  let replyTo = null;

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

  // Back to Home
  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  // Typing Indicator
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 2000);
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

  // Message Submit
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content && !fileInput.files.length) return;

    // Send text
    if (content) {
      await sendMessage({ content, replyTo });
      messageInput.value = "";
      replyTo = null;
    }

    // Send files/images
    if (fileInput.files.length) {
      const formData = new FormData();
      [...fileInput.files].forEach((f) => formData.append("files", f));
      const res = await fetch("/api/messages/private/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        for (const { url, type } of data.files) {
          const fileContent =
            type === "image"
              ? `<img src="${url}" class="w-40 rounded" />`
              : `<a href="${url}" target="_blank" class="text-blue-600 underline">${url.split("/").pop()}</a>`;
          await sendMessage({ content: fileContent, replyTo });
        }
        fileInput.value = "";
        previewBox.innerHTML = "";
        replyTo = null;
      }
    }
  });

  // File Previews
  fileInput.addEventListener("change", () => {
    previewBox.innerHTML = "";
    [...fileInput.files].forEach((file) => {
      const div = document.createElement("div");
      div.className = "text-xs text-gray-700 flex items-center gap-2";

      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.className = "w-20 h-20 object-cover rounded";
        div.appendChild(img);
      } else {
        div.innerHTML = `📄 ${file.name}`;
      }

      previewBox.appendChild(div);
    });
  });

  socket.on("privateMessage", (msg) => {
    if (
      msg.sender === receiverId ||
      msg.senderId === receiverId ||
      msg.recipient === receiverId
    ) {
      appendMessage(msg, true);
      scrollToBottom();
    }
  });

  messageList.addEventListener("scroll", () => {
    if (messageList.scrollTop === 0 && !loading) {
      loadMessages(false);
    }
  });

  async function sendMessage({ content, replyTo = null }) {
    await fetch("/api/messages/private/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipientId: receiverId, content, replyTo }),
    });
  }

  async function getMyUserId() {
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
      usernameHeader.textContent = user.username || user.name || "Chat";
    } catch {
      usernameHeader.textContent = "Chat";
    }
  }

  async function loadMessages(initial = false) {
    loading = true;
    try {
      const res = await fetch(
        `/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (initial) messageList.innerHTML = "";
      data.messages.reverse().forEach((msg) => appendMessage(msg, false));
      if (initial) scrollToBottom();
      skip += data.messages.length;
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      loading = false;
    }
  }

  function appendMessage(msg, toBottom) {
    const isMine = msg.sender === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "text-right" : "text-left"} group relative`;

    const bubble = document.createElement("div");
    bubble.className = `bubble ${
      isMine ? "bg-blue-600 text-white" : "bg-gray-200 text-black"
    } p-2 rounded-xl inline-block max-w-[75%]`;

    // Inline reply display
    if (msg.reply && msg.reply.content) {
      const reply = document.createElement("div");
      reply.className =
        "text-xs italic text-gray-500 mb-1 border-l-2 border-blue-400 pl-2 cursor-pointer";
      reply.textContent = `↩️ ${msg.reply.content.replace(/<[^>]+>/g, "").slice(0, 50)}`;
      reply.onclick = () => scrollToMessage(msg.reply._id);
      bubble.appendChild(reply);
    }

    bubble.innerHTML += msg.content;

    const meta = document.createElement("div");
    meta.className = "meta text-xs mt-1 text-right opacity-70";
    meta.textContent = new Date(msg.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    bubble.appendChild(meta);

    // Emoji, edit, delete options
    bubble.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showMenu(e, msg._id, isMine, msg.content);
    });

    li.dataset.msgid = msg._id;
    li.appendChild(bubble);

    if (toBottom) {
      messageList.appendChild(li);
    } else {
      messageList.prepend(li);
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      messageList.scrollTop = messageList.scrollHeight;
    }, 100);
  }

  function scrollToMessage(id) {
    const target = [...messageList.children].find((li) => li.dataset.msgid === id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring", "ring-blue-400");
      setTimeout(() => target.classList.remove("ring", "ring-blue-400"), 2000);
    }
  }

  function showMenu(e, id, isMine, content) {
    const existing = document.getElementById("context-menu");
    if (existing) existing.remove();

    const menu = document.createElement("div");
    menu.id = "context-menu";
    menu.className =
      "absolute bg-white border rounded shadow p-1 z-50 text-sm flex gap-2";

    ["😂", "❤️", "👍"].forEach((emoji) => {
      const btn = document.createElement("button");
      btn.textContent = emoji;
      btn.onclick = async () => {
        await editMessage(id, content + " " + emoji);
        menu.remove();
      };
      menu.appendChild(btn);
    });

    if (isMine) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️";
      editBtn.onclick = async () => {
        const updated = prompt("Edit:", content);
        if (updated) await editMessage(id, updated);
        menu.remove();
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.onclick = async () => {
        if (confirm("Delete?")) await deleteMessage(id);
        menu.remove();
      };

      const replyBtn = document.createElement("button");
      replyBtn.textContent = "↩️";
      replyBtn.onclick = () => {
        replyTo = id;
        messageInput.focus();
        menu.remove();
      };

      menu.append(editBtn, delBtn, replyBtn);
    }

    document.body.appendChild(menu);
    menu.style.top = e.pageY + "px";
    menu.style.left = e.pageX + "px";
    document.addEventListener(
      "click",
      () => {
        menu.remove();
      },
      { once: true }
    );
  }

  async function editMessage(id, content) {
    await fetch(`/api/messages/private/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
    loadMessages(true);
  }

  async function deleteMessage(id) {
    await fetch(`/api/messages/private/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadMessages(true);
  }
});