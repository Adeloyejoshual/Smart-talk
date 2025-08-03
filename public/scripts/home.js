document.addEventListener("DOMContentLoaded", () => {
  const userDisplay = document.getElementById("welcomeUser");
  const userList = document.getElementById("userList");
  const addUserBtn = document.getElementById("addUserBtn");
  const settingsBtn = document.getElementById("settingsBtn");
  const themeToggle = document.getElementById("themeToggle");
  const logoutBtn = document.getElementById("logoutBtn");
  const searchInput = document.getElementById("searchInput");

  const token = localStorage.getItem("token");

  if (!token) {
    return (window.location.href = "/login.html");
  }

  // Load user info
  async function refreshUserData() {
    try {
      const res = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch user.");

      const data = await res.json();
      localStorage.setItem("user", JSON.stringify(data));
      userDisplay.textContent = `Welcome, ${data.username}!`;
    } catch (err) {
      console.error("Error refreshing user:", err);
      localStorage.removeItem("token");
      window.location.href = "/login.html";
    }
  }

  // Load only friends
  async function loadUsers() {
    try {
      const res = await fetch("/api/users/friends", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load friends");

      const friends = await res.json();
      userList.innerHTML = "";

      if (friends.length === 0) {
        userList.innerHTML = "<p>No friends yet. Click + to add one.</p>";
        return;
      }

      friends.forEach((user) => {
        const card = document.createElement("div");
        card.classList.add("user-card");

        card.innerHTML = `
          <div class="user-info">
            <strong>${user.username}</strong><br/>
            <span class="last-seen">Last seen: ${user.lastSeen ? new Date(user.lastSeen).toLocaleString() : "N/A"}</span>
          </div>
        `;

        card.addEventListener("click", () => {
          window.location.href = `/chat.html?user=${user._id}`;
        });

        userList.appendChild(card);
      });
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  }

  // Dark mode toggle
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", html.dataset.theme);
  });

  // Add Friend Button
  addUserBtn.addEventListener("click", () => {
    window.location.href = "/add-friend.html";
  });

  // Settings Button
  settingsBtn.addEventListener("click", () => {
    window.location.href = "/settings.html";
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login.html";
  });

  // Search
  searchInput.addEventListener("input", async () => {
    const query = searchInput.value.trim();
    if (!query) return loadUsers();

    try {
      const res = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Search failed");

      const results = await res.json();
      userList.innerHTML = "";

      results.forEach((user) => {
        const card = document.createElement("div");
        card.classList.add("user-card");
        card.innerHTML = `
          <div class="user-info">
            <strong>${user.username}</strong><br/>
            <span class="last-seen">Found user</span>
          </div>
        `;

        card.addEventListener("click", () => {
          window.location.href = `/chat.html?user=${user._id}`;
        });

        userList.appendChild(card);
      });
    } catch (err) {
      console.error("Search failed", err);
    }
  });

  // Initialize
  refreshUserData();
  loadUsers();

  // Restore dark mode
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }
});