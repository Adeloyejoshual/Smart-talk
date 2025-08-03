document.addEventListener("DOMContentLoaded", () => {
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const backButton = document.getElementById("backButton");

  const receiverId = localStorage.getItem("receiverId");
  const token = localStorage.getItem("token");

  if (!token || !receiverId) {
    window.location.href = "/home.html";
    return;
  }

  // 🔄 Load message history
  async function loadMessages() {
    try {
      const res = await fetch(`/api/messages/history/${receiverId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (data.success) {
        messageList.innerHTML = "";
        data.messages.forEach((msg) => {
          const messageEl = document.createElement("div");
          messageEl.className = msg.sender === getMyUserId() ? "message sent" : "message received";
          messageEl.textContent = msg.content;
          messageList.appendChild(messageEl);
        });
        messageList.scrollTop = messageList.scrollHeight;
      }
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  }

  // 📨 Send a new message
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const content = messageInput.value.trim();
    if (!content) return;

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ receiverId, content })
      });

      const data = await res.json();

      if (data.success) {
        messageInput.value = "";
        loadMessages(); // reload messages
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  });

  // 🔙 Back to home
  backButton.addEventListener("click", () => {
    window.location.href = "/home.html";
  });

  // 🔐 Decode JWT to get my user ID
  function getMyUserId() {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.id;
  }

  // Initial load
  loadMessages();
});