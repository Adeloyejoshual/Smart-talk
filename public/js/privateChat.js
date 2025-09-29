// /public/js/privateChat.js
document.addEventListener("DOMContentLoaded", () => {
  const socket = io(); // Socket.IO connection

  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const chatUsername = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");

  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  // Get current user and chat partner
  const currentUser = localStorage.getItem("currentUser") || "me";
  const urlParams = new URLSearchParams(window.location.search);
  const chatPartner = urlParams.get("user") || "Unknown";
  chatUsername.textContent = chatPartner;

  let lastSeen = null;
  statusIndicator.textContent = "Online";

  // Helper: format date headers
  function formatDateHeader(date) {
    const msgDate = new Date(date);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (msgDate.toDateString() === now.toDateString()) return "Today";
    if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";
    return msgDate.toLocaleDateString();
  }

  function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function addMessage({ sender, content, date }) {
    const msgDate = new Date(date);
    const lastMessage = messageList.lastElementChild;

    // Add date header if needed
    if (!lastMessage || lastMessage.dataset.date !== msgDate.toDateString()) {
      const header = document.createElement("li");
      header.textContent = formatDateHeader(msgDate);
      header.className = "text-center text-gray-500 dark:text-gray-400 text-xs my-2";
      header.dataset.date = msgDate.toDateString();
      messageList.appendChild(header);
    }

    // Message bubble
    const li = document.createElement("li");
    li.classList.add(sender === currentUser ? "sent" : "received", "flex");
    li.dataset.date = msgDate.toDateString();

    const bubble = document.createElement("div");
    bubble.classList.add("bubble", "px-4", "py-2", "rounded-lg", "max-w-xs", "break-words");
    bubble.textContent = content;

    const time = document.createElement("div");
    time.classList.add("text-xs", "text-gray-500", "mt-1", sender === currentUser ? "text-right" : "text-left");
    time.textContent = formatTime(msgDate);
    bubble.appendChild(time);

    li.appendChild(bubble);
    messageList.appendChild(li);

    // Scroll to bottom
    messageList.scrollTop = messageList.scrollHeight;
  }

  // Send message
  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const msg = {
      sender: currentUser,
      receiver: chatPartner,
      content,
      date: new Date(),
    };

    addMessage(msg); // Show instantly
    socket.emit("private-message", msg); // Send to server

    // Also save via API
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    }).catch((err) => console.error("Message save failed:", err));

    messageInput.value = "";
  });

  // Receive messages from server
  socket.on("private-message", (msg) => {
    if (msg.sender === chatPartner || msg.receiver === chatPartner) {
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
    if (sender === chatPartner) statusIndicator.textContent = lastSeen ? `Last seen: ${lastSeen}` : "Online";
  });

  // File/Image upload
  function handleFileUpload(input, type) {
    input.addEventListener("change", (e) => {
      Array.from(e.target.files).forEach((file) => {
        const msg = {
          sender: currentUser,
          receiver: chatPartner,
          content: `[${type}] ${file.name}`,
          date: new Date(),
        };
        addMessage(msg);
        socket.emit("private-message", msg);

        // Save via API
        fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg),
        }).catch((err) => console.error("File save failed:", err));
      });
      input.value = "";
    });
  }
  handleFileUpload(imageInput, "Image");
  handleFileUpload(fileInput, "File");

  // Load old messages
  async function loadChatHistory() {
    try {
      const res = await fetch(`/api/messages/${chatPartner}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const messages = await res.json();
      messages.forEach(addMessage);
    } catch (err) {
      console.error(err);
    }
  }

  loadChatHistory();
});