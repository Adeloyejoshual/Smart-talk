const socket = io();
const chatBox = document.getElementById("chat-box");
const form = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const typingIndicator = document.getElementById("typing-indicator");
const imageInput = document.getElementById("image-upload");
const chatUsername = document.getElementById("chat-username");

const urlParams = new URLSearchParams(window.location.search);
const otherUserId = urlParams.get("id");
const myId = localStorage.getItem("userId");
const token = localStorage.getItem("token");

chatUsername.textContent = localStorage.getItem("chatUsername") || "Private Chat";

// Join private room
socket.emit("join", myId);

// Send message
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();

  if (content) {
    socket.emit("privateMessage", { senderId: myId, receiverId: otherUserId, content });
    appendMessage(content, "sent");
    messageInput.value = "";
  }
});

// Typing event
messageInput.addEventListener("input", () => {
  socket.emit("typing", { to: otherUserId });
});

// Show typing
socket.on("typing", ({ from }) => {
  if (from === otherUserId) {
    typingIndicator.classList.remove("hidden");
    setTimeout(() => typingIndicator.classList.add("hidden"), 1500);
  }
});

// Receive messages
socket.on("privateMessage", ({ senderId, content }) => {
  if (senderId === otherUserId) {
    appendMessage(content, "received");
  }
});

// Upload image
imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("receiverId", otherUserId);

  const res = await fetch("/api/messages/file", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const data = await res.json();
  if (res.ok) {
    appendImage(data.data.fileUrl, "sent");
  } else {
    alert("Upload failed");
  }
});

// Append text message
function appendMessage(content, type) {
  const div = document.createElement("div");
  div.className = `max-w-xs px-4 py-2 rounded-lg text-sm ${type === "sent" ? "bg-blue-600 text-white self-end ml-auto" : "bg-gray-300 dark:bg-gray-700 text-black dark:text-white self-start mr-auto"}`;
  div.textContent = content;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Append image
function appendImage(src, type) {
  const img = document.createElement("img");
  img.src = src;
  img.className = `max-w-[200px] rounded-lg ${type === "sent" ? "self-end ml-auto" : "self-start mr-auto"}`;
  chatBox.appendChild(img);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Sticky date (optional feature)
const dateDiv = document.createElement("div");
const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
dateDiv.textContent = today;
dateDiv.className = "sticky top-0 text-center text-xs bg-gray-300 dark:bg-gray-700 py-1 rounded";
chatBox.appendChild(dateDiv);

// Settings modal functions
function openSettingsModal() {
  document.getElementById("chat-settings-modal").classList.remove("hidden");
}
function closeSettingsModal() {
  document.getElementById("chat-settings-modal").classList.add("hidden");
}
function goHome() {
  window.location.href = "home.html";
}

// Dummy edit/delete handlers
function editMessage() {
  alert("Edit feature coming soon");
}
function deleteMessage() {
  alert("Delete feature coming soon");
}

// Expose to global scope
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.goHome = goHome;
window.editMessage = editMessage;
window.deleteMessage = deleteMessage;