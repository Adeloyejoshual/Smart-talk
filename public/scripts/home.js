document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const userList = document.getElementById("userList");
  const searchBar = document.getElementById("searchBar");
  const addUserBtn = document.getElementById("addUserBtn");
  const addUserModal = document.getElementById("addUserModal");
  const addFriendBtn = document.getElementById("addFriendBtn");
  const cancelAdd = document.getElementById("cancelAdd");
  const friendIdentifierInput = document.getElementById("friendIdentifierInput");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsPanel = document.getElementById("settingsPanel");
  const closeSettings = document.getElementById("closeSettings");

  const username = localStorage.getItem("username");
  const userId = localStorage.getItem("userId");

  if (usernameDisplay && username) {
    usernameDisplay.textContent = `Welcome, ${username}`;
  }

  // Fetch users
  async function fetchUsers() {
    const res = await fetch("/api/users/list");
    const data = await res.json();
    userList.innerHTML = "";

    data.forEach((user) => {
      if (user._id !== userId) {
        const card = document.createElement("div");
        card.className = "user-card";
        card.textContent = user.username;
        card.addEventListener("click", () => {
          window.location.href = `/chat.html?userId=${user._id}&username=${user.username}`;
        });
        userList.appendChild(card);
      }
    });
  }

  fetchUsers();

  // Search functionality
  searchBar.addEventListener("input", async () => {
    const query = searchBar.value.trim();
    const res = await fetch(`/api/users/search?query=${query}`);
    const data = await res.json();

    userList.innerHTML = "";

    data.forEach((user) => {
      if (user._id !== userId) {
        const card = document.createElement("div");
        card.className = "user-card";
        card.textContent = user.username;
        card.addEventListener("click", () => {
          window.location.href = `/chat.html?userId=${user._id}&username=${user.username}`;
        });
        userList.appendChild(card);
      }
    });
  });

  // Show Add Friend modal
  addUserBtn.addEventListener("click", () => {
    addUserModal.style.display = "flex";
  });

  // Hide Add Friend modal
  cancelAdd.addEventListener("click", () => {
    addUserModal.style.display = "none";
    friendIdentifierInput.value = "";
  });

  // Submit Add Friend
  addFriendBtn.addEventListener("click", async () => {
    const friendIdentifier = friendIdentifierInput.value.trim();
    if (!friendIdentifier || !userId) {
      return alert("Enter a username or email.");
    }

    const res = await fetch("/api/users/add-friend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, friendIdentifier })
    });

    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      addUserModal.style.display = "none";
      friendIdentifierInput.value = "";
    } else {
      alert(data.message || "Failed to add friend");
    }
  });

  // Settings toggle
  settingsBtn.addEventListener("click", () => {
    settingsPanel.style.display = "block";
  });

  closeSettings.addEventListener("click", () => {
    settingsPanel.style.display = "none";
  });
});