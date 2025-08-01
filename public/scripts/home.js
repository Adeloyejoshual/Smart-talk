document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const userList = document.getElementById("userList");
  const searchBar = document.getElementById("searchBar");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsMenu = document.getElementById("settingsMenu");
  const addUserBtn = document.getElementById("addUserBtn");

  // Show settings on click
  settingsBtn.addEventListener("click", () => {
    settingsMenu.classList.toggle("hidden");
  });

  // Fetch current user info
  fetch("/api/users/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  })
    .then((res) => res.json())
    .then((data) => {
      usernameDisplay.textContent = `Welcome, ${data.username}`;
    })
    .catch((err) => {
      console.error("Error fetching user:", err);
      window.location.href = "/login.html"; // redirect to login if error
    });

  // Search users
  searchBar.addEventListener("input", () => {
    const query = searchBar.value.trim();
    if (query.length === 0) {
      userList.innerHTML = "";
      return;
    }

    fetch(`/api/users/search?q=${query}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    })
      .then((res) => res.json())
      .then((users) => {
        userList.innerHTML = "";
        users.forEach((user) => {
          const li = document.createElement("li");
          li.textContent = user.username;
          li.classList.add("user-item");
          li.addEventListener("click", () => {
            window.location.href = `/chat.html?user=${user._id}`;
          });
          userList.appendChild(li);
        });
      })
      .catch((err) => {
        console.error("Search error:", err);
      });
  });

  // Add new user - Floating +
  addUserBtn.addEventListener("click", () => {
    alert("Feature coming soon: Add New User or Friend.");
  });
});