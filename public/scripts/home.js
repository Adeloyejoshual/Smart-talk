document.addEventListener("DOMContentLoaded", async () => {
  const friendList = document.getElementById("friendList");

  try {
    const res = await fetch("/api/users/list", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });

    const data = await res.json();

    if (!data || data.length === 0) {
      friendList.innerHTML = "<p style='text-align:center;margin-top:20px;'>No friends yet</p>";
      return;
    }

    friendList.innerHTML = "";
    data.forEach(user => {
      const lastMessage = user.lastMessage?.content || "No messages yet";
      const lastTime = user.lastMessage?.time
        ? new Date(user.lastMessage.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : "";

      const item = document.createElement("div");
      item.classList.add("friend-item");
      item.innerHTML = `
        <div class="friend-left">
          <span class="friend-name">${user.username}</span>
          <span class="last-message">${lastMessage}</span>
        </div>
        <div class="friend-right">${lastTime}</div>
      `;
      item.addEventListener("click", () => {
        window.location.href = `/chat.html?user=${user._id}`;
      });
      friendList.appendChild(item);
    });
  } catch (err) {
    console.error("Error loading friends:", err);
  }
});