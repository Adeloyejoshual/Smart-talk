// /public/js/privateChat.js
document.addEventListener("DOMContentLoaded", () => {
  const socket = io(); // Connect to Socket.IO server

  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const chatUsername = document.getElementById("chat-username");
  const statusIndicator = document.getElementById("statusIndicator");

  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  // Get current user and chat partner from session/localStorage or URL
  const currentUser = localStorage.getItem("currentUser") || "me";
  const urlParams = new URLSearchParams(window.location.search);
  const chatPartner = urlParams.get("user") || "Unknown";
  chatUsername.textContent = chatPartner;

  // Online status example
  let lastSeen = null;
  statusIndicator.textContent = "Online";

  // Helper: format date for message header
  function formatDateHeader(date) {
    const msgDate = new Date(date);
    const now = new Date();

    const isToday = msgDate.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = msgDate.toDateString() === yesterday.toDateString();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";
    return msgDate.toLocaleDateString();
  }

  // Helper: format time for messages
  function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Render message in the chat
  function addMessage({ sender, content, date }) {
    const msgDate = new Date(date);
    const lastMessage = messageList.lastElementChild;

    // Add date header if necessary
    if (!lastMessage || lastMessage.dataset.date !== msgDate.toDateString()) {
      const header = document.createElement("li");
      header.textContent = formatDateHeader(msgDate);
      header.className = "text-center text-gray-500 dark:text-gray-400 text-xs my-2";
      header.dataset.date = msgDate.toDateString();
      messageList.appendChild(header);
    }

    // Create message bubble
    const li = document.createElement("li");
    li.classList.add(sender === currentUser ? "sent" : "received", "flex");
    li.dataset.date = msgDate.toDateString();

    const bubble = document.createElement("div");
    bubble.classList.add("bubble", "px-4", "py-2", "rounded-lg", "max-w-xs", "break-words");
    bubble.textContent = content;

    // Time
    const time = document.createElement("div");
    time.classList.add("text-xs", "text-gray-500", "mt-1", sender === currentUser ? "text-right" : "text-left");
    time.textContent = formatTime(msgDate);
    bubble.appendChild(time);

    li.appendChild(bubble);
    messageList.appendChild(li);

    // Scroll to latest
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
    messageInput.value = "";
  });

  // Receive message
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
      });
      input.value = "";
    });
  }
  handleFileUpload(imageInput, "Image");
  handleFileUpload(fileInput, "File");

  // Load chat history via API (optional)
  async function loadChatHistory() {
    try {
      const res = await fetch(`/api/messages/${chatPartner}`);
      const messages = await res.json();
      messages.forEach(addMessage);
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  }

  loadChatHistory();

});