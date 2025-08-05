const socket = io();
const chatThread = document.getElementById("chat-thread");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const fileInput = document.getElementById("file-input");
const imagePreview = document.getElementById("image-preview");
const previewImg = document.getElementById("preview-img");
const chatUsername = document.getElementById("chat-username");

const token = localStorage.getItem("token");
const receiverId = new URLSearchParams(window.location.search).get("id"); // ?id=xxxx

if (!token || !receiverId) {
  alert("Missing token or chat target.");
  window.location.href = "/home.html";
}

let currentUserId;

// === Load current user info ===
fetch("/api/users/me", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})
  .then((res) => res.json())
  .then((user) => {
    currentUserId = user._id;
    socket.emit("join", currentUserId);
  });

// === Load receiver username ===
fetch(`/api/users/chats`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})
  .then((res) => res.json())
  .then((friends) => {
    const user = friends.find((f) => f._id === receiverId);
    if (user) chatUsername.textContent = user.username || "Chat";
  });

// === Load past messages ===
fetch(`/api/messages/private/${receiverId}`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})
  .then((res) => res.json())
  .then((messages) => {
    messages.forEach(showMessage);
    scrollToBottom();
  });

// === Send message ===
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = messageInput.value.trim();
  const file = fileInput.files[0];

  if (!text && !file) return;

  const formData = new FormData();
  formData.append("receiverId", receiverId);
  if (file) formData.append("file", file);
  if (text) formData.append("content", text);

  const res = await fetch("/api/messages/private/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json();
  if (data && data._id) {
    showMessage(data);
    messageInput.value = "";
    fileInput.value = "";
    imagePreview.classList.add("hidden");
    previewImg.src = "";
    scrollToBottom();
  }
});

// === Preview selected image ===
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      previewImg.src = reader.result;
      imagePreview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  } else {
    previewImg.src = "";
    imagePreview.classList.add("hidden");
  }
});

// === Listen for real-time incoming messages ===
socket.on("privateMessage", (data) => {
  if (data.senderId === receiverId) {
    showMessage({
      sender: receiverId,
      content: data.content,
      createdAt: data.timestamp,
    });
    scrollToBottom();
  }
});

// === Show message in thread ===
function showMessage(msg) {
  const isSelf = msg.sender === currentUserId || msg.sender?._id === currentUserId;

  const div = document.createElement("div");
  div.className = `p-2 max-w-[70%] rounded-lg ${
    isSelf
      ? "bg-blue-500 text-white self-end ml-auto"
      : "bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white"
  }`;

  if (msg.fileUrl) {
    const img = document.createElement("img");
    img.src = msg.fileUrl;
    img.className = "max-w-full rounded";
    div.appendChild(img);
  }

  if (msg.content) {
    const p = document.createElement("p");
    p.textContent = msg.content;
    div.appendChild(p);
  }

  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-col";
  wrapper.appendChild(div);
  chatThread.appendChild(wrapper);
}

function scrollToBottom() {
  chatThread.scrollTop = chatThread.scrollHeight;
}