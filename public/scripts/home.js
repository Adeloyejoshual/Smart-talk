// public/scripts/home.js
document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const searchBar = document.getElementById("searchBar");
  const userList = document.getElementById("userList");
  const settingsButton = document.getElementById("settingsButton");
  const addUserBtn = document.getElementById("addUserBtn");

  // Show logged-in username from localStorage
  const currentUser = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  usernameDisplay.textContent = currentUser;

  // Fetch user list
  async function fetchUsers(query = "") {
    try {
      const response = await fetch(`/api/users/list?search=${query}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const users = await response.json();

      userList.innerHTML = "";

      users.forEach(user => {
        if (user.username !== currentUser) {
          const li = document.createElement("li");
          li.textContent = user.username;
          li.className = "user-card";
          li.addEventListener("click", () => {
            localStorage.setItem("chatWith", user.username);
            localStorage.setItem("chatWithId", user._id);
            window.location.href = "/chat.html";
          });
          userList.appendChild(li);
        }
      });

    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }

  // Initial fetch
  fetchUsers();

  // Search bar logic
  searchBar.addEventListener("input", (e) => {
    const query = e.target.value.trim();
    fetchUsers(query);
  });

  // Add new user
  addUserBtn.addEventListener("click", () => {
    const email = prompt("Enter the email of the user to add:");
    if (!email) return;

    fetch("/api/users/add-friend", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ email })
    })
    .then(res => res.json())
    .then(data => {
      alert(data.message || "User added!");
      fetchUsers(); // Refresh user list
    })
    .catch(err => console.error("Error adding user:", err));
  });

  // Go to settings
  settingsButton.addEventListener("click", () => {
    window.location.href = "/settings.html";
  });
});