document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const fileInput = document.getElementById("fileInput");
  const messageList = document.getElementById("messageList");
  const backButton = document.getElementById("backButton");
  const exportBtn = document.getElementById("exportBtn");
  const usernameHeader = document.getElementById("chat-username");

  const token = localStorage.getItem("token");
  const urlParams = new URLSearchParams(window.location.search);
  const receiverId = urlParams.get("user");

  let myUserId = null;
  let skip = 0;
  const limit = 20;
  let loading = false;
  let typingTimeout;
  let replyToId = null;

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
    const content = [...messageList.querySelectorAll("li")]
      .map((li) => li.innerText)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "SmartTalk_PrivateChat.txt";
    link.click();
  };

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    await sendMessage({ content });
    messageInput.value = "";
    replyToId = null;
    hideReplyBanner();
  });

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 2000);
  });

  fileInput.addEventListener("change", async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    const res = await fetch("/api/messages/private/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (data.success && data.urls) {
      for (const url of data.urls) {
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
        const content = isImage
          ? `<img src="${url}" class="w-40 rounded"/>`
          : `<a href="${url}" target="_blank" class="text-blue-600 underline">📎 File</a>`;
        await sendMessage({ content });
      }
    }
  });

  messageList.addEventListener("scroll", () => {
    if (messageList.scrollTop === 0 && !loading) {
      loadMessages(false);
    }
  });

  socket.on("privateMessage", (msg) => {
    const isToThisChat = [msg.sender, msg.senderId].includes(receiverId);
    if (isToThisChat) {
      appendMessage(
        {
          _id: msg._id,
          sender: msg.sender,
          content: msg.content,
          timestamp: msg.timestamp || Date.now(),
          status: msg.status,
          replyTo: msg.replyTo,
        },
        true
      );
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

  async function sendMessage({ content }) {
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

  async function fetchUsername() {
    const res = await fetch(`/api/users/${receiverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = await res.json();
    usernameHeader.textContent = user.username || user.name || "Chat";
  }

  async function getMyUserId() {
    const res = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = await res.json();
    return user._id;
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

      if (data.success && data.messages.length) {
        if (initial) messageList.innerHTML = "";
        data.messages.reverse().forEach((msg) => {
          appendMessage(
            {
              _id: msg._id,
              sender: msg.sender,
              content: msg.content,
              timestamp: msg.createdAt,
              status: msg.status,
              replyTo: msg.replyTo,
            },
            false
          );
        });
        skip += data.messages.length;
        if (initial) scrollToBottom();
      }
    } finally {
      loading = false;
    }
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  function appendMessage(msg, toBottom = true) {
    const isMine = msg.sender === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "text-right self-end" : "text-left self-start"} relative group`;

    const bubble = document.createElement("div");
    bubble.className = "bubble bg-white dark:bg-gray-800 p-2 rounded-xl max-w-[75%]";
    bubble.innerHTML = `
      ${
        msg.replyTo
          ? `<div class="text-xs italic text-blue-500 mb-1 underline cursor-pointer" data-scroll="${msg.replyTo}">
              Replying...
            </div>`
          : ""
      }
      ${msg.content}
      <div class="meta text-xs mt-1 opacity-60 text-right">
        ${new Date(msg.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
        <span class="ml-2">${msg.status === "read" ? "Seen" : msg.status === "delivered" ? "Delivered" : ""}</span>
      </div>
    `;

    // Scroll to replied message
    bubble.querySelector("[data-scroll]")?.addEventListener("click", (e) => {
      const targetId = e.target.dataset.scroll;
      const target = messageList.querySelector(`[data-id="${targetId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("bg-yellow-100");
        setTimeout(() => target.classList.remove("bg-yellow-100"), 1000);
      }
    });

    bubble.addEventListener("contextmenu", (e) => e.preventDefault());

    let pressTimer;
    bubble.addEventListener("mousedown", () => {
      pressTimer = setTimeout(() => showMenu(li, msg._id, isMine), 600);
    });
    bubble.addEventListener("mouseup", () => clearTimeout(pressTimer));
    bubble.addEventListener("mouseleave", () => clearTimeout(pressTimer));

    li.dataset.id = msg._id;
    li.appendChild(bubble);

    if (toBottom) messageList.appendChild(li);
    else messageList.prepend(li);
  }

  function showMenu(li, messageId, isMine) {
    li.querySelector(".emoji-menu")?.remove();

    const menu = document.createElement("div");
    menu.className = "emoji-menu absolute bottom-full mb-2 bg-white border rounded shadow p-1 flex gap-2 z-10";

    ["😂", "❤️", "👍"].forEach((emoji) => {
      const btn = document.createElement("button");
      btn.textContent = emoji;
      btn.onclick = () => {
        editMessage(messageId, emoji, true);
        menu.remove();
      };
      menu.appendChild(btn);
    });

    const replyBtn = document.createElement("button");
    replyBtn.textContent = "↩️";
    replyBtn.onclick = () => {
      replyToId = messageId;
      showReplyBanner();
      menu.remove();
    };
    menu.appendChild(replyBtn);

    if (isMine) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️";
      editBtn.onclick = () => {
        const newText = prompt("Edit your message:");
        if (newText) editMessage(messageId, newText, false);
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

  async function editMessage(id, newContent, append = false) {
    if (append) {
      const li = messageList.querySelector(`[data-id="${id}"]`);
      const oldContent = li.querySelector(".bubble").innerHTML.split('<div class="meta')[0];
      newContent = oldContent + newContent;
    }

    await fetch(`/api/messages/private/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: newContent }),
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

  function showReplyBanner() {
    const banner = document.getElementById("replyBanner");
    if (!banner) {
      const div = document.createElement("div");
      div.id = "replyBanner";
      div.className = "bg-blue-100 text-blue-800 px-3 py-1 text-sm";
      div.textContent = "Replying to a message...";
      messageForm.parentNode.insertBefore(div, messageForm);
    }
  }

  function hideReplyBanner() {
    document.getElementById("replyBanner")?.remove();
  }
});