document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const searchBar = document.getElementById("searchBar");
  const userList = document.getElementById("userList");
  const addUserBtn = document.getElementById("addUserBtn");
  const addUserModal = document.getElementById("addUserModal");
  const closeAddUserModal = document.getElementById("closeAddUserModal");
  const addFriendInput = document.getElementById("addFriendInput");
  const addFriendBtn = document.getElementById("add");

  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username");

  if (usernameDisplay) usernameDisplay.textContent = username || "Guest";

  // Search bar input
  if (searchBar) {
    searchBar.addEventListener("input", async () => {
      const query = searchBar.value.trim();
      if (query.length === 0) return (userList.innerHTML = "");

      const res = await fetch(`/api/users/search?query=${query}`);
      const data = await res.json();
      userList.innerHTML = "";

      data.forEach(user => {
        const item = document.createElement("div");
        item.className = "user-card";
        item.innerHTML = `
          <div>
            <strong>${user.username}</strong><br>
            <small>${user.email}</small>
          </div>
          <button class="startChat" data-id="${user._id}">Chat</button>
        `;
        userList.appendChild(item);
      });

      document.querySelectorAll(".startChat").forEach(btn => {
        btn.addEventListener("click", () => {
          const friendId = btn.getAttribute("data-id");
          localStorage.setItem("chatWith", friendId);
          window.location.href = "/chat.html";
        });
      });
    });
  }

  // Open Add Friend Modal
  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      addUserModal.style.display = "flex";
    });
  }

  // Close Add Friend Modal
  if (closeAddUserModal) {
    closeAddUserModal.addEventListener("click", () => {
      addUserModal.style.display = "none";
    });
  }

  // Add Friend
  if (addFriendBtn) {
    addFriendBtn.addEventListener("click", async () => {
      const friendIdentifier = addFriendInput.value.trim();
      if (!friendIdentifier) return alert("Enter a valid email or username");

      const res = await fetch("/api/users/add-friend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, friendIdentifier }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        addUserModal.style.display = "none";
        addFriendInput.value = "";
      } else {
        alert(data.message || "Failed to add friend");
      }
    });
  }
});