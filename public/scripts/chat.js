const socket = io();
const messagesContainer = document.getElementById("messagesContainer");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const typingIndicator = document.getElementById("typingIndicator");
const chatWith = document.getElementById("chatWith");
const backBtn = document.getElementById("backBtn");

let currentUser = null;
let receiverId = null;

// Dummy initialization; you can fetch from server or localStorage
document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/api/users/me");
  const data = await res.json();
  currentUser = data.user;
  chatWith.innerText = `Chatting as ${currentUser.username}`;

  // Join room with receiver (you can set this via query string or storage)
  const urlParams = new URLSearchParams(window.location.search);
  receiverId = urlParams.get("to");

  if (receiverId) {
    socket.emit("joinRoom", { senderId: currentUser._id, receiverId });
    loadMessages(currentUser._id, receiverId);
  }
});

// Load message history
async function loadMessages(senderId, receiverId) {
  const res = await fetch(`/api/messages/history/${senderId}/${receiverId}`);
  const data = await res.json();

  data.messages.forEach((msg) => {
    displayMessage(msg);
  });

  scrollToBottom();
}

// Display message
function displayMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("message");
  if (msg.senderId === currentUser._id) div.classList.add("you");

  div.innerHTML = `
    ${msg.text}
    <div class="meta">${msg.senderName || "You"} · ${new Date(msg.timestamp).toLocaleTimeString()}</div>
  `;
  messagesContainer.appendChild(div);
}

// Send message
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  const msgData = {
    senderId: currentUser._id,
    receiverId,
    text: message,
    senderName: currentUser.username,
    timestamp: Date.now(),
  };

  socket.emit("privateMessage", msgData);
  displayMessage(msgData);
  messageInput.value = "";
  scrollToBottom();
});

// Receive message
socket.on("privateMessage", (msg) => {
  displayMessage(msg);
  scrollToBottom();
});

// Typing indicator
messageInput.addEventListener("input", () => {
  socket.emit("typing", { senderId: currentUser._id, receiverId });
});

socket.on("typing", ({ senderId }) => {
  typingIndicator.style.display = "block";
  setTimeout(() => {
    typingIndicator.style.display = "none";
  }, 1000);
});

// Scroll to latest message
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Go back to homepage
backBtn.addEventListener("click", () => {
  window.location.href = "/home.html";
});