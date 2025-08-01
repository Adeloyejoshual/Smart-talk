document.addEventListener("DOMContentLoaded", () => {
  const userDisplay = document.getElementById("welcomeUser");
  const userList = document.getElementById("userList");
  const themeToggle = document.getElementById("themeToggle");
  const settingsModal = document.getElementById("settingsModal");
  const addUserModal = document.getElementById("addUserModal");

  // Load theme from localStorage
  if (localStorage.getItem("theme") === "light") {
    document.documentElement.setAttribute("data-theme", "light");
    themeToggle.textContent = "☀️";
  }

  themeToggle.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
    themeToggle.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("theme", isDark ? "light" : "dark");
  });

  // Fetch user info
  fetch("/api/users/me")
    .then(res => res.json())
    .then(user => {
      userDisplay.textContent = `Welcome, ${user.username}`;
    });

  // Fetch and display friends
  fetch("/api/users/list")
    .then(res => res.json())
    .then(data => {
      userList.innerHTML = "";
      data.forEach(friend => {
        const li = document.createElement("li");
        li.className = "user-card";
        li.innerHTML = `
          <div class="user-info">
            <div class="user-avatar"></div>
            <div>
              <div>${friend.username}</div>
              <div class="last-seen">${friend.online ? "Online" : "Last seen: " + formatTime(friend.lastSeen)}</div>
            </div>
            <span class="online-indicator ${friend.online ? "online" : "offline"}"></span>
          </div>
          <a href="/chat.html?user=${friend._id}">Chat</a>
        `;
        userList.appendChild(li);
      });
    });

  // Format time from ISO
  function formatTime(timestamp) {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  // Modals
  document.getElementById("settingsBtn").onclick = () => settingsModal.classList.remove("hidden");
  document.getElementById("closeSettings").onclick = () => settingsModal.classList.add("hidden");

  document.getElementById("addUserBtn").onclick = () => addUserModal.classList.remove("hidden");
  document.getElementById("closeAddModal").onclick = () => addUserModal.classList.add("hidden");

  document.getElementById("confirmAddUser").onclick = () => {
    const input = document.getElementById("addUsernameInput").value;
    fetch("/api/users/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: input }),
    })
      .then(res => res.json())
      .then(() => {
        alert("User added!");
        location.reload();
      })
      .catch(() => alert("Error adding user"));
  };

  document.getElementById("logoutBtn").onclick = () => {
    fetch("/api/auth/logout", { method: "POST" }).then(() => {
      location.href = "/login.html";
    });
  };
});