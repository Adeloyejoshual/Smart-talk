document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const userList = document.getElementById("user-list");
  const floatingBtn = document.getElementById("floating-add-btn");

  if (!token) {
    alert("Please log in first.");
    window.location.href = "/login.html";
    return;
  }

  // 🔹 Load all users (except logged-in user)
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

  // 🔹 Handle Add Friend button inside user list
  document.body.addEventListener("click", async (e) => {
    if (e.target.classList.contains("add-friend-btn")) {
      const friendId = e.target.getAttribute("data-id");

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
          console.log("Updated friends:", data.friends);
        } else {
          alert(data.message || "Failed to add friend ❌");
        }
      } catch (err) {
        console.error("Error adding friend:", err);
      }
    }
  });

  // 🔹 Floating Button → reload user list
  floatingBtn.addEventListener("click", async () => {
    alert("Refreshing user list...");
    await loadUsers();
  });
});