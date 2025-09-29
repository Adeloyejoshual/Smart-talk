document.addEventListener("DOMContentLoaded", () => {
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const messageList = document.getElementById("messageList");
  const chatUsername = document.getElementById("chat-username");

  const token = localStorage.getItem("token"); // JWT from login
  const currentUser = localStorage.getItem("currentUser") || "me";
  const urlParams = new URLSearchParams(window.location.search);
  const chatPartner = urlParams.get("user");

  chatUsername.textContent = chatPartner;

  // Display message in chat
  function addMessage(msg) {
    const li = document.createElement("li");
    li.classList.add("flex", "items-end", "space-x-2", "my-1");

    const isSent = msg.sender.username === currentUser;

    const bubble = document.createElement("div");
    bubble.classList.add(
      "px-4",
      "py-2",
      "rounded-lg",
      "max-w-xs",
      "break-words",
      isSent
        ? "bg-blue-600 text-white rounded-tl-lg"
        : "bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-tr-lg"
    );

    if (!isSent) {
      const nameDiv = document.createElement("div");
      nameDiv.className = "text-xs font-semibold";
      nameDiv.textContent = msg.sender.username;
      bubble.appendChild(nameDiv);
    }

    const text = document.createElement("div");
    text.textContent = msg.content;
    bubble.appendChild(text);

    if (isSent) {
      li.classList.add("justify-end");
      li.appendChild(bubble);
    } else {
      li.classList.add("justify-start");
      li.appendChild(bubble);
    }

    messageList.appendChild(li);
    messageList.scrollTop = messageList.scrollHeight;
  }

  // Load old messages
  async function loadChatHistory() {
    try {
      const res = await fetch(`/api/messages/${chatPartner}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const messages = await res.json();
      messages.forEach(addMessage);
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  }

  loadChatHistory();

  // Send message
  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = messageInput.value.trim();
    if (!content) return;

    const msg = { recipient: chatPartner, content };
    addMessage({ sender: { username: currentUser }, ...msg }); // show instantly
    messageInput.value = "";

    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(msg),
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Message failed to send");
    }
  });
});