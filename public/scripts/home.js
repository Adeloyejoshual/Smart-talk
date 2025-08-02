document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  if (!token || !user) {
    window.location.href = "/login.html";
    return;
  }

  const socket = io();

  // DOM Elements
  const welcomeUser = document.getElementById("welcomeUser");
  const themeToggle = document.getElementById("themeToggle");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const closeSettings = document.getElementById("closeSettings");
  const logoutBtn = document.getElementById("logoutBtn");
  const addUserBtn = document.getElementById("addUserBtn");
  const userList = document.getElementById("userList");
  const searchBar = document.getElementById("searchBar");

  // Show username
  welcomeUser.textContent = `Welcome, ${user.username}`;

  // Theme toggle
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
  });

  // Settings modal
  settingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "block";
  });

  closeSettings.addEventListener("click", () => {
    settingsModal.style.display = "none";
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login.html";
  });

  // Add User button
  addUserBtn.addEventListener("click", () => {
    alert("Add User feature coming soon.");
  });

  // Fetch and display all users
  const loadUsers = async (query = "") => {
    try {
      const res = await fetch(`/api/users/search?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      userList.innerHTML = "";

      if (data.length === 0) {
        userList.innerHTML = "<li>No users found.</li>";
        return;
      }

      data.forEach((u) => {
        if (u._id !== user._id) {
          const li = document.createElement("li");
          li.textContent = u.username;
          li.addEventListener("click", () => {
            localStorage.setItem("receiverId", u._id);
            localStorage.setItem("receiverUsername", u.username);
            window.location.href = "/chat.html";
          });
          userList.appendChild(li);
        }
      });
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  loadUsers();

  // Search users
  searchBar.addEventListener("input", (e) => {
    loadUsers(e.target.value.trim());
  });

  // Disconnect on exit
  window.addEventListener("beforeunload", () => {
    socket.disconnect();
  });
}););