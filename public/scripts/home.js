document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const userList = document.getElementById("user-list");
  const floatingBtn = document.getElementById("floating-add-btn");

  // Modal elements
  const modal = document.getElementById("addFriendModal");
  const closeBtn = document.querySelector(".close");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");

  if (!token) {
    alert("Please log in first.");
    window.location.href = "/login.html";
    return;
  }

  // 🔹 Load all users (friend suggestions)
  async function loadUsers() {
    try {
      const res = await fetch("/api/users/list", {
        headers: { "Authorization": `Bearer ${token}` }
      });

      const users = await res.json();
      userList.innerHTML = "";

      users.forEach(user => {
        const div = document.createElement("div");
        div.classList.add("user-card");
        div.innerHTML = `
          <p><strong>${user.username}</strong> (${user.email})</p>
          <button class="add-friend-btn" data-id="${user._id}">➕ Add Friend</button>
        `;
        userList.appendChild(div);
      });
    } catch (err) {
      console.error("Error loading users:", err);
    }
  }

  await loadUsers();

  // 🔹 Handle Add Friend click inside user list
  document.body.addEventListener("click", async (e) => {
    if (e.target.classList.contains("add-friend-btn")) {
      const friendId = e.target.getAttribute("data-id");
      await addFriend(friendId, e.target);
    }
  });

  // 🔹 Floating Button → open modal
  floatingBtn.addEventListener("click", () => {
    modal.style.display = "block";
    searchInput.value = "";
    searchResults.innerHTML = "";
  });

  // 🔹 Close modal
  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  // 🔹 Search users
  searchInput.addEventListener("input", async () => {
    const query = searchInput.value.trim();
    if (!query) {
      searchResults.innerHTML = "";
      return;
    }

    try {
      const res = await fetch(`/api/users/search?q=${query}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      const users = await res.json();
      searchResults.innerHTML = "";

      if (users.length === 0) {
        searchResults.innerHTML = "<p>No users found</p>";
      }

      users.forEach(user => {
        const div = document.createElement("div");
        div.classList.add("user-card");
        div.innerHTML = `
          <p><strong>${user.username}</strong> (${user.email})</p>
          <button class="add-friend-btn" data-id="${user._id}">➕ Add Friend</button>
        `;
        searchResults.appendChild(div);
      });
    } catch (err) {
      console.error("Search error:", err);
    }
  });

  // 🔹 Add friend function
  async function addFriend(friendId, button) {
    try {
      const res = await fetch(`/api/users/add-friend/${friendId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok) {
        alert("Friend added ✅");
        if (button) {
          button.disabled = true;
          button.textContent = "✔️ Added";
        }
      } else {
        alert(data.message || "Failed to add friend ❌");
      }
    } catch (err) {
      console.error("Error adding friend:", err);
    }
  }
});