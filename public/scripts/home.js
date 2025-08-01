document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const userList = document.getElementById("userList");
  const addUserBtn = document.getElementById("addUserBtn");
  const addUserModal = document.getElementById("addUserModal");
  const closeModal = document.getElementById("closeModal");
  const searchBar = document.getElementById("searchBar");
  const searchResults = document.getElementById("searchResults");
  const logoutBtn = document.getElementById("logoutBtn");
  const settingsIcon = document.getElementById("settingsIcon");

  const token = localStorage.getItem("token");
  if (!token) {
    return (window.location.href = "/login.html");
  }

  // Load profile
  fetch("/api/users/profile", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => res.json())
    .then((data) => {
      usernameDisplay.textContent = data.username || "Unknown";
      loadFriends(data.friends);
    });

  // Load friend list
  function loadFriends(friendIds) {
    userList.innerHTML = "";

    friendIds.forEach((friendId) => {
      fetch(`/api/users/${friendId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((friend) => {
          const li = document.createElement("li");
          li.className = "user-card";
          li.innerHTML = `
            <div>
              <strong>${friend.username}</strong><br>
              <small>${friend.email}</small>
            </div>
            <div>
              <button class="chatBtn" data-id="${friend._id}">Chat</button>
              <button class="removeBtn" data-id="${friend._id}">Remove</button>
            </div>
          `;
          userList.appendChild(li);
        });
    });
  }

  // Handle logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/login.html";
  });

  // Settings icon navigation
  settingsIcon.addEventListener("click", () => {
    window.location.href = "/settings.html";
  });

  // Show add user modal
  addUserBtn.addEventListener("click", () => {
    addUserModal.style.display = "block";
    searchBar.value = "";
    searchResults.innerHTML = "";
  });

  closeModal.addEventListener("click", () => {
    addUserModal.style.display = "none";
  });

  // Search user
  searchBar.addEventListener("input", () => {
    const query = searchBar.value.trim();
    if (query.length === 0) {
      searchResults.innerHTML = "";
      return;
    }

    fetch(`/api/users/search?q=${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((results) => {
        searchResults.innerHTML = "";
        results.forEach((user) => {
          const li = document.createElement("li");
          li.className = "user-card";
          li.innerHTML = `
            <div>
              <strong>${user.username}</strong><br>
              <small>${user.email}</small>
            </div>
            <button class="addBtn" data-id="${user._id}">Add</button>
          `;
          searchResults.appendChild(li);
        });
      });
  });

  // Add friend
  searchResults.addEventListener("click", (e) => {
    if (e.target.classList.contains("addBtn")) {
      const friendId = e.target.dataset.id;
      fetch("/api/users/add-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendId }),
      })
        .then((res) => res.json())
        .then(() => location.reload());
    }
  });

  // Remove friend
  userList.addEventListener("click", (e) => {
    if (e.target.classList.contains("removeBtn")) {
      const friendId = e.target.dataset.id;
      fetch("/api/users/remove-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendId }),
      })
        .then((res) => res.json())
        .then(() => location.reload());
    }

    // Start private chat
    if (e.target.classList.contains("chatBtn")) {
      const receiverId = e.target.dataset.id;
      localStorage.setItem("receiverId", receiverId);
      window.location.href = "/chat.html";
    }
  });
});