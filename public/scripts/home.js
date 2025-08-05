document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) return (window.location.href = "/login.html");

  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const friendList = document.getElementById("friendList");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Load all friends
  async function loadFriends() {
    try {
      const res = await fetch("/api/users/list", { headers });
      const data = await res.json();
      friendList.innerHTML = "";

      data.forEach(user => {
        const li = document.createElement("li");
        li.innerHTML = `
          <div class="bg-white p-2 rounded shadow flex justify-between items-center">
            <span>${user.username} (${user.email})</span>
            <div>
              <button class="chatBtn text-green-600" data-id="${user._id}">💬</button>
              <button class="removeBtn text-red-600 ml-2" data-id="${user._id}">❌</button>
            </div>
          </div>
        `;
        friendList.appendChild(li);
      });
    } catch (err) {
      console.error("Failed to load friends:", err);
    }
  }

  // Handle search
  searchInput.addEventListener("input", async () => {
    const query = searchInput.value.trim();
    if (!query) return (searchResults.innerHTML = "");

    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { headers });
      const users = await res.json();
      searchResults.innerHTML = "";

      users.forEach(user => {
        const div = document.createElement("div");
        div.className = "bg-white p-2 rounded shadow flex justify-between items-center";
        div.innerHTML = `
          <span><strong>${user.username}</strong> (${user.email})</span>
          <button class="addBtn text-blue-500" data-id="${user._id}">➕ Add</button>
        `;
        searchResults.appendChild(div);
      });
    } catch (err) {
      console.error("Search failed:", err);
    }
  });

  // Add friend
  searchResults.addEventListener("click", async (e) => {
    if (e.target.classList.contains("addBtn")) {
      const friendId = e.target.dataset.id;
      try {
        await fetch("/api/users/add-friend", {
          method: "POST",
          headers,
          body: JSON.stringify({ friendId }),
        });
        searchInput.value = "";
        searchResults.innerHTML = "";
        loadFriends();
      } catch (err) {
        console.error("Add friend failed:", err);
      }
    }
  });

  // Remove friend
  friendList.addEventListener("click", async (e) => {
    if (e.target.classList.contains("removeBtn")) {
      const friendId = e.target.dataset.id;
      try {
        await fetch(`/api/users/remove-friend/${friendId}`, {
          method: "DELETE",
          headers,
        });
        loadFriends();
      } catch (err) {
        console.error("Remove friend failed:", err);
      }
    }
  });

  // Start private chat
  friendList.addEventListener("click", (e) => {
    if (e.target.classList.contains("chatBtn")) {
      const friendId = e.target.dataset.id;
      localStorage.setItem("receiverId", friendId);
      window.location.href = "/chat.html";
    }
  });

  // Open settings modal
  document.getElementById("settingsBtn").onclick = () => {
    document.getElementById("settingsModal").classList.remove("hidden");
  };

  // Close settings modal
  document.getElementById("closeSettings").onclick = () => {
    document.getElementById("settingsModal").classList.add("hidden");
  };

  // Toggle theme
  document.getElementById("themeToggle").onclick = () => {
    document.documentElement.dataset.theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  };

  // Logout
  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login.html";
  };

  // Initial load
  loadFriends();
});