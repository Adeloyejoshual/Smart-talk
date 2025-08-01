document.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const userList = document.getElementById("userList");
  const addFriendBtn = document.getElementById("addFriendBtn");
  const addUserModal = document.getElementById("addUserModal");
  const addUserInput = document.getElementById("addUserInput");
  const addUserConfirm = document.getElementById("addUserConfirm");
  const addUserCancel = document.getElementById("addUserCancel");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsMenu = document.getElementById("settingsMenu");

  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  if (!token || !userId) {
    return (window.location.href = "/login.html");
  }

  // Display username
  try {
    const res = await fetch(`/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.username) {
      usernameDisplay.textContent = data.username;
    }
  } catch (err) {
    console.error("Failed to fetch user info", err);
  }

  // Load friends list
  async function loadFriends() {
    try {
      const res = await fetch(`/api/users/friends/${userId}`);
      const data = await res.json();
      userList.innerHTML = "";
      data.friends.forEach((friend) => {
        const li = document.createElement("li");
        li.textContent = friend.username;
        li.className = "friend-item";
        li.addEventListener("click", () => {
          window.location.href = `/chat.html?user=${friend._id}`;
        });
        userList.appendChild(li);
      });
    } catch (err) {
      console.error("Error loading friends", err);
    }
  }

  loadFriends();

  // Open modal to add friend
  addFriendBtn.addEventListener("click", () => {
    addUserModal.style.display = "flex";
  });

  addUserCancel.addEventListener("click", () => {
    addUserModal.style.display = "none";
    addUserInput.value = "";
  });

  // Confirm adding friend
  addUserConfirm.addEventListener("click", async () => {
    const friendIdentifier = addUserInput.value.trim();
    if (!friendIdentifier) return alert("Please enter a username or email.");

    try {
      const res = await fetch("/api/users/add-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, friendIdentifier }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message || "Friend added!");
        addUserModal.style.display = "none";
        addUserInput.value = "";
        loadFriends(); // Refresh friend list
      } else {
        alert(data.message || "Failed to add friend");
      }
    } catch (err) {
      console.error("Error adding friend", err);
      alert("Something went wrong");
    }
  });

  // Settings toggle
  settingsBtn.addEventListener("click", () => {
    settingsMenu.style.display =
      settingsMenu.style.display === "flex" ? "none" : "flex";
  });

  // Close settings on click outside
  document.addEventListener("click", (e) => {
    if (
      !settingsMenu.contains(e.target) &&
      e.target !== settingsBtn &&
      e.target.closest("#settingsBtn") == null
    ) {
      settingsMenu.style.display = "none";
    }
  });
});