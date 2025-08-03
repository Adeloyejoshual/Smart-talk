document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const friendList = document.getElementById("friendList");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Load friend list
  async function loadFriends() {
    try {
      const res = await fetch("/api/users/list", { headers });
      const data = await res.json();
      friendList.innerHTML = "";

      data.forEach(user => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span>${user.username} (${user.email})</span>
          <button class="chatBtn" data-id="${user._id}">💬</button>
          <button class="removeBtn" data-id="${user._id}">❌</button>
        `;
        friendList.appendChild(li);
      });
    } catch (err) {
      console.error("Failed to load friends", err);
    }
  }

  // Handle user search
  searchInput.addEventListener("input", async () => {
    const query = searchInput.value.trim();
    if (!query) return (searchResults.innerHTML = "");

    const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      headers,
    });
    const data = await res.json();
    searchResults.innerHTML = "";

    data.forEach(user => {
      const div = document.createElement("div");
      div.innerHTML = `
        <strong>${user.username}</strong> (${user.email})
        <button class="addBtn" data-id="${user._id}">➕ Add</button>
      `;
      searchResults.appendChild(div);
    });
  });

  // Add friend
  searchResults.addEventListener("click", async (e) => {
    if (e.target.classList.contains("addBtn")) {
      const friendId = e.target.dataset.id;
      await fetch("/api/users/add-friend", {
        method: "POST",
        headers,
        body: JSON.stringify({ friendId }),
      });
      searchInput.value = "";
      searchResults.innerHTML = "";
      loadFriends();
    }
  });

  // Remove friend
  friendList.addEventListener("click", async (e) => {
    if (e.target.classList.contains("removeBtn")) {
      const friendId = e.target.dataset.id;
      await fetch(`/api/users/remove-friend/${friendId}`, {
        method: "DELETE",
        headers,
      });
      loadFriends();
    }
  });

  // Start private chat
  friendList.addEventListener("click", (e) => {
    if (e.target.classList.contains("chatBtn")) {
      const friendId = e.target.dataset.id;
      window.location.href = `/chat.html?user=${friendId}`;
    }
  });

  // Settings modal
  document.getElementById("settingsBtn").onclick = () => {
    document.getElementById("settingsModal").classList.remove("hidden");
  };
  document.getElementById("closeSettings").onclick = () => {
    document.getElementById("settingsModal").classList.add("hidden");
  };

  // Theme toggle
  document.getElementById("themeToggle").onclick = () => {
    document.documentElement.dataset.theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  };

  // Logout
  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("token");
    window.location.href = "/login.html";
  };

  // Load friends on start
  loadFriends();
});