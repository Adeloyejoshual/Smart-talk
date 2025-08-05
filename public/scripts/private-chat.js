document.addEventListener("DOMContentLoaded", () => {
  const socket = io(); // Connect to server

  const input = document.getElementById("privateImageInput");
  const previewContainer = document.getElementById("previewContainer");
  const messageInput = document.getElementById("privateMessageInput");
  const sendBtn = document.getElementById("sendPrivateMessage");

  const token = localStorage.getItem("token");
  const receiverId = localStorage.getItem("receiverId");

  if (!token || !receiverId) {
    alert("Token or receiver missing.");
    return window.location.href = "/home.html";
  }

  const myUserId = getMyUserId(token);

  // Preview selected images
  input.addEventListener("change", () => {
    previewContainer.innerHTML = "";
    [...input.files].forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = document.createElement("img");
        img.src = reader.result;
        img.className = "w-20 h-20 object-cover rounded border";
        previewContainer.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  });

  // Send message (text + optional images)
  sendBtn.addEventListener("click", async () => {
    const content = messageInput.value.trim();

    // If there's text, send it via socket
    if (content) {
      socket.emit("privateMessage", {
        senderId: myUserId,
        receiverId,
        content,
      });
      appendMessage({ sender: myUserId, content, timestamp: new Date().toISOString() });
      messageInput.value = "";
    }

    // If images selected, upload them
    if (input.files.length) {
      const formData = new FormData();
      formData.append("receiverId", receiverId);
      [...input.files].forEach(file => formData.append("images", file));

      try {
        const res = await fetch("/api/messages/private/image", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await res.json();
        if (data.success && data.messages) {
          data.messages.forEach(msg => {
            appendMessage({
              sender: msg.sender,
              image: msg.image,
              timestamp: msg.createdAt,
            });
          });
          previewContainer.innerHTML = "";
          input.value = "";
        }
      } catch (err) {
        console.error("Image upload failed:", err);
      }
    }
  });

  // Handle incoming socket messages
  socket.on("privateMessage", (msg) => {
    if (msg.senderId === receiverId) {
      appendMessage({ sender: receiverId, content: msg.content, timestamp: msg.timestamp });
    }
  });

  function appendMessage({ sender, content, image, timestamp }) {
    const chatBox = document.getElementById("messageList");
    const isMine = sender === myUserId;

    const msgDiv = document.createElement("div");
    msgDiv.className = `p-2 mb-2 max-w-[70%] rounded-lg ${isMine ? "bg-blue-100 self-end" : "bg-gray-200 self-start"}`;

    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.className = "w-40 h-auto rounded mb-1";
      msgDiv.appendChild(img);
    }

    if (content) {
      const p = document.createElement("p");
      p.textContent = content;
      msgDiv.appendChild(p);
    }

    const time = document.createElement("div");
    time.className = "text-xs text-gray-500 mt-1";
    time.textContent = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    msgDiv.appendChild(time);

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function getMyUserId(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id || payload.userId;
    } catch {
      return null;
    }
  }
});