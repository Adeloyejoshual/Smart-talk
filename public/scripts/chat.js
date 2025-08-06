// /public/scripts/chat.js

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const messageList = document.getElementById("messageList");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
  const usernameHeader = document.getElementById("chat-username");
  const exportBtn = document.getElementById("exportBtn");
  const backButton = document.getElementById("backButton");

  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");
  let myUserId = null;
  let skip = 0;
  const limit = 20;
  let loading = false;
  let typingTimeout;

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  let replyTo = null;
  let previewImages = [];
  let previewFiles = [];

  if (!token || !receiverId) return (window.location.href = "/home.html");

  getMyUserId(token).then((id) => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages(true);
    fetchUsername();
  });

  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  exportBtn.addEventListener("click", () => {
    const messages = [...messageList.querySelectorAll("li")]
      .map((li) => li.innerText)
      .join("\n");
    const blob = new Blob([messages], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "SmartTalk_PrivateChat.txt";
    link.click();
  });

  imageInput.addEventListener("change", (e) => {
    previewImages = [];
    previewFiles = [];
    const previewBox = document.getElementById("previewBox");
    previewBox.innerHTML = "";

    [...e.target.files].forEach((file) => {
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        previewImages.push(file);
        const img = document.createElement("img");
        img.src = url;
        img.className = "w-20 h-20 rounded mr-2";
        previewBox.appendChild(img);
      } else {
        previewFiles.push(file);
        const div = document.createElement("div");
        div.textContent = file.name;
        div.className = "text-sm bg-gray-200 px-2 py-1 rounded mr-2";
        previewBox.appendChild(div);
      }
    });
  });

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    const previewBox = document.getElementById("previewBox");
    if (!content && previewImages.length === 0 && previewFiles.length === 0) return;

    if (previewImages.length > 0 || previewFiles.length > 0) {
      const formData = new FormData();
      previewImages.forEach((img) => formData.append("images", img));
      previewFiles.forEach((file) => formData.append("files", file));
      formData.append("recipientId", receiverId);
      if (replyTo) formData.append("replyTo", replyTo);

      const res = await fetch(`/api/messages/private/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
    }

    if (content) {
      await fetch(`/api/messages/private/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId: receiverId, content, replyTo }),
      });
    }

    messageInput.value = "";
    imageInput.value = "";
    previewBox.innerHTML = "";
    replyTo = null;
    previewImages = [];
    previewFiles = [];
  });

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 2000);
  });

  socket.on("privateMessage", (msg) => {
    if (
      msg.senderId === receiverId ||
      msg.sender === receiverId ||
      msg.recipient === receiverId
    ) {
      appendMessage(msg, true);
      scrollToBottom();
    }
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
        `/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (data.success && data.messages) {
        const oldScroll = messageList.scrollHeight;
        data.messages.reverse().forEach((msg) => appendMessage(msg, false));
        if (initial) scrollToBottom();
        else messageList.scrollTop = messageList.scrollHeight - oldScroll;
        skip += data.messages.length;
      }
    } catch (err) {
      console.error("Load failed:", err);
    } finally {
      loading = false;
    }
  }

  messageList.addEventListener("scroll", () => {
    if (messageList.scrollTop === 0 && !loading) {
      loadMessages(false);
    }
  });

  function appendMessage(msg, toBottom) {
    const isMine = msg.sender === myUserId || msg.senderId === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "sent" : "received"} flex flex-col relative`;

    const bubble = document.createElement("div");
    bubble.className = "bubble bg-white rounded-xl p-2 max-w-[75%]";

    if (msg.replyTo && msg.replyContent) {
      const reply = document.createElement("div");
      reply.className = "text-sm text-gray-500 border-l-4 pl-2 mb-1";
      reply.textContent = msg.replyContent;
      reply.onclick = () => scrollToMessage(msg.replyTo);
      reply.classList.add("cursor-pointer");
      bubble.appendChild(reply);
    }

    bubble.innerHTML += msg.content;

    const meta = document.createElement("div");
    meta.className = "meta text-xs mt-1 text-right";
    meta.innerHTML = `
      ${new Date(msg.timestamp || msg.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}
      <span class="ml-1">${msg.status === "read" ? "Seen" : msg.status === "delivered" ? "Delivered" : ""}</span>
    `;

    bubble.appendChild(meta);

    // Long-press actions
    bubble.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showMessageOptions(li, msg._id, isMine, msg.content);
    });

    li.appendChild(bubble);
    li.dataset.id = msg._id;
    if (toBottom) messageList.appendChild(li);
    else messageList.prepend(li);
  }

  function showMessageOptions(li, id, isMine, content) {
    let menu = li.querySelector(".menu");
    if (menu) {
      menu.remove();
      return;
    }

    menu = document.createElement("div");
    menu.className = "menu absolute z-10 top-0 right-0 bg-white border shadow rounded text-sm p-1 flex gap-1";

    ["😂", "❤️", "👍"].forEach((emoji) => {
      const btn = document.createElement("button");
      btn.textContent = emoji;
      btn.onclick = () => {
        editMessageContent(id, content + " " + emoji);
        menu.remove();
      };
      menu.appendChild(btn);
    });

    const replyBtn = document.createElement("button");
    replyBtn.textContent = "↩️ Reply";
    replyBtn.onclick = () => {
      replyTo = id;
      menu.remove();
    };
    menu.appendChild(replyBtn);

    if (isMine) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️ Edit";
      editBtn.onclick = () => {
        const newText = prompt("Edit:", content);
        if (newText) editMessageContent(id, newText);
        menu.remove();
      };
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️ Delete";
      delBtn.onclick = () => {
        if (confirm("Delete?")) deleteMessage(id);
        menu.remove();
      };
      menu.appendChild(editBtn);
      menu.appendChild(delBtn);
    }

    li.appendChild(menu);
  }

  async function editMessageContent(id, newText) {
    try {
      await fetch(`/api/messages/private/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newText }),
      });
      loadMessages(true);
    } catch {
      alert("Edit failed");
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
      alert("Delete failed");
    }
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

  async function getMyUserId(token) {
    try {
      const res = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      return user._id;
    } catch {
      return null;
    }
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  function scrollToMessage(id) {
    const target = [...messageList.children].find((li) => li.dataset.id === id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring-2", "ring-blue-400");
      setTimeout(() => target.classList.remove("ring-2", "ring-blue-400"), 1500);
    }
  }
});