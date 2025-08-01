document.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const searchBar = document.getElementById("searchBar");
  const userList = document.getElementById("userList");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsMenu = document.getElementById("settingsMenu");
  const toggleFriendsBtn = document.getElementById("toggleFriendsBtn");

  let allUsers = [];
  let currentUser = null;
  let showOnlyFriends = false;

  // Fetch current user
  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/users/me");
      if (!res.ok) throw new Error("Failed to fetch current user");
      const data = await res.json();
      currentUser = data;
      usernameDisplay.textContent = currentUser.username;
    } catch (err) {
      console.error("Error fetching user:", err);
      window.location.href = "/login.html"; // Redirect if not logged in
    }
  };

  // Fetch all users
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users/list");
      const data = await res.json();
      allUsers = data.filter(user => user._id !== currentUser._id);
      renderUserList();
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const renderUserList = () => {
    const keyword = searchBar.value.toLowerCase();
    userList.innerHTML = "";

    const usersToDisplay = showOnlyFriends
      ? allUsers.filter(user => currentUser.friends.includes(user._id))
      : allUsers;

    usersToDisplay.forEach(user => {
      if (!user.username.toLowerCase().includes(keyword)) return;

      const userCard = document.createElement("div");
      userCard.className = "user-card";
      userCard.innerHTML = `
        <span>${user.username}</span>
        <button class="chat-btn" data-id="${user._id}">Chat</button>
      `;

      userList.appendChild(userCard);
    });
  };

  // Toggle settings menu
  settingsBtn.addEventListener("click", () => {
    settingsMenu.classList.toggle("hidden");
  });

  // Filter friends toggle
  toggleFriendsBtn.addEventListener("click", () => {
    showOnlyFriends = !showOnlyFriends;
    toggleFriendsBtn.textContent = showOnlyFriends ? "Show All" : "My Friends";
    renderUserList();
  });

  // Handle chat button clicks
  userList.addEventListener("click", (e) => {
    if (e.target.classList.contains("chat-btn")) {
      const userId = e.target.dataset.id;
      window.location.href = `/chat.html?user=${userId}`;
    }
  });

  // Handle search bar input
  searchBar.addEventListener("input", () => {
    renderUserList();
  });

  // Load data
  await fetchCurrentUser();
  await fetchUsers();
});