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

  const socket = io();

  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  if (!user || !token) {
    return (window.location.href = "/login.html");
  }

  welcomeUser.textContent = `Welcome, ${user.username}`;

  // Theme toggle logic
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    html.setAttribute("data-theme", isDark ? "light" : "dark");
    themeToggle.innerHTML = `<i class="fas fa-${isDark ? "moon" : "sun"}"></i>`;
  });

  // Show settings panel
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.remove("hidden");
  });

  // Back to main view
  backToHome.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login.html";
  });

  // Add new user
  addUserBtn.addEventListener("click", () => {
    alert("This would open Add New User functionality.");
    // You can implement your modal or redirect here
  });

  // Fetch user list
  async function loadUsers() {
    try {
      const res = await fetch("/api/users/list", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const users = await res.json();

      userList.innerHTML = "";

      users.forEach((u) => {
        if (u._id === user._id || u.blocked) return; // Skip self or blocked
        const userCard = document.createElement("div");
        userCard.className = "user-card";
        userCard.textContent = u.username;
        userCard.addEventListener("click", () => {
          localStorage.setItem("receiverId", u._id);
          localStorage.setItem("receiverUsername", u.username);
          window.location.href = "/chat.html";
        });
        userList.appendChild(userCard);
      });
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }

  // Search users
  searchInput.addEventListener("input", async (e) => {
    const keyword = e.target.value.trim();

    if (keyword === "") return loadUsers();

    try {
      const res = await fetch(`/api/users/search?query=${keyword}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await res.json();
      userList.innerHTML = "";

      result.forEach((u) => {
        if (u._id === user._id || u.blocked) return;
        const userCard = document.createElement("div");
        userCard.className = "user-card";
        userCard.textContent = u.username;
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

  loadUsers();
});