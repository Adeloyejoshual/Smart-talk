document.addEventListener("DOMContentLoaded", async () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const searchBar = document.getElementById("searchBar");
  const userList = document.getElementById("userList");
  const addUserBtn = document.getElementById("addUserBtn");
  const addUserModal = document.getElementById("addUserModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const addUserForm = document.getElementById("addUserForm");
  const friendsList = document.getElementById("userList");

  const token = localStorage.getItem("token");

  if (!token) {
    return (window.location.href = "/login.html");
  }

  // Load username
  try {
    const res = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    usernameDisplay.textContent = data.username || data.email;
  } catch (err) {
    console.error("Error loading user:", err);
  }

  // Fetch and display friends
  async function loadFriends() {
    try {
      const res = await fetch("/api/users/list", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      friendsList.innerHTML = ""; // Clear existing list

      if (!data.friends || data.friends.length === 0) {
        friendsList.innerHTML = "<p>No friends yet.</p>";
        return;
      }

      data.friends.forEach((friend) => {
        const div = document.createElement("div");
        div.className = "friend-item";
        div.dataset.id = friend._id;
        div.dataset.username = friend.username;

        div.innerHTML = `
          <div class="avatar"></div>
          <div class="info">
            <div class="username">${friend.username}</div>
            <div class="start-chat">Tap to chat</div>
          </div>
        `;

        // ✅ Add working click listener to redirect to chat
        div.addEventListener("click", () => {
          window.location.href = `/chat.html?user=${friend._id}`;
        });

        friendsList.appendChild(div);
      });
    } catch (err) {
      console.error("Failed to load friends:", err);
    }
  }

  loadFriends();

  // Search users
  searchBar.addEventListener("input", async (e) => {
    const query = e.target.value.trim();
    if (query === "") return loadFriends();

    try {
      const res = await fetch(`/api/users/search?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const users = await res.json();

      friendsList.innerHTML = "";

      if (users.length === 0) {
        friendsList.innerHTML = "<p>No users found.</p>";
        return;
      }

      users.forEach((user) => {
        const div = document.createElement("div");
        div.className = "friend-item";
        div.dataset.id = user._id;
        div.dataset.username = user.username;

        div.innerHTML = `
          <div class="avatar"></div>
          <div class="info">
            <div class="username">${user.username}</div>
            <div class="start-chat">Tap to add</div>
          </div>
        `;

        div.addEventListener("click", async () => {
          try {
            const res = await fetch("/api/users/add", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ friendId: user._id }),
            });

            if (res.ok) {
              alert("Friend added!");
              loadFriends();
            } else {
              const errData = await res.json();
              alert(errData.message || "Failed to add friend.");
            }
          } catch (err) {
            console.error("Error adding friend:", err);
          }
        });

        friendsList.appendChild(div);
      });
    } catch (err) {
      console.error("Error searching:", err);
    }
  });

  // Add new user modal
  addUserBtn.addEventListener("click", () => {
    addUserModal.style.display = "block";
  });

  closeModalBtn.addEventListener("click", () => {
    addUserModal.style.display = "none";
  });

  // Submit add user form
  addUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = e.target.elements.identifier.value;

    try {
      const res = await fetch("/api/users/search?q=" + identifier, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const users = await res.json();
      if (!users || users.length === 0) {
        alert("User not found.");
        return;
      }

      const friend = users[0];
      const addRes = await fetch("/api/users/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendId: friend._id }),
      });

      if (addRes.ok) {
        alert("Friend added successfully");
        loadFriends();
        addUserModal.style.display = "none";
      } else {
        const error = await addRes.json();
        alert(error.message || "Failed to add friend.");
      }
    } catch (err) {
      console.error("Add friend error:", err);
    }
  });
});