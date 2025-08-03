const token = localStorage.getItem("token");
const username = localStorage.getItem("username");
const userDisplay = document.getElementById("welcomeUser");
const userList = document.getElementById("userList");
const themeToggle = document.getElementById("themeToggle");
const logoutBtn = document.getElementById("logoutBtn");
const addUserBtn = document.getElementById("addUserBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettings");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

if (!token || !username) {
  window.location.href = "/login.html";
} else {
  userDisplay.textContent = `Welcome, ${username}`;
  loadUsers();
}

themeToggle.addEventListener("click", () => {
  document.documentElement.toggleAttribute("data-theme");
});

logoutBtn.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/login.html";
});

addUserBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchResults.innerHTML = "";
  settingsModal.classList.remove("show");
  document.getElementById("searchModal").classList.add("show");
});

settingsBtn.addEventListener("click", () => {
  settingsModal.classList.toggle("show");
});

closeSettings.addEventListener("click", () => {
  settingsModal.classList.remove("show");
});

document.getElementById("closeSearch").addEventListener("click", () => {
  document.getElementById("searchModal").classList.remove("show");
});

// Load only friends (not all users)
async function loadUsers() {
  try {
    const res = await fetch("/api/users/friends", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const friends = await res.json();
    userList.innerHTML = "";

    friends.forEach((u) => {
      const userCard = document.createElement("div");
      userCard.className = "user-card";

      userCard.innerHTML = `
        <div class="user-info">
          <span>${u.username}</span>
          <small>${u.email}</small>
        </div>
        <div class="user-actions">
          <button class="chat-btn">Chat</button>
          <button class="friend-btn">Remove Friend</button>
        </div>
      `;

      // Start chat
      userCard.querySelector(".chat-btn").addEventListener("click", () => {
        localStorage.setItem("receiverId", u._id);
        localStorage.setItem("receiverUsername", u.username);
        window.location.href = "/chat.html";
      });

      // Remove friend
      userCard.querySelector(".friend-btn").addEventListener("click", async () => {
        try {
          await fetch(`/api/users/remove-friend/${u._id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          await refreshUserData();
          loadUsers();
        } catch (err) {
          console.error("Failed to remove friend:", err);
        }
      });

      userList.appendChild(userCard);
    });
  } catch (err) {
    console.error("Failed to load friends.");
    localStorage.clear();
    window.location.href = "/login.html";
  }
}

// Refresh current user data
async function refreshUserData() {
  const res = await fetch("/api/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  localStorage.setItem("username", data.username);
}

// Search functionality
searchInput.addEventListener("input", async () => {
  const query = searchInput.value.trim();
  if (query.length === 0) {
    searchResults.innerHTML = "";
    return;
  }

  const res = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const users = await res.json();
  searchResults.innerHTML = "";

  users.forEach((user) => {
    const resultCard = document.createElement("div");
    resultCard.className = "user-card";

    resultCard.innerHTML = `
      <div class="user-info">
        <span>${user.username}</span>
        <small>${user.email}</small>
      </div>
      <div class="user-actions">
        <button class="add-btn">Add Friend</button>
      </div>
    `;

    resultCard.querySelector(".add-btn").addEventListener("click", async () => {
      await fetch(`/api/users/add-friend/${user._id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshUserData();
      loadUsers();
      document.getElementById("searchModal").classList.remove("show");
    });

    searchResults.appendChild(resultCard);
  });
});