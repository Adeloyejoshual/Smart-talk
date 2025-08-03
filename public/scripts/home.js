document.addEventListener("DOMContentLoaded", () => {
  const welcomeUser = document.getElementById("welcomeUser");
  const userList = document.getElementById("userList");
  const searchInput = document.getElementById("searchInput");
  const themeToggle = document.getElementById("themeToggle");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const logoutBtn = document.getElementById("logoutBtn");
  const backToHome = document.getElementById("backToHome");

  const token = localStorage.getItem("token");
  if (!token) return (window.location.href = "/login.html");

  const headers = { Authorization: `Bearer ${token}` };

  async function refreshUserData() {
    try {
      const res = await fetch("/api/users/me", { headers });
      const user = await res.json();
      localStorage.setItem("user", JSON.stringify(user));
      welcomeUser.textContent = `Welcome, ${user.username}`;
      return user;
    } catch (err) {
      console.error("User fetch failed");
      localStorage.clear();
      window.location.href = "/login.html";
    }
  }

  async function loadFriends(user) {
    try {
      const res = await fetch("/api/users/friends", { headers });
      const friends = await res.json();
      userList.innerHTML = "";

      friends.forEach(friend => {
        const userCard = document.createElement("div");
        userCard.className = "user-card";

        userCard.innerHTML = `
          <div class="user-info">
            <span>${friend.username}</span>
            <small>${friend.email}</small>
          </div>
          <div class="user-actions">
            <button class="chat-btn">Chat</button>
            <button class="friend-btn">Remove Friend</button>
          </div>
        `;

        userCard.querySelector(".chat-btn").addEventListener("click", () => {
          localStorage.setItem("receiverId", friend._id);
          localStorage.setItem("receiverUsername", friend.username);
          window.location.href = "/chat.html";
        });

        userCard.querySelector(".friend-btn").addEventListener("click", async () => {
          await fetch(`/api/users/remove-friend/${friend._id}`, {
            method: "POST",
            headers,
          });
          const updatedUser = await refreshUserData();
          loadFriends(updatedUser);
        });

        userList.appendChild(userCard);
      });
    } catch (err) {
      console.error("Failed to load friends:", err);
    }
  }

  // Theme toggle
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    html.setAttribute("data-theme", isDark ? "light" : "dark");
    themeToggle.innerHTML = `<i class="fas fa-${isDark ? "moon" : "sun"}"></i>`;
  });

  // Settings
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.remove("hidden");
  });

  backToHome.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login.html";
  });

  // INIT
  refreshUserData().then(user => {
    if (user) loadFriends(user);
  });

  // Search (optional: only search among friends if needed)
  searchInput.addEventListener("input", async (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    const user = JSON.parse(localStorage.getItem("user"));
    if (!keyword) return loadFriends(user);

    const res = await fetch("/api/users/friends", { headers });
    const friends = await res.json();

    const filtered = friends.filter(friend =>
      friend.username.toLowerCase().includes(keyword) ||
      friend.email.toLowerCase().includes(keyword)
    );

    userList.innerHTML = "";

    filtered.forEach(friend => {
      const userCard = document.createElement("div");
      userCard.className = "user-card";

      userCard.innerHTML = `
        <div class="user-info">
          <span>${friend.username}</span>
          <small>${friend.email}</small>
        </div>
        <div class="user-actions">
          <button class="chat-btn">Chat</button>
          <button class="friend-btn">Remove Friend</button>
        </div>
      `;

      userCard.querySelector(".chat-btn").addEventListener("click", () => {
        localStorage.setItem("receiverId", friend._id);
        localStorage.setItem("receiverUsername", friend.username);
        window.location.href = "/chat.html";
      });

      userCard.querySelector(".friend-btn").addEventListener("click", async () => {
        await fetch(`/api/users/remove-friend/${friend._id}`, {
          method: "POST",
          headers,
        });
        const updatedUser = await refreshUserData();
        loadFriends(updatedUser);
      });

      userList.appendChild(userCard);
    });
  });
});