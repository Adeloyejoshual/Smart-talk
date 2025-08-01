document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const searchBar = document.getElementById("searchBar");
  const userList = document.getElementById("userList");
  const addUserBtn = document.getElementById("addUserBtn");
  const addUserModal = document.getElementById("addUserModal");
  const cancelAddUser = document.getElementById("cancelAddUser");
  const saveAddUser = document.getElementById("saveAddUser");
  const newUserInput = document.getElementById("newUserInput");
  const settingsIcon = document.getElementById("settingsIcon");
  const settingsMenu = document.getElementById("settingsMenu");

  // Display logged-in username from localStorage
  const storedUser = JSON.parse(localStorage.getItem("user"));
  if (storedUser && storedUser.username) {
    usernameDisplay.textContent = storedUser.username;
  }

  // Fetch user list from server
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users/list");
      const data = await res.json();
      displayUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  // Show users
  const displayUsers = (users) => {
    userList.innerHTML = "";
    users.forEach((user) => {
      if (storedUser && storedUser._id === user._id) return;

      const card = document.createElement("div");
      card.classList.add("user-card");
      card.innerHTML = `
        <span>${user.username}</span>
        <button onclick="startChat('${user._id}', '${user.username}')">Chat</button>
      `;
      userList.appendChild(card);
    });
  };

  // Filter user list
  searchBar.addEventListener("input", async () => {
    const query = searchBar.value.toLowerCase();
    try {
      const res = await fetch(`/api/users/search?query=${query}`);
      const data = await res.json();
      displayUsers(data);
    } catch (err) {
      console.error("Search failed:", err);
    }
  });

  // Floating + button opens modal
  addUserBtn.addEventListener("click", () => {
    addUserModal.style.display = "block";
  });

  // Cancel add user modal
  cancelAddUser.addEventListener("click", () => {
    addUserModal.style.display = "none";
    newUserInput.value = "";
  });

  // Save new user (Add Friend)
  saveAddUser.addEventListener("click", async () => {
    const friendEmail = newUserInput.value.trim();
    if (!friendEmail) return;

    try {
      const res = await fetch("/api/users/add-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendEmail, userId: storedUser._id }),
      });

      const result = await res.json();
      if (res.ok) {
        alert("Friend added!");
        fetchUsers();
        addUserModal.style.display = "none";
        newUserInput.value = "";
      } else {
        alert(result.message || "Failed to add friend.");
      }
    } catch (err) {
      console.error("Error adding friend:", err);
    }
  });

  // Settings icon toggle
  settingsIcon.addEventListener("click", () => {
    settingsMenu.style.display =
      settingsMenu.style.display === "block" ? "none" : "block";
  });

  // Start private chat
  window.startChat = (userId, username) => {
    localStorage.setItem("chatUser", JSON.stringify({ userId, username }));
    window.location.href = "/chat.html";
  };

  fetchUsers();
});