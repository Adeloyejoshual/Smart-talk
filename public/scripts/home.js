document.addEventListener("DOMContentLoaded", () => {
  const welcomeUser = document.getElementById("username");
  const searchInput = document.getElementById("searchInput");
  const userList = document.getElementById("userList");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const closeModal = document.querySelector(".close");
  const logoutBtn = document.getElementById("logoutBtn");
  const addUserBtn = document.getElementById("addUserBtn");

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  if (!token || !user) {
    window.location.href = "/login.html";
    return;
  }

  welcomeUser.textContent = user.username;

  // Fetch users
  const loadUsers = async (query = "") => {
    try {
      const res = await fetch(`/api/users/${query ? "search?q=" + query : "list"}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to load users");

      displayUsers(data);
    } catch (err) {
      console.error("Error loading users:", err);
      userList.innerHTML = "<p class='error'>Could not load users.</p>";
    }
  };

  // Display users
  const displayUsers = (users) => {
    userList.innerHTML = "";

    users.forEach((u) => {
      if (u._id === user._id) return; // skip self

      const userCard = document.createElement("div");
      userCard.className = "user-card";
      userCard.innerHTML = `
        <strong>${u.username}</strong>
        <p>${u.email}</p>
      `;

      userCard.addEventListener("click", () => {
        localStorage.setItem("receiverId", u._id);
        localStorage.setItem("receiverUsername", u.username);
        window.location.href = "/chat.html";
      });

      userList.appendChild(userCard);
    });
  };

  // Search input
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    loadUsers(query);
  });

  // Settings modal
  settingsBtn.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
  });

  closeModal.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });

  window.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add("hidden");
    }
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login.html";
  });

  // Add new user
  addUserBtn.addEventListener("click", () => {
    alert("Feature coming soon: Add New User!");
    // Or redirect to user registration/profile edit page
    // window.location.href = "/add-user.html";
  });

  // Initial load
  loadUsers();
});