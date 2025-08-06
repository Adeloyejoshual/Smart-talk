// /public/scripts/chat.js

document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const imageInput = document.getElementById("imageInput");
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
  let replyToMessageId = null;

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  if (!token || !receiverId) return (window.location.href = "/home.html");

  init();

  async function init() {
    myUserId = await getMyUserId(token);
    socket.emit("join", myUserId);
    loadMessages(true);
    fetchUsername();
  }

  backButton.onclick = () => (window.location.href = "/home.html");

  exportBtn.onclick = () => {
    const text = [...messageList.querySelectorAll("li")]
      .map(li => li.innerText)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "SmartTalk_Chat.txt";
    a.click();
  };

  messageForm.onsubmit = async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;
    await sendMessage({ content });
    messageInput.value = "";
    replyToMessageId = null;
    removeReplyTag();
  };

  imageInput.addEventListener("change", async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;

    const formData = new FormData();
    files.forEach(file => formData.append("images", file));

    const res = await fetch("/api/messages/private/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (data.success && data.urls) {
      for (const url of data.urls) {
        await sendMessage({ content: `<img src='${url}' class='w-40 rounded'/>` });
      }
    }
  });

  messageInput.oninput = () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 2000);
  };

  socket.on("privateMessage", (msg) => {
    const relevant = msg.senderId === receiverId || msg.sender === receiverId;
    if (relevant) {
      appendMessage({
        _id: msg._id,
        sender: msg.senderId || msg.sender,
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
        status: msg.status,
        emoji: msg.emoji,
        replyTo: msg.replyTo,
      }, true);
      scrollToBottom();
    }
  });

  socket.on("typing", ({ from }) => {
    if (from === receiverId && !messageList.contains(typingIndicator)) {
      messageList.append(typingIndicator);
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

  async function sendMessage({ content }) {
    await fetch("/api/messages/private/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipientId: receiverId, content, replyTo: replyToMessageId }),
    });
  }

  async function loadMessages(initial = false) {
    if (loading) return;
    loading = true;

    try {
      const res = await fetch(`/api/messages/history/${receiverId}?skip=${skip}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success && data.messages) {
        if (initial) messageList.innerHTML = "";
        data.messages.reverse().forEach(msg => {
          appendMessage({
            _id: msg._id,
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.createdAt,
            status: msg.status,
            emoji: msg.emoji,
            replyTo: msg.replyTo,
          }, false);
        });
        if (initial) scrollToBottom();
        skip += data.messages.length;
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      loading = false;
    }
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

  function appendMessage({ _id, sender, content, timestamp, status, emoji, replyTo }, toBottom) {
    const isMine = sender === myUserId;
    const li = document.createElement("li");
    li.className = `${isMine ? "self-end text-right" : "self-start text-left"} relative group`;
    li.id = `msg-${_id}`;

    let replyBlock = "";
    if (replyTo) {
      const reply = document.getElementById(`msg-${replyTo}`);
      if (reply) {
        const replyText = reply.querySelector(".bubble")?.innerText.split("\n")[0].slice(0, 100);
        replyBlock = `<div class="text-xs bg-gray-100 px-2 py-1 mb-1 border-l-4 border-blue-400">${replyText}</div>`;
      }
    }

    li.innerHTML = `
      <div class="bubble bg-white p-2 rounded-xl max-w-[75%] shadow">
        ${replyBlock}
        ${content}
        ${emoji ? `<div class="mt-1">${emoji}</div>` : ""}
        <div class="meta text-xs mt-1 text-gray-400 text-right">
          ${new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          <span class="ml-2">${status === "read" ? "Seen" : status === "delivered" ? "Delivered" : ""}</span>
        </div>
      </div>
    `;

    // Add emoji/reply/edit/delete on long press
    let pressTimer;
    li.addEventListener("mousedown", () => {
      pressTimer = setTimeout(() => showOptionsMenu(li, _id, isMine), 600);
    });
    li.addEventListener("mouseup", () => clearTimeout(pressTimer));
    li.addEventListener("mouseleave", () => clearTimeout(pressTimer));

    // Inline reply on click
    li.addEventListener("click", () => {
      replyToMessageId = _id;
      showReplyTag(li);
    });

    toBottom ? messageList.appendChild(li) : messageList.prepend(li);
  }

  function showOptionsMenu(li, messageId, isMine) {
    let existing = li.querySelector(".emoji-menu");
    if (existing) return existing.remove();

    const menu = document.createElement("div");
    menu.className = "emoji-menu absolute -top-10 right-2 bg-white border rounded shadow text-sm p-1 flex gap-1";

    ["😂", "❤️", "👍"].forEach(emoji => {
      const btn = document.createElement("button");
      btn.textContent = emoji;
      btn.onclick = async () => {
        await fetch(`/api/messages/react/${messageId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ emoji }),
        });
        loadMessages(true);
      };
      menu.appendChild(btn);
    });

    if (isMine) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "✏️";
      editBtn.onclick = async () => {
        const newText = prompt("Edit message:");
        if (newText) {
          await fetch(`/api/messages/private/${messageId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ content: newText }),
          });
          loadMessages(true);
        }
      };
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.onclick = async () => {
        if (confirm("Delete message?")) {
          await fetch(`/api/messages/private/${messageId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          loadMessages(true);
        }
      };
      menu.appendChild(editBtn);
      menu.appendChild(delBtn);
    }

    li.appendChild(menu);
  }

  function scrollToBottom() {
    messageList.scrollTop = messageList.scrollHeight;
  }

  function showReplyTag(li) {
    removeReplyTag();
    const preview = li.querySelector(".bubble")?.innerText.slice(0, 80);
    const replyTag = document.createElement("div");
    replyTag.id = "reply-tag";
    replyTag.className = "bg-blue-100 text-xs text-gray-800 px-2 py-1 mb-1 rounded flex justify-between items-center";
    replyTag.innerHTML = `<span>Replying to: ${preview}</span><button onclick="document.getElementById('reply-tag')?.remove();replyToMessageId=null;">✖</button>`;
    messageForm.prepend(replyTag);
  }

  function removeReplyTag() {
    document.getElementById("reply-tag")?.remove();
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
});