// public/scripts/home.js
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const userList = document.getElementById("userList");
  const welcomeUser = document.getElementById("welcomeUser");
  const settingsModal = document.getElementById("settingsModal");
  const settingsIcon = document.getElementById("settingsIcon");
  const addUserBtn = document.getElementById("addUserBtn");
  const searchInput = document.getElementById("searchInput");
  const themeToggle = document.getElementById("themeToggle");

  if (!token || !user) {
    alert("Unauthorized. Redirecting to login...");
    return (window.location.href = "/login.html");
  }

  welcomeUser.textContent = `Welcome, ${user.username}`;

  // Load user list
  function fetchUsers(query = "") {
    fetch(`/api/users/search?q=${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((users) => {
        userList.innerHTML = "";
        users.forEach((u) => {
          if (u._id !== user._id) {
            const li = document.createElement("li");
            li.textContent = u.username;
            li.classList.add("user-card");
            li.addEventListener("click", () => {
              localStorage.setItem("receiverId", u._id);
              localStorage.setItem("receiverUsername", u.username);
              window.location.href = "/chat.html";
            });
            userList.appendChild(li);
          }
        });
      });
  }

  fetchUsers();

  // Search
  searchInput.addEventListener("input", () => {
    fetchUsers(searchInput.value.trim());
  });

  // Settings modal toggle
  settingsIcon.addEventListener("click", () => {
    settingsModal.classList.toggle("hidden");
  });

  // Add user button
  addUserBtn.addEventListener("click", () => {
    alert("Add New User feature coming soon!");
  });

  // Theme toggle
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    if (html.getAttribute("data-theme") === "dark") {
      html.setAttribute("data-theme", "light");
    } else {
      html.setAttribute("data-theme", "dark");
    }
  });
});