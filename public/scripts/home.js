document.addEventListener("DOMContentLoaded", () => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const searchBar = document.getElementById("searchBar");
  const userList = document.getElementById("userList");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsSection = document.getElementById("settingsSection");

  // Load username from localStorage or session
  const username = localStorage.getItem("username");
  if (username) {
    usernameDisplay.textContent = username;
  }

  // Toggle settings
  settingsBtn.addEventListener("click", () => {
    settingsSection.classList.toggle("show");
  });

  // Hide settings if clicked outside
  document.addEventListener("click", (e) => {
    if (!settingsBtn.contains(e.target) && !settingsSection.contains(e.target)) {
      settingsSection.classList.remove("show");
    }
  });

  // Load users
  async function loadUsers() {
    const res = await fetch("/api/users/list");
    const users = await res.json();
    displayUsers(users);
  }

  function displayUsers(users) {
    userList.innerHTML = "";
    users.forEach(user => {
      if (user.username !== username) {
        const li = document.createElement("li");
        li.textContent = user.username;
        li.style.padding = "10px";
        li.style.borderBottom = "1px solid #333";
        li.style.cursor = "pointer";
        li.addEventListener("click", () => {
          window.location.href = `/chat.html?to=${user.username}`;
        });
        userList.appendChild(li);
      }
    });
  }

  searchBar.addEventListener("input", async () => {
    const term = searchBar.value.trim();
    const res = await fetch(`/api/users/search?term=${term}`);
    const users = await res.json();
    displayUsers(users);
  });

  loadUsers();
});