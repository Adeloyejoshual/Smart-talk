const socket = io();
let currentUser, currentFriend, roomId;

document.addEventListener("DOMContentLoaded", () => {
  currentUser = JSON.parse(localStorage.getItem("currentUser"));
  currentFriend = JSON.parse(localStorage.getItem("currentFriend"));

  if (!currentUser || !currentFriend) {
    window.location.href = "/home.html";
    return;
  }

  document.getElementById("friendName").textContent = currentFriend.username;
  roomId = [currentUser._id, currentFriend._id].sort().join('_');

  socket.emit("joinRoom", {
    senderId: currentUser._id,
    receiverId: currentFriend._id,
  });

  fetchMessages();

  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");

  messageForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message === "") return;

    socket.emit("sendMessage", {
      senderId: currentUser._id,
      receiverId: currentFriend._id,
      message,
      senderName: currentUser.username,
    });

    messageInput.value = "";
  });

  messageInput.addEventListener("input", () => {
    socket.emit("typing", { roomId, senderName: currentUser.username });
  });

  socket.on("newMessage", (data) => {
    addMessageToChat(data, data.senderId === currentUser._id);
  });

  socket.on("typing", (senderName) => {
    const typingStatus = document.getElementById("typingStatus");
    typingStatus.textContent = `${senderName} is typing...`;
    clearTimeout(typingStatus.timeout);
    typingStatus.timeout = setTimeout(() => {
      typingStatus.textContent = "";
    }, 2000);
  });
});

function fetchMessages() {
  fetch(`/api/messages/${currentUser._id}/${currentFriend._id}`)
    .then((res) => res.json())
    .then((messages) => {
      messages.forEach((msg) => {
        addMessageToChat(
          {
            senderId: msg.sender,
            message: msg.message,
            senderName: msg.sender === currentUser._id ? currentUser.username : currentFriend.username,
            timestamp: msg.timestamp,
          },
          msg.sender === currentUser._id
        );
      });
    });
}

function addMessageToChat({ senderName, message, timestamp }, isMine) {
  const messageList = document.getElementById("messageList");

  const msgEl = document.createElement("div");
  msgEl.className = `message ${isMine ? "mine" : "theirs"}`;
  msgEl.innerHTML = `
    <div class="message-header">
      <span class="sender">${senderName}</span>
      <span class="time">${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div class="message-body">${message}</div>
  `;

  messageList.appendChild(msgEl);
  messageList.scrollTop = messageList.scrollHeight;
}