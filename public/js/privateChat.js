document.addEventListener("DOMContentLoaded", () => {
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const chatUsername = document.getElementById("chat-username");
  const emojiButton = document.getElementById("emojiButton");
  const filePreview = document.getElementById("filePreview");
  const imageInput = document.getElementById("imageInput");
  const fileInput = document.getElementById("fileInput");

  const token = localStorage.getItem("token");
  const currentUser = localStorage.getItem("currentUser") || "me";
  const urlParams = new URLSearchParams(window.location.search);
  const chatPartner = urlParams.get("user");
  if (!chatPartner) return alert("No chat partner specified!");
  chatUsername.textContent = chatPartner;

  let selectedFiles = [];

  // ---------- Emoji Picker ----------
  const picker = new EmojiButton({ position: "top-end" });
  emojiButton.addEventListener("click", () => picker.togglePicker(emojiButton));
  picker.on("emoji", emoji => messageInput.value += emoji);

  // ---------- Socket.IO ----------
  const socket = io();

  socket.on("private-message", msg => {
    if (msg.sender.username === chatPartner || msg.sender.username === currentUser) {
      addMessage(msg, null);
    }
  });

  // ---------- Format Time ----------
  function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ---------- Date Separator ----------
  function addDateSeparator(prevDate, currentDate) {
    const prevDay = prevDate ? new Date(prevDate).toDateString() : null;
    const currDay = new Date(currentDate).toDateString();
    if (prevDay !== currDay) {
      const li = document.createElement("li");
      li.className = "date-separator";
      if (currDay === new Date().toDateString()) li.textContent = "Today";
      else if (currDay === new Date(Date.now() - 86400000).toDateString()) li.textContent = "Yesterday";
      else li.textContent = currDay;
      messageList.appendChild(li);
    }
  }

  // ---------- Add Message ----------
  function addMessage(msg, prevMsgDate) {
    addDateSeparator(prevMsgDate, msg.createdAt);

    const li = document.createElement("li");
    li.classList.add("flex", "items-end", "space-x-2", "my-1");

    const isSent = msg.sender.username === currentUser;
    const bubble = document.createElement("div");
    bubble.classList.add(
      "px-4", "py-2", "rounded-lg", "max-w-xs", "break-words",
      isSent ? "bg-blue-600 text-white rounded-tl-lg" : "bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-tr-lg"
    );

    if (!isSent) {
      const nameDiv = document.createElement("div");
      nameDiv.className = "text-xs font-semibold";
      nameDiv.textContent = msg.sender.username;
      bubble.appendChild(nameDiv);
    }

    if (msg.type === "text") {
      const text = document.createElement("div");
      text.textContent = msg.content;
      bubble.appendChild(text);
    } else if (msg.type === "image") {
      const img = document.createElement("img");
      img.src = msg.fileUrl;
      img.alt = msg.fileName;
      img.className = "max-w-full rounded-lg cursor-pointer hover:opacity-80 transition";
      bubble.appendChild(img);
    } else if (msg.type === "file") {
      const fileLink = document.createElement("a");
      fileLink.href = msg.fileUrl;
      fileLink.textContent = msg.fileName;
      fileLink.target = "_blank";
      fileLink.className = "underline text-sm text-blue-600";
      bubble.appendChild(fileLink);
    }

    const timeDiv = document.createElement("div");
    timeDiv.className = "text-xs text-gray-400 mt-1 text-right";
    timeDiv.textContent = formatTime(msg.createdAt || new Date());
    bubble.appendChild(timeDiv);

    li.classList.add(isSent ? "justify-end" : "justify-start");
    li.appendChild(bubble);
    messageList.appendChild(li);
    messageList.scrollTop = messageList.scrollHeight;
  }

  // ---------- Load Chat History ----------
  async function loadChatHistory() {
    try {
      const res = await fetch(`/api/messages/${chatPartner}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const messages = await res.json();
      let prevDate = null;
      messages.forEach(msg => {
        addMessage(msg, prevDate);
        prevDate = msg.createdAt;
      });
    } catch (err) {
      console.error("Failed to load chat history", err);
    }
  }
  loadChatHistory();

  // ---------- File Preview ----------
  function updatePreview() {
    filePreview.innerHTML = "";
    selectedFiles.forEach((file, index) => {
      const previewDiv = document.createElement("div");
      previewDiv.className = "relative";

      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.className = "w-20 h-20 object-cover rounded-lg";
        previewDiv.appendChild(img);
      } else {
        const fileDiv = document.createElement("div");
        fileDiv.className = "w-20 h-20 flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700 text-sm rounded-lg p-1 text-center overflow-hidden";
        fileDiv.innerHTML = `<span class="truncate">${file.name}</span><span class="text-xs">${(file.size/1024).toFixed(1)} KB</span>`;
        previewDiv.appendChild(fileDiv);
      }

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "✖";
      removeBtn.className = "absolute top-0 right-0 text-red-500 font-bold bg-white rounded-full";
      removeBtn.addEventListener("click", () => {
        selectedFiles.splice(index, 1);
        updatePreview();
      });
      previewDiv.appendChild(removeBtn);

      filePreview.appendChild(previewDiv);
    });
  }

  imageInput.addEventListener("change", e => {
    selectedFiles.push(...Array.from(e.target.files));
    updatePreview();
  });
  fileInput.addEventListener("change", e => {
    selectedFiles.push(...Array.from(e.target.files));
    updatePreview();
  });

  messageList.addEventListener("dragover", e => e.preventDefault());
  messageList.addEventListener("drop", e => {
    e.preventDefault();
    selectedFiles.push(...Array.from(e.dataTransfer.files));
    updatePreview();
  });

  // ---------- Send Files ----------
  async function sendSelectedFiles() {
    for (let file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recipient", chatPartner);
      try {
        const res = await fetch("/api/messages/file", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const msg = await res.json();
        addMessage(msg, null);
        socket.emit("private-message", msg);
      } catch (err) {
        console.error("Failed to send file", err);
        alert("File failed to send");
      }
    }
    selectedFiles = [];
    updatePreview();
  }

  // ---------- Send Text ----------
  messageForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (selectedFiles.length > 0) await sendSelectedFiles();

    const content = messageInput.value.trim();
    if (!content) return;

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipient: chatPartner, content })
      });
      const msg = await res.json();
      addMessage(msg, null);
      messageInput.value = "";
      socket.emit("private-message", msg);
    } catch (err) {
      console.error("Failed to send message", err);
      alert("Message failed to send");
    }
  });

});