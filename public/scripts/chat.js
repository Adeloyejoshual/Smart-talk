// /public/scripts/chat.js

document.addEventListener("DOMContentLoaded", () => { const messageForm = document.getElementById("messageForm"); const messageInput = document.getElementById("messageInput"); const messageList = document.getElementById("messageList"); const backButton = document.getElementById("backButton"); const exportBtn = document.getElementById("exportBtn");

const token = localStorage.getItem("token"); const receiverId = localStorage.getItem("receiverId");

if (!token || !receiverId) { window.location.href = "/home.html"; return; }

const myUserId = getMyUserId(token); let receiverUsername = "User";

// Fetch real username fetch(/api/users/${receiverId}, { headers: { Authorization: Bearer ${token} } }) .then(res => res.json()) .then(data => { receiverUsername = data.username || data.name || "User"; });

const socket = io(); socket.emit("join", myUserId); loadMessages();

// Send message messageForm.addEventListener("submit", (e) => { e.preventDefault(); const content = messageInput.value.trim(); if (!content) return;

socket.emit("privateMessage", {
  senderId: myUserId,
  receiverId,
  content,
});

appendMessage({ sender: myUserId, content, timestamp: Date.now(), read: true });
messageInput.value = "";
scrollToBottom();

});

// Receive message socket.on("privateMessage", (msg) => { if (msg.senderId === receiverId) { appendMessage({ sender: receiverId, content: msg.content, timestamp: Date.now(), read: false }); scrollToBottom(); } });

// Export chat exportBtn.addEventListener("click", () => { const messages = [...messageList.querySelectorAll("li")].map(li => li.innerText).join("\n"); const blob = new Blob([messages], { type: "text/plain" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "SmartTalk_PrivateChat.txt"; link.click(); });

// Back button backButton.addEventListener("click", () => { window.location.href = "/home.html"; });

// Load chat history async function loadMessages() { try { const res = await fetch(/api/messages/history/${receiverId}, { headers: { Authorization: Bearer ${token} } }); const data = await res.json();

if (data.success && data.messages) {
    messageList.innerHTML = "";
    data.messages.forEach(msg => {
      appendMessage({
        sender: msg.sender,
        content: msg.content,
        timestamp: msg.createdAt,
        read: msg.status === "read"
      });
    });
    scrollToBottom();
  }
} catch (err) {
  console.error("Failed to load messages:", err);
}

}

// Append a message to the list function appendMessage({ sender, content, timestamp, read }) { const isMine = sender === myUserId; const li = document.createElement("li"); li.className = isMine ? "sent" : "received"; li.innerHTML = <div class="bubble"> <strong>${isMine ? "You" : receiverUsername}</strong>: ${content} <div class="meta"> ${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${isMine && read ? '<span class="seen">✔✔</span>' : ''} </div> </div>; messageList.appendChild(li); }

function scrollToBottom() { messageList.scrollTop = messageList.scrollHeight; }

function getMyUserId(token) { try { const payload = JSON.parse(atob(token.split(".")[1])); return payload.id || payload.userId; } catch { return null; } }

// Optional helper: Mark messages as read function markMessagesAsRead() { fetch('/api/messages/markAsRead', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: Bearer ${token} }, body: JSON.stringify({ senderId: receiverId, receiverId: myUserId }) }); }

// Optional helper: Block user async function blockUser(blockId) { try { await fetch("/api/users/block", { method: "POST", headers: { "Content-Type": "application/json", Authorization: Bearer ${token} }, body: JSON.stringify({ userId: myUserId, blockId }) }); alert("User blocked."); } catch (err) { console.error("Block failed", err); } } });

