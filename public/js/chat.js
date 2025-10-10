import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const socket = io();
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const auth = window.firebaseAuth;

let currentUser;

onAuthStateChanged(auth, async (user) => {
  if (!user) return (window.location.href = "/login.html");
  currentUser = user;

  // Fetch existing messages
  const token = await user.getIdToken();
  const res = await fetch("/api/messages", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const messages = await res.json();
  messages.forEach(renderMessage);
});

socket.on("newMessage", renderMessage);

sendBtn.addEventListener("click", async () => {
  const text = messageInput.value.trim();
  if (!text) return;
  const msgData = {
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    text,
  };
  socket.emit("sendMessage", msgData);
  messageInput.value = "";
});

function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = msg.senderUid === currentUser?.uid ? "my-message" : "other-message";
  div.textContent = `${msg.senderEmail}: ${msg.text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}