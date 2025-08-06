// /public/scripts/chat.js

document.addEventListener("DOMContentLoaded", () => { const socket = io(); const messageForm = document.getElementById("messageForm"); const messageInput = document.getElementById("messageInput"); const imageInput = document.getElementById("imageInput"); const messageList = document.getElementById("messageList"); const backButton = document.getElementById("backButton"); const exportBtn = document.getElementById("exportBtn"); const usernameHeader = document.getElementById("chat-username");

const token = localStorage.getItem("token"); const urlParams = new URLSearchParams(window.location.search); const receiverId = urlParams.get("user"); let myUserId = null; let skip = 0; const limit = 20; let loading = false; let typingTimeout;

const typingIndicator = document.createElement("li"); typingIndicator.className = "italic text-sm text-gray-500 px-2"; typingIndicator.textContent = "Typing...";

if (!token || !receiverId) return (window.location.href = "/home.html");

getMyUserId(token).then((id) => { myUserId = id; socket.emit("join", myUserId); loadMessages(true); fetchUsername(); });

messageForm.addEventListener("submit", async (e) => { e.preventDefault(); const content = messageInput.value.trim(); if (!content) return;

await fetch(`/api/messages/private/send`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ recipientId: receiverId, content }),
});

messageInput.value = "";

});

messageInput.addEventListener("input", () => { socket.emit("typing", { to: receiverId, from: myUserId }); clearTimeout(typingTimeout); typingTimeout = setTimeout(() => { socket.emit("stopTyping", { to: receiverId, from: myUserId }); }, 2000); });

imageInput?.addEventListener("change", async (e) => { const files = [...e.target.files]; if (!files.length) return;

const formData = new FormData();
files.forEach((file) => formData.append("images", file));

const res = await fetch(`/api/messages/private/upload`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

const data = await res.json();
if (data.success && data.urls) {
  for (const url of data.urls) {
    await fetch(`/api/messages/private/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipientId: receiverId,
        content: `<img src='${url}' class='w-40 rounded'/>`,
      }),
    });
  }
}

});

socket.on("privateMessage", (msg) => { const isMine = msg.senderId === myUserId || msg.sender === myUserId; const isFromOrToReceiver = msg.senderId === receiverId || msg.sender === receiverId;

if (isFromOrToReceiver) {
  appendMessage(
    {
      _id: msg._id,
      sender: msg.senderId || msg.sender,
      content: msg.content,
      timestamp: msg.timestamp || Date.now(),
      status: msg.status,
    },
    true
  );
  scrollToBottom();
}

});

socket.on("typing", ({ from }) => { if (from === receiverId && !messageList.contains(typingIndicator)) { messageList.appendChild(typingIndicator); scrollToBottom(); } });

socket.on("stopTyping", ({ from }) => { if (from === receiverId && messageList.contains(typingIndicator)) { messageList.removeChild(typingIndicator); } });

exportBtn.addEventListener("click", () => { const messages = [...messageList.querySelectorAll("li")] .map((li) => li.innerText) .join("\n"); const blob = new Blob([messages], { type: "text/plain" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "SmartTalk_PrivateChat.txt"; link.click(); });

backButton.addEventListener("click", () => { window.location.href = "/home.html"; });

async function loadMessages(initial = false) { if (loading) return; loading = true; try { const res = await fetch( /api/messages/history/${receiverId}?skip=${skip}&limit=${limit}, { headers: { Authorization: Bearer ${token} }, } ); const data = await res.json(); if (data.success && data.messages) { if (initial) messageList.innerHTML = ""; data.messages.reverse().forEach((msg) => { appendMessage( { _id: msg._id, sender: msg.sender, content: msg.content, timestamp: msg.createdAt, status: msg.status, }, false ); }); if (initial) scrollToBottom(); skip += data.messages.length; } } catch (err) { console.error("Failed to load messages:", err); } finally { loading = false; } }

messageList.addEventListener("scroll", () => { if (messageList.scrollTop === 0 && !loading) { loadMessages(false); } });

async function fetchUsername() { try { const res = await fetch(/api/users/${receiverId}, { headers: { Authorization: Bearer ${token} }, }); const user = await res.json(); if (user && (user.username || user.name)) { usernameHeader.textContent = user.username || user.name; } } catch (err) { console.error("Username fetch failed", err); usernameHeader.textContent = "Chat"; } }

function appendMessage({ _id, sender, content, timestamp, status }, toBottom) { const isMine = sender === myUserId; const li = document.createElement("li"); li.className = ${isMine ? "sent" : "received"} group relative; li.innerHTML = <div class="bubble"> ${content} <div class="meta"> ${new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", })} <div class="text-xs mt-1"> ${status === "delivered" ? "Delivered" : status === "read" ? "Seen" : ""} </div> </div> ${isMine ?<div class="absolute top-0 right-0 hidden group-hover:flex space-x-2 text-xs"> <button onclick="editMessage('${_id}')" class="text-yellow-500">Edit</button> <button onclick="deleteMessage('${_id}')" class="text-red-500">Delete</button> </div>: ""} </div>; if (toBottom) { messageList.appendChild(li); } else { messageList.prepend(li); } }

function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }

async function getMyUserId(token) { try { const res = await fetch("/api/users/me", { headers: { Authorization: Bearer ${token} }, }); const user = await res.json(); return user._id; } catch { return null; } }

window.editMessage = async function (id) { const newContent = prompt("Edit your message:"); if (!newContent) return; try { await fetch(/api/messages/private/${id}, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: Bearer ${token}, }, body: JSON.stringify({ content: newContent }), }); loadMessages(true); } catch (err) { alert("Failed to edit message"); } };

window.deleteMessage = async function (id) { if (!confirm("Are you sure you want to delete this message?")) return; try { await fetch(/api/messages/private/${id}, { method: "DELETE", headers: { Authorization: Bearer ${token} }, }); loadMessages(true); } catch (err) { alert("Failed to delete message"); } }; });

