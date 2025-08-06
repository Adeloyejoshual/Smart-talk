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

  const typingIndicator = document.createElement("li");
  typingIndicator.className = "italic text-sm text-gray-500 px-2";
  typingIndicator.textContent = "Typing...";

  if (!token || !receiverId) return (window.location.href = "/home.html");

  getMyUserId(token).then((id) => {
    myUserId = id;
    socket.emit("join", myUserId);
    loadMessages(true);
    fetchUsername();
  });

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    await sendMessage({ content });
    messageInput.value = "";
  });

  async function sendMessage({ content }) {
    await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipientId: receiverId, content }),
    });
  }

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { to: receiverId, from: myUserId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stopTyping", { to: receiverId, from: myUserId });
    }, 2000);
  });

  imageInput?.addEventListener("change", async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;

    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));

    const res = await fetch(`/api/messages/private/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (data.success && data.urls) {
      for (const url of data.urls) {
        await sendMessage({
          content: `<img src='${url}' class='w-40 rounded'/>`,
        });
      }
    }
  });

  socket.on("privateMessage", (msg) => {
    const isFromOrToReceiver =
      msg.senderId === receiverId ||
      msg.sender === receiverId;

    if (isFromOrToReceiver) {
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

  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
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
        if (initial) messageList.innerHTML = "";
        data.messages.reverse().forEach((msg) => {
          appendMessage(
            {
              _id: msg._id,
              sender: msg.sender,
              content: msg.content,
              timestamp: msg.createdAt,
              status: msg.status,
            },
            false
          );
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

  messageList.addEventListener("scroll", () => {
    if (messageList.scrollTop === 0 && !loading) {
      loadMessages(false);
    }
  });

  async function fetchUsername() {
    try {
      const res = await fetch(`/api/users/${receiverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      usernameHeader.textContent = user.username || user.name || "Chat";
    } catch (err) {
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

    // Long press menu
    let pressTimer;
    bubble.addEventListener("touchstart", (e) => {
      pressTimer = setTimeout(() => showEmojiMenu(li, _id, isMine), 600);
    });
    bubble.addEventListener("touchend", () => clearTimeout(pressTimer));
    bubble.addEventListener("mousedown", () => {
      pressTimer = setTimeout(() => showEmojiMenu(li, _id, isMine), 600);
    });
    bubble.addEventListener("mouseup", () => clearTimeout(pressTimer));
    bubble.addEventListener("mouseleave", () => clearTimeout(pressTimer));

    li.appendChild(bubble);
    if (toBottom) {
      messageList.appendChild(li);
    } else {
      messageList.prepend(li);
    }
  }

  function showEmojiMenu(li, messageId, isMine) {
    let menu = li.querySelector(".emoji-menu");
    if (menu) {
      menu.remove();
      return;
    }

    menu = document.createElement("div");
    menu.className = "emoji-menu absolute z-10 bottom-full mb-2 bg-white border rounded p-1 shadow text-sm flex gap-1";

    ["😂", "❤️", "👍"].forEach((emoji) => {
      const btn = document.createElement("button");
      btn.textContent = emoji;
      btn.className = "hover:scale-110";
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
        const newContent = prompt("Edit your message:");
        if (newContent) editMessageContent(messageId, newContent, false);
        menu.remove();
      };
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑️";
      deleteBtn.onclick = () => {
        if (confirm("Delete this message?")) deleteMessage(messageId);
        menu.remove();
      };
      menu.appendChild(editBtn);
      menu.appendChild(deleteBtn);
    }

    li.appendChild(menu);
  }

  async function editMessageContent(id, newText, isAppend = false) {
    const msgLi = [...messageList.children].find((li) =>
      li.innerHTML.includes(`editMessage('${id}')`)
    );
    let newContent;
    if (isAppend && msgLi) {
      const oldHTML = msgLi.querySelector(".bubble").innerHTML;
      newContent = oldHTML.split('<div class="meta')[0] + newText;
    } else {
      newContent = newText;
    }

    try {
      await fetch(`/api/messages/private/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newContent }),
      });
      loadMessages(true);
    } catch {
      alert("Failed to edit");
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