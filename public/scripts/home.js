document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const searchBar = document.getElementById("searchBar");
  const userList = document.getElementById("userList");
  const addUserBtn = document.getElementById("addUserBtn");
  const addUserModal = document.getElementById("addUserModal");
  const closeModal = document.getElementById("closeModal");
  const addFriendButton = document.getElementById("addFriendButton");
  const newFriendEmail = document.getElementById("newFriendEmail");

  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  if (usernameDisplay) {
    usernameDisplay.textContent = username || "Guest";
  }

  // 🔍 Search users
  if (searchBar) {
    searchBar.addEventListener("input", async () => {
      const query = searchBar.value.trim();
      if (query.length === 0) return (userList.innerHTML = "");

      try {
        const res = await fetch(`/api/users/search?query=${query}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        userList.innerHTML = "";

        data.forEach((user) => {
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

        document.querySelectorAll(".startChat").forEach((btn) => {
          btn.addEventListener("click", () => {
            const friendId = btn.getAttribute("data-id");
            localStorage.setItem("chatWith", friendId);
            window.location.href = "/chat.html";
          });
        });
      } catch (err) {
        console.error("Search error:", err);
        alert("Error searching users.");
      }
    });
  }

  // ➕ Open Add Friend Modal
  addUserBtn?.addEventListener("click", () => {
    addUserModal.style.display = "block";
  });

  // ❌ Close Add Friend Modal
  closeModal?.addEventListener("click", () => {
    addUserModal.style.display = "none";
  });

  // ✅ Add Friend
  addFriendButton?.addEventListener("click", async () => {
    const email = newFriendEmail.value.trim();
    if (!email) return alert("Please enter a valid email.");

    try {
      const res = await fetch("/api/users/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("Friend added successfully!");
        newFriendEmail.value = "";
        addUserModal.style.display = "none";
      } else {
        alert(data.message || "Failed to add friend.");
      }
    } catch (err) {
      console.error("Add friend error:", err);
      alert("Failed to connect to the server.");
    }
  });
});