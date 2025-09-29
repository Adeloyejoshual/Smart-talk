// /public/js/privateChat.js
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const chatUsername = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");

  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  const currentUser = localStorage.getItem("currentUser") || "me";
  const urlParams = new URLSearchParams(window.location.search);
  const chatPartner = urlParams.get("user") || null;
  chatUsername.textContent = chatPartner;

  let lastSeen = null;
  statusIndicator.textContent = "Online";

  // Format date header
  function formatDateHeader(date) {
    const msgDate = new Date(date);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (msgDate.toDateString() === now.toDateString()) return "Today";
    if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";
    return msgDate.toLocaleDateString();
  }

  // Format time
  function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Add message to chat
  function addMessage(msg) {
    const msgDate = new Date(msg.createdAt || msg.date);
    const lastMessage = messageList.lastElementChild;

    // Date header
    if (!lastMessage || lastMessage.dataset.date !== msgDate.toDateString()) {
      const header = document.createElement("li");
      header.textContent = formatDateHeader(msgDate);
      header.className = "text-center text-gray-500 dark:text-gray-400 text-xs my-2";
      header.dataset.date = msgDate.toDateString();
      messageList.appendChild(header);
    }

    const li = document.createElement("li");
    li.classList.add("flex", "items-end", "space-x-2", "my-1");
    li.dataset.date = msgDate.toDateString();

    const isSent = msg.sender.username === currentUser;

    // Avatar
    const avatar = document.createElement("img");
    avatar.src = msg.sender.avatar || "/default-avatar.png";
    avatar.className = "w-6 h-6 rounded-full";

    // Bubble
    const bubble = document.createElement("div");
    bubble.classList.add(
      "bubble",
      "px-4",
      "py-2",
      "rounded-lg",
      "max-w-xs",
      "break-words",
      isSent
        ? "bg-blue-600 text-white rounded-tl-lg"
        : "bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-tr-lg"
    );

    if (msg.type === "text") {
      bubble.textContent = msg.content;
    } else if (msg.type === "image") {
      const img = document.createElement("img");
      img.src = msg.image;
      img.className = "max-w-xs rounded-lg";
      bubble.appendChild(img);
      if (msg.content) {
        const text = document.createElement("div");
        text.textContent = msg.content;
        bubble.appendChild(text);
      }
    } else if (msg.type === "file") {
      const link = document.createElement("a");
      link.href = msg.file;
      link.textContent = msg.content || msg.file.split("/").pop();
      link.target = "_blank";
      link.className = "underline text-blue-600";
      bubble.appendChild(link);
    }

    // Time
    const time = document.createElement("div");
    time.classList.add(
      "text-xs",
      "text-gray-500",
      "mt-1",
      isSent ? "text-right" : "text-left"
    );
    time.textContent = formatTime(msgDate);
    bubble.appendChild(time);

    // Arrange bubble and avatar
    if (isSent) {
      li.classList.add("justify-end");
      li.appendChild(bubble);
      li.appendChild(avatar);
    } else {
      li.classList.add("justify-start");
      li.appendChild(avatar);
      li.appendChild(bubble);
    }

    messageList.appendChild(li);
    messageList.scrollTop = messageList.scrollHeight;
  }

  // Send message
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const msg = {
      sender: currentUser,
      recipient: chatPartner,
      content,
      type: "text",
    };

    addMessage(msg);
    messageInput.value = "";

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
      const savedMsg = await res.json();
      socket.emit("private-message", savedMsg);
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Message failed to send.");
    }
  });

  // Receive message
  socket.on("private-message", (msg) => {
    if (msg.sender.username === chatPartner || msg.recipient === chatPartner) {
      addMessage(msg);
    }
  });

  // Typing indicator
  let typingTimeout;
  messageInput.addEventListener("input", () => {
    socket.emit("typing", { sender: currentUser, receiver: chatPartner });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("stop-typing", { sender: currentUser, receiver: chatPartner });
    }, 1000);
  });
  socket.on("typing", ({ sender }) => {
    if (sender === chatPartner) statusIndicator.textContent = "Typing...";
  });
  socket.on("stop-typing", ({ sender }) => {
    if (sender === chatPartner) statusIndicator.textContent = lastSeen
      ? `Last seen: ${lastSeen}`
      : "Online";
  });

  // Upload images/files
  async function handleFileUpload(input, type) {
    input.addEventListener("change", async (e) => {
      for (const file of e.target.files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);

        const uploadRes = await fetch(`/api/upload`, {
          method: "POST",
          body: formData,
        });
        const data = await uploadRes.json();

        const msg = {
          sender: currentUser,
          recipient: chatPartner,
          type: type.toLowerCase(),
          content: file.name,
          image: type === "image" ? data.url : null,
          file: type === "file" ? data.url : null,
          fileType: file.type,
        };
        addMessage(msg);
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
        });
        socket.emit("private-message", msg);
      }
      input.value = "";
    });
  }

  handleFileUpload(imageInput, "Image");
  handleFileUpload(fileInput, "File");

  // Load chat history
  async function loadChatHistory() {
    try {
      const res = await fetch(`/api/messages/${chatPartner}`);
      const messages = await res.json();
      messages.forEach(addMessage);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }

  loadChatHistory();
});