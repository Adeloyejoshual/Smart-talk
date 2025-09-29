const socket = io();
const messageList = document.getElementById("messageList");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const chatUsername = document.getElementById("chat-username");
const statusIndicator = document.getElementById("statusIndicator");

const token = localStorage.getItem("token");
const chatUserId = localStorage.getItem("chatUserId"); // 👈 must be set when opening private chat
const chatUserName = localStorage.getItem("chatUserName");

if (!token || !chatUserId) {
  alert("Invalid chat session. Please login again.");
  window.location.href = "/login.html";
}

// set chat username
chatUsername.textContent = chatUserName || "User";

// ✅ Function to format date
function formatDate(date) {
  const today = new Date();
  const msgDate = new Date(date);

  if (
    msgDate.toDateString() === today.toDateString()
  ) return "Today";

  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (msgDate.toDateString() === yesterday.toDateString())
    return "Yesterday";

  return msgDate.toLocaleDateString();
}

// ✅ Function to add message to UI
function addMessage(msg, isOwn) {
  const li = document.createElement("li");
  li.className = isOwn ? "sent flex justify-end" : "received flex justify-start";

  const div = document.createElement("div");
  div.className = "bubble max-w-xs md:max-w-md px-3 py-2 rounded-lg shadow";
  div.innerHTML = `
    <p class="text-sm">${msg.content}</p>
    <span class="text-xs text-gray-500">${new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
  `;

  li.appendChild(div);
  messageList.appendChild(li);
  messageList.scrollTop = messageList.scrollHeight;
}

// ✅ Fetch chat history
async function loadHistory() {
  try {
    const res = await fetch(`/api/messages/history/${chatUserId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const messages = await res.json();

    messageList.innerHTML = "";
    let lastDate = "";

    messages.forEach((msg) => {
      const msgDate = formatDate(msg.createdAt);
      if (msgDate !== lastDate) {
        const sep = document.createElement("div");
        sep.className = "date-separator";
        sep.textContent = msgDate;
        messageList.appendChild(sep);
        lastDate = msgDate;
      }
      addMessage(msg, msg.sender._id === parseJwt(token).id);
    });
  } catch (err) {
    console.error("Failed to load messages:", err);
  }
}

// ✅ Parse JWT to get logged in user ID
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    return null;
  }
}

// ✅ Send message
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();
  if (!content) return;

  try {
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ receiverId: chatUserId, content }),
    });
    const newMsg = await res.json();

    addMessage(newMsg, true);
    socket.emit("privateMessage", {
      to: chatUserId,
      message: newMsg,
    });
    messageInput.value = "";
  } catch (err) {
    console.error("Error sending message:", err);
  }
});

// ✅ Receive new messages in real-time
socket.on("privateMessage", (msg) => {
  if (msg.sender === chatUserId) {
    addMessage(msg, false);
  }
});

// Load chat history on page load
loadHistory();