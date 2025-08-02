document.addEventListener("DOMContentLoaded", () => {
  const welcomeUser = document.getElementById("welcomeUser");
  const userList = document.getElementById("userList");
  const searchInput = document.getElementById("searchInput");
  const themeToggle = document.getElementById("themeToggle");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const addUserBtn = document.getElementById("addUserBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const backToHome = document.getElementById("backToHome");

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  if (!token || !user) {
    window.location.href = "/login.html";
    return;
  }

  welcomeUser.textContent = `Welcome, ${user.username}`;
  const socket = io();

  // === Load all users from server ===
  async function loadUsers() {
    try {
      const res = await fetch("/api/users/list", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const users = await res.json();
      userList.innerHTML = "";

      users.forEach((u) => {
        if (u._id === user._id || u.blocked) return;

        const userCard = document.createElement("div");
        userCard.className = "user-card";
        userCard.innerHTML = `
          <span>${u.username}</span>
          <small>${u.email}</small>
        `;

        userCard.addEventListener("click", () => {
          localStorage.setItem("receiverId", u._id);
          localStorage.setItem("receiverUsername", u.username);
          window.location.href = "/chat.html";
        });

        userList.appendChild(userCard);
      });
    } catch (err) {
      console.error("Error loading users:", err);
      alert("Session expired. Please log in again.");
      localStorage.clear();
      window.location.href = "/login.html";
    }
  }

  // === User search ===
  searchInput.addEventListener("input", async (e) => {
    const keyword = e.target.value.trim();
    if (keyword === "") return loadUsers();

    try {
      const res = await fetch(`/api/users/search?query=${keyword}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      userList.innerHTML = "";

      result.forEach((u) => {
        if (u._id === user._id || u.blocked) return;

        const userCard = document.createElement("div");
        userCard.className = "user-card";
        userCard.innerHTML = `
          <span>${u.username}</span>
          <small>${u.email}</small>
        `;

        userCard.addEventListener("click", () => {
          localStorage.setItem("receiverId", u._id);
          localStorage.setItem("receiverUsername", u.username);
          window.location.href = "/chat.html";
        });

        userList.appendChild(userCard);
      });
    } catch (err) {
      console.error("Search failed:", err);
    }
  });

  // === Toggle dark/light theme ===
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    html.setAttribute("data-theme", isDark ? "light" : "dark");
    themeToggle.innerHTML = `<i class="fas fa-${isDark ? "moon" : "sun"}"></i>`;
  });

  // === Open/close settings panel ===
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.remove("hidden");
  });

  backToHome.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
  });

  // === Logout and clear session ===
  logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login.html";
  });

  // === Add new user click event ===
  addUserBtn.addEventListener("click", () => {
    alert("Feature: Add New User (not implemented yet).");
  });

  // Initial load
  loadUsers();
});