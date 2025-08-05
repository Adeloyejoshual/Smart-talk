// /public/js/private-chat.js

const socket = io("https://your-backend-url"); // Or just io() if same domain

const userToken = localStorage.getItem("token");
const urlParams = new URLSearchParams(window.location.search);
const otherUserId = urlParams.get("id");

let myUserId = null;
let lastDateLabel = null;

// Auth fetch for username
fetch("/api/users/me", {
  headers: { Authorization: `Bearer ${userToken}` }
})
  .then(res => res.json())
  .then(user => {
    myUserId = user._id;
    loadMessages();
    socket.emit("join", myUserId);
  });

function goHome() {
  window.location.href = "/home.html";
}

function openSettingsModal() {
  document.getElementById("chat-settings-modal").classList.remove("hidden");
}
function closeSettingsModal() {
  document.getElementById("chat-settings-modal").classList.add("hidden");
}

function editMessage() {
  alert("Edit message feature coming soon.");
}
function deleteMessage() {
  alert("Delete message feature coming soon.");
}

document.getElementById("message-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  const file = document.getElementById("image-upload").files[0];

  if (!text && !file) return;

  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiverId", otherUserId);

    const res = await fetch("/api/messages/file", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: formData,
    });

    const result = await res.json();
    addMessageToUI({
      sender: myUserId,
      fileUrl: result.data.fileUrl,
      createdAt: new Date().toISOString(),
    });
  }

  if (text) {
    socket.emit("privateMessage", {
      senderId: myUserId,
      receiverId: otherUserId,
      content: text,
    });

    addMessageToUI({
      sender: myUserId,
      content: text,
      createdAt: new Date().toISOString(),
    });
  }

  input.value = "";
  document.getElementById("image-upload").value = "";
});

socket.on("privateMessage", (data) => {
  addMessageToUI({
    sender: data.senderId,
    content: data.content,
    createdAt: data.timestamp,
  });
});

function loadMessages() {
  fetch(`/api/messages/private/${otherUserId}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  })
    .then(res => res.json())
    .then(messages => {
      messages.forEach(msg => addMessageToUI(msg));
    });
}

function addMessageToUI(msg) {
  const chatBox = document.getElementById("chat-box");

  const dateLabel = new Date(msg.createdAt).toDateString();
  if (lastDateLabel !== dateLabel) {
    const dateDiv = document.createElement("div");
    dateDiv.className = "sticky top-0 text-center text-xs bg-gray-300 dark:bg-gray-700 py-1 rounded";
    dateDiv.textContent = dateLabel;
    chatBox.appendChild(dateDiv);
    lastDateLabel = dateLabel;
  }

  const div = document.createElement("div");
  div.className = `max-w-xs px-4 py-2 rounded-lg ${msg.sender === myUserId ? 'bg-blue-600 text-white ml-auto' : 'bg-gray-300 text-black dark:bg-gray-700 dark:text-white mr-auto'}`;

  if (msg.fileUrl) {
    const img = document.createElement("img");
    img.src = msg.fileUrl;
    img.className = "max-w-full rounded";
    div.appendChild(img);
  }

  if (msg.content) {
    const text = document.createElement("p");
    text.textContent = msg.content;
    div.appendChild(text);
  }

  const time = document.createElement("div");
  time.className = "text-xs mt-1 text-right opacity-70";
  time.textContent = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.appendChild(time);

  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}